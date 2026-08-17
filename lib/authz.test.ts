import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideAuthRoute,
  homePathForRole,
  type AuthContext,
} from "./authz.ts";

function ctx(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    pathname: "/student/home",
    isAuthenticated: true,
    emailConfirmed: true,
    profile: { role: "student", school_id: "school-a", deactivated_at: null, restricted_at: null },
    ...overrides,
  };
}

const student = { role: "student" as const, school_id: "school-a", deactivated_at: null, restricted_at: null };
const teacher = { role: "teacher" as const, school_id: "school-a", deactivated_at: null, restricted_at: null };
const admin = { role: "admin" as const, school_id: "school-a", deactivated_at: null, restricted_at: null };

test("homePathForRole maps roles to their home route", () => {
  assert.equal(homePathForRole("student"), "/student/home");
  assert.equal(homePathForRole("teacher"), "/teacher/home");
  assert.equal(homePathForRole("admin"), "/admin/home");
});

test("unauthenticated users are sent to /login preserving the destination", () => {
  const decision = decideAuthRoute(ctx({ isAuthenticated: false, pathname: "/admin/settings" }));
  assert.equal(decision.type, "redirect");
  if (decision.type === "redirect") {
    assert.match(decision.to, /^\/login\?next=/);
    assert.ok(decision.to.includes(encodeURIComponent("/admin/settings")));
  }
});

test("unauthenticated users can reach public pages", () => {
  for (const pathname of ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback", "/terms"]) {
    assert.equal(decideAuthRoute(ctx({ isAuthenticated: false, pathname })).type, "next", pathname);
  }
});

test("restricted users are locked to the restriction/appeal flow", () => {
  const restricted = { ...student, restricted_at: "2026-01-01T00:00:00Z" };
  assert.equal(
    decideAuthRoute(ctx({ profile: restricted, pathname: "/student/home" })).type,
    "redirect"
  );
  const decision = decideAuthRoute(ctx({ profile: restricted, pathname: "/teacher/home" }));
  assert.equal(decision.type, "redirect");
  if (decision.type === "redirect") assert.equal(decision.to, "/auth/restricted");
});

test("restricted users can reach the restriction/callback/recovery/API paths", () => {
  const restricted = { ...student, restricted_at: "2026-01-01T00:00:00Z" };
  for (const pathname of [
    "/auth/restricted",
    "/auth/callback",
    "/forgot-password",
    "/reset-password",
    "/logout",
    "/api/export-account",
  ]) {
    assert.equal(decideAuthRoute(ctx({ profile: restricted, pathname })).type, "next", pathname);
  }
});

test("restriction takes precedence over deactivation", () => {
  const both = { ...student, deactivated_at: "2026-01-01T00:00:00Z", restricted_at: "2026-01-01T00:00:00Z" };
  const decision = decideAuthRoute(ctx({ profile: both, pathname: "/student/home" }));
  assert.equal(decision.type, "redirect");
  if (decision.type === "redirect") assert.equal(decision.to, "/auth/restricted");
});

test("deactivated users are locked to the reactivation flow", () => {
  const deactivated = { ...student, deactivated_at: "2026-01-01T00:00:00Z" };
  assert.equal(
    decideAuthRoute(ctx({ profile: deactivated, pathname: "/student/home" })).type,
    "redirect"
  );
  const decision = decideAuthRoute(ctx({ profile: deactivated, pathname: "/teacher/home" }));
  assert.equal(decision.type, "redirect");
  if (decision.type === "redirect") assert.equal(decision.to, "/auth/reactivate");
});

test("deactivated users can reach the reactivation/callback/recovery/API paths", () => {
  const deactivated = { ...student, deactivated_at: "2026-01-01T00:00:00Z" };
  for (const pathname of [
    "/auth/reactivate",
    "/auth/callback",
    "/forgot-password",
    "/reset-password",
    "/api/export-account",
  ]) {
    assert.equal(decideAuthRoute(ctx({ profile: deactivated, pathname })).type, "next", pathname);
  }
});

test("authenticated user with NO profile is sent to the incomplete flow, never allowed", () => {
  for (const pathname of ["/student/home", "/teacher/home", "/admin/home", "/login", "/signup", "/"]) {
    const decision = decideAuthRoute(ctx({ profile: null, pathname }));
    assert.equal(decision.type, "redirect", pathname);
    if (decision.type === "redirect") assert.equal(decision.to, "/auth/incomplete");
  }
  assert.equal(decideAuthRoute(ctx({ profile: null, pathname: "/auth/incomplete" })).type, "next");
});

test("unverified email blocks application access", () => {
  for (const pathname of ["/student/home", "/teacher/home", "/admin/home", "/student/search"]) {
    const decision = decideAuthRoute(ctx({ emailConfirmed: false, pathname }));
    assert.equal(decision.type, "redirect", pathname);
    if (decision.type === "redirect") assert.equal(decision.to, "/login?unverified=1");
  }
});

test("unverified users can still reach login/signup and callback", () => {
  for (const pathname of ["/login", "/signup", "/auth/callback"]) {
    assert.equal(decideAuthRoute(ctx({ emailConfirmed: false, pathname })).type, "next", pathname);
  }
});

test("a user_metadata-style forged role cannot change routing - profile role rules", () => {
  // Even if a caller somehow had admin claims in metadata, the middleware
  // passes the PROFILE role - a student profile stays a student.
  assert.equal(decideAuthRoute(ctx({ profile: student, pathname: "/student/home" })).type, "next");
  const decision = decideAuthRoute(ctx({ profile: student, pathname: "/admin/home" }));
  assert.equal(decision.type, "redirect");
  if (decision.type === "redirect") assert.equal(decision.to, "/student/home");
});

test("wrong-role access is bounced to the user's own home", () => {
  const cases: [NonNullable<AuthContext["profile"]>, string, string][] = [
    [student, "/teacher/home", "/student/home"],
    [student, "/admin/home", "/student/home"],
    [teacher, "/student/home", "/teacher/home"],
    [teacher, "/admin/home", "/teacher/home"],
    [admin, "/student/home", "/admin/home"],
    [admin, "/teacher/home", "/admin/home"],
  ];
  for (const [profile, pathname, expected] of cases) {
    const decision = decideAuthRoute(ctx({ profile, pathname }));
    assert.equal(decision.type, "redirect", `${pathname} for ${profile.role}`);
    if (decision.type === "redirect") assert.equal(decision.to, expected);
  }
});

test("correct-role access is allowed", () => {
  assert.equal(decideAuthRoute(ctx({ profile: student, pathname: "/student/home" })).type, "next");
  assert.equal(decideAuthRoute(ctx({ profile: teacher, pathname: "/teacher/home" })).type, "next");
  assert.equal(decideAuthRoute(ctx({ profile: admin, pathname: "/admin/home" })).type, "next");
  assert.equal(decideAuthRoute(ctx({ profile: admin, pathname: "/admin/users" })).type, "next");
});

test("signed-in users on login/signup are sent to their own home", () => {
  assert.equal(decideAuthRoute(ctx({ profile: student, pathname: "/login" })).type, "redirect");
  assert.equal(decideAuthRoute(ctx({ profile: teacher, pathname: "/signup" })).type, "redirect");
  const decision = decideAuthRoute(ctx({ profile: student, pathname: "/login" }));
  if (decision.type === "redirect") assert.equal(decision.to, "/student/home");
});
