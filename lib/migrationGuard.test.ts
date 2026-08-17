import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Static SQL-contract guard for migration 059.
 *
 * This suite does NOT exercise RLS (no database is available in the Node test
 * environment - see docs/SECURITY.md for the live-DB RLS verification
 * checklist). It pins the security invariants of the migration text so a
 * future refactor cannot silently drop them:
 *
 *   1. School admins can never modify an admin account (protect_profile_columns
 *      blocks demotion + authorization-field edits on admin rows).
 *   2. profiles_admin_update cannot target existing admin rows.
 *   3. The six owner-insert policies require school_id = my_school_id().
 */

const MIGRATION = readFileSync(
  fileURLToPath(new URL("../database/migrations/059_auth_restructure.sql", import.meta.url)),
  "utf8"
);

test("059: protect_profile_columns blocks modifying an existing admin account", () => {
  const guard = "Cannot modify an admin account";
  assert.ok(MIGRATION.includes(guard), `migration must contain "${guard}"`);
  // The guard must sit in the admin branch and fire on role/school/user_id
  // changes of an admin row, but stay silent for service-role provisioning.
  const adminBranch = MIGRATION.split("IF caller_role = 'admin' THEN")[1] ?? "";
  assert.ok(adminBranch.includes("OLD.role = 'admin'"), "admin-row guard must key on OLD.role = 'admin'");
  assert.ok(adminBranch.includes("NEW.role IS DISTINCT FROM OLD.role"), "role changes on admin rows blocked");
  assert.ok(adminBranch.includes("NEW.school_id IS DISTINCT FROM OLD.school_id"), "school changes on admin rows blocked");
  assert.ok(adminBranch.includes("NEW.user_id IS DISTINCT FROM OLD.user_id"), "user_id changes on admin rows blocked");
  // Service-role provisioning must remain exempt (returns NEW before guards).
  const serviceBranch = MIGRATION.split("IF auth.role() = 'service_role' THEN")[1] ?? "";
  assert.ok(serviceBranch.includes("RETURN NEW"), "service role stays exempt");
});

test("059: profiles_admin_update cannot target existing admin rows", () => {
  const policy = MIGRATION.split('CREATE POLICY "profiles_admin_update"')[1] ?? "";
  assert.ok(policy.includes("profiles.role IS DISTINCT FROM 'admin'"), "USING must exclude admin rows");
  assert.ok(policy.includes("role IS DISTINCT FROM 'admin'"), "WITH CHECK must block promoting to admin");
  assert.ok(policy.includes("p.school_id = profiles.school_id"), "admin scope must stay same-school");
});

test("059: owner-insert policies constrain school_id to the caller's school", () => {
  const cases: { policy: string; table: string; ownerCol: string }[] = [
    { policy: "stories_own_create", table: "stories", ownerCol: "user_id" },
    { policy: "achievements_own_insert", table: "student_achievements", ownerCol: "student_id" },
    { policy: "music_own_insert", table: "student_music", ownerCol: "student_id" },
    { policy: "quiz_attempts_student_create", table: "quiz_attempts", ownerCol: "student_id" },
    { policy: "borrow_requests_student_create", table: "library_borrow_requests", ownerCol: "student_id" },
    { policy: "account_requests_own_create", table: "account_requests", ownerCol: "requester_id" },
  ];
  for (const { policy, table, ownerCol } of cases) {
    const block = MIGRATION.split(`CREATE POLICY "${policy}" ON ${table}`)[1] ?? "";
    assert.ok(
      block.includes("school_id = public.my_school_id()"),
      `${policy} on ${table} must require school_id = my_school_id()`
    );
    assert.ok(
      block.includes(`${ownerCol} = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())`),
      `${policy} on ${table} must keep the owner-binding (${ownerCol})`
    );
  }
});

test("059: admin role is never creatable through public signup metadata", () => {
  const trigger = MIGRATION.split("CREATE OR REPLACE FUNCTION public.handle_new_user()")[1] ?? "";
  assert.ok(
    trigger.includes("IF meta_role NOT IN ('student', 'teacher')"),
    "handle_new_user must reject any role outside student/teacher"
  );
});
