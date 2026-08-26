"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CrownMark } from "@/components/ui/CrownMark";
import { Button } from "@/components/ui/Button";
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  type DeferredInstallPromptEvent,
} from "@/components/pwa/InstallPrompt";
import { usePlatformContext } from "@/lib/usePlatformContext";
import { APK_RELEASE, apkDownloadUrl, formatApkSize } from "@/lib/apkRelease";

/**
 * The /download hub — for people browsing the WEBSITE in a browser.
 *
 * Context-aware:
 * - Installed contexts (TWA / standalone PWA) see an "already using the app"
 *   state: no install buttons, no nagging. Updates are explained instead.
 * - Normal browsers see honest per-platform guidance. No invented store
 *   listings, no fake binaries — only actions backed by something real.
 *
 * The browser's deferred install prompt is triggered ONLY by an explicit
 * button press here (never automatically).
 */

type InstallAvailability = "unknown" | "available" | "unavailable";

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[10px] border border-base bg-surface p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-bold text-navy">{title}</h2>
        {badge && (
          <span className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-2.5 text-[13px] leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export function DownloadExperience() {
  const { ready, installedLike, isAndroid, isIOS, isDesktop } = usePlatformContext();
  const [deferred, setDeferred] = useState<DeferredInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<
    "idle" | "installing" | "installed" | "dismissed" | "unsupported"
  >("idle");

  // Pick up the silently-captured beforeinstallprompt event whenever the
  // browser decides to offer it (this page never triggers it proactively).
  useEffect(() => {
    const sync = () => setDeferred(getDeferredInstallPrompt());
    sync();
    window.addEventListener("hc-install-available", sync);
    return () => window.removeEventListener("hc-install-available", sync);
  }, []);

  async function handleBrowserInstall() {
    const event: DeferredInstallPromptEvent | null = getDeferredInstallPrompt();
    if (!event) {
      setInstallState("unsupported");
      return;
    }
    setInstallState("installing");
    await event.prompt(); // ONLY on explicit user action
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      setInstallState("installed");
      clearDeferredInstallPrompt();
      setDeferred(null);
    } else {
      setInstallState("dismissed");
    }
  }

  const [apkCopied, setApkCopied] = useState(false);

  async function copyChecksum() {
    try {
      await navigator.clipboard.writeText(APK_RELEASE.sha256);
      setApkCopied(true);
      window.setTimeout(() => setApkCopied(false), 2000);
    } catch {
      /* clipboard unavailable — checksum is selectable text anyway */
    }
  }

  const alreadyInstalled = ready && installedLike;
  const showInstallButton =
    !alreadyInstalled &&
    (installState === "idle" || installState === "dismissed") &&
    deferred !== null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[720px] px-4 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 sm:pt-12">
      <header className="mb-6 flex items-center gap-3">
        <CrownMark height={34} className="text-gold" />
        <div>
          <h1 className="font-display text-xl font-bold text-navy">Get Hierarchy Class</h1>
          <p className="text-xs text-muted">
            Climb the ranks from any device.
          </p>
        </div>
      </header>

      {/* Already-installed context: acknowledge, don't nag, don't duplicate. */}
      {alreadyInstalled ? (
        <section className="mb-5 rounded-[10px] border border-sealion/40 bg-surface p-4 sm:p-5">
          <p className="text-[14px] font-bold text-navy">
            You&apos;re already using the Hierarchy Class app.
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            New website improvements arrive automatically — when an update is
            ready, you&apos;ll see a &ldquo;New version available&rdquo; notice inside the app.
            Nothing to reinstall.
          </p>
        </section>
      ) : (
        ready && (
          <section className="mb-5 rounded-[10px] border border-base bg-surface p-4 sm:p-5">
            <p className="text-[13px] leading-relaxed text-muted">
              Hierarchy Class runs as a web app in any modern browser and can be{" "}
              <span className="font-semibold text-navy">installed as an app</span> on
              Android, Windows, macOS, Linux and ChromeOS devices. iPhone and iPad use
              the Add to Home Screen flow.
            </p>
            {(showInstallButton || installState !== "idle") && (
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                {showInstallButton && (
                  <Button variant="primary" size="sm" onClick={handleBrowserInstall}>
                    Install {isAndroid ? "app" : "as app"}
                  </Button>
                )}
                {installState === "installing" && (
                  <span className="text-xs text-muted">Opening the install prompt…</span>
                )}
                {installState === "installed" && (
                  <span className="text-xs font-semibold text-navy">
                    Installed! Check your home screen or app launcher.
                  </span>
                )}
                {installState === "dismissed" && (
                  <span className="text-xs text-muted">
                    No problem — you can also keep using Hierarchy Class in the browser.
                  </span>
                )}
                {installState === "unsupported" && (
                  <span className="text-xs text-warn">
                    Your browser doesn&apos;t offer one-tap install — use the manual steps below.
                  </span>
                )}
              </div>
            )}
          </section>
        )
      )}

      <div className="space-y-4">
        {/* ANDROID */}
        <Section title="Android" badge={ready && isAndroid ? "Your device" : undefined}>
          {!alreadyInstalled && (
            <div className="rounded-lg border border-sealion/40 bg-[var(--tile)] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-navy">
                    Hierarchy Class for Android
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    Version {APK_RELEASE.version} · APK · {formatApkSize(APK_RELEASE.sizeBytes)}
                  </p>
                </div>
                <a
                  href={apkDownloadUrl()}
                  download
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-[#c2c7cf] to-[#9ea7b3] px-5 py-2.5 text-[13px] font-semibold text-[#141214] transition hover:-translate-y-0.5 hover:brightness-110"
                >
                  Download for Android
                </a>
              </div>
              <button
                type="button"
                onClick={copyChecksum}
                title="Copy SHA-256 checksum"
                className="mt-2.5 flex w-full items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-left transition hover:border-sealion"
              >
                <span className="min-w-0 flex-1 break-all font-mono-ui text-[10.5px] text-faint">
                  SHA-256 {APK_RELEASE.sha256}
                </span>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gold">
                  {apkCopied ? "Copied" : "Copy"}
                </span>
              </button>
              <p className="mt-2 text-[11px] leading-relaxed text-faint">
                This APK installer is signed by the same key that verifies the
                installed app against this website.
              </p>
            </div>
          )}
          <p>
            On Android, Hierarchy Class runs as a{" "}
            <span className="font-semibold text-navy">full-screen app</span> — once
            installed it opens without a browser address bar.
          </p>
          <ol className="ml-4 list-decimal space-y-1.5">
            <li>
              <span className="font-semibold text-navy">Download the APK</span> above.
            </li>
            <li>Open the downloaded file.</li>
            <li>
              Android may ask you to <strong>allow installs</strong> from your browser
              or file manager — approve it once.
            </li>
            <li>Install Hierarchy Class, then open the app.</li>
          </ol>
          <ul className="ml-4 list-disc space-y-1.5">
            <li>
              <span className="font-semibold text-navy">Google Play:</span> not
              published yet. We won&apos;t show a store button until it&apos;s real.
            </li>
            <li>
              Already installed? Website updates arrive automatically inside the app —
              you only ever need a new APK if we announce a native release.
            </li>
          </ul>
        </Section>

        {/* WINDOWS */}
        <Section title="Windows" badge={ready && isDesktop && !isIOS ? "Your device" : undefined}>
          <p>
            There is no separate Windows program to download — you install the{" "}
            <span className="font-semibold text-navy">web app</span>, which behaves like
            one:
          </p>
          <ol className="ml-4 list-decimal space-y-1.5">
            <li>Open hierarchyclass.com in Chrome or Edge.</li>
            <li>
              Click the <strong>install icon</strong> at the right end of the address
              bar (or menu → “Cast, save and share” → “Install page as app” in Edge /
              “Install Hierarchy Class” in Chrome).
            </li>
            <li>Launch it from the Start menu like any other app.</li>
          </ol>
        </Section>

        {/* LINUX */}
        <Section title="Linux" badge={undefined}>
          <p>
            Same as Windows — there&apos;s no .deb/.rpm/AppImage/Flatpak/Snap package.
            Install the web app from a Chromium-based browser (Chrome, Chromium, Edge,
            Brave):
          </p>
          <ol className="ml-4 list-decimal space-y-1.5">
            <li>Open hierarchyclass.com.</li>
            <li>
              Use the <strong>install icon</strong> in the address bar, or menu → “Install
              app”. It appears in your applications menu.
            </li>
            <li>Firefox users: keep using the site normally — everything works in-browser.</li>
          </ol>
        </Section>

        {/* iOS / iPadOS */}
        <Section title="iPhone & iPad" badge={ready && isIOS ? "Your device" : undefined}>
          <p>iOS uses Safari&apos;s Add to Home Screen flow (an App Store build doesn&apos;t exist):</p>
          <ol className="ml-4 list-decimal space-y-1.5">
            <li>Open hierarchyclass.com in Safari.</li>
            <li>
              Tap the <strong>Share</strong> button <span aria-hidden>(□↑)</span>.
            </li>
            <li>
              Scroll and choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
            </li>
          </ol>
        </Section>

        {/* Already-installed extra info */}
        {alreadyInstalled && (
          <Section title="Platform info">
            <p>
              {isAndroid && "You're on the Android app (Trusted Web Activity)."}
              {isIOS && "You added Hierarchy Class to your iOS home screen."}
              {!isAndroid && !isIOS && "You're running the installed web app."}{" "}
              Website updates install through the in-app update notice — native Android
              releases (Play/APK) are announced separately when available.
            </p>
          </Section>
        )}
      </div>

      <footer className="mt-8 text-center">
        <Link href="/" className="text-xs font-semibold text-gold hover:underline">
          ← Back to Hierarchy Class
        </Link>
      </footer>
    </main>
  );
}
