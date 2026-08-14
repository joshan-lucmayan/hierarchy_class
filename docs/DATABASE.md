# Hierarchy Class — Database

This document covers the PostgreSQL schema behind the app: the main tables,
how row-level security (RLS) is structured, storage buckets, and the complete
migration index. Migrations live in `database/migrations/` — see
[`database/README.md`](../database/README.md) for how to apply them.

---

## 1. Schema overview (by domain)

### Identity & school

| Table | Purpose | Key columns |
|---|---|---|
| `schools` | The tenant (a school/campus) | name, abbreviation |
| `profiles` | One row per app user (student/teacher/admin) | user_id, role, school_id, full_name, avatar_url, bio, hobbies, tags, favorite_subject, educational_level, program, level_label, section (legacy), is_librarian |
| `account_requests` | Deactivate/delete requests | profile_id, type, status |

### Academics (the hierarchy)

| Table | Purpose |
|---|---|
| `programs` | Self-referencing (`parent_id`): education levels at the top (`parent_id` NULL), programs nested under them (`parent_id` set) |
| `sections` | Year/grade level inside a program (e.g. Year 1, Grade 12) |
| `courses` | Individual subjects, assigned to a teacher, in a section |
| `course_enrollments` | Student ↔ course membership |
| `grade_entries` | The core grade row: student, course, type (Exam/Quiz/Activity/Assignment), score, `approval_status` ('pending'/'approved'/'rejected'), submitted_by |
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
| `habit_entries` | Daily habit completion (study/exercise/reading/sleep/focus), one row per student per habit per date |
| `florin_balances` | Read-only currency balance (no client minting) |
| `library_books`, `library_borrow_requests`, `library_borrow_log` | Library catalog + borrow flow |
| `quizzes`, `quiz_questions`, `quiz_attempts` | Quiz engine |
| `learning_materials` | Course materials with storage file paths |
| `banner_config` | Admin-managed header banner |
| `enrollment_status` | Admin-managed enrollment: status, started_at, expires_at |
| `teacher_notes`, `teacher_schedule`, `teacher_lesson_plans` | Teacher's own workspace (notes/schedule/lessons) |

### Admin-only reference tables

`programs`, `sections`, `courses`, `course_enrollments`, `banner_config` are
managed from the admin pages and are read-only for everyone else.

---

## 2. RLS model

**Row-level security is the gate for everything.** No policy, no data. The
pattern is consistent across tables:

1. **School scoping** — every school-scoped table joins back to `profiles` or
   uses `auth.jwt()` metadata to confirm the row belongs to the caller's
   `school_id`.
2. **Role scoping** — students, teachers, and admins see different slices:
   - Students: only their own rows (grades, habits, enrollment) or
     school-wide rows that are safe to share (roster, feed, leaderboard
     aggregates).
   - Teachers: rows for courses they teach; school-wide roster and
     enrollment status (read-only).
   - Admins: everything in their school.
3. **Ownership scoping** — personal data (profile, notifications, chat
   per-side state, habits) is gated by `profile_id = my profile`.

### Grade privacy (the strictest case)

- Students read **only their own approved** `grade_entries`.
- Teachers read rows for courses they teach.
- Admins read the whole school.
- The leaderboard is an **aggregate-only** `SECURITY DEFINER` function
  (`get_school_leaderboard`) — raw grade rows are never exposed.

### Protected columns

A BEFORE UPDATE trigger on `profiles` blocks non-admins from changing `role`,
`school_id`, `academic_excellence`, rank, and the librarian flag.

---

## 3. Storage buckets

All buckets are **private**; access is enforced by storage RLS policies.

| Bucket | Purpose | Access |
|---|---|---|
| `avatars` | Profile pictures | Owner upload/delete; school-wide read via signed URLs |
| `materials` | Teacher course materials | Teacher (own school) upload; school-wide read |
| `feed` | Feed post images | Admin/author upload |
| `myday` | Story images | Author upload; 24h signed URLs |
| `banners` | Admin banner images | Admin only |

Paths follow `{school_id}/{profile_id}/{uuid}.{ext}` (no bucket prefix inside
the object name — storage policies parse the folder as
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
| 007–009 | Library description, add-book (cover/isbn), teacher-task delete policy |
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
| 032 | Education Level Management: `programs.parent_id` self-reference so levels → programs → year/levels nest; idempotent orphan reparenting |
| 033 | `profiles.program` column — the program saved from Academic info (level · program · year) |

> Numbers 026–028 were created and removed during the rank-system rollback;
> the sequence is intentionally 025 → 029.
