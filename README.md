# Hierarchy Class

**Climb the ranks.**

Hierarchy Class is a gamified academic tracking platform for Grade 1–10
students following the Philippine DepEd curriculum. It reimagines the
school report card as an RPG-style character sheet — academic subjects
and personal attributes are converted into stats and tiered ranks
(S++, S, A, B, C, D), similar to a game character profile, while grading
data itself remains strictly controlled by teachers and administrators.

The platform blends the customization and social feel of a profile-based
app with the structure and accountability of a school information system.

## Concept

Each subject grade converts into a stat:
- **Mathematics → Logic**
- **English → Communication**
- **Science → Insight**
- **PE → Physical**

Stats are ranked on a tier scale (S++, S, A, B, C, D), and an overall
composite **Academic Excellence** score reflects a student's standing
across all subjects. Alongside academic performance, a **Charisma** stat
captures social and engagement activity — participation, library use,
event attendance.

Students cannot edit their own grades or ranks — those are fed
exclusively by teachers and confirmed by admins. What students *can*
customize is their bio, hobbies, interests, favorite subject, and
self-assigned tags (e.g. "Math Wizard") — similar to a social media
profile, but layered on top of verified academic data. Sensitive
information (home address, contact details) is never displayed on any
profile, public or private.

## Roles

| Role | Can View | Can Edit | Key Actions |
|---|---|---|---|
| **Student** | Own profile, other students' profiles, leaderboard, learning materials, library | Bio, hobbies, interests, tags | Borrow/return books, browse materials, view rank |
| **Teacher** | Student grades/subjects for their class | Submit grades, upload learning materials | Send grades to admin, manage learning material uploads |
| **Admin** | All system data | Grades, ranks, system configuration | Approve/reconfigure grades, manage system-wide settings |

## Screens

**Student:** Home, Profile, Learning Materials, Library (borrow/return),
Leaderboard, Search, Settings

**Teacher:** Home, Profile, Learning Materials (upload/manage), Grade
submission

**Admin:** Home, Control System (grade/rank configuration, user
management), Settings

## Design direction

The tone sits between a game character sheet and a school portal —
gamified, but professional and school-appropriate rather than a hardcore
RPG aesthetic. Visual language includes stat bars, rank badges, and
tier-based color coding (blue for academic stats, red for physical, gold
for charisma/rank), built on a flat navy/white/gold identity with no
gradients or heavy shadows. Student-facing screens lean toward a game
profile feel; teacher and admin dashboards feel more like a control
panel — denser, more neutral, minimal ornamentation.

## Tech stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Charts:** Recharts (stat radar visualization)
- **Backend / Auth / Database:** Supabase (Postgres, Row-Level Security, Auth)
- **Hosting:** Vercel

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's values
npm run dev
```

Visit `http://localhost:3000`.
