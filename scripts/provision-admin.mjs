#!/usr/bin/env node
/**
 * Developer/platform-owner admin provisioning.
 *
 * Admins are NEVER created through public signup (which only accepts
 * student/teacher and is rejected at the database trigger level). This script
 * is the controlled mechanism: it runs on the developer's machine / CI with
 * the SERVICE-ROLE key (server-only, never in the browser bundle).
 *
 * What it does:
 *   1. Validates that the target school exists and is active (and open for
 *      registration - the signup trigger enforces the same rule).
 *   2. Creates the auth user with email confirmation pre-approved
 *      (email_confirm: true) and metadata WITHOUT an admin role - the
 *      handle_new_user trigger therefore creates a neutral student profile.
 *   3. Upgrades that profile to role = 'admin' via the service role (the
 *      protected-columns trigger exempts the service role) and removes the
 *      placeholder florin balance.
 *
 * Requirements:
 *   - SUPABASE_SERVICE_ROLE_KEY (server-only env var)
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - @supabase/supabase-js (already in package.json dependencies)
 *
 * Usage:
 *   node scripts/provision-admin.mjs \
 *     --email admin@school.edu \
 *     --password 'a-strong-password' \
 *     --first-name Jane --last-name Doe [--middle-name Marie] \
 *     --school CSA                      # abbreviation OR --school-id <uuid>
 *
 * Optional: --password omitted -> a random password is generated and printed
 * once (change it on first login via the forgot-password flow).
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return undefined;
}

const email = arg("email");
const password = arg("password");
const firstName = arg("first-name");
const lastName = arg("last-name");
const middleName = arg("middle-name");
const school = arg("school");
const schoolId = arg("school-id");

if (!email || !firstName || !lastName || (!school && !schoolId)) {
  fail(
    "Usage: node scripts/provision-admin.mjs --email <email> [--password <pw>] --first-name <name> --last-name <name> [--middle-name <name>] --school <abbreviation> | --school-id <uuid>"
  );
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-only).");
}

const svc = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// 1) School must exist and be active + open for registration.
const schoolQuery = schoolId
  ? svc.from("schools").select("id, name, abbreviation, active, registration_enabled").eq("id", schoolId)
  : svc.from("schools").select("id, name, abbreviation, active, registration_enabled").eq("abbreviation", school ?? "");

const { data: schoolRows, error: schoolError } = await schoolQuery;
if (schoolError || !schoolRows || schoolRows.length === 0) {
  fail(`School not found (${schoolId ? `id ${schoolId}` : `abbreviation ${school}`}).`);
}
const target = schoolRows[0];
if (!target.active || !target.registration_enabled) {
  fail(
    `School "${target.name}" is not open for registration (active=${target.active}, registration_enabled=${target.registration_enabled}). ` +
      "Enable registration before provisioning an admin for it."
  );
}
console.log(`→ School: ${target.name} (${target.abbreviation})`);

// 2) The email must not already be an auth user.
const { data: existing } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (existing?.users.some((u) => u.email?.toLowerCase() === email.toLowerCase())) {
  fail(`An account already exists for ${email}.`);
}

// 3) Create the auth user. Role is deliberately NOT admin in metadata: the
//    handle_new_user trigger only accepts student/teacher, so the profile
//    starts as a neutral student placeholder and is upgraded below.
const finalPassword = password ?? randomBytes(12).toString("base64url");
const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

const { data: created, error: createError } = await svc.auth.admin.createUser({
  email,
  password: finalPassword,
  email_confirm: true,
  user_metadata: {
    school_id: target.id,
    first_name: firstName,
    middle_name: middleName ?? null,
    last_name: lastName,
    name: fullName,
    role: "student", // placeholder - upgraded below
    is_provisioned: "true", // skip the placeholder florin balance
  },
});

if (createError || !created.user) {
  fail(`Could not create the auth user: ${createError?.message ?? "unknown error"}`);
}
const userId = created.user.id;
console.log(`→ Auth user created: ${email} (${userId})`);

// 4) Upgrade the profile to admin (service role bypasses RLS; the
//    protect_profile_columns trigger exempts the service role).
const { data: profileRows, error: profileError } = await svc
  .from("profiles")
  .select("id")
  .eq("user_id", userId);
if (profileError || !profileRows || profileRows.length === 0) {
  fail(`Profile row was not created for ${email} - check the handle_new_user trigger.`);
}
const profileId = profileRows[0].id;

const { error: upgradeError } = await svc
  .from("profiles")
  .update({ role: "admin" })
  .eq("id", profileId);
if (upgradeError) {
  fail(`Could not set role=admin: ${upgradeError.message}`);
}

// 5) Remove the placeholder florin balance created for the student stub.
await svc.from("florin_balances").delete().eq("student_id", profileId);

console.log(`✓ Admin provisioned: ${fullName} <${email}> at ${target.name}`);
console.log(`  Profile: ${profileId}`);
if (!password) {
  console.log(`  Generated password (change it via forgot-password): ${finalPassword}`);
}
