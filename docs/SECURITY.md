# Hierarchy Class - Security

Security is layered: **route guards -> client checks -> RLS -> SECURITY
DEFINER functions**. The database policies are the real gate; everything
else is UX and defense in depth.

---

## 1. Authentication

- **Supabase Auth** with email/password. A database trigger auto-creates a
  `profiles` row on signup (migration 003).
- **Session**: `@supabase/ssr` cookies. `middleware.ts` refreshes the session
  cookie on every request and redirects appropriately:
  - Logged out -> `/login`
  - Wrong role for the prefix (`/student`, `/teacher`, `/admin`) -> bounce to
    their own home
  - Signed-in user on `/login`/`/signup` -> their home
- **Role comes from `user_metadata.role`** at signup and is immutable by the
  user (a BEFORE UPDATE trigger on `profiles` blocks non-admins from changing
  role or school).

## 2. Authorization (RLS)

Every table has policies. Three consistent patterns:

1. **School scope** - the row's `school_id` must match the caller's school
   (via a `profiles` lookup or `auth.jwt()` metadata).
2. **Role scope** - students see only their own data; teachers see what they
   teach plus school-wide read-only data; admins see the school.
3. **Ownership scope** - personal rows (profile, notifications, chat side,
   habits) are gated by `profile_id = my profile`.

**Grade privacy** is the strictest case: students read only their own
approved entries; the leaderboard is an aggregate-only RPC that never exposes
raw grade rows.

## 3. Server-side trust boundaries

- **No client INSERT/UPDATE on privileged tables.** Notifications are created
  only by SECURITY DEFINER functions. Conversations are mutated only through
  RPCs - the client has no direct UPDATE on `conversations`.
- **Message sender identity is forced by RLS** (`from_id = my profile`), so a
  user can't send as someone else.
- **Blocks are enforced server-side** in `ensure_conversation` and
  `send_chat_message` (either direction blocks both).
- **Protected columns** on `profiles` (role, school_id, academic_excellence,
  rank, librarian flag) can only be changed by admins - enforced by a
  BEFORE UPDATE trigger.

## 4. Client-side hardening

- **Role routing is enforced in `middleware.ts`** on every request - it
  matches `user_metadata.role` against the `/student|/teacher|/admin` prefix
  and bounces mismatches to the user's own home; RLS remains authoritative
  for data.
- **No service-role keys in the browser.** All client code uses the anon key.
- **Upload validation** (`lib/uploadUtils.ts`): MIME whitelist, size caps,
  extension derived from MIME (with fallback), UUID file paths. Storage
  buckets are private with owner/school policies.
- **No client-side Florin minting** - balance write policies were removed
  until a verified payment flow exists.
- **Theme/UX is not a security boundary** - the Midnight/Rose theme and
  cosmetic states never gate data.

## 5. Account lifecycle security

**Self-service deactivation** is a reversible flag (`profiles.deactivated_at`).
It uses the caller's own session (anon key + RLS) — no admin step, no
service role. The flag is enforced server-side by `middleware.ts` on every
request; hiding UI alone cannot bypass it.

**Permanent deletion** is deliberately server-side because Supabase Auth user
deletion (`auth.admin.deleteUser`) requires privileged access:

1. **Same-school authorization** — the server action verifies the admin's
   `school_id` matches both the request's `school_id` and the target
   profile's `school_id`.
2. **Admin-only approval** — only users with `role = 'admin'` can approve
   deletion requests.
3. **Server-side verification** — the admin's identity is verified via
   `supabase.auth.getUser()` and the `profiles` table (RLS + server action).
4. **Service-role isolation** — the `SUPABASE_SERVICE_ROLE_KEY` is used
   ONLY for the irreversible step (`auth.admin.deleteUser` + storage
   cleanup). It is server-only, never `NEXT_PUBLIC_`, never committed, and
   callers must authorize BEFORE using it.
5. **Storage ownership cleanup** — after auth deletion (which cascades the
   profile and personal data), storage objects (avatars, certificates,
   stories, materials, feed images) are collected and removed using the
   service-role client.
6. **RLS** — all pre-deletion reads (request lookup, profile verification,
   storage path collection) go through the admin's own session with normal
   RLS policies.
7. **Deactivated-user middleware enforcement** — deactivated users are
   redirected by `middleware.ts` on every request and cannot reach any app
   page except `/auth/reactivate`, login, signup, and callback routes.

**Data export** (`/api/export-account`) uses the caller's own session with
normal RLS — no service role, no bypass. A user can only export their own
data.

## 6. Known deployment caveats

- **Fake-auth fallback**: if `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` are
  missing, middleware blocks nothing and stores render empty states - fine
  for UI work, a hazard if env vars are forgotten in production. Always set
  them in the deploy environment.
- **Non-secure contexts**: `crypto.randomUUID()` throws over plain HTTP on a
  LAN; `lib/randomId.ts` falls back to a safe random id so uploads and
  optimistic updates still work.
