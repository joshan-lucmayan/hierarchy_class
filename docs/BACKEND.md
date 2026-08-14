# Hierarchy Class — Backend

This document describes the actual backend of Hierarchy Class. The app has **no
separate REST service or Node backend process**. The backend is a combination
of:

1. **Supabase** (hosted Postgres + PostgREST + Realtime + Storage + Auth) —
   the source of truth for every feature: users, schools, programs, courses,
   grades, chat, habits, feed, library, materials, banners, stories.
2. **Next.js server-side code** (`middleware.ts`, `app/actions/`, `app/api/`,
   `lib/supabase/`) — session handling, role routing, signup, feedback email.
3. **The browser** talks to Supabase *directly* with the anon key; **RLS**
   scopes every query to the signed-in user's school and role. There is no
   backend tier between the client and the database for normal reads/writes.

> The interface catalog (routes, RPCs, realtime channels) lives in
> [API.md](./API.md). The schema and RLS policies are in
> [DATABASE.md](./DATABASE.md). This document explains how the backend is
> wired together, how a request flows, and where the server-side code lives.

---

## 1. Backend architecture at a glance

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Next.js App Router, client components + stores)   │
│                                                             │
│  lib/supabase/client.ts  →  createBrowserClient(anon key)   │
│      │                                                      │
│      ▼                                                      │
│  Supabase edge (PostgREST / Realtime / Storage / Auth)      │
│      │  ▲                                                   │
│      ▼  │                                                   │
│  PostgreSQL                                                  │
│   ├─ tables        (school_id-scoped, RLS-enforced)          │
│   ├─ RLS policies  (per-role SELECT/INSERT/UPDATE/DELETE)   │
│   ├─ RPC functions (SECURITY DEFINER, validated callers)     │
│   └─ triggers      (handle_new_user, notifications, etc.)    │
└─────────────────────────────────────────────────────────────┘
        ▲
        │  server-side only
        ▼
┌─────────────────────────────────────────────────────────────┐
│  Next.js server                                               │
│   ├─ middleware.ts        session refresh + role guard        │
│   ├─ app/actions/auth.ts  signUpWithProfile (server action)   │
│   ├─ app/api/feedback     feedback → Resend email             │
│   ├─ app/auth/callback    OAuth/reset callback exchange       │
│   └─ lib/supabase/auth.ts getUserMetadata (server reads)       │
└─────────────────────────────────────────────────────────────┘
```

**Multi-tenancy model:** one shared Supabase project; every school-scoped
table carries a `school_id` column, and RLS filters on it. A user's school is
derived from `auth.jwt() -> user_metadata -> school_id` (set at signup) and
stored on `profiles.school_id`. The `profiles` table joins user → role →
school, and most policies are written as `EXISTS (SELECT 1 FROM profiles WHERE
user_id = auth.uid() AND role = ... AND school_id = <row>.school_id)`.

---

## 2. Where the backend code lives

### 2.1 Database (the real backend)

Everything schema-related is in **`database/migrations/`** — one numbered SQL
file per change, run against Supabase in order:

| Area | Migrations |
|---|---|
| Core auth + profiles + schools | 001–005 |
| Classroom hierarchy (programs/sections/courses/enrollments) | 006–009 |
| Grades + approval workflow | 010–013 |
| Messaging (conversations, messages, blocks, RLS) | 014–018, 031 |
| Feed, stories, banners, library, materials | 019–024 |
| Notifications, habits, enrollment status | 025–030 |
| Education level → program nesting (`parent_id`) | 032 |

Apply a migration in the Supabase SQL editor (or `psql -f database/migrations/NNN_*.sql`).
Migrations are idempotent where it matters (`IF NOT EXISTS` / `DROP POLICY IF
EXISTS` guards) because there is no tracking table.

### 2.2 Next.js server code

| Path | Responsibility |
|---|---|
| `middleware.ts` | Runs on every request: refreshes the Supabase session cookie and enforces that `/student`, `/teacher`, `/admin` are only reachable by a logged-in user with the matching role. Bounces wrong-role users to their own home, logged-out users to `/login`. Skips all checks when `NEXT_PUBLIC_SUPABASE_*` env vars are absent (UI-only dev mode). |
| `app/actions/auth.ts` | `signUpWithProfile(...)` server action — creates the auth user with `user_metadata` (school_id, role, names); the `handle_new_user()` DB trigger then inserts the `profiles` row. |
| `app/api/feedback/route.ts` | POST — sends the feedback form to the configured email via Resend. |
| `app/auth/callback/route.ts` | GET — exchanges auth/recovery codes for a session, routes password-reset flows. |
| `lib/supabase/auth.ts` | `getUserMetadata(cookieStore)` — server-side session read for pages/components that need the role without exposing it to the client. |
| `lib/supabase/client.ts` | The single browser client factory (`createBrowserClient`). |

### 2.3 Client "data layer" (stores/hooks)

The client fetches straight from Supabase through provider components in
`lib/` — each is a React context that fetches on mount, exposes
derived/CRUD helpers, and subscribes to a realtime channel:

| Store | Tables | Realtime channel |
|---|---|---|
| `useMyProfile` | profiles | — |
| `classroomHierarchyStore` | programs, sections, courses, course_enrollments, grade_entries | `classroom-grades` |
| `chatStore` | conversations, chat_messages, chat_blocks | `chat-inbox`, `chat-blocks-mine` |
| `notificationsStore` | notifications | `notifications-mine` |
| `habitStore` | habit_entries | `habit-entries` |
| `schoolFeedStore` | posts, post_tags | — |
| `storiesStore` | stories | — |
| `bannerStore` | banners + storage `banners` | — |
| `libraryStore` | library_items | — |
| `materialsStore` | learning_materials + storage `materials` | — |
| `florinStore` | profiles (florin balance) | — |
| `friendsStore` | friends | — |
| `quizStore` | quizzes, quiz_questions, quiz_attempts | — |
| `teacherWorkspaceStore` / `teacherTasksStore` | teacher_notes, schedules, lessons, tasks | — |
| `useLeaderboard` | grade_entries (aggregate) | `leaderboard-grades-<unique>` |
| `useEnrollment` | course_enrollments (status/expiry) | — |
| `useSchools` / `useSchoolProfiles` / `useAccountRequests` | schools, profiles, account_requests | — |

---

## 3. How a request flows (end-to-end examples)

### Example A — student opens their home page

1. `middleware.ts` refreshes the session cookie; role guard allows `/student`.
2. The page (client component) mounts providers: `useMyProfile` →
   `lib/supabase/client.ts` → `supabase.auth.getUser()`.
3. `classroomHierarchyStore` fetches programs/sections/courses/enrollments/
   grade_entries in parallel via PostgREST. **RLS returns only rows where
   `school_id` matches the caller's school** — a student at school A never
   sees school B's data, and grade entries are filtered to their own or
   approved ones by policy.
4. The store subscribes to `classroom-grades`; when a teacher approves a
   grade, Postgres emits the change and the store refetches → the leaderboard
   and rank badge update live.

### Example B — student sends a chat message

1. `chatStore.sendMessage` calls `supabase.rpc('send_chat_message', ...)`.
2. The RPC (SECURITY DEFINER) validates the caller is a participant of the
   conversation, inserts into `chat_messages`, bumps `last_message`/
   `last_message_at`, revives the other side from archive.
3. Realtime fires on the `chat-inbox` channel → the recipient's `chatStore`
   appends the message and bumps their unread count; the Messages nav badge
   updates via `get_unread_counts`.

### Example C — teacher submits grades

1. Teacher page calls `submitGrades` → direct `grade_entries` inserts
   (RLS allows teachers to insert for their school) with `approval_status =
   'pending'` and `submitted_by` = teacher's profile id.
2. The `notify_admins(...)` RPC fans out one notification per submitting
   teacher to all admins.
3. Admin reviews in Admin → Grade Submissions and calls
   `approve_grade_submission(...)` → batch updates status + one notification
   back to the teacher. Approved entries flow into averages, ranks, and the
   leaderboard.

### Example D — admin creates an education level / program

1. Admin → Education Levels page calls `addProgram({ name, parentId })`.
2. The store inserts into `programs` with `school_id` + `parent_id`
   (`NULL` = education level, set = program inside it).
3. RLS `programs_admin_write` requires the caller to be an admin of the same
   school; `programs_school_read` lets everyone in the school read.
4. The page refetches and shows the new level; clicking it drills into its
   programs, then year/level sections, courses, and enrolled students.

---

## 4. Security model (backend)

- **RLS is the security boundary.** There is no "server validation layer"
  between the client and Postgres — policies are the enforcement point, so
  they must be complete. See [SECURITY.md](./SECURITY.md) and the full policy
  inventory in [DATABASE.md](./DATABASE.md).
- **RPCs are SECURITY DEFINER** — they run as the function owner and must
  re-validate the caller (participant check, same school, role check) before
  acting. Never add a DEFINER function that trusts the caller blindly.
- **Secrets:** only `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` exist in the client bundle. The anon key is
  safe because RLS blocks everything it can't see. Service-role access must
  never be exposed to the client; any admin-only operation that can't be done
  through RLS should be an RPC with an in-function role check.

---

## 5. Storage (Supabase Storage)

Buckets used by the app (referenced from `lib/` stores):

| Bucket | Used for | Store |
|---|---|---|
| `materials` | Teacher-uploaded lesson materials | `materialsStore` |
| `banners` | School banners | `bannerStore` |
| `feed` | Feed post images | `schoolFeedStore` |
| `avatars` | Profile avatars | `useMyProfile` / profile editing |

Files are read via **signed URLs** (1-hour expiry) rather than public URLs;
deletes go through the same stores so the storage object and the DB row stay
in sync.

---

## 6. Operational notes

- **Migrations:** apply `database/migrations/NNN_*.sql` in order in Supabase.
  There's no tracking table, so re-running a file must be safe (idempotent
  guards) — verify with `psql` after applying.
- **Realtime:** one channel per provider, created once per mount, removed on
  cleanup. Hooks that can mount more than once (e.g. `useLeaderboard`) must
  use a unique channel name per instance or `subscribe()` re-use throws.
- **Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  Without them the app runs in a UI-only "fake auth" mode (no backend calls).
- **Health check:** log in as each role and exercise one write per feature
  (send a message, submit a grade, add a material, toggle a habit) — RLS and
  RPC failures surface as per-action error messages, not crashes.
