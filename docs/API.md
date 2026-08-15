# Hierarchy Class - API

Hierarchy Class has no separate REST service. The "API" is a combination of
three surfaces:

1. **Next.js routes** (`app/api/`, `app/actions/`, `middleware.ts`) - the
   server-side layer of the Next app.
2. **Supabase REST** (PostgREST) - the browser talks to Supabase directly
   with the anon key; RLS scopes every query. Tables are listed in
   [DATABASE.md](./DATABASE.md).
3. **Supabase RPCs** - `SECURITY DEFINER` Postgres functions for operations
   that can't be expressed as simple RLS-restricted table writes.

---

## 1. Next.js routes

| Route | Method | Purpose |
|---|---|---|
| `/api/feedback` | POST | Sends the feedback/report form to email (Resend) |
| `/auth/callback` | GET | Exchanges the auth/recovery code for a session; routes password-reset flows |
| `/actions/auth` | server action | Signup (first/last name + auth) |
| `middleware.ts` | - | Session refresh + role-prefix guard (see [SECURITY.md](./SECURITY.md)) |

Everything else under `app/` is the client-rendered UI (App Router pages).

---

## 2. Supabase RPCs (server-side functions)

Called from the client with `supabase.rpc(...)`. All are `SECURITY DEFINER`
and validate the caller (participant, same school, role) before acting.

### Messaging

| RPC | What it does |
|---|---|
| `ensure_conversation(p_other_user_id)` | Find or create the shared thread; block-aware; returns the conversation id |
| `send_chat_message(p_conversation_id, p_text)` | Inserts the message, bumps `last_message`/`last_message_at`, revives the other side from archive |
| `set_conversation_read(p_conversation_id, p_read)` | Marks MY side read/unread |
| `set_conversation_archived(p_conversation_id, p_archived)` | Archives/unarchives MY side |
| `delete_conversation(p_conversation_id)` | Sets MY history cutoff; when both sides have deleted, clears the shared preview (migration 031) |
| `get_unread_counts()` | Unread per visible conversation for the caller |

### Grades & leaderboard

| RPC | What it does |
|---|---|
| `get_school_leaderboard()` | **Legacy** aggregate-only rankings over approved grade entries (superseded by the rank engine; kept for reference) |
| `approve_grade_submission(...)` | Batch approve/reject pending entries + one notification per submitting teacher. Approving also **auto-feeds the rank engine** (migration 036 trigger: `process_score_entry` with type->category mapping, score/100, current period, exactly-once per grade); **rejecting** (or deleting) an approved grade **reverts its rank effect** via `revert_grade_rank_feed` (migration 037) |
| `revert_grade_rank_feed(p_grade_id)` | (migration 037) Removes the rank feed a grade produced, restores the before-state, replays all later entries through the engine math, and logs `feed_reverted` - called automatically by the reject/delete triggers |

### Rank engine (migration 034)

| RPC | What it does |
|---|---|
| `get_rank_config(p_school_id)` | Get (or lazily create) the school's rank config: weights, `k`, `ex_step`, tiers, season reset map |
| `update_rank_config(...)` | Admin-only config upsert with validation (weights sum to 1, tiers/reset map complete) |
| `validate_score_entry(...)` | Hard blocks (`earned < 0`, `possible <= 0`) + warnings (1.5× typo, peer max-score drift) |
| `preview_rank_update(p_student_id, p_period_id, p_category, p_earned, p_possible)` | Full pipeline, **zero side effects**, returns a stateless md5 preview token |
| `confirm_and_apply_score_entry(..., p_preview_token)` | The only writer: re-validates, rejects stale preview tokens, updates state + writes the event log |
| `process_score_entry(..., p_auto_confirm, p_source_grade_id, p_weights)` | Orchestrates validate -> preview -> (auto) confirm; optional course weights override the school config |
| `reset_period_category_totals(p_student_id, p_new_period_id)` | Clears category totals at a period boundary; rank/bar untouched |
| `end_season(...)` | Peak-based season reseed + `season_history_log` + monotonic `highest_rank_ever` |
| `get_season_history(p_student_id)` | Season logs ordered by `season_end_date` |
| `get_dual_rank_display(p_student_id)` | current rank/bar/EX score/peak/highest for the UI |
| `save_course_rank_weights(p_course_id, p_categories)` | (migration 040) Teacher/admin REPLACES a course's category list - `p_categories` is an array of {key, label, weight} (add / remove / edit in one call; weights must sum to 100) - used for the classroom weighted average and the rank auto-feed |
| `get_course_rank_weights(p_course_id)` | (migration 040) The course's category array, or the school default four as percents when none configured |
| `declare_semester(p_school_id, p_school_year, p_semester_label, p_start_date, p_end_date)` | (migration 038, admin-only) Closes the previous active semester and starts a new one - its label becomes the grading period for the auto-feed |
| `get_active_semester(p_school_id)` | (migration 038) The school's current active semester, if any |
| `end_season_for_school(p_school_id, p_school_year, p_semester_label)` | **Admin-only (migration 035):** reseeds every ranked student in the school from their season peak; writes one `season_history_log` per student; returns the count + per-student results |
| `get_school_season_history(p_school_id)` | All season logs for a school (join with profiles for names), newest first |

### Notifications

| RPC | What it does |
|---|---|
| `create_notification(...)` | One notification with a same-school check |
| `notify_admins(...)` | Fan-out to all admins (grade submissions) |
| `notify_post_audience(...)` | Fan-out announcements by audience (admin only) |

### Enrollment

| RPC | What it does |
|---|---|
| `effective_enrollment_status(...)` | Enrolled/expired/revoked at read time |
| `refresh_expired_enrollments()` | Bulk expiry pass (optional hardening) |

---

## 3. Realtime channels

The browser subscribes with `supabase.channel(...)` and
`postgres_changes`. RLS scopes which events each user receives.

| Channel | Table / event | Consumer |
|---|---|---|
| `chat-inbox` | chat_messages INSERT (no filter; RLS-scoped) | ChatProvider - appends to open thread, bumps unread |
| `chat-blocks-mine` | chat_blocks all events | ChatProvider - refreshes the block list |
| `notifications-mine` | notifications INSERT `recipient_id=eq.me` | NotificationsProvider - unread bell |
| `classroom-grades` | grade_entries all events | ClassroomHierarchyProvider - live averages |
| `rank-state-<id>` | student_rank_state all events | RankProvider - live rank cards/leaderboard; **unique channel per instance** so multiple mounts never collide |
| `habit-entries` | habit_entries INSERT (own) | HabitProvider - live weekly counts |

Design rule: **one channel per provider, created once per mount, removed on
cleanup** - never re-created on list growth, and never a fixed name for hooks
that can be mounted more than once.
