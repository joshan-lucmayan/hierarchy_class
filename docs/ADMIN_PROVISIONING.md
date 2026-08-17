# Admin Provisioning (Platform Owner)

Administrator accounts are **never** created through public signup. The
signup form, the server action, and the `handle_new_user()` database trigger
all reject `role = admin` outright. Admins are provisioned by the platform
owner/developer through one of the two controlled mechanisms below.

## Security model

```
Developer (platform owner)  ->  registers schools (SQL / seed script)
Developer (platform owner)  ->  provisions admin accounts (this document)
School admin                ->  manages students/teachers in their own school
School admin                ->  can NEVER create platform admins
```

A school admin cannot promote a user to admin, demote an admin, edit another
admin's row, or move a user across schools - enforced by the
`protect_profile_columns` trigger and the `profiles_admin_update` RLS policy
(migration 059).

## What happens on the database

Admin provisioning deliberately avoids putting `role = admin` in
`user_metadata` (the signup trigger rejects it). Instead:

1. The auth user is created with metadata whose role is the neutral
   `student` placeholder plus `is_provisioned = "true"` (which skips the
   placeholder florin balance).
2. The `handle_new_user()` trigger creates the profile row as a student.
3. The service role upgrades the profile to `role = admin` directly - the
   `protect_profile_columns` trigger exempts `auth.role() = 'service_role'`,
   so this is the only path that can set the admin role.

Because the upgrade runs with the service role (server-only key), a random
user can never perform it. The `is_provisioned` marker itself is harmless if
forged - it only skips a florin balance.

## Mechanism A - provisioning script (recommended)

`scripts/provision-admin.mjs` runs on the developer's machine or CI with the
server-only `SUPABASE_SERVICE_ROLE_KEY`:

```bash
node scripts/provision-admin.mjs \
  --email admin@school.edu \
  --password 'a-strong-password' \
  --first-name Jane --last-name Doe --middle-name Marie \
  --school CSA            # or: --school-id <uuid>
```

- Validates the school exists, is active, and is open for registration.
- Creates the auth user with email confirmation pre-approved.
- Upgrades the profile to `role = admin`.
- Without `--password` a random password is generated and printed once
  (change it via the forgot-password flow).

The script requires `@supabase/supabase-js` (already a dependency) and the
env vars `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. It lives
in `scripts/`, which is never part of the Next.js client bundle.

## Mechanism B - Supabase SQL Editor / Dashboard

Equivalent steps by hand:

```sql
-- 1. Find the school.
SELECT id, name, abbreviation, active, registration_enabled
FROM schools WHERE abbreviation = 'CSA';

-- 2. Create the auth user via the Dashboard (Authentication > Users > Add
--    user, or the Admin API) with user_metadata:
--    { "school_id": "<uuid>", "first_name": "Jane", "middle_name": "Marie",
--      "last_name": "Doe", "name": "Jane Marie Doe",
--      "role": "student", "is_provisioned": "true" }
--    Mark the email as confirmed.

-- 3. Promote the resulting profile to admin (runs as postgres/service role,
--    which the protect_profile_columns trigger exempts).
UPDATE profiles
SET role = 'admin'
WHERE user_id = '<new auth user id>';

-- 4. Remove the placeholder florin balance (created for the student stub).
DELETE FROM florin_balances
WHERE student_id = (SELECT id FROM profiles WHERE user_id = '<new auth user id>');
```

## Adding a second admin for a school

Exactly the same process - the school contacts the platform owner, the owner
provisions another admin. There is no self-service "create admin" page.

## Registering / closing a school

- **Register:** insert the school (SQL editor or `scripts/seed-schools.sql`)
  with `active = true` and `registration_enabled = true` so students and
  teachers can sign up.
- **Close:** `UPDATE schools SET registration_enabled = false WHERE id = '<uuid>';`
  The school stays in the database (`active` untouched); it simply stops
  appearing in the signup selector, and new signups are rejected by the
  server action and the trigger. Existing members keep working.
