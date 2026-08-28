# Hierarchy Class

**Make school feel like a game worth playing.**

Hierarchy Class is a gamified academic tracking platform for students, teachers, and school administrators that turns the report card into an RPG-style character sheet: real grades become tiered **ranks** (S++ down to D), habits build streaks, and every day's work moves you up the ladder. The point is engagement - students stay productive, beat procrastinate, and keep improving academically, while grading data stays strictly controlled by teachers and admins. It blends the social feel of a profile app with the structure and accountability of a school information system.

**Current version:** `1.17.103`

---

## What it's for

Each school builds its own academic hierarchy - **Education Levels** -> **Programs** -> **Year/Levels** -> **Courses**, each assigned to a teacher and enrolled with real students. Teachers submit daily grades, admins approve them through a review queue, and students see live ranks, progress charts, and a social-style profile on top of verified academic data.

Students can personalize their profile (bio, hobbies, tags, favorite subject, profile picture) but can never edit grades or ranks. Sensitive information (home address, contact details) is never displayed on any profile.

## Roles

| Role | What they do |
|---|---|
| **Student** | View their live rank & progress, school feed, leaderboard, materials, library; message classmates/teachers; track weekly habits |
| **Teacher** | Submit grades per course, manage assigned tasks, upload learning materials, run quizzes, use a personal workspace (notes, schedule, lesson plans), and a customizable Home command center. **Librarian** teachers also manage the library catalog and pickup requests |
| **Admin** | Build the program/section/course hierarchy, enroll students, assign teachers, review/approve grade submissions, monitor progress, manage the school, and a customizable Home command center |

Each admin account is scoped to exactly **one school**.

## Device support

| Role | Phone (< 768px) | Tablet (768px+) | Desktop (1280px+) |
|---|---|---|---|
| **Student** | Supported | Supported | Supported |
| **Teacher** | Blocked (device-warning) | Supported | Supported |
| **Admin** | Blocked (device-warning) | Supported | Supported |

- **Student** uses a hamburger menu + navigation drawer on phone/tablet, and a sidebar rail on desktop. On Android phones (< 768px) the Home screen shows the student identity + rank as a prominent card directly below the header, followed by stories and the school feed — reusing the existing `ProfileRankCard` without redesigning colors, typography, or rank visuals. **Search behavior** is split by breakpoint: on phone (< 768px), a standalone search icon sits in the header and opens the search overlay; the `QuickSearchBar` on the Home page is hidden. On tablet and desktop (>= 768px), the header search icon is hidden and the `QuickSearchBar` is visible on the Home page (centered on tablet, left-aligned on desktop). Tablet intentionally follows desktop-style search behavior. Verified on real browsers from **320px** through 1440px (no horizontal overflow; compact rank badges and wrapping theme cards under 420px); internal scrollers are used intentionally for wide tables/toolbars. *v1.16.102:* `StoriesRail` “+” badge uses a circle-sized relative wrapper (`h-14 w-14 sm:h-16 sm:w-16`) with the story button filling it (`h-full w-full`) and a responsive offset (`bottom-[2px] right-[2px] sm:bottom-[1px] sm:right-[1px]`) so the badge stays attached to the visible ring across phone/tablet/desktop without drifting to the label; weakest-subject typography is unified — the mobile `ProfileHeroCard` inset now uses the desktop `WeakestSubjectCard` hierarchy (`section-label`, `text-[10.5px]` pill, `text-sm` title, `text-xs` secondary, `text-[11px]` faint) across all breakpoints. *v1.16.103:* rank letter typography unified — mobile `ProfileHeroCard` now matches desktop `RankBadge` (`font-extrabold tracking-[0.02em] leading-none` sans, no `Georgia`); canonical display names `S+→Honors`, `S++→Distinguished`, `EX→Exceptional` via `lib/rankEngine.ts:RANK_DISPLAY_NAMES` (landing `RANKS[]` and admin `LADDER` now inherit from it), internal codes `["D","C","B","A","S","S+","S++","EX"]` and DB/API unchanged.
- **Teacher** and **Admin** see a dedicated device-warning screen on phone-sized viewports (< 768px) with a clear message to continue on a larger screen. The user remains authenticated; the warning is a UI layer only.
- The 768px breakpoint (`md:` in Tailwind) cleanly separates phone from tablet. The phone layout stacks the Home content for natural one-hand use; tablet (768px+) keeps the existing desktop/tablet arrangement. Resizing or rotating the device updates the view instantly.

## Student navigation

- **Phone** (< 768px): Hamburger button in the header opens the drawer (navigation links + logout). The identity/rank card lives prominently on Home itself, so the Home hierarchy is Header (with search icon) → Rank Card → Stories/Feed. The header search icon opens the search overlay; the Home page `QuickSearchBar` is hidden.
- **Tablet** (768px–1279px): Hamburger + drawer containing the profile card, stat widgets, navigation links, and logout. The header search icon is hidden; the Home page `QuickSearchBar` is visible (centered). Tablet follows desktop-style search behavior.
- **Desktop** (1280px+): Fixed icon-rail sidebar on the left with the same navigation links and logout. The rank card appears in the right column of Home. The header search icon is hidden; the Home page `QuickSearchBar` is visible (left-aligned).
- The student BottomNav has been removed. All student navigation flows through the drawer (phone/tablet) or sidebar (desktop).

## Key features

- **Non-linear rank engine** - category percentages accumulate per grading period, compress through a power curve (`Adjusted = 100 (S/100)^k`), and move a fill-first rank bar from **D** up through **C B A S S+ S++** and into the open-ended **EX** tier. Every knob (weights, `k`, tier lengths, EX step, season reset map) is configurable per school.
- **Live ranks & leaderboard** - realtime across the app, with validate -> preview -> confirm and an audit log on every write.
- **Grade approval queue** - teacher submissions go to admins as pending; only approved grades count toward stats.
- **Messaging** - one shared chat across all three roles with unread badges, archive, per-user delete, and blocking.
- **School feed & announcements** (admin-created posts carry an "Administrator" badge), **MyDay stories**, **notifications**.
- **Student achievements** - post certificates (title, school year, date awarded, school) with a raw image upload (public `certificates` bucket, owner-folder RLS, 10 MB cap); the profile shows a title-only 3x3 grid that opens a detail modal and a full-screen certificate viewer. Other students see a read-only version.
- **Student music** - post music by link (YouTube / Spotify / Apple Music / SoundCloud / Vimeo): the app resolves title, artist, and album cover server-side via keyless oEmbed / iTunes lookup (Spotify upgrades to the Web API when server-only env vars are set) and links out to the original track.
- **Habit tracker** - default and custom habits with goal types, scheduled days, streaks, pause/resume/archive, and a history calendar. Entries are one per (habit, day) at the database level; habits never touch the rank engine or grades.
- **Account lifecycle** - students and teachers can deactivate their own account (reversible, nothing is deleted) and reactivate it from the sign-in flow with a welcome-back notification. School admins cannot deactivate other users. For suspicious accounts, an admin can apply a temporary **restriction** (`profiles.restricted_at`): the user can still sign in but only reaches `/auth/restricted`, where they can submit an **appeal** that the admin reviews. Permanent deletion is admin-approved: the account and personal data are removed while school-required academic records are preserved and anonymized (migration 058), and user storage objects are cleaned up via a server-only service-role client. Admins have no in-app deactivate/delete controls for their own account - account changes for administrators go through the developer.
- **Weekly progress** chart derived from real approved grades.
- **Library** with barcode (camera or USB scanner) ISBN lookup and a borrow flow.
- **Quiz engine**, **learning materials** with private storage, **Florin** currency balances.
- **Florin shop & wardrobe** - students buy decorative page backgrounds, profile card backgrounds, and avatar borders. Purchases and equipping run through SECURITY DEFINER RPCs (no client-side minting).
- **Florin top-ups with GCash** - students buy Florin packs through PayMongo Hosted Checkout (GCash). The success redirect never credits anything: the verified server-side webhook is the payment authority, completion is idempotent, and package pricing is database-authoritative. See [`docs/PAYMENTS.md`](docs/PAYMENTS.md).
- **Midnight & Rose themes** - pick either from any role's settings; applied before first paint and remembered per browser.
- **Inverted-triangle rank emblem** - one shared rank visual across every role and surface; the letter/name sits below the triangle, and EX carries a gold "glory" glow.
- **Feedback with attachments** - bug reports and feedback can include screenshots/files, stored privately in the `feedback` bucket and reviewed by school admins (signed links in the developer email).
- **Actionable notifications** - message notifications link straight into the exact conversation; announcements stay informational with no fake destinations.

## Tech stack

- **Framework:** Next.js 14 (App Router) - **Language:** TypeScript
- **Styling:** Tailwind CSS with theme tokens (Midnight + Rose)
- **Backend / Auth / Database:** Supabase - Postgres, Row-Level Security, Auth, Realtime, Storage
- **Charts:** Recharts - **Barcode:** `html5-qrcode` + HID scanner input
- **Hosting:** Vercel

## PWA / installation

- The app can be installed as a **Progressive Web App (PWA)** where supported. Browsers that support the Web App Manifest and service worker will show an install prompt.
- An **Android TWA (Trusted Web Activity)** exists as a native wrapper: package `com.hierarchyclass.app`, built with Bubblewrap. It opens the live web app fullscreen with no browser UI once Digital Asset Links verify, falling back to Chrome Custom Tabs otherwise. The Android shell follows its own version (`1.15.90` / `versionCode 11590`) and is rebuilt only for native changes — see [`docs/ANDROID.md`](docs/ANDROID.md).
- **Production domain:** `https://www.hierarchyclass.com/`
- *v1.17.103:* Android production readiness finalized — the TWA architecture (Bubblewrap; AGP 8.9.1 / Gradle 8.11.1 / JDK 17; minSdk 21, target/compileSdk 36) was fully audited with no configuration changes needed; a stale `android/manifest-checksum.txt` that broke the documented release pipeline was corrected; debug APK, signed release APK, and release AAB were rebuilt and validated (`aapt2 dump badging`, `apksigner verify` v2/v3, production-only URLs, correct package/version/label/launchable activity); the fresh signed release APK is **byte-identical** to the distributed, git-tracked `public/downloads/hierarchy-class-v1.15.90.apk`, confirming the release chain is exactly reproducible and the SHA-256 in `lib/apkRelease.ts` remains authoritative; `public/.well-known/assetlinks.json` was verified against the actual keystores (release cert + local debug cert for dev builds; no Play App Signing fingerprint invented); the production deployment was verified live (HTTPS, `/manifest.json`, `/sw.js`, `/.well-known/assetlinks.json`, `/api/version`, icons all 200 with the deployed assetlinks byte-identical to the repo); stale Android documentation was corrected in `docs/ANDROID.md` and `android/README.md`. Not yet done: physical-device install testing and Play Store publication.

## Update system

The in-app update system detects new deployments without forced reloads:

- On mount and when the browser tab returns to focus, the app checks for a newer build by comparing `NEXT_PUBLIC_APP_VERSION` against the live deployment.
- If a newer build is detected, a non-intrusive prompt appears.
- **"Later"** dismisses the prompt for that specific detected build. A newer deployment will prompt again.
- **"Update"** performs a controlled reload to pick up the new build.
- No automatic forced reload without user consent.
- Works across browser, PWA, and TWA contexts.

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

- PayMongo sandbox end-to-end verification for Florin top-ups (implementation complete and locally verified - the runbook lives in [`docs/PAYMENTS.md`](docs/PAYMENTS.md))