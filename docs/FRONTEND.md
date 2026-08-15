# Hierarchy Class - Frontend

Next.js 14 (App Router) + React 18 + TypeScript + Tailwind. Pages live in
`app/`, reusable UI in `components/`, and the data layer in `lib/`.

---

## 1. Pages by role

| Area | Pages |
|---|---|
| Public | `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/` (redirect) |
| Student | `/student/home`, `/student/search`, `/student/messages`, `/student/learning-materials`, `/student/library`, `/student/quiz`, `/student/leaderboard`, `/student/profile`, `/student/profile/[id]`, `/student/habits`, `/student/settings` |
| Teacher | `/teacher/home`, `/teacher/classroom`, `/teacher/students`, `/teacher/quiz`, `/teacher/learning-materials`, `/teacher/library-management`, `/teacher/messages`, `/teacher/settings` |
| Admin | `/admin/home`, `/admin/users`, `/admin/programs`, `/admin/students`, `/admin/teachers`, `/admin/reports`, `/admin/ranks`, `/admin/messages`, `/admin/settings` |

Each role has its own `layout.tsx` (wraps `AppShell`) and `loading.tsx`.

---

## 2. Data layer

**Stores** are React context providers mounted in `app/layout.tsx` - they
fetch on mount, refetch on a tick, and subscribe to Realtime. **Hooks** are
per-page (leaderboard, rosters, enrollment). All are Supabase-backed; there
is no mock data.

| Provider / hook | Purpose |
|---|---|
| `ClassroomHierarchyProvider` | Education levels -> programs -> year/levels -> courses -> enrollments + grade getters |
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
| `useRankStore` (`RankProvider`) | School-wide rank state - `rankOf(profileId)` + `sorted` (best-first); realtime refetch on `student_rank_state` |
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
- **Cards**: `CornerFrame` - flat 1px hairline border, 10px radius, no shadow.
- **Accent**: Great Falls (`--gold`) - used for ranks, fills, primary accents.
- **Shared UI** in `components/ui/`: `RankBadge` (fed by the rank engine:
  rank letter hero + bar / EX score + track), `StatBar`, `StatRadarChart`,
  `EnrolledBadge`, `UserAvatar`, `CornerFrame`, `CrownMark` (logo), `CoinIcon`.

### 3.1 UI plan and rationale

The whole interface follows one idea: **flat, quiet, typographic - the data
is the decoration.** No gradients, no glows, no drop shadows, no hero
images inside the card system. Every card is a flat panel defined only by a
1px hairline border; color is used sparingly (one accent, one warning tone,
neutrals everywhere else) so the rank bar and the numbers stand out.

Layout:

- **Sidebar** - fixed-width icon rail on the left (the app brand at the
  top, nav icons below, avatar + sign-out at the foot). The active item gets
  a subtle background tint and a 2px accent left-border; hovering shows a
  small tooltip label. Icons come from the already-loaded icon set - no new
  icon dependency.
- **Top bar** - school name on the left; on the right the currency pill
  (coin icon + balance + small "+") and a notification bell with a small
  unread dot.
- **Search bar** - flat rounded rectangle under the top bar (students,
  teachers, people).
- **Content** - a two-column grid on the student home: the left column is
  the school feed (StoriesRail + feed posts), the right column stacks the
  five cards in a fixed order: **Profile/rank card → Weakest Subject →
  Subject Stats → Habit Tracker → Weekly Progress** (16px gap between).

Why this design?

- **Tokens over hex.** Every color routes through CSS variables, so the
  light/dark theme and any future rebrand happen in one file
  (`app/globals.css`), not across hundreds of pages.
- **Shared primitives.** `CornerFrame`, `RankBadge`, `UserAvatar`,
  `EnrolledBadge` are used by student, teacher, and admin pages alike - fix
  them once and every role picks up the change (this is how the rank
  redesign reached all roles without per-page edits).
- **One accent.** The rank system is the game; the accent (Great Falls) is
  reserved for it plus primary actions. Everything else is neutral greys so
  nothing competes.
- **Real data everywhere.** No mock UI - every number on screen is fetched
  from Supabase (rank state, grades, habits, weekly progress) and updates
  through Realtime.

### 3.2 Color palette (tokens)

Both themes share the same token names; only the values differ. **Never
hardcode a hex in a component** - use the token via `var(--token)` or the
Tailwind utility classes that map to them.

#### Dark theme (default, `.dark`)

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#0f0f11` | Page background |
| `--kettle` | `#141214` | Sidebar background |
| `--surface` | `#17181b` | Cards / panels |
| `--surface-strong` | `#1a1b1e` | Hover / active panels |
| `--tile` | `#1a1b1e` | Inputs, chips, icon tiles, pills |
| `--border` | `#232327` | Card hairline (line-soft) |
| `--line` | `#2a2b2f` | Progress tracks, stronger lines |
| `--text` | `#f0f0f1` | Primary text |
| `--muted` | `#9a9ba1` | Secondary text |
| `--faint` | `#6c6d73` | Labels / captions / section headings |
| `--gold` | `#9ea7b3` | **Accent** (Great Falls) - ranks, fills, primary actions |
| `--sealion` | `#7f8995` | Fills, active borders |
| `--asphalt` | `#464c55` | Avatar placeholders, spark bars |
| `--warn` | `#c98f8f` | Salmon warning text ("tracking" pill, unread) |
| `--warn-fill` | `#8a5f5f` | Sparkline low bars |
| `--low-fill` | `#5b5f66` | Lowest stat fill |
| `--btn` | `#525b69` | Primary button fill (lifted above the page) |
| `--on-accent` | `#141214` | Dark text that always sits on the accent |
| `--shadow` | `0 0 0 1px var(--border)` | The only "shadow" - a hairline |

#### Light theme (`:root`)

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#e9eaed` | Page background |
| `--kettle` | `#e1e2e6` | Sidebar background |
| `--surface` | `#f5f6f8` | Cards / panels |
| `--surface-strong` | `#f7f8fa` | Hover / active panels |
| `--tile` | `#edeef1` | Inputs, chips, icon tiles, pills |
| `--border` | `#d6d8dd` | Card hairline |
| `--line` | `#c8cbd1` | Progress tracks, stronger lines |
| `--text` | `#23252a` | Primary text |
| `--muted` | `#565a63` | Secondary text |
| `--faint` | `#8b8e97` | Labels / captions |
| `--gold` | `#8a94a0` | **Accent** (Great Falls, deepened for light surfaces) |
| `--sealion` | `#8a95a1` | Fills, active borders |
| `--asphalt` | `#b6bbc3` | Avatar placeholders, spark bars |
| `--warn` | `#b0605a` | Salmon warning text |
| `--warn-fill` | `#b47a74` | Sparkline low bars |
| `--low-fill` | `#a7acb4` | Lowest stat fill |
| `--btn` | `#3d434e` | Primary button fill (deep slate, visible on light) |
| `--on-accent` | `#141214` | Dark text on the accent |
| `--shadow` | `0 0 0 1px var(--border)` | The only "shadow" |

**Design rules of thumb:**
- Use tokens/utilities, never hardcode hex values.
- Cards are flat: 1px hairline border (`--border`), 10px radius, no glow.
- One accent (`--gold`), one warning tone (`--warn`), neutrals everywhere
  else.
- New features that read/write data follow the store pattern (provider +
  Supabase + Realtime) and get a numbered migration in `database/migrations/`.

---

## 4. Key flows (user-facing)

1. **Rank visibility** - `RankBadge` reads the **non-linear rank engine**
   (per-entry isolated fill -> power curve x weight share -> fill-first bar -
   see `docs/RANK_SYSTEM.md` for the full math). The rank letter is the hero
   (D -> C -> B -> A -> S -> S+ -> S++ -> **EX**); beneath it sits the bar as
   `N / 100` (or the open-ended EX score, uncapped, no `/100`).
   Student home/profile cards show the full badge; search results,
   leaderboard rows, and teacher/admin rosters show a compact `{rank} Rank`
   pill. The   student profile also renders **season history** cards from
   `get_season_history`. Data flows through `lib/rankStore.tsx` (mounted in
   `app/layout.tsx`).

   **Entering scores** (what makes ranks move): the ONLY way scores reach the
   engine is grades - there is no separate rank-entry page. A teacher
   configures each course's categories on `/teacher/classroom` - add, remove
   or edit category labels and weights (array saved via
   `save_course_rank_weights`, weights summing to 100%) - then enters each
   student's earned score and the "out of" max (e.g. 24 out of 50). The
   submit form's category picker shows exactly the course's configured
   categories. **Semester gate (044):** if the admin hasn't declared an
   active semester yet, the submit form is blocked with a "contact your
   admin" notice - enforced both in the UI (via `get_active_semester`) and
   at the database level (a BEFORE INSERT trigger rejects the write). The
   admin approving a grade in Admin -> Grade Submissions triggers
   `process_score_entry` automatically (type label -> category key
   via the course's rows, `score/max_score`, the **active semester** as
   period, course weights, exactly-once).
   Rejecting (or deleting) an approved grade **reverts its rank effect**
   (the feed entry is removed and the rank/bar are recomputed from the
   period-start baseline through the remaining grades - even a bulk clear of
   all course data collapses cleanly). Admins declare the semester
   (start/end dates) and watch the standings / run the season end from
   `/admin/ranks`.
2. **Search** - `QuickSearchBar`: typing shows results; **clicking a result
   opens an in-place profile preview** (`ProfileModal`) without leaving the
   page; **Enter** goes to the full search results page.
3. **Messaging** - `MessengerView` is shared across all roles: search people,
   start/open threads, send, archive, delete (per-user), block, mark unread;
   the nav shows an unread dot (`MessagesBadge`) until all threads are read.
4. **Grades** - teacher submits (pending) -> admin approves/rejects -> approved
   grades flow to student stats and the leaderboard in realtime.
5. **Habits** - five habits, weekly 10x target; clicking a row toggles
   today's entry (real DB writes + optimistic update).
6. **Theming** - light/dark toggle in every role's settings page; version
   shown there too (from `lib/version.ts`).
7. **Academic info (admin)** - Admin -> Students -> Academic info picks
   education level -> program -> year/level (or **None** to clear); saving
   auto-enrolls the student in that year's courses via `autoEnrollInSection`
   and the roster/identity updates everywhere through realtime.
