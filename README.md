# Hierarchy Class

Gamified academic tracking platform for Grade 1-10 students (Philippine DepEd curriculum). Next.js (App Router, TypeScript, Tailwind) + Supabase.

## Sprint 1 status

- [x] Login screen (`/login`) — email/password + multi-tenant school selector, redirects into `/student/home`
- [x] Student app: Home, Profile (radar chart + editable bio), Leaderboard (grade/section filters)
- [x] Shared game-identity components: RankBadge (S++ to D), StatBar, StatRadarChart, BottomNav
- [ ] Real Supabase auth + data (currently mock data + simulated login)
- [ ] Teacher screens: Home, Profile, Learning Materials upload, grade submission
- [ ] Admin screens: Home, Control System, Settings
- [ ] Remaining student screens: Learning Materials, Library (LMS), Search, Settings
- [ ] Role-based routing / middleware (currently login always routes to the student app)

## Try it without Supabase set up yet

The login form detects whether `NEXT_PUBLIC_SUPABASE_URL` is set. If it isn't, it simulates the login (700ms delay, no real auth) and routes straight into `/student/home` — so you can click through the whole student flow (login → home → profile → leaderboard) before Supabase is wired up.

## Setup

```bash
# install dependencies
npm install

# copy env template and fill in your Supabase project's values
cp .env.example .env.local

# run the dev server
npm run dev
```

Visit `http://localhost:3000` — it redirects to `/login`.

## Supabase

You'll need a Supabase project with:
- `auth` enabled (email/password)
- Eventually: a `schools` table (id, name, abbreviation) to replace the mock data in `data/schools.ts`, plus a `school_id` column on user-facing tables with row-level security scoping each school's data

## Project structure

```
app/
  layout.tsx        root layout, imports globals.css
  page.tsx           redirects to /login
  login/page.tsx     login screen
components/
  auth/              LoginForm, SchoolSelector, LogoLockup
data/
  schools.ts         mock school list (swap for Supabase query later)
lib/
  supabase/client.ts   browser client
types/
  school.ts
```

## Pushing to GitHub

```bash
git init
git add .
git commit -m "Sprint 1: login screen walking skeleton"
gh repo create hierarchy-class --private --source=. --remote=origin
git push -u origin main
```

(No `gh` CLI? Create the repo on github.com first, then `git remote add origin <url>` and `git push -u origin main`.)

## Deploying

Connect the GitHub repo to Vercel and add the two `NEXT_PUBLIC_SUPABASE_*` env vars in the Vercel project settings — pushes to `main` will auto-deploy.
