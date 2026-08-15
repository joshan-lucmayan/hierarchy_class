# Hierarchy Class - Backend

This document describes the actual backend of Hierarchy Class. The app has **no
separate REST service or Node backend process**. The backend is a combination
of:

1. **Supabase** (hosted Postgres + PostgREST + Realtime + Storage + Auth) -
   the source of truth for every feature: users, schools, programs, courses,
   grades, chat, habits, feed, library, materials, banners, stories.
2. **Next.js server-side code** (`middleware.ts`, `app/actions/`, `app/api/`,
   `lib/supabase/`) - session handling, role routing, signup, feedback email.
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
│  lib/supabase/client.ts  ->  createBrowserClient(anon key)   │
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
│   ├─ app/api/feedback     feedback -> Resend email             │
│   ├─ app/auth/callback    OAuth/reset callback exchange       │
│   └─ lib/supabase/auth.ts getUserMetadata (server reads)       │
└─────────────────────────────────────────────────────────────┘
```

**Multi-tenancy model:** one shared Supabase project; every school-scoped
table carries a `school_id` column, and RLS filters on it. A user's school is
derived from `auth.jwt() -> user_metadata -> school_id` (set at signup) and
stored on `profiles.school_id`. The `profiles` table joins user -> role ->
school, and most policies are written as `EXISTS (SELECT 1 FROM profiles WHERE
user_id = auth.uid() AND role = ... AND school_id = <row>.school_id)`.

---

## 2. Where the backend code lives

### 2.1 Database (the real backend)

Everything schema-related is in **`database/migrations/`** - one numbered SQL
file per change, run against Supabase in order:

| Area | Migrations |
|---|---|
| Core auth + profiles + schools | 001-005 |
| Classroom hierarchy (programs/sections/courses/enrollments) | 006-009 |
| Grades + approval workflow | 010-013 |
| Messaging (conversations, messages, blocks, RLS) | 014-018, 031 |
| Feed, stories, banners, library, materials | 019-024 |
| Notifications, habits, enrollment status | 025-030 |
| Education level -> program nesting (`parent_id`) | 032 |
| `profiles.program` column (Academic info) | 033 |
| Rank engine: `rank_config`, `student_rank_state`, `rank_period_entries`, `season_history_log`, `rank_history_log` + RLS + SECURITY DEFINER RPCs (validate -> preview -> confirm, EX score, season reseed) | 034 |
| Admin rank ops: school-wide season end + season-history query | 035 |
| Auto-feed: approved `grade_entries` -> rank engine trigger (`rank_fed_at`, category mapping, exactly-once) | 036 |
| Feed reversal: `source_grade_id` + before-state on entries, `revert_grade_rank_feed` with full replay; rejecting/deleting an approved grade undoes its rank effect | 037 |
| Teacher-grade flow: `max_score` on grades, per-course weights, admin-declared semesters, weight-aware feed | 038 |
| Dynamic categories: `course_rank_categories` replaces the fixed four, `save/get_course_rank_weights` take an add/remove/edit array, label->key feed mapping, category-agnostic revert replay | 040 |
| Students seed at D (not C): state defaults + preview/revert anchors, existing rows replayed from a D/0 seed | 041 |
| Season-end reset keys off the FINAL rank (peak stays in history + drives the all-time record) | 042 |
| Auto-adopt grading period: confirm adopts the caller's period (rank carries, new period's entries form the next feed), backfills approved-but-unfed grades | 043 |
| Semester gate: BEFORE INSERT trigger blocks grade submissions without an active semester | 044 |
| Period baseline: period-start snapshot on the state row; revert recomputes order-independently from it, so clearing all grades collapses to D/0 (no stale bar residue) | 046 |
| **Per-entry isolated fill (permanent):** each grade entry computes its own fill from its own score + category weight share (`weightShare = w[cat]/sum(all configured)`); no running averages, no composite S; EX check on the uncapped adjusted; supersedes 047 | 049 |

Apply a migration in the Supabase SQL editor (or `psql -f database/migrations/NNN_*.sql`).
Migrations are idempotent where it matters (`IF NOT EXISTS` / `DROP POLICY IF
EXISTS` guards) because there is no tracking table.

### 2.2 Next.js server code

| Path | Responsibility |
|---|---|
| `middleware.ts` | Runs on every request: refreshes the Supabase session cookie and enforces that `/student`, `/teacher`, `/admin` are only reachable by a logged-in user with the matching role. Bounces wrong-role users to their own home, logged-out users to `/login`. Skips all checks when `NEXT_PUBLIC_SUPABASE_*` env vars are absent (UI-only dev mode). |
| `app/actions/auth.ts` | `signUpWithProfile(...)` server action - creates the auth user with `user_metadata` (school_id, role, names); the `handle_new_user()` DB trigger then inserts the `profiles` row. |
| `app/api/feedback/route.ts` | POST - sends the feedback form to the configured email via Resend. |
| `app/auth/callback/route.ts` | GET - exchanges auth/recovery codes for a session, routes password-reset flows. |
| `lib/supabase/auth.ts` | `getUserMetadata(cookieStore)` - server-side session read for pages/components that need the role without exposing it to the client. |
| `lib/supabase/client.ts` | The single browser client factory (`createBrowserClient`). |

### 2.3 Client "data layer" (stores/hooks)

The client fetches straight from Supabase through provider components in
`lib/` - each is a React context that fetches on mount, exposes
derived/CRUD helpers, and subscribes to a realtime channel:

| Store | Tables | Realtime channel |
|---|---|---|
| `useMyProfile` | profiles | - |
| `classroomHierarchyStore` | programs, sections, courses, course_enrollments, grade_entries | `classroom-grades` |
| `chatStore` | conversations, chat_messages, chat_blocks | `chat-inbox`, `chat-blocks-mine` |
| `notificationsStore` | notifications | `notifications-mine` |
| `habitStore` | habit_entries | `habit-entries` |
| `schoolFeedStore` | posts, post_tags | - |
| `storiesStore` | stories | - |
| `bannerStore` | banners + storage `banners` | - |
| `libraryStore` | library_items | - |
| `materialsStore` | learning_materials + storage `materials` | - |
| `florinStore` | profiles (florin balance) | - |
| `friendsStore` | friends | - |
| `quizStore` | quizzes, quiz_questions, quiz_attempts | - |
| `teacherWorkspaceStore` / `teacherTasksStore` | teacher_notes, schedules, lessons, tasks | - |
| `useRankStore` (`RankProvider`) | student_rank_state (+ rank_config) | rank engine realtime |
| `useEnrollment` | course_enrollments (status/expiry) | - |
| `useSchools` / `useSchoolProfiles` / `useAccountRequests` | schools, profiles, account_requests | - |

---

## 3. How a request flows (end-to-end examples)

### Example A - student opens their home page

1. `middleware.ts` refreshes the session cookie; role guard allows `/student`.
2. The page (client component) mounts providers: `useMyProfile` ->
   `lib/supabase/client.ts` -> `supabase.auth.getUser()`.
3. `classroomHierarchyStore` fetches programs/sections/courses/enrollments/
   grade_entries in parallel via PostgREST. **RLS returns only rows where
   `school_id` matches the caller's school** - a student at school A never
   sees school B's data, and grade entries are filtered to their own or
   approved ones by policy.
4. The store subscribes to `classroom-grades`; when a teacher approves a
   grade, Postgres emits the change and the store refetches -> the leaderboard
   and rank badge update live.

### Example B - student sends a chat message

1. `chatStore.sendMessage` calls `supabase.rpc('send_chat_message', ...)`.
2. The RPC (SECURITY DEFINER) validates the caller is a participant of the
   conversation, inserts into `chat_messages`, bumps `last_message`/
   `last_message_at`, revives the other side from archive.
3. Realtime fires on the `chat-inbox` channel -> the recipient's `chatStore`
   appends the message and bumps their unread count; the Messages nav badge
   updates via `get_unread_counts`.

### Example C - teacher submits grades

1. Teacher page calls `submitGrades` -> direct `grade_entries` inserts
   (RLS allows teachers to insert for their school) with `approval_status =
   'pending'` and `submitted_by` = teacher's profile id.
2. The `notify_admins(...)` RPC fans out one notification per submitting
   teacher to all admins.
3. Admin reviews in Admin -> Grade Submissions and calls
   `approve_grade_submission(...)` -> batch updates status + one notification
   back to the teacher. Approved entries flow into averages, ranks, and the
   leaderboard. **Since migration 036, approving a grade also auto-feeds the
   rank engine** (see Example E step 0) - no manual rank entry needed for
   grades; grade submission on `/teacher/classroom` is the only input path.

### Example E - a score entry moves a rank (teacher/admin)

0. **Auto-feed (migration 036, extended in 038):** when a `grade_entries`
   row flips to `approval_status = 'approved'`, the
   `feed_approved_grade_to_rank` trigger runs
   `process_score_entry(..., auto_confirm=true)` - since migration 040 the
   grade's **type is a category LABEL** that maps to its key via the course's
   `course_rank_categories` rows (legacy built-in mapping Exam->exam,
   Quiz->quiz, Activity/Assignment->activity, Participation->participation is
   only the fallback when a course has no custom categories), points are
   `score / max_score`, and the entry lands in the **admin-declared active
   semester** (see Example G). The course's saved category weights
   (percents, fractions when passed) are attached to each entry as `p_weights`
   so each entry's fill honors the teacher's config - and reverts replay with
   each entry's own stored weights, so removing a category never breaks a
   revert. A `rank_fed_at` stamp makes it exactly-once: rejecting and
   re-approving the same grade never double-feeds. A feed failure never rolls
   back the approval (error is logged as a NOTICE; the unstamped row can be
   retried with the backfill statement in the migration). Since migration 038
   the feed uses the grade's `score / max_score` (teachers enter "out of"
   scores), the grading period is the **admin-declared active semester** (no
   teacher-facing period concept), and each entry's weight share comes from
   the course's own `course_rank_weights` percentages (fallback: the school
   config).

   **Reversal (migration 037):** rejecting - or outright deleting - an
   approved grade undoes its rank effect. Each fed entry stores its
   `source_grade_id` plus the rank/bar/ex/peak values that were in effect
   when it was applied; `revert_grade_rank_feed` deletes the entry and
   **recomputes from the period-start baseline** through the remaining
   current-period entries (migration 046 - order-independent, so even a bulk
   clear of every grade collapses the state to the baseline instead of
   leaving a stale bar), using the per-entry isolated fill (migration 049),
   so the student's rank/bar end up exactly as if the grade(s) never existed
   (logged as `feed_reverted`). The
   grade's `rank_fed_at` is cleared on rejection, so a later re-approval
   feeds it again.

   Since migration 038 the manual score-entry UI is **gone from the teacher
   flow** - grades are the only way scores enter the engine. The teacher
   manages each course's categories on the classroom page - add, remove or
   edit labels and weights (`save_course_rank_weights` with an array,
   weights summing to 100, migration 040) - and enters earned/"out of"
   scores; the feed passes `score/max_score` and the course's weights
   through to the engine.

### Example G - admin declares a semester

1. Admin -> `/admin/ranks` -> Declare semester: `declare_semester(school_id,
   school_year, semester_label, start_date, end_date)` - closes any
   previously active semester and inserts a new active one (admin-only RPC).
2. The active semester's label IS the grading period: every approved grade
   auto-feeds into `rank_period_entries.period_id = 'First Semester'`, etc.
   Students see their rank/bar accumulate within that period.
3. At semester end the admin runs **End season & reseed** (migration 035's
   `end_season_for_school`), which reseeds every ranked student from their
   season peak and writes season history.

1. The caller runs `preview_rank_update(student, period, category, earned,
   possible)` - SECURITY DEFINER, **read-only**: it computes the entry's own
   percentage -> `Adjusted = 100·(min(pct,100)/100)^k` -> the weight-scaled
   fill change on the current bar and returns `{ S, adjusted, fill_change,
   bar_before/after, rank_before/after, promoted, demoted, cascade_tiers,
   warnings, token }` with **zero side effects** (the token is a deterministic
   md5 fingerprint of the inputs + config + existing entries, not a stored
   row). PER-ENTRY ISOLATION (049, permanent): `fill = ((Adjusted - 50)/50) x
   (100/n) x weightShare`, where `weightShare = w[category]/sum(ALL configured
   weights)` - each grade moves the bar by its own quality scaled by its
   category weight, with no blending against other entries. The EX >= 50 check
   uses the UNCAPPED adjusted (`100·(pct/100)^k`).
2. On confirmation the caller invokes `confirm_and_apply_score_entry(...,
   token)` - re-validates, rejects a stale/mismatched token (config or
   entries changed since preview), inserts the `rank_period_entries` row,
   applies the bar mechanic (fill-first promotion, overflow demotion capped
   at 2 tiers), tracks `peak_rank_this_season` on promotion, zeroes `ex_score`
   on reaching EX, and appends a `rank_history_log` row (promotions/demotions
   logged distinctly).
3. `student_rank_state` UPDATE emits on realtime -> `RankProvider` refetches ->
   home/profile rank cards and the leaderboard update live.
4. At season end the admin runs `end_season_for_school(...)` (035, admin
   only) - it loops every ranked student, calling `end_season(...)` which
   reseeds from the season's **final** rank (042: S mid-season ending at A
   resets to D), writes `season_history_log` (which keeps the **peak**), and
   bumps `highest_rank_ever` from the peak (monotonic).

### Example D - admin creates an education level / program

1. Admin -> Education Levels page calls `addProgram({ name, parentId })`.
2. The store inserts into `programs` with `school_id` + `parent_id`
   (`NULL` = education level, set = program inside it).
3. RLS `programs_admin_write` requires the caller to be an admin of the same
   school; `programs_school_read` lets everyone in the school read.
4. The page refetches and shows the new level; clicking it drills into its
   programs, then year/level sections, courses, and enrolled students.

---

## 4. Security model (backend)

- **RLS is the security boundary.** There is no "server validation layer"
  between the client and Postgres - policies are the enforcement point, so
  they must be complete. See [SECURITY.md](./SECURITY.md) and the full policy
  inventory in [DATABASE.md](./DATABASE.md).
- **RPCs are SECURITY DEFINER** - they run as the function owner and must
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
  guards) - verify with `psql` after applying.
- **Realtime:** one channel per provider, created once per mount, removed  on cleanup. Hooks that can mount more than once (e.g. `RankProvider`) must
  use a unique channel name per instance or `subscribe()` re-use throws.
- **Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  Without them the app runs in a UI-only "fake auth" mode (no backend calls).
- **Health check:** log in as each role and exercise one write per feature
  (send a message, submit a grade, add a material, toggle a habit) - RLS and
  RPC failures surface as per-action error messages, not crashes.
