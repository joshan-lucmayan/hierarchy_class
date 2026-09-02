"use client";

import { useState } from "react";
import Link from "next/link";
import { useShop, type ShopItem, type ShopItemType } from "@/lib/shopStore";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { CornerFrame } from "@/components/ui/CornerFrame";

const SLOT_META: Record<ShopItemType, { label: string; hint: string }> = {
  background: { label: "Page background", hint: "Shown behind every student page" },
  profile_card: { label: "Profile card", hint: "Shown behind your rank card" },
  avatar_border: { label: "Avatar border", hint: "A ring around your avatar" },
};

const SLOT_ORDER: ShopItemType[] = ["background", "profile_card", "avatar_border"];

function ItemPreview({ item, small }: { item: ShopItem; small?: boolean }) {
  if (item.type === "avatar_border") {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full border border-base bg-tile ${
          small ? "h-8 w-8" : "h-10 w-10"
        }`}
      >
        <UserAvatar
          name={item.name}
          src="/avatars/default-avatar.webp"
          size="xs"
          decorColor={item.accent}
        />
      </div>
    );
  }
  return (
    <div
      className={`shrink-0 rounded-md border border-base bg-cover bg-center ${
        small ? "h-8 w-14" : "h-12 w-20"
      }`}
      style={{ backgroundImage: `url(${item.image_url})` }}
    />
  );
}

/**
 * The wardrobe: where owned shop items get equipped. The shop only sells; this
 * is the storage/equip UI, living on the profile page.
 */
export function Wardrobe() {
  const { items, ownedIds, equipped, equip, unequip } = useShop();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const ownedByType = (type: ShopItemType) => items.filter((i) => i.type === type && ownedIds.has(i.id));

  const equippedOf = (type: ShopItemType): ShopItem | null => {
    if (type === "background") return equipped.background;
    if (type === "profile_card") return equipped.profileCard;
    return equipped.avatarBorder;
  };

  async function handleEquip(item: ShopItem) {
    setBusyId(item.id);
    setStatus(null);
    const err = await equip(item);
    if (err) setStatus(err);
    else setStatus(`${item.name} equipped.`);
    setBusyId(null);
  }

  async function handleUnequip(type: ShopItemType) {
    setStatus(null);
    await unequip(type);
    setStatus("Equipped item removed - back to the default.");
  }

  return (
    <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Wardrobe</h2>
        <Link href="/student/shop" className="text-[12px] font-semibold text-accent transition hover:underline">
          Shop
        </Link>
      </div>
      <p className="mb-5 text-xs leading-5 text-muted">
        Equip what you bought. Your style shows on your pages, your profile card, and your avatar.
      </p>

      {status && (
        <p className="mb-4 rounded-lg border border-accent bg-accent/10 px-3 py-2 text-xs font-medium text-accent">
          {status}
        </p>
      )}

      <div className="space-y-6">
        {SLOT_ORDER.map((type) => {
          const meta = SLOT_META[type];
          const owned = ownedByType(type);
          const current = equippedOf(type);
          return (
            <div key={type}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[13.5px] font-bold text-navy">{meta.label}</p>
                  <p className="text-[11.5px] text-muted">{meta.hint}</p>
                </div>
                {current ? (
                  <div className="flex items-center gap-2">
                    <ItemPreview item={current} small />
                    <button
                      type="button"
                      onClick={() => handleUnequip(type)}
                      className="rounded-full border border-line px-2.5 py-1 text-[11.5px] font-semibold text-muted transition hover:border-sealion hover:text-navy"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <span className="rounded-full border border-line px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-faint">
                    Default
                  </span>
                )}
              </div>

              {owned.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {owned.map((item) => {
                    const isCurrent = current?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleEquip(item)}
                        disabled={busyId === item.id}
                        className={`flex items-center gap-2 rounded-lg border p-2 text-left transition disabled:opacity-60 ${
                          isCurrent
                            ? "border-accent bg-accent/10"
                            : "border-base bg-[var(--surface-strong)] hover:border-sealion"
                        }`}
                      >
                        <ItemPreview item={item} small />
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-semibold text-navy">{item.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-accent">In use</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-[12px] text-faint">
                  Nothing owned yet -{" "}
                  <Link href="/student/shop" className="font-semibold text-accent transition hover:underline">
                    visit the shop
                  </Link>
                  .
                </p>
              )}
            </div>
          );
        })}
      </div>
    </CornerFrame>
  );
}
