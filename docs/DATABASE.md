# Hierarchy Class - Database

This document covers the PostgreSQL schema behind the app: the main tables,
how row-level security (RLS) is structured, storage buckets, and the complete
migration index. Migrations live in `database/migrations/` - see
[`database/README.md`](../database/README.md) for how to apply them.

---

## 1. Schema overview (by domain)

### Identity & school

| Table | Purpose | Key columns |
|---|---|---|
| `schools` | The tenant (a school/campus) | name, abbreviation |
| `profiles` | One row per app user (student/teacher/admin) | user_id, role, school_id, full_name, avatar_url, bio, hobbies, tags, favorite_subject, educational_level, program, level_label, section (legacy), is_librarian, **deactivated_at** (self-service deactivation timestamp, nullable) |
| `account_requests` | Deletion requests (deactivation is now self-service) | requester_id, type ('deletion'), status |

### Academics (the hierarchy)

| Table | Purpose |
|---|---|
| `programs` | Self-referencing (`parent_id`): education levels at the top (`parent_id` NULL), programs nested under them (`parent_id` set) |
| `sections` | Year/grade level inside a program (e.g. Year 1, Grade 12) |
| `courses` | Individual subjects, assigned to a teacher, in a section |
| `course_enrollments` | Student ↔ course membership |
| `grade_entries` | The core grade row: student, course, type (a category LABEL - any label the teacher configured for the course), score + `max_score` (“out of”), `approval_status` ('pending'/'approved'/'rejected'), submitted_by |
| `course_rank_categories` | Per-course category rows (course_id, category_key, label, weight %) - teachers add/remove/edit them freely; replaced the fixed four (Quiz/Exam/Activity/Participation) in migration 040 |
| `teacher_tasks` | Tasks assigned to teachers (e.g. "submit grades") |

### Social & communication

| Table | Purpose |
|---|---|
| `school_feed_posts` | Feed posts / announcements (post_type, audience) |
| `stories` / `story_views` | MyDay stories with 24h expiry + view tracking |
| `friends` | Same-school friend pairs |
| `conversations` | ONE shared row per participant pair + per-side read/archive/delete state |
| `chat_messages` | Message rows inside a conversation |
| `chat_blocks` | Blocked pairs (either direction blocks both) |
| `notifications` | Per-user notifications (created only by RPCs) |

### Student life

| Table | Purpose |
|---|---|
| `habits` | Student-defined habits (name, category, goal type + target, daily/weekly frequency, scheduled days Mon-first, status active/paused/archived). Five defaults seeded per student by migration 053: Study 5x/week (Mon-Fri), Exercise 4x/week, Reading 30 min/day, Sleep 8 h/day, Focus 60 min/day |
| `habit_entries` | Daily habit records: one row per (student, habit, date) enforced by a UNIQUE constraint; `value` holds the amount logged (1 for a check-off, minutes/pages for duration/quantity goals) |
| `habit_pauses` | Pause windows per habit (started_at, ended_at NULL while paused). Paused days are skipped by streak math - a pause never breaks a streak and never generates missed days |
| `florin_balances` | Read-only currency balance (no client minting) |
| `shop_items` | Florin shop catalog - three types: `background` (page backdrop), `avatar_border` (avatar ring), `profile_card` (viewed-profile card background). Seeded by migrations 050-052 |
| `shop_ownership` | Which items each student owns (unique per student + item) |
| `student_shop_loadout` | What each student currently has equipped (page background + avatar border + profile card), school-readable so decorations show on other users' avatars and cards |
| `student_achievements` | Posted certificates (migration 056): four student fields - title, school_year, date_awarded, school - plus the raw certificate image public URL in the `certificates` bucket; owner insert/delete via profiles join, same-school read |
| `student_music` | Post-music-by-link posts (migration 057): original `music_url`, `platform`, resolved `title`/`artist`/`album_cover_url`; owner insert/delete via profiles join, same-school read. No audio is stored - only metadata + the external link |
| `library_books`, `library_borrow_requests`, `library_borrow_log` | Library catalog + borrow flow |
| `quizzes`, `quiz_questions`, `quiz_attempts` | Quiz engine |
| `learning_materials` | Course materials with storage file paths |
| `banner_config` | Admin-managed header banner |
| `enrollment_status` | Admin-managed enrollment: status, started_at, expires_at |
| `teacher_notes`, `teacher_schedule`, `teacher_lesson_plans` | Teacher's own workspace (notes/schedule/lessons) |
| `teacher_dashboard_prefs` | Teacher Home customization: which widgets appear and how they're arranged (layout JSONB `{widgets:[{id,size,tall,order}]}`) - presentation-only, own-row RLS |
| `admin_dashboard_prefs` | Admin Home customization, same model as teacher (migration 055) - presentation-only, own-row RLS |

### Admin-only reference tables

`programs`, `sections`, `courses`, `course_enrollments`, `banner_config` are
managed from the admin pages and are read-only for everyone else.

---

## 2. RLS model

**Row-level security is the gate for everything.** No policy, no data. The
pattern is consistent across tables:

1. **School scoping** - every school-scoped table joins back to `profiles` or
   uses `auth.jwt()` metadata to confirm the row belongs to the caller's
   `school_id`.
2. **Role scoping** - students, teachers, and admins see different slices:
   - Students: only their own rows (grades, habits, enrollment) or
     school-wide rows that are safe to share (roster, feed, leaderboard
     aggregates).
   - Teachers: rows for courses they teach; school-wide roster and
     enrollment status (read-only).
   - Admins: everything in their school.
3. **Ownership scoping** - personal data (profile, notifications, chat
   per-side state, habits) is gated by `profile_id = my profile`.

### Grade privacy (the strictest case)

- Students read **only their own approved** `grade_entries`.
- Teachers read rows for courses they teach.
- Admins read the whole school.
- The leaderboard is an **aggregate-only** `SECURITY DEFINER` function
  (`get_school_leaderboard`) - raw grade rows are never exposed.

### Protected columns

A BEFORE UPDATE trigger on `profiles` blocks non-admins from changing `role`,
`school_id`, `academic_excellence`, rank, and the librarian flag.

---

## 3. Storage buckets

All buckets are **private** except `certificates`; access is enforced by
storage RLS policies.

| Bucket | Purpose | Access |
|---|---|---|
| `avatars` | Profile pictures | Owner upload/delete; school-wide read via signed URLs |
| `materials` | Teacher course materials | Teacher (own school) upload; school-wide read |
| `feed` | Feed post images | Admin/author upload |
| `myday` | Story images | Author upload; 24h signed URLs |
| `banners` | Admin banner images | Admin only |
| `certificates` | Achievement certificate images (public bucket) | Owner folder upload/delete (`{auth uid}/...`); public read so any viewer can open the raw certificate |

Paths follow `{school_id}/{profile_id}/{uuid}.{ext}` (no bucket prefix inside
the object name - storage policies parse the folder as
`{school}/{profile}/...`).

---

## 4. Server-side functions (RPCs)

Privileged or multi-row operations that can't be done safely under plain RLS
live in `SECURITY DEFINER` functions:

| Function | Purpose |
|---|---|
| `create_notification` | One notification, same-school check |
| `notify_admins` | Fan-out to all admins (grade submissions) |
| `notify_post_audience` | Fan-out announcements by audience (admin only) |
| `ensure_conversation` | Find-or-create shared thread, block-aware, race-free |
| `send_chat_message` | Insert message, bump both sides' preview, block-aware |
| `set_conversation_read` / `set_conversation_archived` | Per-side state |
| `delete_conversation` | Sets my history cutoff; clears shared preview once both sides deleted |
| `get_unread_counts` | Unread per conversation from read_at + cutoff |
| `get_school_leaderboard` | Aggregate-only rankings (approved grades) |
| `approve_grade_submission` | Batch approve/reject + one notification per teacher |
| `effective_enrollment_status` | Enrolled/expired/revoked at read time |
| `refresh_expired_enrollments` | Bulk expiry (optional hardening) |

Triggers: profile auto-create on signup, protected-column guard on `profiles`.

---

## 5. Migration index (apply in order)

All files live in `database/migrations/`.

| File | Contents |
|---|---|
| 001 | Core schema: schools, profiles, materials, library, quizzes, chat, friends, feed, banner, florin + base RLS |
| 002 | Fix RLS recursion (school-scoped reads via JWT metadata) |
| 003 | SECURITY DEFINER trigger: auto-create profile on signup |
| 004 | School-wide `profiles` SELECT policy |
| 005 | Fix `auth.jwt()` RLS syntax |
| 006 | Programs, sections, courses, enrollments, grade_entries, teacher_tasks + RLS |
| 007-009 | Library description, add-book (cover/isbn), teacher-task delete policy |
| 010 | Profile avatar column + storage |
| 011 | JSONB array defaults |
| 012 | Quizzes link to courses |
| 013 | Friends RLS (same-school) |
| 014 | notifications + RLS, conversations.last_read_at, chat RPCs, notify fan-out |
| 015 | stories + story_views + myday bucket |
| 016 | enrollment_status + effective-status function |
| 017 | profiles first/last name backfill |
| 018 | feed posts: author_id, audience, image_path + storage bucket |
| 019 | materials RLS + bucket |
| 020 | grade approval_status, hardened grade RLS, account_requests |
| 021 | banner bucket |
| 022 | Security hardening: profile column guard, chat insert identity, friends same-school, no client Florin, leaderboard aggregate RPC |
| 023 | Messaging overhaul: dedupe + unique pair, archive/delete/last_message_at, chat_blocks, rewritten RPCs, get_unread_counts, approve_grade_submission, admin profile update, nullable feed title |
| 024 | Feed `post_type` (post vs announcement), teacher read on enrollment_status, effective_enrollment_status teacher branch |
| 025 | Messaging thread rewrite: one shared row per participant pair (per-side read/archive/delete; delete = history cutoff), rewritten ensure_conversation / send_chat_message / get_unread_counts + set_conversation_read / set_conversation_archived / delete_conversation RPCs; leaderboard RPC fix (live approved average, program + educational level); notifications `cleared_at`; profiles `educational_level` |
| 029 | Habit tracker: `habit_entries` table + RLS (school-scoped through profiles) |
| 030 | Teacher workspace: `teacher_notes`, `teacher_schedule`, `teacher_lesson_plans` + RLS |
| 031 | Messaging delete fix: `delete_conversation` clears the shared last-message preview once both sides have deleted |
| 032 | Education Level Management: `programs.parent_id` self-reference so levels -> programs -> year/levels nest; idempotent orphan reparenting |
| 033 | `profiles.program` column - the program saved from Academic info (level · program · year) |
| 034 | Non-linear rank engine: `rank_config` (weights/k/ex_step/tiers/season reset map), `student_rank_state` (rank/bar/EX score/peak/highest), `rank_period_entries` (per-grade feed rows with stored weights/before-state), `season_history_log`, `rank_history_log` (event audit) + school-scoped RLS + SECURITY DEFINER RPCs (`preview_rank_update`, `confirm_and_apply_score_entry`, `process_score_entry`, `reset_period_category_totals`, `end_season`, `get_season_history`, `get_dual_rank_display`, `get_rank_config`, `update_rank_config`) |
| 035 | Admin rank ops: `end_season_for_school` (reseed every ranked student - admin only) + `get_school_season_history` (all season logs for a school) |
| 036 | Auto-feed: `grade_entries.rank_fed_at` + `feed_approved_grade_to_rank` trigger - approving a grade automatically runs `process_score_entry` (Exam->exam, Quiz->quiz, Activity/Assignment->activity, Participation->participation, score/max_score) into the current period; exactly-once per grade |
| 039 | `Participation` added as a valid `grade_entries.type` (CHECK widened); feed maps it to the rank `participation` category |
| 037 | Revert: `rank_period_entries.source_grade_id` + before-state columns (rank/bar/ex/peak at apply time); `revert_grade_rank_feed(p_grade_id)` deletes the feed, restores the before-state, and REPLAYS all later entries through the engine math; rejection or deletion of an approved grade now undoes its rank effect (`feed_reverted` event) and re-approval feeds again |
| 038 | Teacher-grade flow: `grade_entries.max_score` (“out of” scores), `course_rank_weights` (per-course category percentages, teacher-saved, sum 100), `school_semesters` (admin-declared active semester = the feed's grading period); `preview/confirm/process_score_entry` take optional `p_weights`; feed uses score/max_score + course weights + active-semester period |
| 040 | Dynamic categories: `course_rank_categories` replaces `course_rank_weights` (dropped); `grade_entries.type` CHECK dropped (type now stores a category label); `save_course_rank_weights` takes an ARRAY of {key,label,weight} and replaces the whole set (add/remove/edit in one call, must sum 100); `get_course_rank_weights` returns the array or the school default four; the feed maps label -> key via the course's rows (legacy built-in fallback) and stores per-entry weights; `revert_grade_rank_feed` replay rewritten category-agnostic so reverts never break for custom categories |
| 041 | Students seed at **D** (not C): `student_rank_state` defaults for current/peak/highest -> 'D'; preview's synthetic state + revert replay anchor default to D; existing rows replayed from a D/0 seed through their period entries so live data matches the new "start at the bottom, fill to 100%, then promote" rule |
| 042 | Season-end reset keys off the FINAL rank (S mid-season ending at A resets to D); the PEAK stays in `season_history_log.peak_rank`, drives `highest_rank_ever`/`ex_achieved`, but no longer decides the reset |
| 043 | Auto-adopt grading period: `confirm_and_apply_score_entry` adopts the caller's period instead of raising "Period mismatch" (rank/bar carry over, the new period's entries form the next feed); backfills all approved-but-unfed grades |
| 044 | Semester gate: `guard_grade_submission_requires_semester` BEFORE INSERT trigger on `grade_entries` blocks ANY grade submission when the school has no active semester (teachers must ask the admin to declare it first) |
| 049 | **PER-ENTRY ISOLATED FILL (permanent, supersedes 047):** the period-cumulative category running average and the composite blend across categories (S) are removed. Each grade entry computes its own fill independently from its own score and category weight share - `entryPct = earned/possible*100`, `Adjusted = 100*(min(entryPct,100)/100)^k`, `fillChange = ((Adjusted-50)/50)*(100/n)*weightShare` where `weightShare = w[cat]/sum(ALL configured weights)`. Applied in `preview_rank_update`, `revert_grade_rank_feed` (both branches), and the replay; the EX >= 50 check uses the UNCAPPED adjusted of the single entry (`Adjusted_uncapped = 100*(entryPct/100)^k`). 046's period-baseline clear fix is kept; existing states replayed with the new math |
| 048 | Publish app tables to `supabase_realtime`: `profiles`, `grade_entries`, `student_rank_state`, `rank_period_entries`, `rank_history_log`, `habit_entries`, `chat_blocks`, `chat_messages`, `notifications` were subscribed to via postgres_changes but never in the publication, so no realtime event ever reached the browser (rank bars, habits, messages, notifications all silently required a full reload). Idempotent add |
| 050 | Florin shop: `shop_items` (catalog, seeded), `shop_ownership` (unique per student + item), `student_shop_loadout` (equipped background + border, school-readable for decorations) + RLS + `purchase_shop_item` / `equip_shop_item` / `unequip_shop_item` SECURITY DEFINER RPCs (no client-side Florin writes) + publish shop tables to realtime |
| 051 | Third shop type: `profile_card` (viewed-profile card background). Extends the `shop_items.type` CHECK, adds `student_shop_loadout.profile_card_item_id`, extends `equip_shop_item`/`unequip_shop_item` for the new slot, seeds 4 SVG card backgrounds |
| 052 | Girls' theme shop: renames the `Golden Hour` background to `Samurai Sword` and seeds the two pink page backgrounds (Pink Butterfly, Pink Cat) for the Rose theme |
| 053 | Full habit tracker: new `habits` table (goal type/target, daily vs weekly frequency, Mon-first `scheduled_days`, status) + `habit_pauses` pause windows, both RLS-protected (own-row students, school-wide admins) and published to realtime. Re-keys `habit_entries` onto `habits.id` (backfills legacy `habit_type` rows, drops the column) and moves the uniqueness constraint to `(student_id, habit_id, entry_date)`. Seeds the five default habits for every student |
| 054 | Teacher dashboard prefs: `teacher_dashboard_prefs` (own-row RLS via profiles join, `teacher_id` unique, layout JSONB `{widgets:[{id,size,tall,order}]}`) - presentation-only Home customization, empty by default |
| 055 | Admin dashboard prefs: `admin_dashboard_prefs` (own-row RLS via profiles join, `admin_id` unique, layout JSONB) - same presentation-only model as teacher, empty by default |
| 056 | Student achievements: `student_achievements` (title, school_year, date_awarded, school, image_path; owner insert/delete via profiles join, same-school read) + public `certificates` storage bucket (owner folder write/delete mirroring avatars, public read) |
| 057 | Student music: `student_music` (music_url, platform, title, artist, album_cover_url; owner insert/delete via profiles join, same-school read) - metadata resolved server-side (keyless oEmbed for YouTube/SoundCloud/Vimeo, iTunes lookup for Apple Music, Spotify keyless oEmbed with optional Web API upgrade), links out only |
| 058 | Account lifecycle: `profiles.deactivated_at` (self-service, reversible deactivation; no data deleted). Deletion-safe FKs - school-required records (`grade_entries`, `course_enrollments`, `rank_period_entries`, `season_history_log`, `rank_history_log`, `library_borrow_log`, teacher/admin attribution on `learning_materials`/`quizzes`/`teacher_tasks`/`library_books`) switch to ON DELETE SET NULL (preserved + anonymized when the profile is deleted); `quiz_attempts` switches to CASCADE (personal). `get_school_leaderboard` excludes deactivated students |
| 047 | ~~Restore composite bar fill~~ **SUPERSEDED by 049** - 045's weight-dominant experiment was briefly reverted, then permanently replaced by per-entry isolation (049) |
| 046 | Period baseline: `student_rank_state` gains `period_start_rank/bar/ex_score/peak` (captured when the grading period is adopted); `revert_grade_rank_feed` now recomputes order-independently from the baseline + all remaining current-period entries, so bulk-clearing all grades (admin → clear course data) collapses the state to the baseline (D/0 for a fresh student) instead of leaving a stale bar residue; old-period deletions keep the anchor + replay path |


> Numbers 026-028 were created and removed during the rank-system rollback;
> the sequence is intentionally 025 -> 029.

---

## 6. Account lifecycle (migration 058)

Migration 058 introduces self-service deactivation and deletion-safe foreign
keys. The two behaviors are independent:

### Deactivation (`profiles.deactivated_at`)

- **Self-service.** Any student or teacher sets `deactivated_at` to the current
  timestamp; no admin step required.
- **Reversible.** Reactivation clears the timestamp. Nothing is deleted on
  deactivation.
- **Server-enforced.** `middleware.ts` redirects deactivated users to
  `/auth/reactivate`; they can only reach that page, login/signup, and
  callback routes. The profile's `deactivated_at` column is checked on every
  request.
- **Indexed.** A partial index (`idx_profiles_deactivated`) covers only
  rows where `deactivated_at IS NOT NULL`.
- **Excluded from:** the leaderboard (`get_school_leaderboard` filters
  `deactivated_at IS NULL`), active user searches (`useSchoolProfiles`
  filters `.is('deactivated_at', null)`), and friend lists (`friendsStore`
  excludes deactivated peers).
- **Admins** cannot deactivate their own account through the app.

### Permanent deletion (admin-approved)

1. Student/teacher submits a deletion request via `account_requests` (type
   `'deletion'`).
2. A same-school admin reviews the request in **Settings → Account requests**.
3. On approval, the server action `resolveDeletionRequest` uses the
   **service-role client** (`lib/supabase/serviceClient.ts`) to call
   `auth.admin.deleteUser()`.
4. `auth.users` → `profiles` cascades via `ON DELETE CASCADE` (migration 001),
   removing the profile row.
5. Migration 058's FK changes determine what happens to related data.

### Deletion-safe FK behavior

Migration 058 reclassifies foreign keys into two categories:

#### School-owned historical data → `ON DELETE SET NULL`

These records are **preserved** when the profile is deleted; the referencing
column is set to `NULL`, removing the identity while keeping the school's
academic record intact.

| Table | Column(s) | Purpose |
|---|---|---|
| `grade_entries` | `student_id`, `submitted_by` | Student grades + teacher attribution |
| `course_enrollments` | `student_id` | Course membership history |
| `rank_period_entries` | `student_id` | Per-grade rank feed entries |
| `season_history_log` | `student_id` | Historical season outcomes |
| `rank_history_log` | `student_id` | Rank change audit log |
| `learning_materials` | `uploaded_by` | Teacher-uploaded materials |
| `quizzes` | `created_by` | Teacher-created quizzes |
| `teacher_tasks` | `assigned_by` | Admin-assigned teacher tasks |
| `library_books` | `borrowed_by` | Library book ownership (borrower identity removed) |
| `library_borrow_log` | `student_id` | Library borrow history |

#### Personal data → `ON DELETE CASCADE`

These records are **removed** with the profile. Most were already cascading;
migration 058 switches `quiz_attempts` from `NO ACTION` to `CASCADE` so it no
longer blocks deletion.

| Table | What it holds |
|---|---|
| `student_achievements` | Posted certificates |
| `student_music` | Music link posts |
| `stories` / `story_views` | MyDay stories |
| `habits` / `habit_entries` / `habit_pauses` | Habit tracker data |
| `quiz_attempts` | Personal test results (changed from NO ACTION → CASCADE) |
| `chat_messages` / `chat_blocks` | Messaging data |
| `notifications` | Notification records |
| `florin_balances` / `shop_ownership` / `student_shop_loadout` | Florin currency and shop items |
| `student_rank_state` | Current rank state |
| `friends` | Friend relationships |
| `school_feed_posts` | User-authored feed posts |

#### Storage cleanup

After the DB cascade, the server action collects storage paths from the
(now-deleted or about-to-be-deleted) DB rows (avatar, certificates, stories,
materials, feed images) and removes them from Supabase Storage using the
service-role client. This is best-effort per bucket — failures are reported
back but never leave a half-deleted account.
