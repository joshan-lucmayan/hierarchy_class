"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import { useFlorin } from "@/lib/florinStore";

export type ShopItemType = "background" | "avatar_border" | "profile_card";

export interface ShopItem {
  id: string;
  type: ShopItemType;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  accent: string | null;
}

interface ShopContextValue {
  items: ShopItem[];
  ownedIds: Set<string>;
  equipped: { background: ShopItem | null; avatarBorder: ShopItem | null; profileCard: ShopItem | null };
  loading: boolean;
  error: string | null;
  /** Returns an error message on failure, or null on success. */
  purchase: (item: ShopItem) => Promise<string | null>;
  /** Returns an error message on failure, or null on success. */
  equip: (item: ShopItem) => Promise<string | null>;
  unequip: (type: ShopItemType) => Promise<void>;
  /** The equipped background item, used by PageBackdrop. */
  equippedBackground: ShopItem | null;
  /** The equipped profile-card background item (self view on home/profile). */
  equippedProfileCard: ShopItem | null;
  /** Accent color another profile has equipped as an avatar border, if any. */
  decorColorOf: (profileId?: string | null) => string | undefined;
  /** The profile-card image another profile has equipped, if any. */
  profileCardOf: (profileId?: string | null) => string | undefined;
}

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useMyProfile();
  const { refetch: refetchFlorin } = useFlorin();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [equipped, setEquipped] = useState<{
    background: ShopItem | null;
    avatarBorder: ShopItem | null;
    profileCard: ShopItem | null;
  }>({ background: null, avatarBorder: null, profileCard: null });
  const [borderMap, setBorderMap] = useState<Record<string, string>>({});
  const [cardMap, setCardMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      setError("Supabase isn't configured yet.");
      return;
    }
    if (!profile) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    async function loadAll() {
      setLoading(true);

      const [{ data: itemRows }, { data: ownedRows }, { data: loadoutRow }, { data: borderRows }] =
        (await Promise.all([
          supabase.from("shop_items").select("*").eq("active", true).order("sort_order"),
          supabase
            .from("shop_ownership")
            .select("item_id")
            .eq("student_id", profile!.id),
          supabase
            .from("student_shop_loadout")
            .select("background_item_id, avatar_border_item_id, profile_card_item_id")
            .eq("student_id", profile!.id)
            .maybeSingle(),
          // School-wide loadouts (joined to the item for its accent/image) so
          // every user's decoration renders on other people's avatars and
          // profile cards.
          supabase
            .from("student_shop_loadout")
            .select(
              "student_id, border:shop_items!student_shop_loadout_avatar_border_item_id_fkey(accent), card:shop_items!student_shop_loadout_profile_card_item_id_fkey(image_url)"
            )
            .or("avatar_border_item_id.not.is.null,profile_card_item_id.not.is.null"),
        ])) as any[];

      if (cancelled) return;

      const catalog = ((itemRows ?? []) as any[]).map((r) => ({
        id: r.id,
        type: r.type,
        name: r.name,
        description: r.description,
        price: r.price,
        image_url: r.image_url,
        accent: r.accent,
      }));

      const owned = new Set<string>((ownedRows ?? []).map((r: any) => r.item_id));

      const loadout = (loadoutRow ?? null) as any;
      const resolve = (id: string | null | undefined) =>
        id ? catalog.find((i) => i.id === id) ?? null : null;

      const map: Record<string, string> = {};
      const cardMap: Record<string, string> = {};
      for (const row of borderRows ?? []) {
        const accent = row?.border?.accent;
        const cardUrl = row?.card?.image_url;
        if (row?.student_id) {
          if (accent) map[row.student_id] = accent;
          if (cardUrl) cardMap[row.student_id] = cardUrl;
        }
      }

      setItems(catalog);
      setOwnedIds(owned);
      setEquipped({
        background: resolve(loadout?.background_item_id),
        avatarBorder: resolve(loadout?.avatar_border_item_id),
        profileCard: resolve(loadout?.profile_card_item_id),
      });
      setBorderMap(map);
      setCardMap(cardMap);
      setError(null);
      setLoading(false);
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, profile, refetchTick]);

  const refetch = useCallback(() => setRefetchTick((t) => t + 1), []);

  // Keep owned/equipped state live across open tabs (migration 050 publishes
  // these tables to supabase_realtime).
  useEffect(() => {
    if (!supabaseConfigured || !profile) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`shop-ownership-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shop_ownership", filter: `student_id=eq.${profile.id}` },
        () => refetch()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_shop_loadout", filter: `student_id=eq.${profile.id}` },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabaseConfigured, profile, refetch]);

  const purchase = useCallback(
    async (item: ShopItem): Promise<string | null> => {
      if (!profile) return "You need to be signed in.";
      const supabase = createClient();
      const { data, error: rpcError } = (await (supabase as any).rpc("purchase_shop_item", {
        p_item_id: item.id,
      })) as any;

      if (rpcError || !data?.ok) {
        const reason = (data?.error as string) ?? "Couldn't complete the purchase.";
        if (reason === "insufficient_funds") {
          return "Not enough Florin. Earn more before buying this.";
        }
        if (reason === "already_owned") return "You already own this item.";
        return "Couldn't complete the purchase. Please try again.";
      }

      setOwnedIds((prev) => new Set(prev).add(item.id));
      refetchFlorin();
      return null;
    },
    [profile, refetchFlorin]
  );

  const equip = useCallback(
    async (item: ShopItem): Promise<string | null> => {
      if (!profile) return "You need to be signed in.";
      const supabase = createClient();
      const { data, error: rpcError } = (await (supabase as any).rpc("equip_shop_item", {
        p_item_id: item.id,
        p_slot: item.type,
      })) as any;

      if (rpcError || !data?.ok) {
        return "Couldn't equip that item. Please try again.";
      }

      setEquipped((prev) => ({ ...prev, [item.type]: item }));
      return null;
    },
    [profile]
  );

  const unequip = useCallback(
    async (type: ShopItemType) => {
      if (!profile) return;
      const supabase = createClient();
      await (supabase as any).rpc("unequip_shop_item", { p_slot: type });
      setEquipped((prev) => ({ ...prev, [type]: null }));
    },
    [profile]
  );

  const decorColorOf = useCallback(
    (profileId?: string | null) => (profileId ? borderMap[profileId] : undefined),
    [borderMap]
  );

  const profileCardOf = useCallback(
    (profileId?: string | null) => (profileId ? cardMap[profileId] : undefined),
    [cardMap]
  );

  return (
    <ShopContext.Provider
      value={{
        items,
        ownedIds,
        equipped,
        loading,
        error,
        purchase,
        equip,
        unequip,
        equippedBackground: equipped.background,
        equippedProfileCard: equipped.profileCard,
        decorColorOf,
        profileCardOf,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used within ShopProvider");
  return ctx;
}
