# Hierarchy Class - Architecture

**Version 1.4.25.** A gamified academic-tracking platform ("Climb the ranks")
for schools: students, teachers, and admins get role-scoped dashboards built
on Supabase (Postgres + Auth + RLS + Realtime + Storage) and Next.js 14
(App Router).

This document describes the system as it exists now - every feature is
database-backed; there is no mock-data layer left.

---

## 1. Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router), React 18, TypeScript (strict) |
| Styling | Tailwind CSS, CSS variables (Midnight / Rose themes) |
| Backend | Supabase: Postgres, Auth, Realtime, Storage, RLS |
| DB access | `@supabase/ssr` (browser + server clients), typed by `types/supabase.ts` |
| Deployment | Vercel-ready; env vars in `.env.local` |

Everything runs in one Supabase project; multi-tenancy is by `school_id`
column on every school-scoped table, enforced in RLS. The product currently
serves a single school (CSA).

---

## 2. Directory map (clean structure)

```
hierarchy_class/
├── app/                     FRONTEND - Next.js routes (App Router)
│   ├── layout.tsx           Root layout: providers, theme bootstrap, favicon
│   ├── middleware.ts        (root) session refresh + role-prefix guard
│   ├── page.tsx             Landing -> redirects by session
│   ├── login/ signup/       Public auth pages
│   ├── forgot-password/     Password recovery request
│   ├── reset-password/      Password reset (recovery code exchange)
│   ├── auth/callback/       OAuth/password recovery code exchange
│   ├── api/                 BACKEND - route handlers (e.g. feedback -> email)
│   ├── actions/             Server actions (signup, etc.)
│   ├── student/             Student pages: home, search, messages,
│   │                        learning-materials, library, quiz, leaderboard,
│   │                        profile, habits, settings
│   ├── teacher/             Teacher pages: home, classroom, students, quiz,
│   │                        learning-materials, library-management, settings
│   └── admin/               Admin pages: home, users, programs, students,
│                            teachers, reports, ranks, settings
│
├── components/              FRONTEND - UI, grouped by feature
│   ├── navigation/          SideNav / BottomNav / AppShell / SiteHeader /
│   │                        NotificationBell / MessagesBadge / BrandMark
│   ├── chat/                MessengerView (shared by all three roles)
│   ├── feed/                FeedPost, StoriesRail, StoryViewerModal
│   ├── dashboard/           SubjectStats, HabitTracker, WeeklyProgress
│   ├── habits/              HabitFormModal, HabitDetailModal, HabitHistoryView,
│   │                        HabitIcon, habitFormat
│   ├── profile/             ProfileModal (in-place profile preview)
│   ├── search/              QuickSearchBar
│   ├── admin/               PostEditor
│   ├── auth/                Login/Signup forms, SchoolSelector
│   ├── library/             Catalog, AddBookModal, EditBookModal
│   ├── leaderboard/         LeaderboardRow
│   ├── student/             FlorinPurchaseModal
│   ├── ui/                  RankBadge, StatBar, StatRadarChart, EnrolledBadge,
│   │                        CornerFrame, UserAvatar, DefaultAvatar,
│   │                        CrownMark, CoinIcon
│   └── FeedbackForm.tsx     Shared feedback/report form
│
├── lib/                     SHARED LOGIC - data layer + helpers
│   ├── supabase/            client.ts (browser), auth.ts (server reads)
│   ├── *Store.tsx           React context providers -> live Supabase data
│   ├── use*.ts              Data hooks (profile, roster, enrollment,
│   │                        schools, account requests)
│   ├── notify.ts            Client wrappers for notification RPCs
│   ├── uploadUtils.ts       Upload validation (MIME/size/path)
│   ├── randomId.ts          Secure-id helper with non-HTTPS fallback
│   ├── version.ts           Single source of truth for the app version
│   └── weekUtils.ts         Date/week helpers
│
├── database/                DATABASE - everything Postgres
│   ├── migrations/          Numbered SQL migrations 001 -> 053 (see DATABASE.md)
│   └── README.md            How to apply migrations
│
├── types/                   TypeScript types (supabase.ts, school.ts, ...)
├── scripts/                 Seed scripts (seed-schools.sql, seed.ts, ...)
├── public/                  Static assets (favicons, hc_bg shop/backdrop images)
└── docs/                    DOCUMENTATION (this folder)
```

Concern -> folder cheat sheet:

| Concern | Where |
|---|---|
| Frontend UI & routes | `app/`, `components/` |
| Backend (server-side) | `app/api/`, `app/actions/`, `middleware.ts`, `lib/supabase/auth.ts` |
| Database (schema, RLS, RPCs, triggers) | `database/migrations/` |
| Security (auth, RLS, role guards) | `middleware.ts`, `database/migrations/` (RLS) |
| Client data layer | `lib/` (stores + hooks) |

---

## 3. Runtime layers

```
Browser (React providers + hooks)
   │  supabase-js (anon key only)
   ▼
PostgREST / Realtime / Storage API
   │
   ▼
Postgres
   ├── RLS policies      (row-level gates, school + role + ownership)
   ├── SECURITY DEFINER  (server-side ops: chat, notifications, approvals)
   └── triggers          (profile auto-create, protected-column guard)
```

### Routing & auth

- **middleware.ts** refreshes the Supabase session cookie on every request and
  enforces the role prefix: `/student`, `/teacher`, `/admin` require a logged-in
  user whose `user_metadata.role` matches; wrong role -> bounce to their own
  home; logged out -> `/login`. `/login`/`/signup` redirect signed-in users to
  their home. Logging **out** lands on the public home page (`/`), which shows
  the landing site for visitors.
- **Fake-auth fallback**: when `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` are absent,
  middleware blocks nothing and the client stores render empty/error states -
  intentional for UI-only work, a deployment hazard if env vars are forgotten.
- Role routing is enforced in **middleware only** (no client-side role-guard
  component); RLS remains the real gate for data.

---

## 4. Client data layer (stores & hooks)

All providers are mounted in `app/layout.tsx`. They fetch on mount (and
refetch via a tick counter), expose CRUD + helpers, and subscribe to Realtime
where it matters. All are Supabase-backed - **there is no mock data**.

| Provider / hook | Backing tables | Notes |
|---|---|---|
| `ClassroomHierarchyProvider` | programs, sections, courses, course_enrollments, grade_entries | Hierarchy + grades; exposes getters (course averages, grade history) |
| `ChatProvider` | conversations, chat_messages, chat_blocks | Shared-thread messaging; per-user read/archive/delete; DB unread |
| `NotificationsProvider` | notifications | Realtime INSERT on `recipient_id`; mark-all-read |
| `SchoolFeedProvider` | school_feed_posts | Audience-aware feed; admin create/edit/delete + optional image |
| `StoriesProvider` | stories, story_views, `myday` bucket | 24h expiry, uploads, view tracking |
| `MaterialsProvider` | learning_materials, `materials` bucket | Signed URLs; teacher uploads |
| `HabitProvider` | habits, habit_entries, habit_pauses | Habit definitions, daily records, pause windows (student home + tracker) |
| `FriendsProvider` | friends | Same-school enforced by RLS |
| `BannerProvider` | banner_config, `banners` bucket | Admin-managed header image |
| `FlorinProvider` | florin_balances | Read-only balance; no client-side minting |
| `LibraryProvider` | library_books, library_borrow_requests, library_borrow_log | Catalog + borrow flow |
| `QuizProvider` | quizzes, quiz_questions, quiz_attempts | Live quiz system |
| `TeacherTasksProvider` | teacher_tasks | Accept/decline/done -> notifications |
| `TeacherWorkspaceProvider` | teacher_notes/schedule/lesson tables | Notes, schedule, lesson plans |
| `useMyProfile` | profiles, `avatars` bucket | Secure avatar upload/remove |
| `useSchoolProfiles` | profiles | School roster by role (RLS-scoped) |
| `useRankStore` (`RankProvider`) | student_rank_state (+ rank_config) | Non-linear rank engine: `rankOf(profileId)`, `sorted` (best-first); realtime refetch on rank state changes |
| `useMyEnrollment` / `useAdminEnrollments` | enrollment_status | Effective status computed at read time |
| `useAccountRequests` | account_requests | Submit + admin review |

See [FRONTEND.md](./FRONTEND.md) for the pages and component breakdown.

---

## 5. Key flows

### Grades: submit -> approve -> leaderboard

1. Teacher picks Program -> Section -> Course (only their assigned courses are
   visible) and submits scores. Rows are inserted with `approval_status =
   'pending'`; `notify_admins` tells admins.
2. Admin Home groups pending entries by course + submitter + batch and shows
   the real teacher (avatar/name), course, section, program, submit time,
   student count, and status.
3. Admin approves/rejects via `approve_grade_submission`, which flips the rows
   atomically and sends **one** notification to each submitting teacher.
4. Students only ever see their **own approved** rows (RLS), so their course
   stats reflect approved data automatically. (The rank engine is a separate
   pipeline - see the score-entry flow below - driven by the rank RPCs, not by
   `grade_entries`.)
5. Realtime: grade INSERT/UPDATE events trigger a refetch in the classroom
   store, so course averages update live when an admin approves - no reload
   needed.

### Rank engine (non-linear, migration 034-035+)

The non-linear rank engine powers all rank UI - see
[RANK_SYSTEM.md](./RANK_SYSTEM.md) (user-facing explanation),
[BACKEND.md §Rank engine](./BACKEND.md) and `lib/rankEngine.ts` for the full
spec (per-entry isolated fill -> power curve x weight share -> fill-first bar
-> promotion/demotion -> EX score -> season reseed). Score entry flows
through the strict validate -> preview -> confirm pipeline:

```
teacher enters earned/max per category -> preview (read-only, token) -> confirm
-> entry pct -> adjusted (k power curve) x weight share -> bar fill -> rank change
```

- Students' rank state lives in `student_rank_state` (RLS-scoped to the
  school); teachers/admin write only through the SECURITY DEFINER RPCs in
  034, and the school-wide season end (`end_season_for_school`) is admin-only
  (035).
- The client reads through `useRankStore` (realtime); ranks update live on
  home, profiles, leaderboard, search, and teacher/admin rosters without a
  reload.

### Messaging

- One shared system across all three roles. `conversations` is a single
  shared row per participant pair (`user_a_id`/`user_b_id` canonical
  LEAST/GREATEST ordering, `UNIQUE (user_a_id, user_b_id)`), so both sides
  read the same message history and realtime stream.
- Creating/sending/state changes go through SECURITY DEFINER RPCs
  (`ensure_conversation`, `send_chat_message`, `set_conversation_read`,
  `set_conversation_archived`, `delete_conversation`): participant-only,
  block-aware (either direction), race-free (`ON CONFLICT`). The client has
  no direct UPDATE on conversations.
- Realtime delivers inserts only for threads the user participates in (RLS);
  the client ignores its own echoes so each message appears once.
- Per-user inbox state: `read_at_a/b`, `archived_a/b`, `deleted_a/b` on the
  shared row. Deleting MY side sets my `deleted_at` as a **history cutoff** -
  the thread leaves my inbox and, if it revives with new activity, only
  post-delete messages come back (old history stays hidden for me, untouched
  for the other person). Unread = the other participant's messages newer than
  my `read_at` and my cutoff, computed server-side by `get_unread_counts`.
- Deleting/archiving never touches the other participant's copy or the
  messages themselves. Once **both** sides delete, the shared preview is
  cleared (migration 031) so a dead thread never shows a stale last message.

### Notifications

Rows are created **only** by SECURITY DEFINER functions (no client INSERT
policy), so recipients can't be forged. Read/mark-read is recipient-only.
Generated by real events: grade submissions/approvals, messages, tasks,
announcements (audience fan-out), library events.

### Enrollment badge

`enrollment_status` is admin-managed (status, started_at, expires_at). The
effective status is computed from `expires_at` vs. `now()` at read time - no
job needed, and it can't be fooled client-side. Students see a ✓ badge only
while active; admin sees the full record and can enroll/renew/revoke with
both the enrolled-on and expiry dates configurable.

---

## 6. Health & versioning

- `npx tsc --noEmit` - clean
- `npx next build` - compiles all pages
- `npm run lint` - no errors
- Version lives in **one place**: `lib/version.ts` (displayed on all three
  Settings pages) and mirrors `package.json`. Keep both in sync when bumping.

Docs: [README](./README.md) · [DATABASE](./DATABASE.md) · [API](./API.md) ·
[SECURITY](./SECURITY.md) · [FRONTEND](./FRONTEND.md) · [DEPLOYMENT](./DEPLOYMENT.md)
