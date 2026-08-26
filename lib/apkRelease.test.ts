import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { APK_RELEASE, apkDownloadUrl, formatApkSize } from "./apkRelease.ts";

// Read (not import) package.json — avoids JSON import-attribute requirements.
const pkgVersion = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
).version as string;

test("APK release metadata matches the distributed artifact contract", () => {
  assert.equal(APK_RELEASE.packageName, "com.hierarchyclass.app");
  assert.equal(APK_RELEASE.version, pkgVersion, "APK version must track package.json");
  assert.equal(APK_RELEASE.versionCode, 11590);
  assert.equal(APK_RELEASE.sizeBytes, 1142956);
});

test("download URL is versioned and served from the public downloads path", () => {
  assert.equal(apkDownloadUrl(), `/downloads/hierarchy-class-v1.15.90.apk`);
  assert.match(apkDownloadUrl(), /^\/downloads\/hierarchy-class-v\d+\.\d+\.\d+\.apk$/);
  assert.equal(APK_RELEASE.fileName, apkDownloadUrl().split("/").pop());
});

test("checksum is a well-formed SHA-256 hex digest", () => {
  assert.match(APK_RELEASE.sha256, /^[a-f0-9]{64}$/);
});

test("size formatter renders MB with one decimal", () => {
  assert.equal(formatApkSize(1142956), "1.1 MB");
});
