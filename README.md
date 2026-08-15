# Hierarchy Class

**Climb the ranks.**

Hierarchy Class is a gamified academic tracking platform for students,
teachers, and school administrators. It turns the school report card into an
RPG-style character sheet: real grades become **Academic Excellence** scores
and tiered **ranks** (S++ down to D), while grading data stays strictly
controlled by teachers and admins. It blends the social feel of a profile app
with the structure and accountability of a school information system.

**Current version:** `1.2.24`

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
- **Habit tracker** - weekly study/exercise/reading/sleep/focus targets on
  the student dashboard.
- **Weekly progress** chart derived from real approved grades.
- **Library** with barcode (camera or USB scanner) ISBN lookup and a borrow
  flow.
- **Quiz engine**, **learning materials** with private storage, **Florin**
  currency balances (read-only until payments exist).
- **Dark & light themes** - flat, minimal console design with a single
  1px-border card system and a grey/blue (Great Falls) accent.

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

## Recent highlights

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
