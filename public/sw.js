// Hierarchy Class - Service Worker (standards-based, no Workbox)
// Install: cache offline shell + static icons; skipWaiting only on user consent.
// Security: NEVER cache Supabase, /api, payment, or authenticated HTML.
const CACHE_STATIC = "hc-static-v1";
const OFFLINE_URL = "/offline";

const PRECACHE = [OFFLINE_URL, "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_STATIC)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" }))))
      .catch(() => {})
  );
  // Don't auto-skipWaiting - wait for user-approved update (message SKIP_WAITING)
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Cleanup old caches
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_STATIC).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET
  if (request.method !== "GET") return;

  // Bypass: Supabase, API, payments, auth, realtime
  const isSupabase = url.hostname.includes("supabase.co") || url.hostname.includes("supabase");
  const isApi = url.pathname.startsWith("/api/");
  const isPayment = url.pathname.startsWith("/payment/");
  const isAuth = url.pathname.startsWith("/auth/");
  if (isSupabase || isApi || isPayment || isAuth) return;
  // Also bypass if Authorization header present (best-effort - headers not always visible, but path check covers API)
  // Navigation requests - NetworkFirst, never cache HTML (protects role-based routing + auth)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(async () => {
          const cached = await caches.match(OFFLINE_URL);
          return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/html" } });
        })
    );
    return;
  }

  // Static assets - CacheFirst with network update (icons, next static, images, fonts)
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/hc_bg/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/);

  if (isStatic) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) {
          // Update in background (stale-while-revalidate)
          event.waitUntil(
            fetch(request)
              .then((res) => {
                if (res && res.ok) caches.open(CACHE_STATIC).then((c) => c.put(request, res));
              })
              .catch(() => {})
          );
          return cached;
        }
        try {
          const res = await fetch(request);
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_STATIC).then((c) => c.put(request, clone));
          }
          return res;
        } catch {
          // Fallback to cache if network fails
          const fallback = await caches.match(request);
          if (fallback) return fallback;
          throw new Error("Network error");
        }
      })()
    );
    return;
  }

  // Everything else - NetworkOnly (no cache) to avoid leaking user data
});
