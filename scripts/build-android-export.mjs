#!/usr/bin/env node
/**
 * Build the statically exported frontend for the standalone Android
 * (Capacitor) app into out/.
 *
 * Why the file shuffling: the web app relies on edge middleware and server
 * route handlers, none of which can exist in `output: export`. They stay
 * untouched on disk — this script only moves them aside for the duration of
 * the export build and restores them in a `finally` block (Ctrl-C safe).
 *
 * Moved aside during the build:
 *   - middleware.ts                       (edge middleware is unsupported)
 *   - app/api/**                          (server route handlers; the Android
 *                                          app calls the deployed backend)
 *   - app/auth/callback/route.ts          (auth email-link handler, web-only)
 *   - app/student/profile/[id]            (web deep-link route; dynamic path
 *                                          segments cannot be exported and
 *                                          Next 14.2 rejects an empty
 *                                          generateStaticParams - internal
 *                                          navigation uses /view?id= instead)
 *
 * The build runs with CAPACITOR_EXPORT=1, which next.config.js maps to
 * output: "export" + trailingSlash and the frontend uses to bake in the
 * backend origin (lib/siteUrl.ts) and skip web-only features.
 */

import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import process from "node:process";

const root = resolve(process.cwd());
const staging = join(root, ".android-export-staging");

const MOVES = [
  { from: join(root, "middleware.ts"), to: join(staging, "middleware.ts") },
  { from: join(root, "app", "api"), to: join(staging, "app", "api") },
  { from: join(root, "app", "auth", "callback"), to: join(staging, "app", "auth", "callback") },
  {
    from: join(root, "app", "student", "profile", "[id]"),
    to: join(staging, "app", "student", "profile", "[id]"),
  },
];

let moved = [];
function moveAside() {
  if (existsSync(staging)) {
    console.error(`Refusing to run: ${staging} already exists (a previous run crashed?).`);
    console.error("Inspect it, restore the files manually, then delete it.");
    process.exit(1);
  }
  mkdirSync(join(staging, "app", "auth"), { recursive: true });
  for (const { from, to } of MOVES) {
    if (existsSync(from)) {
      mkdirSync(join(to, ".."), { recursive: true });
      renameSync(from, to);
      moved.push({ from, to });
      console.log(`moved aside: ${from} -> ${to}`);
    }
  }
}

function restore() {
  for (const { from, to } of moved.reverse()) {
    if (existsSync(to)) {
      renameSync(to, from);
      console.log(`restored: ${to} -> ${from}`);
    }
  }
  if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
}

moveAside();
try {
  const result = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    env: { ...process.env, CAPACITOR_EXPORT: "1" },
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error("Android export build FAILED.");
    process.exitCode = result.status ?? 1;
  } else {
    // The APK distribution file lives in public/downloads so the WEBSITE can
    // serve it. It must NOT be bundled into the Android app itself - that
    // would embed the previous APK inside every new APK ("APK-in-APK" bloat,
    // and the download link inside the app targets the production origin
    // anyway). Strip it from the export output after a successful build.
    const downloads = join(root, "out", "downloads");
    if (existsSync(downloads)) {
      rmSync(downloads, { recursive: true, force: true });
      console.log("removed out/downloads (APK file is web-only, not bundled)");
    }
  }
} finally {
  restore();
}
