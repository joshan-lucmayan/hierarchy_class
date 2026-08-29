/** @type {import('next').NextConfig} */

// Build identity for the global app-update system: on Vercel every deployment
// has a unique commit SHA (inlined into the client bundle at build time);
// elsewhere fall back to the package version — the project's single source.
const pkgVersion = require("./package.json").version;

// Standalone Android (Capacitor) export build, driven by
// scripts/build-android-export.mjs: the frontend is statically exported into
// out/ and bundled into the APK. The web deployment never sets this flag and
// behaves exactly as before (server rendering, middleware, API routes).
const isAndroidExport = process.env.CAPACITOR_EXPORT === "1";

const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION:
      process.env.VERCEL_GIT_COMMIT_SHA || `v${pkgVersion}`,
    // Client components cannot read the build-time CAPACITOR_EXPORT var
    // (Next.js only inlines NEXT_PUBLIC_* into client bundles). Expose an
    // inlined mirror so client-side libs (siteUrl, bridgeClient) resolve the
    // backend origin correctly inside the standalone Android app.
    NEXT_PUBLIC_CAPACITOR_EXPORT: isAndroidExport ? "1" : "0",
  },
  ...(isAndroidExport
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

module.exports = nextConfig;
