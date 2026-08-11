# Hierarchy Class — Architecture

**Version 1.0.0.** A gamified academic-tracking platform ("Climb the ranks") for
schools: students, teachers, and admins get role-scoped dashboards built on
Supabase (Postgres + Auth + RLS + Storage) and Next.js 14 (App Router).

This document describes the system as it exists now — every feature is
database-backed; there is no mock-data layer left.

---

## 1. Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router), React 18, TypeScript (strict) |
| Styling | Tailwind CSS, CSS variables (light/dark theme) |
| Backend | Supabase: Postgres, Auth, Realtime, Storage, RLS |
| DB access | `@supabase/ssr` (browser + server clients), typed by `types/supabase.ts` |
| Deployment | Vercel-ready; env vars in `.env.local` |

Everything runs in one Supabase project; multi-tenancy is by `school_id`
column on every school-scoped table, enforced in RLS. The product currently
serves a single school (CSA).

---

## 2. Directory map

```
app/
  layout.tsx            Root layout: all context providers, theme bootstrap, favicon
  middleware.ts         (root) session refresh + role-prefix guard
  page.tsx              Landing → redirects by session
  login/ signup/        Public auth pages (Supabase Auth)
  forgot-password/      Password recovery request
  reset-password/       Password reset (recovery code exchange)
  auth/callback/route.ts  Exchange code → session; recovery → reset page
  api/feedback/route.ts   Server-side feedback → email (Resend)
  student/ home, search, messages, learning-materials, library, quiz,
           leaderboard, profile, settings
  teacher/ home, messages, learning-materials, classroom, quiz, students,
           library-management, settings
  admin/   home, messages, users, programs, students, teachers, reports, settings
  actions/auth.ts       Signup server action (first/last name)
components/
  navigation/           SideNav/BottomNav/AppShell/SiteHeader/NotificationBell
  chat/                 MessengerView (shared by all three roles)
  feed/                 FeedPost, StoriesRail, StoryViewerModal
  admin/                PostEditor, BannerEditor
  auth/ login/signup forms, SchoolSelector, RoleGuard
  ui/                   RankBadge, StatBar, StatRadarChart, EnrolledBadge, CornerFrame
  FeedbackForm.tsx      Shared feedback/report form
lib/
  supabase/             client.ts (browser), auth.ts (server helpers)
  *Store.tsx            React context providers → live Supabase data (see §4)
  useMyProfile, useSchoolProfiles, useLeaderboard, useEnrollment,
  useAccountRequests, useSchools   (data hooks)
  notify.ts             Client wrappers for notification RPCs
  uploadUtils.ts        MIME/size/path validation for uploads
migrations/             001–023 SQL, applied in order (see §8)
scripts/                seed-schools.sql (CSA only), seed.ts, fetch-schools.ts
types/                  supabase.ts (DB types), school.ts, student.ts
```

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
  user whose `user_metadata.role` matches; wrong role → bounce to their own
  home; logged out → `/login?next=...`. `/login`/`/signup` redirect signed-in
  users to their home.
- **Fake-auth fallback**: when `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` are absent,
  middleware blocks nothing and the client stores render empty/error states —
  intentional for UI-only work, a deployment hazard if env vars are forgotten.
- **RoleGuard** re-checks role client-side inside each role layout as a second
  layer (defense in depth; RLS remains the real gate).

### Server-side operations (RPC functions)
Client code can't do everything under RLS, so privileged, atomic operations
live in SECURITY DEFINER functions:

| Function | Purpose |
|---|---|
| `create_notification` | One notification, same-school check |
| `notify_admins` | Fan-out to all admins (grade submissions) |
| `notify_post_audience` | Fan-out announcements by audience (admin only) |
| `ensure_conversation` | Find-or-create both participant rows, block-aware, race-free |
| `send_chat_message` | Insert message, update both sides, block-aware |
| `get_unread_counts` | Unread per conversation from `last_read_at` |
| `get_school_leaderboard` | Aggregate-only rankings (approved grades) |
| `approve_grade_submission` | Batch approve/reject + one notification per teacher |
| `effective_enrollment_status` | Enrolled/expired/revoked at read time |
| `refresh_expired_enrollments` | Bulk expiry (optional hardening) |

---

## 4. Client data layer (stores & hooks)

All providers are mounted in `app/layout.tsx`. They fetch on mount (and
refetch via a tick counter), expose CRUD + helpers, and subscribe to Realtime
where it matters. All are Supabase-backed — **there is no mock data**.

| Provider / hook | Backing tables | Notes |
|---|---|---|
| `ClassroomHierarchyProvider` | programs, sections, courses, course_enrollments, grade_entries | Hierarchy + grades; exposes getters (averages, ranks, leaderboards) |
| `ChatProvider` | conversations, chat_messages, chat_blocks | Single RLS-scoped realtime channel; DB unread; archive/delete/block per user |
| `NotificationsProvider` | notifications | Realtime INSERT on `recipient_id`; mark-all-read |
| `SchoolFeedProvider` | school_feed_posts | Audience-aware feed; admin create/edit/delete + optional image |
| `StoriesProvider` | stories, story_views, `myday` bucket | 24h expiry, uploads, view tracking |
| `MaterialsProvider` | learning_materials, `materials` bucket | Signed URLs; teacher uploads |
| `FriendsProvider` | friends | Same-school enforced by RLS |
| `BannerProvider` | banner_config, `banners` bucket | Admin-managed header image |
| `FlorinProvider` | florin_balances | Read-only balance; no client-side minting |
| `LibraryProvider` | library_books, library_borrow_requests, library_borrow_log | Catalog + borrow flow |
| `QuizProvider` | quizzes, quiz_questions, quiz_attempts | Live quiz system |
| `TeacherTasksProvider` | teacher_tasks | Accept/decline/done → notifications |
| `TeacherWorkspaceProvider` | teacher_notes/schedule/lesson tables (own-work area) | Notes, schedule, lesson plans |
| `useMyProfile` | profiles, `avatars` bucket | Secure avatar upload/remove |
| `useSchoolProfiles` | profiles | School roster by role (RLS-scoped) |
| `useLeaderboard` | `get_school_leaderboard()` RPC | Aggregate-only rankings |
| `useMyEnrollment` / `useAdminEnrollments` | enrollment_status | Effective status computed at read time |
| `useAccountRequests` | account_requests | Submit + admin review |

---

## 5. Key flows

### Grades: submit → approve → leaderboard
1. Teacher picks Program → Section → Course (only their assigned courses are
   visible) and submits scores. Rows are inserted with `approval_status =
   'pending'`; `notify_admins` tells admins.
2. Admin Home groups pending entries by course + submitter + batch and shows
   the real teacher (avatar/name), course, section, program, submit time,
   student count, and status.
3. Admin approves/rejects via `approve_grade_submission`, which flips the rows
   atomically and sends **one** notification to each submitting teacher.
4. Students only ever see their **own approved** rows (RLS), so their stats and
   the leaderboard (aggregate-only RPC over `approval_status='approved'`) reflect
   approved data automatically.

### Messaging
- One shared system across all three roles (`conversations` has one row per
  participant; both rows share a conversation id).
- Creating/sending goes through SECURITY DEFINER RPCs: participant-only,
  block-aware (either direction), race-free (`UNIQUE (participant_id,
  other_user_id)` + `ON CONFLICT`).
- Realtime delivers inserts only for conversations the user participates in
  (RLS); the client ignores its own echoes so each message appears once.
- Per-user inbox state: `archived_at` / `deleted_at` on **your own row** —
  hiding/archiving never affects the other person; a fresh message resurrects
  a hidden thread. Unread = messages newer than your `last_read_at`, computed
  server-side by `get_unread_counts`.

### Notifications
Rows are created **only** by SECURITY DEFINER functions (no client INSERT
policy), so recipients can't be forged. Read/mark-read is recipient-only.
Generated by real events: grade submissions/approvals, messages, tasks,
announcements (audience fan-out), library events.

### MyDay (stories)
`stories` with `expires_at` (24h), image in the private `myday` bucket,
signed URLs at render, query-time active filtering. Views tracked in
`story_views` with `UNIQUE (story_id, viewer_id)`; owner-only viewer lists.

### Enrollment badge
`enrollment_status` is admin-managed (status, started_at, expires_at). The
effective status is computed from `expires_at` vs. `now()` at read time — no
job needed, and it can't be fooled client-side. Students see a ✓ badge only
while active; admin sees the full record and can enroll/renew/revoke.

---

## 6. Security model

- **RLS everywhere**: every table has policies (school-scoped via
  `auth.jwt()` metadata or a profile lookup, role-scoped, ownership-scoped).
- **Grade privacy**: students read only their own approved rows; teachers read
  rows for courses they teach; admins read the school. The leaderboard exposes
  aggregates only, never raw rows.
- **Messaging**: participant-only reads; no UPDATE/DELETE policies on messages;
  sender identity is forced by RLS (`from_id = my profile`), so a user can't
  send as someone else; blocks enforced server-side.
- **Profile protection**: a BEFORE UPDATE trigger blocks non-admins from
  changing role, school, `academic_excellence`, rank, librarian flag.
- **Notifications**: no client INSERT/DELETE; creation only via SECURITY
  DEFINER with same-school checks.
- **Storage**: private buckets (`avatars`, `materials`, `feed`, `myday`,
  `banners`) with owner/school RLS; client uploads validated (MIME whitelist,
  size caps, extension derived from MIME, UUID paths) in `uploadUtils.ts`;
  no service-role keys in the browser.
- **No client-side Florin minting**: all write policies removed; balances are
  read-only until a verified payment flow exists.

---

## 7. Realtime subscriptions

| Channel | Table / event | Scope |
|---|---|---|
| `chat-inbox` | chat_messages INSERT (no filter; RLS-scoped) | One channel, never re-created on list growth |
| `chat-blocks-mine` | chat_blocks all events | Refreshes block list |
| `notifications-mine` | notifications INSERT `recipient_id=eq.me` | Unread bell |

Each is created once per mount and removed on cleanup.

---

## 8. Migrations index (apply in order)

| File | Contents |
|---|---|
| 001 | Core schema: schools, profiles, materials, library, quizzes, chat, friends, feed, banner, florin + base RLS |
| 002 | Fix RLS recursion (school-scoped reads via JWT metadata) |
| 003 | SECURITY DEFINER trigger: auto-create profile on signup |
| 004 | School-wide `profiles` SELECT policy |
| 005 | Fix `auth.jwt()` RLS syntax |
| 006 | Programs, sections, courses, enrollments, grade_entries, teacher_tasks + RLS |
| 007–009 | Library description, add-book (cover/isbn), teacher-task delete policy |
| 010 | Profile avatar column + storage |
| 011 | JSONB array defaults |
| 012 | Quizzes link to courses |
| 013 | Friends RLS (same-school) |
| 014 | notifications + RLS, conversations.last_read_at, chat RPCs, notify fan-out |
| 015 | stories + story_views + myday bucket |
| 016 | enrollment_status + effective-status function |
| 017 | profiles first/last name backfill |
| 018 | feed posts: author_id, audience, image_path + storage bucket |
| 019 | materials RLS + bucket |
| 020 | grade approval_status, hardened grade RLS, account_requests |
| 021 | banner bucket |
| 022 | Security hardening: profile column guard, chat insert identity, friends same-school, no client Florin, leaderboard aggregate RPC |
| 023 | Messaging overhaul: dedupe + unique pair, archive/delete/last_message_at, chat_blocks, rewritten RPCs, get_unread_counts, approve_grade_submission, admin profile update, nullable feed title |

---

## 9. Health & versioning

- `npx tsc --noEmit` — clean
- `npx next build` — compiles, 39/39 pages
- `npx next lint` — no errors (one pre-existing hook-deps warning in `lib/quizStore.tsx`)
- Version is maintained in `package.json`, the three Settings pages, and this repo's README.
