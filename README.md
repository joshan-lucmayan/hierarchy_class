# Hierarchy Class

**Climb the ranks.**

Hierarchy Class is a gamified academic tracking platform for students,
teachers, and school administrators. It turns the school report card into an
RPG-style character sheet: real grades become **Academic Excellence** scores
and tiered **ranks** (S++ down to D), while grading data stays strictly
controlled by teachers and admins. It blends the social feel of a profile app
with the structure and accountability of a school information system.

**Current version:** `1.1.22`

---

## What it's for

Each school builds its own academic hierarchy — **Education Levels** →
**Programs** → **Year/Levels** → **Courses**, each assigned to a teacher and
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

- **Live ranks & leaderboard** — approved grades flow into a student's
  Academic Excellence and rank in realtime; no separate publish step.
- **Grade approval queue** — teacher submissions go to admins as pending;
  only approved grades count toward stats.
- **Messaging** — one shared chat across all three roles with unread badges,
  archive, per-user delete, and blocking.
- **School feed & announcements**, **MyDay stories**, **notifications**.
- **Habit tracker** — weekly study/exercise/reading/sleep/focus targets on
  the student dashboard.
- **Weekly progress** chart derived from real approved grades.
- **Library** with barcode (camera or USB scanner) ISBN lookup and a borrow
  flow.
- **Quiz engine**, **learning materials** with private storage, **Florin**
  currency balances (read-only until payments exist).
- **Dark & light themes** — flat, minimal console design with a single
  1px-border card system and a grey/blue (Great Falls) accent.

## Tech stack

- **Framework:** Next.js 14 (App Router) · **Language:** TypeScript
- **Styling:** Tailwind CSS with theme tokens (dark default, light optional)
- **Backend / Auth / Database:** Supabase — Postgres, Row-Level Security,
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
`database/migrations/` — see [`database/README.md`](database/README.md).

## Recent highlights

- **Search-result profile modal** — clicking a person in search opens their
  profile in place without leaving the current menu; the Message button sits
  aligned with the name.
- **Social-style profiles** — Instagram-style pencil edit, bio under the
  course/year line, hobbies shown as viewers see them.
- **Light-mode fixes** — theme-aware buttons and sidebar hovers keep light
  mode light.
- **Chat delete fix** — re-messaging after deleting a conversation no longer
  resurfaces the old message as a preview.
- **Rank-first UI** — the rank badge is the hero on profile/home cards;
  leaderboard rows show just the rank.
- **Enrollment dates** — admins set both the enrolled-on and expiry dates.
- **Education Level Management** — admins build levels → programs →
  year/levels → courses, and Academic info in the student monitor saves a
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
