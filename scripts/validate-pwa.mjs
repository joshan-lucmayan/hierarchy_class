#!/usr/bin/env node
// validate-pwa.mjs - PWA/Android invariants (manifest, icons, SW bypass, no unsafe caching)
// Usage: node scripts/validate-pwa.mjs
import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname ? path.dirname(new URL(import.meta.url).pathname) : ".");
const manifestPath = path.join(root, "../public/manifest.json");
const swPath = path.join(root, "../public/sw.js");
const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/manifest.json"), "utf8"));
const sw = fs.readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");

let fails = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    fails++;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

// Manifest required fields
assert(manifest.name && manifest.name.length > 0, "manifest.name exists");
assert(manifest.short_name && manifest.short_name.length > 0, "manifest.short_name exists");
assert(manifest.start_url === "/", "manifest.start_url is /");
assert(manifest.scope === "/", "manifest.scope is /");
assert(manifest.display === "standalone", "manifest.display standalone");
assert(manifest.theme_color, "manifest.theme_color exists");
assert(manifest.background_color, "manifest.background_color exists");
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 3, "manifest.icons >=3");

// Icons valid sizes and files exist
const bySize = Object.fromEntries(manifest.icons.map((i) => [i.sizes, i]));
assert(bySize["192x192"], "manifest has 192x192");
assert(bySize["512x512"], "manifest has 512x512");
assert(manifest.icons.some((i) => i.purpose === "maskable"), "manifest has maskable purpose");
for (const icon of manifest.icons) {
  if (icon.src.startsWith("/icons/")) {
    const file = path.join(process.cwd(), "public", icon.src);
    assert(fs.existsSync(file), `icon file exists: ${icon.src}`);
  }
}

// SW bypass rules
assert(sw.includes("supabase.co") || sw.includes("supabase"), "SW bypasses supabase");
assert(sw.includes('/api/'), "SW bypasses /api/");
assert(sw.includes('/payment/'), "SW bypasses /payment/");
assert(sw.includes('/auth/'), "SW bypasses /auth/");
assert(sw.includes('request.method !== "GET"') || sw.includes("request.method !== 'GET'"), "SW bypasses non-GET");
assert(sw.includes('request.mode === "navigate"'), "SW handles navigate");
assert(sw.includes("caches.match(OFFLINE") || sw.includes("OFFLINE_URL"), "SW fallback to /offline");
assert(!sw.includes("cache.put") || sw.includes("isStatic"), "SW cache.put only for static (not navigate) - check manual");
assert(sw.includes("CACHE_STATIC"), "SW has CACHE_STATIC");
assert(sw.includes("SKIP_WAITING"), "SW supports SKIP_WAITING");

// No unsafe authenticated caching: ensure no cache.put for navigate
const navigateSection = sw.slice(sw.indexOf('request.mode === "navigate"'), sw.indexOf("isStatic"));
assert(!navigateSection.includes("cache.put"), "SW does not cache HTML for navigate (no cache.put in navigate branch)");

// Assetlinks placeholder check
const assetlinksPath = path.join(process.cwd(), "public/.well-known/assetlinks.json");
if (fs.existsSync(assetlinksPath)) {
  const assetlinks = JSON.parse(fs.readFileSync(assetlinksPath, "utf8"));
  assert(Array.isArray(assetlinks), "assetlinks.json is array");
  assert(assetlinks[0]?.target?.package_name === "com.hierarchyclass.app", "assetlinks package_name is com.hierarchyclass.app");
  const fp = assetlinks[0]?.target?.sha256_cert_fingerprints?.[0] || "";
  assert(fp.includes("__REPLACE") || fp.length >= 95, "assetlinks has placeholder or real SHA256");
} else {
  assert(false, "assetlinks.json exists");
}

if (fails > 0) {
  console.error(`\n${fails} check(s) failed.`);
  process.exit(1);
} else {
  console.log("\nAll PWA checks passed.");
}
