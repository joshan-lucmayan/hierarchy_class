/**
 * Metadata for the officially distributed Android APK.
 *
 * The binary itself lives at `public/downloads/<fileName>` so that after
 * deployment it is served directly from the production domain:
 *   https://www.hierarchyclass.com/downloads/<fileName>
 *
 * Every value here must match the REAL audited artifact:
 *   source: android/app-release-signed.apk  (signed with android.keystore,
 *   cert SHA-256 8C:95:E7:DC:38:44:9B:4B:D6:82:D3:58:98:6E:4B:60:64:00:DB:E1:
 *   9C:29:BA:60:E1:55:E3:1E:EF:51:E8:46 — the fingerprint published in
 *   public/.well-known/assetlinks.json)
 *
 * When a new NATIVE shell build is released (TWA config, signing, native
 * resources), re-audit the APK and update these fields together with the
 * binary. Ordinary website deployments never require touching this file.
 */

export const APK_RELEASE = {
  version: "1.15.90",
  versionCode: 11590,
  packageName: "com.hierarchyclass.app",
  fileName: "hierarchy-class-v1.15.90.apk",
  /** Public path served from /public. */
  publicPath: "/downloads/hierarchy-class-v1.15.90.apk",
  sizeBytes: 1142956,
  /** SHA-256 of the exact distributed binary. */
  sha256: "7d0ac743a75c02e3533bdcd4c26f2dcaf88b5725f577fc5b9b140d5e25af31c1",
} as const;

export function apkDownloadUrl(): string {
  return APK_RELEASE.publicPath;
}

export function formatApkSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
