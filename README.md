# Hierarchy Class

**Climb the ranks.**

Hierarchy Class is a gamified academic tracking platform for students, teachers/professors, and admins at any school or campus that wants to help students improve academically. It reimagines the school report card as an RPG-style character sheet - academic subjects and personal attributes are converted into stats and tiered ranks (S++, S, A, B, C, D), similar to a game character profile, while grading data itself remains strictly controlled by
teachers and administrators.

The platform blends the customization and social feel of a profile-based
app with the structure and accountability of a school information
system.

**Current version:** `1.0.0`

## Concept

Each school builds its own academic hierarchy - **Programs** (e.g. a
track or grade band) contain **Sections** (a year or grade level), which
contain **Courses** (individual subjects), each assigned to one teacher
and enrolled with students. Nothing about subject names or grade levels
is hardcoded, so the same platform works for a K-12 school, a senior
high school with tracks/strands, or a college department.

Teachers submit **daily grade entries** (Exam, Quiz, Activity,
Assignment) per student per course. Every submission immediately
recalculates that student's course average and overall rank - there is
no separate "publish" step. A student's overall **Academic Excellence**
score and **Rank** (S++ down to D) are a live average across every
course they're enrolled in, computed straight from real grade data.

Students cannot edit their own grades or ranks - those are fed
exclusively by teachers and reflected instantly once submitted. What
students *can* customize is their bio, hobbies, interests, favorite
subject, self-assigned tags (e.g. "Math Wizard"), and their profile
picture - similar to a social media profile, but layered on top of
verified academic data. Sensitive information (home address, contact
details) is never displayed on any profile, public or private.

### Coin Charisma (planned)

Search profiles include a "Send Charisma" flow where one student can
gift another a real-money coin package that boosts the recipient's
Social stat - similar to in-game currency systems (e.g. diamonds in
MLBB). **This is currently a UI-only preview**: the coin packages and
"Sent!" confirmation are mocked, and no real payment processor, wallet,
or ledger is wired up yet. That integration is scoped as a separate
project phase alongside backend and security work.

## Roles

| Role | Can View | Can Edit | Key Actions |
|---|---|---|---|
| **Student** | Own profile, other students' and teachers' profiles, leaderboard, learning materials, library | Bio, hobbies, interests, tags, favorite subject, profile picture | Borrow/return books, browse materials, message classmates/teachers, view live rank & recent grades |
| **Teacher** | Their assigned programs/sections/courses only, their own roster and grade history | Submit daily grades, manage assigned tasks (accept/decline/mark done), manage the library catalog | Submit exam/quiz/activity/assignment scores, accept or decline admin-assigned tasks (with a required reason on decline), scan or manually add library books, approve/decline book pickup requests |
| **Admin** | All system data for their own school | Grades (via approval queue), programs/sections/courses/enrollment, teacher-to-course assignments, tasks assigned to teachers | Build the program/section/course hierarchy, enroll real signed-up students, assign a teacher to each course, monitor student progress and teacher performance, assign tasks to teachers, review reports and school-wide academic excellence |

Each admin account is scoped to exactly **one school** - the one
registered against their account when the school signed up. Multi-admin
schools are handled by issuing a second admin account for that same
school, not by giving one admin visibility into other schools.

## Screens

**Student:** Home (school feed, live rank badge, academic excellence
gauge, recent grades, weakest subject), Messages (full inbox), Profile
(editable bio/tags/hobbies/picture, stat radar), Learning Materials,
Library (catalog with cover art, book detail view, borrow/return, borrow
history), Leaderboard (animated rank badges), Search (students and
teachers, profile view, add friend, message, send charisma), Settings
(appearance, feedback, about)

**Teacher:** Home (notes, schedule, lesson plan, tasks assigned by
admin with accept/decline/mark-done), Messages, Learning Materials
(upload/manage), Classroom (Program → Section → Course → Students
navigation, daily grade submission by type, live course leaderboard,
per-student grade history), Library Management (add books via camera
barcode scan, physical USB/Bluetooth scanner, or manual entry; approve
pickup requests; track borrowed books; edit/delete catalog entries),
Settings

**Admin:** Home (pending grade-submission approvals), Messages,
Programs (create/edit/delete programs, sections, and courses; assign a
teacher to each course; enroll real signed-up students), Students (live
progress and rank monitoring across the school), Teachers (performance
overview, assign tasks with due dates), Reports (live school-wide
academic excellence, rank distribution, per-course averages), Settings
(school overview card, appearance, account deactivation / deletion
request)

## Navigation

- Persistent collapsible left sidebar on desktop - icon-only by
  default, expands to show labels on hover, with a pin toggle to keep it
  expanded. A bottom tab bar is used on mobile instead.
- A notification bell in the top header replaces the old inline
  chat/theme icons.
- Dark mode is the default appearance; it's toggled from Settings and
  persists across navigation and reloads (only changes when the user
  explicitly switches it).
- Messaging is a dedicated full page (`/[role]/messages`), not a popup -
  contact list on the left, conversation thread on the right.

## Design direction

The tone sits between a game character sheet and a school portal -
gamified, but professional and school-appropriate rather than a
hardcore RPG aesthetic. Visual language includes stat bars, animated
rank badges, and tier-based color coding (blue for academic stats, red
for physical, gold for rank/social), built on a flat navy/white/gold
identity with no gradients or heavy shadows. Page headers are
theme-aware (light card in light mode, dark card in dark mode) rather
than a fixed dark banner. Student-facing screens lean toward a game
profile feel; teacher and admin dashboards use the same card-based
layout patterns, populated with role-appropriate content.

## Tech stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Charts:** Recharts (stat radar visualization)
- **Backend / Auth / Database:** Supabase (Postgres, Row-Level Security, Auth)
- **Barcode scanning:** `html5-qrcode` (camera-based ISBN scan), plus a plain-text input mode that accepts input from USB/Bluetooth HID barcode scanners with no extra driver
- **Book metadata lookup:** Open Library API (auto-fills title/author/genre/cover from a scanned ISBN)
- **Hosting:** Vercel

## Project status

The classroom/grading core and the library are now real, Supabase-backed
features - not mock data:

- **Programs, sections, courses, enrollment, and grade entries** -
  fully live. Admin builds the hierarchy and assigns teachers; teachers
  only see courses assigned to them; grade submissions write straight to
  Postgres and drive each student's real rank.
- **Teacher tasks** (admin assigns → teacher accepts/declines with a
  reason/marks done/deletes) - fully live, with RLS scoping each teacher
  to only their own tasks.
- **Quiz** - fully live.
- **Library** - fully live, including the new add-book flow (camera
  scan, physical scanner device, or manual entry) and full catalog
  edit/delete for the assigned librarian.

**Fully Supabase-backed (migrations 014-023):**
- Messaging (conversations, realtime, unread counts, archive/delete,
  blocks), notifications, school feed + announcements with audience
  targeting, MyDay stories + view tracking, enrollment status, banner
  customization, learning materials with private storage
- Grade submissions go through an admin approval queue; students only see
  approved grades, and the leaderboard is computed from approved entries
  via an aggregate-only RPC

**Not yet implemented:**
- Real payment processing for Coin Charisma (wallet, ledger, fraud/spend
  limits) - Florin balances are read from the database but purchases stay
  intentionally disabled until a verified payment flow exists
- Account deactivation / deletion actually removing or disabling data
  (requests are recorded and reviewable by admins)

## Database

SQL migrations live in `migrations/`, applied in order against your
Supabase project's SQL editor (or `supabase db push` if using the CLI):

1. `001_init_schema.sql` - core schema: schools, profiles, learning
   materials, library, quizzes, chat, friends, school feed, banner,
   Florin
2. `003_auto_create_profile.sql` - `SECURITY DEFINER` trigger that
   creates a `profiles` row on signup
3. `005_fix_jwt_syntax.sql` - corrects `auth.jwt()` RLS syntax across
   several tables
4. `006_classroom_hierarchy.sql` - programs, sections, courses,
   course_enrollments, grade_entries, teacher_tasks
5. `007_library_description.sql` - adds `library_books.description`
6. `008_library_add_book.sql` - adds `cover_url`/`isbn` to
   `library_books`, plus its missing INSERT/DELETE policies
7. `009_teacher_tasks_delete.sql` - adds the missing DELETE policy for
   `teacher_tasks`

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's values
npm run dev
```

Visit `http://localhost:3000`.
