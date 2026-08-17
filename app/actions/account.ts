"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database, ProfileRow, AccountRequestRow } from "@/types/supabase";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import { storagePathFromUrl } from "@/lib/uploadUtils";

// Account lifecycle server actions.
//
// DEACTIVATION / REACTIVATION - self-service, reversible, no admin step.
//   Runs through the caller's own session against the anon-key server client,
//   so RLS (profiles_user_updates_own) is the gate: a user can only touch
//   their own row. No service role involved.
//
// DELETION - admin-approved. The admin's session (anon key + RLS) verifies
//   the caller is an admin of the same school as the pending request and the
//   target profile; only then does the service-role client delete the auth
//   user (which cascades profiles and anonymizes school records via
//   migration 058) and remove the user's storage objects.

interface CookieToSet {
  name: string;
  value: string;
  options?: {
    maxAge?: number;
    expires?: Date;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
    path?: string;
  };
}

type SessionClient = NonNullable<Awaited<ReturnType<typeof createSessionClient>>>;

async function createSessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: async () => cookieStore.getAll(),
      setAll: async (cookiesToSet: CookieToSet[]) => {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });
}

async function currentProfile(supabase: SessionClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null as null, profile: null as null };

  // Note: this project's supabase-js types `.single()`/`.maybeSingle()` as
  // `never`, so results are cast - same convention as the rest of the codebase.
  const { data: profile } = (await supabase
    .from("profiles")
    .select("id, school_id, role, deactivated_at")
    .eq("user_id", user.id)
    .maybeSingle()) as { data: ProfileRow | null };

  return { user, profile: profile ?? null };
}

/** Self-service deactivation: sets deactivated_at, nothing is deleted. */
export async function deactivateAccount() {
  const supabase = await createSessionClient();
  if (!supabase) return { error: "Account management isn't configured." };
  const { profile } = await currentProfile(supabase);
  if (!profile) return { error: "Not signed in." };

  const { error } = await (supabase.from("profiles") as any)
    .update({ deactivated_at: new Date().toISOString() })
    .eq("id", profile.id);

  if (error) return { error: "Couldn't deactivate your account. Please try again." };
  return { ok: true as const };
}

/**
 * Self-service reactivation: clears deactivated_at and creates the
 * "welcome back" notification via the existing create_notification RPC
 * (recipient = self, so the same-school check passes).
 */
export async function reactivateAccount() {
  const supabase = await createSessionClient();
  if (!supabase) return { error: "Account management isn't configured." };
  const { user, profile } = await currentProfile(supabase);
  if (!user || !profile) return { error: "Not signed in." };

  if (!profile.deactivated_at) return { error: "Your account is already active." };

  const { error } = await (supabase.from("profiles") as any)
    .update({ deactivated_at: null })
    .eq("id", profile.id);
  if (error) return { error: "Couldn't reactivate your account. Please try again." };

  // Welcome-back notification (existing SECURITY DEFINER RPC, no new system).
  await (supabase as any).rpc("create_notification", {
    p_recipient_id: profile.id,
    p_type: "system",
    p_title: "Welcome back!",
    p_body: "Your Hierarchy Class account has been reactivated. Welcome back!",
  });

  return { ok: true as const };
}

type Decision = "approved" | "denied";

/**
 * Admin resolution of a pending DELETION request. Denying just records the
 * decision. Approving executes the permanent deletion: storage objects are
 * collected first, the auth user is deleted (cascade -> profile gone, school
 * records preserved/anonymized by migration 058), then the collected files
 * are removed. Any failure before the auth-user delete reverts the request to
 * pending so nothing is half-destroyed.
 */
export async function resolveDeletionRequest(requestId: string, decision: Decision) {
  const supabase = await createSessionClient();
  if (!supabase) return { error: "Account management isn't configured." };

  // 1. Authenticated caller must be a school admin.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: caller } = (await supabase
    .from("profiles")
    .select("id, school_id, role")
    .eq("user_id", user.id)
    .single()) as { data: ProfileRow | null };
  if (!caller || caller.role !== "admin") {
    return { error: "Only a school admin can review deletion requests." };
  }

  // 2. The request must exist, be a pending deletion, and belong to the
  //    admin's own school (RLS already limits the read; verified again here).
  const { data: req } = (await supabase
    .from("account_requests")
    .select("*")
    .eq("id", requestId)
    .single()) as { data: AccountRequestRow | null };
  if (!req) return { error: "Request not found." };
  if (req.type !== "deletion") return { error: "Only deletion requests can be reviewed here." };
  if (req.status !== "pending") return { error: "This request was already reviewed." };
  if (req.school_id !== caller.school_id) {
    return { error: "This request belongs to another school." };
  }

  // 3. The target profile must exist and be in the same school.
  const { data: target } = (await supabase
    .from("profiles")
    .select("id, user_id, school_id, role, avatar_url")
    .eq("id", req.requester_id)
    .single()) as { data: ProfileRow | null };
  if (!target || target.school_id !== caller.school_id) {
    return { error: "The account to delete isn't in your school." };
  }
  if (!target.user_id) {
    return { error: "The account has no auth user to delete." };
  }

  // Deny: record the decision, no destructive work.
  if (decision === "denied") {
    const { error: denyError } = await (supabase.from("account_requests") as any)
      .update({
        status: "denied",
        reviewed_by: caller.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", req.id);
    if (denyError) return { error: "Couldn't record the decision." };
    return { ok: true as const, decision: "denied" as const };
  }

  // Approve -> execute the deletion.
  const svc = createServiceClient();
  if (!svc) {
    return { error: "Permanent deletion isn't configured on this server yet." };
  }

  // Collect storage paths BEFORE the auth-user delete (after it, the DB rows
  // that point at the files are gone).
  const paths = await collectStoragePaths(supabase, target);

  // Record the admin's approval (intent) before the irreversible step.
  const { error: approveError } = await (supabase.from("account_requests") as any)
    .update({
      status: "approved",
      reviewed_by: caller.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", req.id);
  if (approveError) return { error: "Couldn't record the approval." };

  // Delete the auth user. auth.users -> profiles ON DELETE CASCADE removes the
  // profile; migration 058's SET NULL FKs keep school records anonymized.
  const { error: deleteError } = await svc.auth.admin.deleteUser(target.user_id);
  if (deleteError) {
    // Account still exists - revert the request so it stays reviewable.
    await (supabase.from("account_requests") as any)
      .update({ status: "pending", reviewed_by: null, reviewed_at: null })
      .eq("id", req.id);
    return { error: "Deletion failed. No data was removed; the request is back to pending." };
  }

  // Storage cleanup (best effort per bucket - the account is already gone, so
  // any failure here only leaves orphaned files, never a half-deleted account).
  // Failures are NOT silent: counts + failed paths/errors are reported back so
  // orphaned files can be tracked and cleaned up manually.
  const storage: Record<string, { found: number; deleted: number; failed: number; errors: string[] }> = {};
  for (const bucket of ["avatars", "certificates", "myday", "materials", "feed"] as const) {
    storage[bucket] = await removePaths(svc, bucket, paths[bucket]);
  }

  const totalFound = Object.values(storage).reduce((n, s) => n + s.found, 0);
  const totalDeleted = Object.values(storage).reduce((n, s) => n + s.deleted, 0);
  const totalFailed = Object.values(storage).reduce((n, s) => n + s.failed, 0);
  const warnings = Object.values(storage)
    .flatMap((s) => s.errors)
    .map((e) => `Storage cleanup: ${e}`);

  return {
    ok: true as const,
    decision: "approved" as const,
    storage: { totalFound, totalDeleted, totalFailed },
    warnings: warnings.length ? warnings : undefined,
  };
}

async function collectStoragePaths(
  supabase: SessionClient,
  target: { id: string; avatar_url: string | null }
) {
  const paths: Record<"avatars" | "certificates" | "myday" | "materials" | "feed", string[]> = {
    avatars: [],
    certificates: [],
    myday: [],
    materials: [],
    feed: [],
  };

  if (target.avatar_url) {
    const p = storagePathFromUrl(target.avatar_url, "avatars");
    if (p) paths.avatars.push(p);
  }

  const [achievementsRes, storiesRes, materialsRes, postsRes] = await Promise.all([
    supabase.from("student_achievements").select("image_path").eq("student_id", target.id),
    supabase.from("stories").select("image_path").eq("user_id", target.id),
    supabase.from("learning_materials").select("url").eq("uploaded_by", target.id),
    supabase.from("school_feed_posts").select("image_path").eq("author_id", target.id),
  ]);

  paths.certificates = ((achievementsRes.data ?? []) as { image_path: string }[])
    .map((a) => storagePathFromUrl(a.image_path, "certificates"))
    .filter((p): p is string => !!p);
  paths.myday = ((storiesRes.data ?? []) as { image_path: string | null }[])
    .map((s) => s.image_path)
    .filter((p): p is string => !!p);
  paths.materials = ((materialsRes.data ?? []) as { url: string | null }[])
    .map((m) => m.url)
    .filter((p): p is string => !!p);
  paths.feed = ((postsRes.data ?? []) as { image_path: string | null }[])
    .map((p) => p.image_path)
    .filter((p): p is string => !!p);

  return paths;
}

async function removePaths(
  svc: NonNullable<ReturnType<typeof createServiceClient>>,
  bucket: string,
  paths: string[]
): Promise<{ found: number; deleted: number; failed: number; errors: string[] }> {
  if (paths.length === 0) return { found: 0, deleted: 0, failed: 0, errors: [] };
  const { error } = await svc.storage.from(bucket).remove(paths);
  if (error) {
    return { found: paths.length, deleted: 0, failed: paths.length, errors: [`${bucket}: ${error.message}`] };
  }
  return { found: paths.length, deleted: paths.length, failed: 0, errors: [] };
}
