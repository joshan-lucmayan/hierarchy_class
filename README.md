# Hierarchy Class

**Climb the ranks.**

Hierarchy Class makes **school feel like a game worth playing**. It is a
gamified academic tracking platform for students, teachers, and school
administrators that turns the report card into an RPG-style character sheet:
real grades become tiered **ranks** (S++ down to D), habits build streaks,
and every day's work moves you up the ladder. The point is engagement -
students stay productive, **beat procrastination**, and keep improving
academically, while grading data stays strictly controlled by teachers and
admins. It blends the social feel of a profile app with the structure and
accountability of a school information system.

**Current version:** `1.4.25`

---

## What it's for

Each school builds its own academic hierarchy - **Education Levels** ->
**Programs** -> **Year/Levels** -> **Courses**, each assigned to a teacher and
enrolled with real students.
Teachers submit daily grades, admins approve them through a review queue, and
students see live ranks, progress charts, and a social-style profile on top
of verified academic data.

Students can personalize their profile (bio, hobbies, tags, favorite subject,
profile picture) but can never edit grades or ranks. Sensitive information
(home address, contact details) is never displayed on any profile.

## Roles

| Role | What they do |
|---|---|
| **Student** | View their live rank & progress, school feed, leaderboard, materials, library; message classmates/teachers; track weekly habits |
| **Teacher** | Submit grades per course, manage assigned tasks, upload learning materials, run quizzes, manage the library catalog, use a personal workspace (notes, schedule, lesson plans) |
| **Admin** | Build the program/section/course hierarchy, enroll students, assign teachers, review/approve grade submissions, monitor progress, manage the school |

Each admin account is scoped to exactly **one school**.

## Key features

- **Non-linear rank engine** - category percentages (quiz/exam/activity/
  participation) accumulate per grading period, compress through a power curve
  (`Adjusted = 100·(S/100)^k`), and move a fill-first rank bar from **D** up
  through **C · B · A · S · S+ · S++** and into the open-ended **EX** tier.
  Promotions are fill-first, demotions are overflow-based and capped at two
  tiers per entry, and seasons reseed ranks from the season's **final** rank
  (the peak is kept in history and drives the all-time highest-rank record).
  Every knob (weights, `k`, tier lengths, EX step, season reset map) is
  configurable per school.
- **Live ranks & leaderboard** - the rank engine drives the leaderboard,
  profile/home rank cards, teacher rosters, and admin views in realtime
  (validate -> preview -> confirm with an audit log on every write).
- **Grade approval queue** - teacher submissions go to admins as pending;
  only approved grades count toward stats.
- **Messaging** - one shared chat across all three roles with unread badges,
  archive, per-user delete, and blocking.
- **School feed & announcements**, **MyDay stories**, **notifications**.
- **Habit tracker** - a full personal tracker: five default habits (Study
  5x/week, Exercise 4x/week, Reading 30 min/day, Sleep 8 h/day, Focus
  60 min/day) plus custom habits with goal types (completion/count/
  duration/quantity), daily vs weekly targets, scheduled days, streaks that
  follow the schedule, pause/resume/archive, and a history calendar.
  Entries are one per (habit, day) at the database level; habits never touch
  the rank engine or grades.
- **Weekly progress** chart derived from real approved grades.
- **Library** with barcode (camera or USB scanner) ISBN lookup and a borrow
  flow.
- **Quiz engine**, **learning materials** with private storage, **Florin**
  currency balances.
- **Florin shop** - a Discord-style store where students buy decorative
  page backgrounds, profile card backgrounds, and avatar borders with their
  balance. Purchases and equipping run through SECURITY DEFINER RPCs (no
  client-side minting), the equipped page  background renders behind the student pages, the equipped avatar border follows that user's avatar
  across the whole app, and the equipped profile card background shows on
  their profile card when anyone views them. Buying happens in the shop;
  equipping happens in the **Wardrobe** on the student's profile page.
- **Midnight & Rose themes** - a theme picker replaces the old dark/light
  toggle: **Midnight** (the cool slate palette) and **Rose** (a soft pink
  palette - Mountain Mist, Cavern Pink, Oyster Pink, Fair Pink, Athens
  Gray). Pick one from any role's settings; it's applied before first paint
  and remembered per browser. The **default avatar** is theme-adaptive: a
  gray silhouette in Midnight, and in Rose a Cavern Pink silhouette - so
  students without a profile photo still get a placeholder that fits their
  theme.
- **Public landing & auth** - a cinematic marketing page at `/` (crown mark,
  king/queen chess motif, animated hero tagline "Procrastination is just an
  illusion."), a tabbed login/signup card shared by the auth pages, detailed
  Terms & Privacy pages (required on signup), and GitHub attribution. The
  landing copy tracks the live feature set (rank engine, habits, classroom
  grading, florin shop & wardrobe, Midnight/Rose themes, messaging, library,
  quiz). Logging out lands back on this page rather than the login form.

## Tech stack

- **Framework:** Next.js 14 (App Router) · **Language:** TypeScript
- **Styling:** Tailwind CSS with theme tokens (dark default, light optional)
- **Backend / Auth / Database:** Supabase - Postgres, Row-Level Security,
  Auth, Realtime, Storage
- **Charts:** Recharts · **Barcode:** `html5-qrcode` + HID scanner input
- **Hosting:** Vercel

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's values
npm run dev
```

Visit `http://localhost:3000`.

For a new or upgraded database, apply the numbered migrations in
`database/migrations/` - see [`database/README.md`](database/README.md).

## Deployment

The site runs on five services, each with one job: **GitHub** (source +
version control, triggers deploys), **Vercel** (hosts and builds the Next.js
app, auto-deploys from `main`), **Supabase** (PostgreSQL, Auth, RLS,
Realtime, Storage), **Cloudflare** (DNS, domain routing, DDoS protection,
security, CDN), and **Digital Plat Dev** (domain registrar). The only env
vars needed at runtime are `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (set in Vercel, never in the repo).

Full walkthrough - connecting the repo, Vercel build settings, Supabase
setup, Cloudflare records, and the release/rollback flow - lives in
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Recent highlights

- **Habit Tracker hardening (1.4.25)** - the tracker is fully wired to real
  data with no dead buttons: the detail modal stays in sync with the store
  (after Edit/Pause the modal immediately shows the new state; after
  Archive/Delete it closes instead of lingering), double-tapping Pause can
  no longer create duplicate pause windows (which used to break Resume),
  archiving now appears in the Archived section instantly, the home widget
  shows busy/error feedback on its check buttons instead of silently doing
  nothing, and the page keeps its skeleton while the profile is still
  loading instead of flashing an empty state. A user guide lives in
  `docs/HABITS.md`.
- **Midnight & Rose themes (1.3.24)** - the dark/light toggle is gone,
  replaced by a **theme picker** on the profile (and every role's settings):
  **Midnight** keeps the cool slate palette; **Rose** is the girls' soft pink
  theme built from the five requested colors (Mountain Mist #98979C, Cavern
  Pink #D9BBBD, Oyster Pink #EAD0D1, Fair Pink #F6E8E7, Athens Gray
  #EEEEF0). The choice is remembered per browser and applied before first
  paint.
- **Florin shop & wardrobe (1.3.24)** - `/student/shop` is a Discord-style
  store with three sellable decoration types: **page backgrounds** (Chess
  Court, Samurai Sword, and the girls' Pink Butterfly + Pink Cat),
  **profile card backgrounds** (four crafted SVG cards - Royal Slate,
  Midnight Board, Gold Ribbon, Crown Court), and **avatar borders**
  (colored rings). Buying deducts the balance and records a
  `florin_transaction` through `purchase_shop_item`; equipping happens in
  the **Wardrobe** on the student's profile through `equip_shop_item` - both
  SECURITY DEFINER RPCs, so a student can't mint coins or equip unowned
  items. The equipped page background renders behind every student page
  (`PageBackdrop`), the equipped profile card renders behind the student's
  card on home, their own profile, the viewed profile + preview modal, and
  the equipped avatar border shows as a colored ring on that user's avatar
  everywhere (feed, chat, search, leaderboard, profiles, rosters). Schema:
  migrations `050_shop.sql` + `051_profile_card_shop.sql` +
  `052_girls_theme_shop.sql`.
- **Inside/outside blend (1.2.24)** - the three role dashboards (student,
  teacher, admin) now share the public pages' typography: IBM Plex Mono
  uppercase eyebrows for every section label (`.section-label`), Cinzel for
  the greeting headings and the student profile name, and the crown mark in
  the sidebar brand - so the app reads as one product from landing page to
  dashboard.
- **Mission-led landing (1.2.24)** - the hero now opens with the product
  mission: "Our main focus is simple: make school feel like a game worth
  playing. Ranks, streaks, and habits turn everyday work into real progress,
  so students stay engaged, beat procrastination, and keep improving
  academically." - everything on the page (roles, features, the ladder,
  auth) points back at that promise.
- **Public web (1.2.24)** - the root route is now a full marketing landing
  page instead of a redirect: fixed atmospheric background (crown watermark,
  floating king/queen chess pieces, ribbons, grain), a page-filling hero
  tagline with per-letter cascade + shimmer + sparkles, roles/features/
  rank-ladder/tech sections, and an in-page auth card with working Log in /
  Sign up tabs. `/login`, `/signup`, `/forgot-password`, `/reset-password`
  share the same rotating-border `AuthCard` + `AuthTabs` over the same
  background, and `/terms` + `/privacy` add a detailed, signup-gated legal
  layer. Fonts (Inter/Cinzel/IBM Plex Mono) load once in the layout so the
  in-app pages and the public pages blend.

- **Rank system v2 (1.2.x)** - the full non-linear rank engine shipped across
  the app: rank cards on home/profile (rank letter is the hero, the bar or EX
  score sits smaller underneath), a rank-engine leaderboard, season history
  cards on the profile, and live rank pills in teacher/admin rosters and the
  school directory. Backed by `lib/rankEngine.ts` (pure, unit-tested),
  `lib/rankStore.tsx` (realtime provider), and migrations 034-049 (tables +
  RLS + SECURITY DEFINER RPCs). Since 1.2.24 the fill is **per-entry
  isolated** - each grade moves the bar by its own score x its category's
  weight share, with no running averages. See `docs/RANK_SYSTEM.md` for the
  full, user-readable explanation.
- **Grades drive ranks** - grades are the only way scores reach the rank
  engine. Teachers configure each course's category weights (percentages
  summing to 100%) and enter earned/"out of" scores on `/teacher/classroom`;
  the admin approving a grade auto-feeds it (type -> category, score/max,
  the active semester as period, course weights, exactly-once per grade).
  Rejecting (or deleting) an approved grade **reverts its effect** - the
  rank/bar are recomputed from the period baseline through the remaining
  grades, so even clearing all course data collapses cleanly.
- **Semester control (admin)** - admins declare the semester (start/end
  dates, school year, label) from `/admin/ranks`; it becomes the grading
  period, and the end-of-semester action reseeds every student from their
  season final rank (peak recorded in history).
- **Search-result profile modal** - clicking a person in search opens their
  profile in place without leaving the current menu; the Message button sits
  aligned with the name.
- **Social-style profiles** - Instagram-style pencil edit, bio under the
  course/year line, hobbies shown as viewers see them.
- **Light-mode fixes** - theme-aware buttons and sidebar hovers keep light
  mode light.
- **Chat delete fix** - re-messaging after deleting a conversation no longer
  resurfaces the old message as a preview.
- **Rank-first UI** - the rank badge is the hero on profile/home cards;
  leaderboard rows show just the rank.
- **Enrollment dates** - admins set both the enrolled-on and expiry dates.
- **Education Level Management** - admins build levels -> programs ->
  year/levels -> courses, and Academic info in the student monitor saves a
  student's level/program/year and auto-enrolls them in that year's courses.

## Documentation

Full documentation lives in [`docs/`](docs/README.md): architecture, the
backend (Supabase Postgres + RLS + RPC + realtime + storage and Next.js server
code), database schema & migrations, API surface, security model, and
frontend guide.

## Not yet implemented

- Real payments for Coin Charisma (purchases stay disabled)
- Account deletion actually removing data (requests are recorded for admin review)
- School logos in the school picker
