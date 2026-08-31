# Hierarchy Class

**Make school feel like a game worth playing.**

Hierarchy Class is a gamified academic tracking platform for students, teachers, and school administrators that turns the report card into an RPG-style character sheet: real grades become tiered **ranks** (S++ down to D), habits build streaks, and every day's work moves you up the ladder. The point is engagement - students stay productive, beat procrastinate, and keep improving academically, while grading data stays strictly controlled by teachers and admins. It blends the social feel of a profile app with the structure and accountability of a school information system.

**Current version:** `1.24.111`

---

## What it's for

Each school builds its own academic hierarchy - **Education Levels** -> **Programs** -> **Year/Levels** -> **Courses**, each assigned to a teacher and enrolled with real students. Teachers submit daily grades, admins approve them through a review queue, and students see live ranks, progress charts, and a social-style profile on top of verified academic data.

Students can personalize their profile (bio, hobbies, favorite subject, profile picture) but can never edit grades or ranks. Sensitive information (home address, contact details) is never displayed on any profile.

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
- The **Android app is a standalone native application** (Capacitor): package `com.hierarchyclass.app`. The Next.js frontend is statically exported (`npm run export:android`) and bundled **inside the APK** — launch, UI, and routing all run locally in a native WebView with no address bar, no Chrome UI, no Custom Tabs, and no dependency on the website for the frontend. Backend traffic (Supabase auth/database/realtime/storage and the `/api/bridge/*`, `/api/payments/*` operations on the deployed site) goes over HTTPS to the approved origins only. Server-side secrets are never bundled; only the public Supabase URL + anon key are inlined. See [`docs/ANDROID.md`](docs/ANDROID.md) and [`android/README.md`](android/README.md).
- The previous **Bubblewrap TWA** implementation is archived intact at [`android-twa/`](android-twa/README.md) (same signing keystore, which the standalone app reuses; `versionName 1.24.111` / `versionCode 124111` supersedes the TWA's 1.15.90/11590 with the same applicationId and certificate, so installs upgrade cleanly).
- **Production domain:** `https://www.hierarchyclass.com/` (the Android backend origin; the frontend itself is bundled)
- *v1.17.103:* Android architecture migrated from TWA to a standalone bundled-frontend app. Audit first confirmed the TWA chain was fully correct (checksum fix, byte-identical reproducible release APK, DAL verified) — see the archived `android-twa/README.md` history — then the Capacitor app was built and verified on an emulator: install, launch, local-asset UI, login round trip to Supabase, keyboard, back button, no browser UI at any point. The auth boot flow is owned by one client gate (`components/native/NativeRootGate.tsx`): the static HTML of "/" is already the minimal native entry screen (logo + session spinner — no Home/login flash), then the persisted Supabase session is validated and the user lands on the correct role home (or the entry actions when signed out / expired). Hardware back closes overlays first, then in-app history, then exits at the root. Not yet done: Play Store publication and physical-device testing (no device was attached over ADB in the latest session; the 2026-08-28 emulator verification remains the last device-class test).
- *v1.22.110:* Consolidation of the accumulated Android migration and fixes. Native Android auth screens (Entry, Login, Signup, Forgot, Reset, RootGate) completed with keyboard navigation, offline-aware error handling, and hardware back integration. Deep-link password recovery (NativeDeepLink + App Links intent filter). Android teacher/admin phone support with logout in bottom navs. Android back-button overlay priority model. Auth server bridge (Server Actions → `/api/bridge/*`). Static export pipeline with `CAPACITOR_EXPORT` gating. Bug fixes: offline login/fogot/reset misleading errors, forgot-password fake success, deep-link duplicate-URL race, student home trailing-slash hamburger menu, signup scroll, and auth form interaction corrections. Version 1.22.110 (versionCode 122110).
- *v1.23.110:* Student profile rebuilt. Android now launches **directly into Login** (the redundant "Log In / Create an Account" chooser is gone; "Welcome back" appears on every cold start, not just revisits) and its menu/back header shows the current menu name instead of "Back to Home" with a scroll-collapsing header. Profile sections (Achievements / Music / Photos / History) are aligned with cleaner typography; **About** (bio, favorite subject, hobbies — "Separate hobbies with commas.") moved into the Rank area; **Friends** moved above Wardrobe with a **See All** modal; and a **Story Archive** joins View As / Season History in the profile menu, reusing the existing stories table. Tags are removed everywhere (ranks/achievements/subjects/categories/roles/statuses untouched). Feedback and Reports are fully functional end-to-end (validation, persistence, attachments, admin review panel — no fake success). Habits received targeted fixes (edit draft sync, unit defaults, value-goal completion for daily count habits). The student leaderboard gained Section / Grade / Program filters plus a Campus summary chip, and the Android leaderboard no longer shows Rank Quick View. Android detects newer APK versions (`android-version.json` + in-app banner → official download page). APK release metadata now tracks the real signed v1.23.110 artifact. Version 1.23.110 (versionCode 123110).
- *v1.24.111:* Android UI polish and corrections. Profile **Achievements / Music / Photos / History** tabs are now one coherent segmented control — equal-width, readable, no clipping, no horizontal overflow. The **Android update checker** no longer falsely announces an update when the installed app is current: the installed versionCode is now computed with the project convention (`MAJOR×100000 + MINOR×1000 + BUG_FIX`; the previous code used `×10000/×100`, so 1.23.110 parsed as 12410 and every check reported a newer remote), and versions are compared numerically (1.10.0 correctly beats 1.9.0). The **Android leaderboard** reorganizes filters into a compact collapsible "Filters" panel with a summary chip row (campus + student count) so ranked entries stay the main focus; desktop keeps the inline sections. The **Android back arrow** now returns to the menu selection (top-level menu pages reopen the drawer; drill-down pages go back to the previous context), and drawer navigation replaces its pushed history entry so there are no stale-entries/back loops. The **collapsing header** is more aggressive on Android: scrolling down leaves only the menu/back bar (title, app name, icons fully removed from layout), scrolling up restores the full header. Version 1.24.111 (versionCode 124111).

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