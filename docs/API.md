# Hierarchy Class — API

Hierarchy Class has no separate REST service. The "API" is a combination of
three surfaces:

1. **Next.js routes** (`app/api/`, `app/actions/`, `middleware.ts`) — the
   server-side layer of the Next app.
2. **Supabase REST** (PostgREST) — the browser talks to Supabase directly
   with the anon key; RLS scopes every query. Tables are listed in
   [DATABASE.md](./DATABASE.md).
3. **Supabase RPCs** — `SECURITY DEFINER` Postgres functions for operations
   that can't be expressed as simple RLS-restricted table writes.

---

## 1. Next.js routes

| Route | Method | Purpose |
|---|---|---|
| `/api/feedback` | POST | Sends the feedback/report form to email (Resend) |
| `/auth/callback` | GET | Exchanges the auth/recovery code for a session; routes password-reset flows |
| `/actions/auth` | server action | Signup (first/last name + auth) |
| `middleware.ts` | — | Session refresh + role-prefix guard (see [SECURITY.md](./SECURITY.md)) |

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
| `get_school_leaderboard()` | Aggregate-only rankings over approved grade entries (never raw rows) |
| `approve_grade_submission(...)` | Batch approve/reject pending entries + one notification per submitting teacher |

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
| `chat-inbox` | chat_messages INSERT (no filter; RLS-scoped) | ChatProvider — appends to open thread, bumps unread |
| `chat-blocks-mine` | chat_blocks all events | ChatProvider — refreshes the block list |
| `notifications-mine` | notifications INSERT `recipient_id=eq.me` | NotificationsProvider — unread bell |
| `classroom-grades` | grade_entries all events | ClassroomHierarchyProvider — live averages/ranks |
| `leaderboard-grades-<id>` | grade_entries all events | useLeaderboard — **unique channel per instance** so multiple mounts (search + profile preview) never collide |
| `habit-entries` | habit_entries INSERT (own) | HabitProvider — live weekly counts |

Design rule: **one channel per provider, created once per mount, removed on
cleanup** — never re-created on list growth, and never a fixed name for hooks
that can be mounted more than once.
