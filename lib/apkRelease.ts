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
  version: "1.25.113",
  versionCode: 125113,
  packageName: "com.hierarchyclass.app",
  fileName: "hierarchy-class-v1.25.113.apk",
  /** Public path served from /public. */
  publicPath: "/downloads/hierarchy-class-v1.25.113.apk",
  sizeBytes: 7667822,
  /** SHA-256 of the exact distributed binary. */
  sha256: "ee30443f2496c3ca905fb1744cc2732cd4169547c5dca3a4b8e0f1bf90bf8f2b",
} as const;

export function apkDownloadUrl(): string {
  return APK_RELEASE.publicPath;
}

export function formatApkSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}