# Hierarchy Class

**Make school feel like a game worth playing.**

Hierarchy Class is a gamified academic tracking platform for students, teachers, and school administrators that turns the report card into an RPG-style character sheet: real grades become tiered **ranks** (S++ down to D), habits build streaks, and every day's work moves you up the ladder. The point is engagement - students stay productive, beat procrastination, and keep improving academically, while grading data stays strictly controlled by teachers and admins. It blends the social feel of a profile app with the structure and accountability of a school information system.

**Current version:** `1.7.32`

---

## What it's for

Each school builds its own academic hierarchy - **Education Levels** -> **Programs** -> **Year/Levels** -> **Courses**, each assigned to a teacher and enrolled with real students. Teachers submit daily grades, admins approve them through a review queue, and students see live ranks, progress charts, and a social-style profile on top of verified academic data.

Students can personalize their profile (bio, hobbies, tags, favorite subject, profile picture) but can never edit grades or ranks. Sensitive information (home address, contact details) is never displayed on any profile.

## Roles

| Role | What they do |
|---|---|
| **Student** | View their live rank & progress, school feed, leaderboard, materials, library; message classmates/teachers; track weekly habits |
| **Teacher** | Submit grades per course, manage assigned tasks, upload learning materials, run quizzes, manage the library catalog, use a personal workspace (notes, schedule, lesson plans), and a customizable Home command center |
| **Admin** | Build the program/section/course hierarchy, enroll students, assign teachers, review/approve grade submissions, monitor progress, manage the school, and a customizable Home command center |

Each admin account is scoped to exactly **one school**.

## Customizable Home dashboards

Teacher and Admin Home pages are personal command centers built from widgets - empty by default, so each user arranges what matters to them. Customization lives in **Settings -> Home Dashboard -> Customize Home** (there is no Customize button on the Home pages themselves).

- Pick from the app's real widgets (classes, grading status, schedule, lesson plans, notes, tasks for teachers; school snapshot, academic/hierarchy health, attention center, grade pipeline, enrollment health, teacher workload, pending grades, account requests, teacher tasks, recent activity, school feed & announcements for admins).
- Drag to reorder, drag card edges to resize (width cycles small/medium/large/full, height toggles tall), remove, or add.
- Start from a developer-created **preset** (loaded as a draft you can still modify) or build from scratch. Cancel discards a session; Clear Home empties the dashboard.
- Layouts persist per user (`teacher_dashboard_prefs` / `admin_dashboard_prefs`), are presentation-only, and never touch the underlying data - removing a widget never deletes a grade, post, or task. Teacher Workspace (`/teacher/workspace`) remains the place for detailed teaching work.

## Key features

- **Non-linear rank engine** - category percentages accumulate per grading period, compress through a power curve (`Adjusted = 100·(S/100)^k`), and move a fill-first rank bar from **D** up through **C · B · A · S · S+ · S++** and into the open-ended **EX** tier. Every knob (weights, `k`, tier lengths, EX step, season reset map) is configurable per school.
- **Live ranks & leaderboard** - realtime across the app, with validate -> preview -> confirm and an audit log on every write.
- **Grade approval queue** - teacher submissions go to admins as pending; only approved grades count toward stats.
- **Messaging** - one shared chat across all three roles with unread badges, archive, per-user delete, and blocking.
- **School feed & announcements** (admin-created posts carry an "Administrator" badge), **MyDay stories**, **notifications**.
- **Student achievements** - post certificates (title, school year, date awarded, school) with a raw image upload (public `certificates` bucket, owner-folder RLS, 10 MB cap); the profile shows a title-only 3×3 grid that opens a detail modal and a full-screen certificate viewer. Other students see a read-only version.
- **Student music** - post music by link (YouTube / Spotify / Apple Music / SoundCloud / Vimeo): the app resolves title, artist, and album cover server-side via keyless oEmbed / iTunes lookup (Spotify upgrades to the Web API when server-only env vars are set) and links out to the original track.
- **Habit tracker** - default and custom habits with goal types, scheduled days, streaks, pause/resume/archive, and a history calendar. Entries are one per (habit, day) at the database level; habits never touch the rank engine or grades.
- **Account lifecycle** - students and teachers can deactivate their own account (reversible, nothing is deleted) and reactivate it from the sign-in flow with a welcome-back notification. Permanent deletion is admin-approved: the account and personal data are removed while school-required academic records are preserved and anonymized (migration 058), and user storage objects are cleaned up via a server-only service-role client. Admins have no in-app deactivate/delete controls - account changes for administrators go through the developer.
- **Weekly progress** chart derived from real approved grades.
- **Library** with barcode (camera or USB scanner) ISBN lookup and a borrow flow.
- **Quiz engine**, **learning materials** with private storage, **Florin** currency balances.
- **Florin shop & wardrobe** - students buy decorative page backgrounds, profile card backgrounds, and avatar borders. Purchases and equipping run through SECURITY DEFINER RPCs (no client-side minting).
- **Midnight & Rose themes** - pick either from any role's settings; applied before first paint and remembered per browser.

## Tech stack

- **Framework:** Next.js 14 (App Router) · **Language:** TypeScript
- **Styling:** Tailwind CSS with theme tokens (Midnight + Rose)
- **Backend / Auth / Database:** Supabase - Postgres, Row-Level Security, Auth, Realtime, Storage
- **Charts:** Recharts · **Barcode:** `html5-qrcode` + HID scanner input
- **Hosting:** Vercel

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's values
npm run dev
```

Visit `http://localhost:3000`.

For a new or upgraded database, apply the numbered migrations in `database/migrations/` - see [`database/README.md`](database/README.md).

## Project structure

- `app/` - Next.js App Router pages, one folder per role route (`student/`, `teacher/`, `admin/`) plus public pages (`landing`, auth, terms).
- `components/` - shared UI primitives (`ui/`), role components, feed, dashboard widgets.
- `lib/` - React providers and stores (auth, classroom hierarchy, ranks, tasks, school feed, dashboard preferences), pure logic (rank engine, week utils), and Supabase clients.
- `database/migrations/` - numbered SQL migrations (schema, RLS, RPCs).
- `docs/` - architecture, frontend, rank system, habits, deployment, and database documentation.

## Deployment

The site runs on five services, each with one job: **GitHub** (source + version control, triggers deploys), **Vercel** (hosts and builds the Next.js app, auto-deploys from `main`), **Supabase** (PostgreSQL, Auth, RLS, Realtime, Storage), **Cloudflare** (DNS, domain routing, DDoS protection, security, CDN), and **Digital Plat Dev** (domain registrar). The only env vars needed at runtime are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (set in Vercel, never in the repo).

Full walkthrough - connecting the repo, Vercel build settings, Supabase setup, Cloudflare records, and the release/rollback flow - lives in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Documentation

Full documentation lives in [`docs/`](docs/README.md): architecture, the backend (Supabase Postgres + RLS + RPC + realtime + storage and Next.js server code), database schema & migrations, API surface, security model, and frontend guide.

## Not yet implemented

- Real payments for Coin Charisma (purchases stay disabled)
- School logos in the school picker
