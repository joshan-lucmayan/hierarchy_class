/** @type {import('next').NextConfig} */

// Build identity for the global app-update system: on Vercel every deployment
// has a unique commit SHA (inlined into the client bundle at build time);
// elsewhere fall back to the package version - the project's single source.
const pkgVersion = require("./package.json").version;

// Standalone Android (Capacitor) export build, driven by
// scripts/build-android-export.mjs: the frontend is statically exported into
// out/ and bundled into the APK. The web deployment never sets this flag and
// behaves exactly as before (server rendering, middleware, API routes).
const isAndroidExport = process.env.CAPACITOR_EXPORT === "1";

// Security headers for the web deployment (Vercel / Next server). The Android
// export is a static bundle served by Capacitor's local asset server, which
// does not emit these HTTP headers; they are a server concern and therefore
// only configured for the web build (Next's headers() is ignored in output
// "export", so we must not emit them in the Android build anyway).
const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Content-Security-Policy. Inline scripts/styles stay enabled because
    // Next.js emits its own inline hydration/bootstrap scripts and React
    // style attributes; connect-src covers Supabase (REST + Realtime) and the
    // app's own API. Frame/media/img sources cover the embedded content the
    // app legitimately renders (music previews, stories, openlibrary covers).
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com https://api.paymongo.com https://openlibrary.org",
      "frame-src https://www.youtube.com https://player.vimeo.com https://open.spotify.com https://w.soundcloud.com https://accounts.spotify.com",
      "worker-src 'self' blob:",
    ].join("; "),
  },
];

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
    : {
        // Web deployment only: apply security headers to every response.
        async headers() {
          return [
            {
              source: "/:path*",
              headers: securityHeaders,
            },
          ];
        },
      }),
};

module.exports = nextConfig;
