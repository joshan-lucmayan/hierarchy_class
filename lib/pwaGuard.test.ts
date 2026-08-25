import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/manifest.json"), "utf8"));
const sw = fs.readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");

describe("PWA manifest", () => {
  test("required fields present", () => {
    assert.ok(manifest.name, "name");
    assert.ok(manifest.short_name, "short_name");
    assert.equal(manifest.start_url, "/");
    assert.equal(manifest.scope, "/");
    assert.equal(manifest.display, "standalone");
    assert.ok(manifest.theme_color, "theme_color");
    assert.ok(manifest.background_color, "background_color");
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3, "icons >=3");
  });
  test("icons include 192,512,maskable and files exist", () => {
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    assert.ok(sizes.includes("192x192"), "192");
    assert.ok(sizes.includes("512x512"), "512");
    assert.ok(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable"), "maskable");
    for (const icon of manifest.icons) {
      if (icon.src.startsWith("/icons/")) {
        const file = path.join(process.cwd(), "public", icon.src);
        assert.ok(fs.existsSync(file), `icon exists: ${icon.src}`);
      }
    }
  });
});

describe("Service Worker security", () => {
  test("bypasses Supabase/API/payments/auth and non-GET", () => {
    assert.ok(sw.includes("supabase.co") || sw.includes("supabase"), "supabase");
    assert.ok(sw.includes('/api/'), "/api");
    assert.ok(sw.includes('/payment/'), "/payment");
    assert.ok(sw.includes('/auth/'), "/auth");
    assert.ok(sw.includes('request.method !== "GET"'), "non-GET");
  });
  test("navigate never cached, fallback to /offline", () => {
    assert.ok(sw.includes('request.mode === "navigate"'), "navigate");
    assert.ok(sw.includes("OFFLINE_URL") || sw.includes("/offline"), "offline fallback");
    const navStart = sw.indexOf('request.mode === "navigate"');
    const nextSection = sw.indexOf("isStatic", navStart);
    const navSection = sw.slice(navStart, nextSection !== -1 ? nextSection : sw.length);
    assert.ok(!navSection.includes("cache.put"), "no cache.put in navigate branch");
  });
});

describe("Digital Asset Links", () => {
  test("assetlinks.json structure", () => {
    const assetlinksPath = path.join(process.cwd(), "public/.well-known/assetlinks.json");
    assert.ok(fs.existsSync(assetlinksPath), "file exists");
    const json = JSON.parse(fs.readFileSync(assetlinksPath, "utf8"));
    assert.ok(Array.isArray(json), "array");
    assert.equal(json[0]?.target?.package_name, "com.hierarchyclass.app");
    const fp = json[0]?.target?.sha256_cert_fingerprints?.[0] || "";
    assert.ok(fp.includes("__REPLACE") || fp.length >= 95, "placeholder or real SHA256");
  });
});
