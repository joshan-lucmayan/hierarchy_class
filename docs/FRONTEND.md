# Hierarchy Class — Frontend

Next.js 14 (App Router) + React 18 + TypeScript + Tailwind. Pages live in
`app/`, reusable UI in `components/`, and the data layer in `lib/`.

---

## 1. Pages by role

| Area | Pages |
|---|---|
| Public | `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/` (redirect) |
| Student | `/student/home`, `/student/search`, `/student/messages`, `/student/learning-materials`, `/student/library`, `/student/quiz`, `/student/leaderboard`, `/student/profile`, `/student/profile/[id]`, `/student/habits`, `/student/settings` |
| Teacher | `/teacher/home`, `/teacher/classroom`, `/teacher/students`, `/teacher/quiz`, `/teacher/learning-materials`, `/teacher/library-management`, `/teacher/messages`, `/teacher/settings` |
| Admin | `/admin/home`, `/admin/users`, `/admin/programs`, `/admin/students`, `/admin/teachers`, `/admin/reports`, `/admin/messages`, `/admin/settings` |

Each role has its own `layout.tsx` (wraps `AppShell` + RoleGuard) and
`loading.tsx`.

---

## 2. Data layer

**Stores** are React context providers mounted in `app/layout.tsx` — they
fetch on mount, refetch on a tick, and subscribe to Realtime. **Hooks** are
per-page (leaderboard, rosters, enrollment). All are Supabase-backed; there
is no mock data.

| Provider / hook | Purpose |
|---|---|
| `ClassroomHierarchyProvider` | Programs → sections → courses → enrollments + grade getters |
| `ChatProvider` | Shared-thread messaging (see ARCHITECTURE §5) |
| `NotificationsProvider` | Notification bell + mark read |
| `SchoolFeedProvider` | Feed/announcements |
| `StoriesProvider` | MyDay stories |
| `MaterialsProvider` | Course materials |
| `HabitProvider` | Weekly habit tracking |
| `FriendsProvider` | Friends |
| `BannerProvider` | Header banner |
| `FlorinProvider` | Read-only currency balance |
| `LibraryProvider` | Catalog + borrow flow |
| `QuizProvider` | Quiz engine |
| `TeacherTasksProvider` | Teacher tasks |
| `TeacherWorkspaceProvider` | Teacher notes/schedule/lesson plans |
| `useMyProfile` | Current profile + avatar upload |
| `useSchoolProfiles` | School roster by role |
| `useLeaderboard` | Rankings + `averageOf` |
| `useMyEnrollment` / `useAdminEnrollments` | Enrollment status |
| `useAccountRequests` | Deactivate/delete requests |

---

## 3. Design system

- **Tokens** in `app/globals.css` (`--bg`, `--surface`, `--border`, `--muted`,
  `--text`, `--gold`, ...). Light theme on `:root`, dark theme on `.dark`
  (default), toggled by `ThemeToggle` and persisted in `localStorage` under
  `hc-theme`.
- **Tailwind** with the token set in `tailwind.config.ts`; a few utility
  classes (`text-navy`, `bg-tile`, `border-base`, ...) are defined in
  `globals.css` so they follow the theme variables.
- **Cards**: `CornerFrame` — flat 1px hairline border, 10px radius, no shadow.
- **Accent**: Great Falls (`--gold`) — used for ranks, fills, primary accents.
- **Shared UI** in `components/ui/`: `RankBadge`, `StatBar`, `StatRadarChart`,
  `EnrolledBadge`, `UserAvatar`, `CornerFrame`, `CrownMark` (logo), `CoinIcon`.

**Design rules of thumb:**
- Use tokens/utilities, never hardcode hex values.
- New features that read/write data follow the store pattern (provider +
  Supabase + Realtime) and get a numbered migration in `database/migrations/`.

---

## 4. Key flows (user-facing)

1. **Rank visibility** — `RankBadge` shows rank + Academic Excellence with a
   progress bar; student home right column shows profile/rank, weakest
   subject, subject stats, habit tracker, weekly progress.
2. **Search** — `QuickSearchBar`: typing shows results; **clicking a result
   opens an in-place profile preview** (`ProfileModal`) without leaving the
   page; **Enter** goes to the full search results page.
3. **Messaging** — `MessengerView` is shared across all roles: search people,
   start/open threads, send, archive, delete (per-user), block, mark unread;
   the nav shows an unread dot (`MessagesBadge`) until all threads are read.
4. **Grades** — teacher submits (pending) → admin approves/rejects → approved
   grades flow to student stats and the leaderboard in realtime.
5. **Habits** — five habits, weekly 10x target; clicking a row toggles
   today's entry (real DB writes + optimistic update).
6. **Theming** — light/dark toggle in every role's settings page; version
   shown there too (from `lib/version.ts`).
