# Hierarchy Class

**Climb the ranks.**

Hierarchy Class is a gamified academic tracking platform for students,
teachers, and admins following the Philippine DepEd curriculum for Grades
1-10. It reimagines the school report card as an RPG-style character
sheet - academic subjects and personal attributes are converted into
stats and tiered ranks (S++, S, A, B, C, D), similar to a game character
profile, while grading data itself remains strictly controlled by
teachers and administrators.

The platform blends the customization and social feel of a profile-based
app with the structure and accountability of a school information
system.

**Current version:** `0.1.2` (frontend/UI phase - see [Project status](#project-status))

## Concept

Each subject grade converts into a stat:
- **Mathematics → Logic**
- **English → Communication**
- **Science → Insight**
- **PE → Physical**

Stats are ranked on a tier scale (S++, S, A, B, C, D), and an overall
composite **Academic Excellence** score reflects a student's standing
across all subjects. Alongside academic performance, a **Social** stat
(internally tracked as `charisma`) captures social and engagement
activity - participation, library use, event attendance.

Students cannot edit their own grades or ranks - those are fed
exclusively by teachers and confirmed by admins. What students *can*
customize is their bio, hobbies, interests, favorite subject,
self-assigned tags (e.g. "Math Wizard"), and their profile picture -
similar to a social media profile, but layered on top of verified
academic data. Sensitive information (home address, contact details) is
never displayed on any profile, public or private.

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
| **Student** | Own profile, other students' and teachers' profiles, leaderboard, learning materials, library | Bio, hobbies, interests, tags, favorite subject, profile picture | Borrow/return books, browse materials, message classmates/teachers, view rank |
| **Teacher** | Student grades/subjects for their class | Submit grades, upload learning materials | Send grades to admin, manage learning material uploads, message students |
| **Admin** | All system data | Grades, ranks, system configuration, tenant schools | Approve/reconfigure grades, manage schools, review reports, deactivate/delete own account |

## Screens

**Student:** Home (school feed + stat snapshot), Messages (full inbox),
Profile (editable bio/tags/hobbies/picture, stat radar), Learning
Materials, Library (expanded catalog, book detail view, borrow/return,
borrow history), Leaderboard (animated rank badges), Search (students
and teachers, profile view, add friend, message, send charisma),
Settings (appearance, feedback, about)

**Teacher:** Home, Messages, Learning Materials (upload/manage),
Classroom (grade submission), Students (roster with animated rank
badges), Settings

**Admin:** Home (pending grade approvals), Messages, Schools (tenant
management with per-school stats), Reports (summary stats + recent
reports), Settings (system configuration, account deactivation /
deletion request)

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
- **Backend / Auth / Database:** Supabase (Postgres, Row-Level Security, Auth) - client is wired up, but most screens still run on local mock data (see below)
- **Hosting:** Vercel

## Project status

This build has been through a UI/UX-first pass: navigation, page layouts,
light/dark theming, profile and library features, messaging, and
teacher/admin parity are largely in place, all running on local mock
data (`data/*.ts`) rather than live Supabase queries.

**Not yet implemented** (planned as a follow-up phase):
- Real Supabase-backed data (students, grades, materials, library,
  messages) in place of mock data
- Authentication-gated routes and role-based access control
- Real payment processing for Coin Charisma (wallet, ledger, fraud/spend
  limits)
- Account deactivation / deletion actually removing or disabling data

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's values
npm run dev
```

Visit `http://localhost:3000`.
