/**
 * Metadata for the officially distributed Android APK.
 *
 * The binary itself lives at `public/downloads/<fileName>` so that after
 * deployment it is served directly from the production domain:
 *   https://www.hierarchyclass.com/downloads/<fileName>
 *
 * Every value here must match the REAL audited artifact.
 * Update after building the release APK with:
 *   cd android && ./gradlew assembleRelease
 *   sha256sum app/build/outputs/apk/release/app-release-unsigned.apk
 *   ls -la app/build/outputs/apk/release/app-release-unsigned.apk
 */

export const APK_RELEASE = {
  version: "1.27.115",
  versionCode: 127115,
  packageName: "com.hierarchyclass.app",
  fileName: "hierarchy-class-v1.27.115.apk",
  /** Public path served from /public. */
  publicPath: "/downloads/hierarchy-class-v1.27.115.apk",
  sizeBytes: 7681946,
  /** SHA-256 of the exact distributed binary. */
  sha256: "edb629622ccbcb116d4e8317d9bd818eb1ab4b58c8a3f86fb91be017f5ee1f4e",
} as const;

export function apkDownloadUrl(): string {
  return APK_RELEASE.publicPath;
}

export function formatApkSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}