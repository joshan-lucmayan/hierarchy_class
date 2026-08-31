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
  version: "1.26.114",
  versionCode: 126114,
  packageName: "com.hierarchyclass.app",
  fileName: "hierarchy-class-v1.26.114.apk",
  /** Public path served from /public. */
  publicPath: "/downloads/hierarchy-class-v1.26.114.apk",
  sizeBytes: 7676374,
  /** SHA-256 of the exact distributed binary. */
  sha256: "72e6647558427ead86346e5e2177e7e9ae84b76e0ee1a2dbb85931eacd2d3f0e",
} as const;

export function apkDownloadUrl(): string {
  return APK_RELEASE.publicPath;
}

export function formatApkSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}