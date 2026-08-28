# Android — Trusted Web Activity (TWA) for Hierarchy Class

> Source PWA: `public/manifest.json` + `public/sw.js` (vanilla, no Workbox)
> Package: `com.hierarchyclass.app` — `versionName 1.15.90` — `versionCode 11590`

## Architecture

```
Next.js 14.2.5 (App Router) → HTTPS production (https://www.hierarchyclass.com)
  → PWA manifest (public/manifest.json) + SW (public/sw.js, CACHE_STATIC hc-static-v1)
  → Trusted Web Activity (Bubblewrap) → Android APK / AAB (Play Store)
```

Rank authority stays server-side (Supabase RPC `approve_grade_submission` etc.). No offline rank mutation queue. See `lib/rankEngine.ts` and `docs/ANDROID.md` offline rules.

## Prerequisites — verified on this Arch Linux machine (2026-08-26)

- Node 26.7.0, npm 12 (`npm config get prefix` → set to `~/.local` for user-level globals)
- **Java:** JDK 17 active system default — `/usr/lib/jvm/java-17-openjdk` (17.0.20.1). Pass this exact path as Bubblewrap `jdkPath`.
- **Android SDK root (user-level, writable):** `~/Android/Sdk`
  - The AUR packages install a **root-owned read-only** SDK at `/opt/android-sdk`; locate binaries with `pacman -Ql <pkg>` (e.g. `/opt/android-sdk/cmdline-tools/latest/bin/sdkmanager`). `sdkmanager --sdk_root=/opt/android-sdk` fails without sudo.
  - `~/Android/Sdk` holds build-tools 36.1.0 + 37.0.0, platforms android-36 + android-36.1, platform-tools (adb), cmdline-tools latest, accepted `licenses/`, and a `bin -> cmdline-tools/latest/bin` symlink (Bubblewrap ≤1.25 checks legacy `<sdk>/bin`).
- **User env** in `~/.bashrc`: `ANDROID_HOME`/`ANDROID_SDK_ROOT=$HOME/Android/Sdk`, PATH += `cmdline-tools/latest/bin`, `platform-tools`, `build-tools/37.0.0`.
- **Bubblewrap CLI 1.25.0** at `~/.local/bin/bubblewrap`; config `~/.bubblewrap/config.json` → jdkPath `/usr/lib/jvm/java-17-openjdk`, androidSdkPath `$HOME/Android/Sdk`. `bubblewrap doctor` → ✅ valid.
- Production HTTPS domain serving the Next.js app with `/.well-known/assetlinks.json` reachable (**still pending**).

## Versioning

App version source: `package.json` `version` is the web release (`1.16.101`). The Android shell tracks it only when a native build is made: currently `android/twa-manifest.json` `appVersion`/`packageVersion` + `appVersionCode: 11590` (`major*10000 + minor*100 + patch`). At a native release, bump `package.json`, `android/twa-manifest.json`, and the generated `android/app/build.gradle` `versionCode`/`versionName` together (until `bubblewrap update` can regenerate against the live deployment). `versionCode` must always increase for Play Store.

## Icon source

`public/icon.svg` (crown #9ea7b3 on #141214) → `sharp` generates `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png` (51px padding on #0f0f11) and `apple-touch-icon-180.png`. See `scripts/generate-pwa-icons.mjs` if recreated.

## Bubblewrap build (verified)

```bash
export PATH="$HOME/.local/bin:$PATH"

# Non-interactive passwords (keystore password also at ~/.bubblewrap/hc-keystore.pass)
export BUBBLEWRAP_KEYSTORE_PASSWORD=$(cat ~/.bubblewrap/hc-keystore.pass)
export BUBBLEWRAP_KEY_PASSWORD=$BUBBLEWRAP_KEYSTORE_PASSWORD

# Regenerate project from canonical manifest (needs reachable webManifestUrl + icons):
bubblewrap update --manifest android/twa-manifest.json --directory android --skipVersionUpgrade

# Debug APK:
cd android && JAVA_HOME=/usr/lib/jvm/java-17-openjdk ./gradlew assembleDebug --no-daemon

# Signed release APK + AAB:
cd android && bubblewrap build --manifest twa-manifest.json
```

**Production artifacts (2026-08-26, v1.15.90, `www.hierarchyclass.com` config):**

- `android/app/build/outputs/apk/debug/app-debug.apk` — 5,052,528 B (badging: `com.hierarchyclass.app`, versionCode 11590, versionName 1.15.90)
- `android/app-release-signed.apk` — 1,142,956 B (`apksigner verify` v1+v2+v3 OK; cert SHA-256 `8c95e7dc38449b4bd682d358986e4b606400dbe19c29ba60e155e31eef51e846`)
- `android/app-release-bundle.aab` (+ copy at `android/app/build/outputs/bundle/release/app-release-bundle.aab`) — 1,253,380 B (valid AAB: BundleConfig.pb, base/manifest, dex, resources.pb)

**Canonical regeneration (2026-08-26):** the project was regenerated with `bubblewrap update --manifest twa-manifest.json --directory . --skipVersionUpgrade` directly against the live production manifest — no manual patching. Re-run this exact command whenever `twa-manifest.json` changes and the domain is reachable:

```bash
export PATH="$HOME/.local/bin:$PATH"
cd .. && bubblewrap update --manifest android/twa-manifest.json --directory android --skipVersionUpgrade && cd android
```

Re-verify `https://www.hierarchyclass.com/.well-known/assetlinks.json` returns the real fingerprint (HTTP 200, valid JSON).

## Rebuilding after a version bump

1. Bump `package.json:version` and `android/twa-manifest.json` `appVersion`/`packageVersion`/`appVersionCode` together (versionCode must increase).
2. `bubblewrap update --manifest android/twa-manifest.json --directory android` (omit `--skipVersionUpgrade` to auto-increment versionCode) → regenerates `android/app/` + refreshes `manifest-checksum.txt`.
3. Rebuild APK/AAB as above; upload the signed AAB to Play Console.

## Signing — CURRENT STATE

- `android/android.keystore` **exists** (gitignored, mode 600): alias `android`, RSA-2048, 30-year validity. Password stored OUTSIDE the repo at `~/.bubblewrap/hc-keystore.pass` (mode 600) — back it up to a password manager.
- Certificate SHA-256 (public): `8c95e7dc38449b4bd682d358986e4b606400dbe19c29ba60e155e31eef51e846`
- **Debug:** Gradle auto-generates the user debug keystore at `~/.android/debug.keystore` (do not commit).
- For Play Store: upload `app-release-bundle.aab`, enroll in Play App Signing, then fetch the **Play signing SHA-256** (Play Console → Setup → App signing) and put it in `public/.well-known/assetlinks.json`.

## Digital Asset Links

File: `public/.well-known/assetlinks.json` → served at `https://www.hierarchyclass.com/.well-known/assetlinks.json`

**Current state (2026-08-26):** contains the VERIFIED fingerprint of the existing keystore — placeholder removed:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.hierarchyclass.app",
      "sha256_cert_fingerprints": ["8C:95:E7:DC:38:44:9B:4B:D6:82:D3:58:98:6E:4B:60:64:00:DB:E1:9C:29:BA:60:E1:55:E3:1E:EF:51:E8:46"]
    }
  }
]
```

**How it works:** when the Android app opens a URL, Chrome fetches this file from the SAME domain and checks whether the app's signing certificate matches a listed fingerprint for the package name. Match → TWA renders fullscreen without browser UI. No match / file unreachable → falls back to Custom Tabs (address bar visible) — still functional.

**Verify it (after deploying to Vercel):**

```bash
curl -s https://www.hierarchyclass.com/.well-known/assetlinks.json   # must be HTTP 200, valid JSON, no redirect
# statement generator/checker:
# https://developers.google.com/digital-asset-links/tools/generator
```

If Play App Signing is enrolled later, ADD the Play-managed signing key's SHA-256 as a second entry in `sha256_cert_fingerprints` (Play re-signs uploads; both fingerprints can coexist).

## Offline rules (enforced in `public/sw.js` + UI)

- **Safe offline:** shell, icons, fonts, `/_next/static/*`, `/offline`, `public/icons/*`, `brand/*`. Cached `CacheFirst` with revalidate.
- **Network-only (never cached):** `isSupabase` (`hostname includes supabase.co`), `/api/*`, `/payment/*`, `/auth/*`, `POST/PUT/DELETE`, navigation HTML (`request.mode==="navigate"` → NetworkFirst, never `cache.put`).
- **Student rank:** Never mutated offline; classroom grade submit blocked offline with “You’re offline — connect to submit…” preserving inputs, not fake success (`app/teacher/classroom/page.tsx` `useOnline` guard). Chat send blocked offline (`MessengerView` `useOnline`), payments blocked (`FlorinPurchaseModal` `useOnline`). See `lib/rankEngine.ts` authoritative flow: Teacher/Admin → Server RPC → validation → realtime sync → student sees rank.

## Missing SDK pieces (Arch, no sudo)

`sdkmanager` can only install into a **user-writable** SDK root (`~/Android/Sdk`). Example (already done for `platforms;android-36`):

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
yes | sdkmanager --sdk_root="$ANDROID_HOME" "platforms;android-36" "build-tools;36.1.0" "platform-tools"
```

Never point `--sdk_root` at `/opt/android-sdk` (root-owned AUR copy; installs fail with AccessDeniedException). Bubblewrap 1.25 template needs: build-tools **36.1.0**, platforms **android-36** (compile/targetSdk 36), Gradle 8.11.1 + AGP 8.9.1 (auto-downloaded).

## Testing checklist (physical device)

See `docs/ANDROID.md` full QA — at minimum:

Android 320/360/375/390/412 portrait + landscape: install banner → standalone (no address bar) → safe-area insets → BottomNav scroll → keyboard (chat input) → login → student/teacher/admin nav → chat → classroom grading → rank view → offline airplane → /offline → reconnect → update banner → Play billing not tested live (GCash redirect requires external browser; TWA uses Custom Tabs, return via `window.location.href` — verify on device).

## Troubleshooting

- `bubblewrap doctor` → "androidSdkPath isn't correct … contains the folder build/bin" → the SDK root needs a legacy `bin/` entry: `ln -sfn cmdline-tools/latest/bin ~/Android/Sdk/bin` (already in place).
- `bubblewrap: readline was closed` → set `~/.bubblewrap/config.json` (`bubblewrap updateConfig --jdkPath /usr/lib/jvm/java-17-openjdk --androidSdkPath "$HOME/Android/Sdk"`) or export `BUBBLEWRAP_KEYSTORE_PASSWORD`/`BUBBLEWRAP_KEY_PASSWORD` to skip password prompts.
- `manifest not reachable` → ensure `https://YOUR_DOMAIN/manifest.json` returns 200, not 301, with `Content-Type: application/manifest+json`.
- `assetlinks.json` not verified → check `https://YOUR_DOMAIN/.well-known/assetlinks.json` is not behind auth/middleware (see Known Risks in `docs/ANDROID.md`; `.well-known` matcher exclusion still recommended).
- `SW not registering` → requires `isSecureContext` (HTTPS or localhost), and `public/sw.js` at `scope "/"`.

## References

- `docs/ANDROID.md` (full), `public/manifest.json`, `public/sw.js`, `middleware.ts:102-105`, `lib/rankEngine.ts`, `app/offline/page.tsx`
