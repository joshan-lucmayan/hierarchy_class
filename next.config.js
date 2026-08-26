/** @type {import('next').NextConfig} */

// Build identity for the global app-update system: on Vercel every deployment
// has a unique commit SHA (inlined into the client bundle at build time);
// elsewhere fall back to the package version — the project's single source.
const pkgVersion = require("./package.json").version;

const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION:
      process.env.VERCEL_GIT_COMMIT_SHA || `v${pkgVersion}`,
  },
};

module.exports = nextConfig;
