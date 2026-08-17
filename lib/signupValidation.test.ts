import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parsePublicSignupRole,
  validateSignupInput,
  passwordPolicyError,
  isValidEmail,
  normalizeIdentifier,
  normalizeSignupIdentifiers,
  isSchoolEligibleForSignup,
  MIN_PASSWORD_LENGTH,
  type SignupInput,
} from "./signupValidation.ts";

function validStudent(overrides: Partial<SignupInput> = {}): SignupInput {
  return {
    email: "jane@example.com",
    password: "strongPass123",
    firstName: "Jane",
    lastName: "Doe",
    middleName: "",
    role: "student",
    schoolId: "school-a",
    studentId: "1001",
    facultyId: "",
    isLibrarian: false,
    ...overrides,
  };
}

function validTeacher(overrides: Partial<SignupInput> = {}): SignupInput {
  return {
    email: "mr.smith@example.com",
    password: "strongPass123",
    firstName: "John",
    lastName: "Smith",
    middleName: "Paul",
    role: "teacher",
    schoolId: "school-a",
    studentId: "",
    facultyId: "F-42",
    isLibrarian: false,
    ...overrides,
  };
}

test("student signup is accepted with all required fields", () => {
  assert.deepEqual(validateSignupInput(validStudent()), {});
});

test("teacher signup is accepted with all required fields", () => {
  assert.deepEqual(validateSignupInput(validTeacher()), {});
});

test("optional middle name is accepted for both roles", () => {
  assert.deepEqual(validateSignupInput(validStudent({ middleName: "Marie" })), {});
  assert.deepEqual(validateSignupInput(validTeacher({ middleName: "" })), {});
});

test("admin signup is REJECTED", () => {
  const errors = validateSignupInput(validStudent({ role: "admin" }));
  assert.ok(errors.role, "expected a role error for admin signup");
  assert.match(errors.role!, /Administrator accounts cannot be created/i);
});

test("admin role variants are rejected (case, spaces, synonyms)", () => {
  for (const role of ["ADMIN", " Administrator ", "school-admin", "campus admin", "owner", "superuser"]) {
    const errors = validateSignupInput(validStudent({ role }));
    assert.ok(errors.role, `expected role rejection for "${role}"`);
  }
});

test("role is required - empty role rejected", () => {
  const errors = validateSignupInput(validStudent({ role: "" }));
  assert.ok(errors.role);
});

test("missing student ID rejected for student signup", () => {
  const errors = validateSignupInput(validStudent({ studentId: "  " }));
  assert.ok(errors.studentId, "expected studentId error");
  assert.match(errors.studentId!, /student ID/i);
});

test("missing faculty ID rejected for teacher signup", () => {
  const errors = validateSignupInput(validTeacher({ facultyId: "" }));
  assert.ok(errors.facultyId, "expected facultyId error");
  assert.match(errors.facultyId!, /faculty ID/i);
});

test("a student without faculty ID is fine (no false positive)", () => {
  assert.deepEqual(validateSignupInput(validStudent({ facultyId: "" })), {});
});

test("missing names rejected", () => {
  const errors = validateSignupInput(validStudent({ firstName: " ", lastName: "" }));
  assert.ok(errors.firstName);
  assert.ok(errors.lastName);
});

test("missing school rejected", () => {
  const errors = validateSignupInput(validStudent({ schoolId: "" }));
  assert.ok(errors.school);
});

test("invalid email rejected", () => {
  for (const email of ["not-an-email", "a@b", "a b@c.com", ""]) {
    const errors = validateSignupInput(validStudent({ email }));
    assert.ok(errors.email, `expected email error for "${email}"`);
  }
  assert.equal(isValidEmail("jane@example.com"), true);
});

test("password policy - too short rejected", () => {
  // 7 chars (under the 8-char minimum) but still a letter+number mixture,
  // so the ONLY failing rule is the length.
  const short = "a1" + "b".repeat(MIN_PASSWORD_LENGTH - 3);
  assert.equal(short.length, MIN_PASSWORD_LENGTH - 1);
  const errors = validateSignupInput(validStudent({ password: short }));
  assert.ok(errors.password);
  assert.match(errors.password!, /at least/i);
});

test("password policy - letters only rejected", () => {
  const errors = validateSignupInput(validStudent({ password: "abcdefgh" }));
  assert.ok(errors.password);
  assert.match(errors.password!, /letter and one number/i);
});

test("password policy - digits only rejected", () => {
  const errors = validateSignupInput(validStudent({ password: "12345678" }));
  assert.ok(errors.password);
});

test("password policy - valid mixture accepted", () => {
  assert.equal(passwordPolicyError("abc12345"), null);
  assert.equal(passwordPolicyError("Str0ngPass!"), null);
});

test("parsePublicSignupRole maps exactly student/teacher (case-insensitive)", () => {
  assert.equal(parsePublicSignupRole("student"), "student");
  assert.equal(parsePublicSignupRole("Student"), "student");
  assert.equal(parsePublicSignupRole(" teacher "), "teacher");
  assert.equal(parsePublicSignupRole("admin"), null);
  assert.equal(parsePublicSignupRole(""), null);
  assert.equal(parsePublicSignupRole(null), null);
  assert.equal(parsePublicSignupRole(undefined), null);
  assert.equal(parsePublicSignupRole(42), null);
});

test("identifiers are normalized consistently (trim + collapse whitespace)", () => {
  assert.equal(normalizeIdentifier("  1001  "), "1001");
  assert.equal(normalizeIdentifier("  2024  - 1001 "), "2024 - 1001");
  const ids = normalizeSignupIdentifiers(validStudent({ studentId: "  1001  " }));
  assert.equal(ids.studentId, "1001");
  assert.equal(ids.facultyId, null);
  assert.equal(ids.middleName, null);
  const teacherIds = normalizeSignupIdentifiers(validTeacher({ facultyId: " F-42 " }));
  assert.equal(teacherIds.facultyId, "F-42");
  assert.equal(teacherIds.studentId, null);
  assert.equal(teacherIds.middleName, "Paul");
});

test("school eligibility requires active AND registration_enabled", () => {
  const open = { id: "a", active: true, registration_enabled: true };
  assert.equal(isSchoolEligibleForSignup(open), true);
  assert.equal(isSchoolEligibleForSignup({ ...open, active: false }), false);
  assert.equal(isSchoolEligibleForSignup({ ...open, registration_enabled: false }), false);
  assert.equal(isSchoolEligibleForSignup({ id: "a", active: false, registration_enabled: false }), false);
  assert.equal(isSchoolEligibleForSignup(null), false);
  assert.equal(isSchoolEligibleForSignup(undefined), false);
});
