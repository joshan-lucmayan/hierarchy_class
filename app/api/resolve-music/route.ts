import { NextResponse } from "next/server";

// Music metadata resolution - post-music-by-link.
//
// The student pastes a music URL and this endpoint resolves title, artist and
// album artwork server-side so no client code touches any credential. The
// server only ever calls the platform's own metadata endpoint (never the
// arbitrary user-supplied URL), which also keeps this route safe from SSRF.
//
// Supported platforms:
//   - YouTube / SoundCloud / Vimeo  - keyless oEmbed (no credentials needed)
//   - Apple Music                   - keyless iTunes lookup API
//   - Spotify                       - the Spotify Web API (full title/artist/
//                                     cover metadata) when SPOTIFY_CLIENT_ID
//                                     and SPOTIFY_CLIENT_SECRET env vars are
//                                     configured; otherwise it falls back to
//                                     Spotify's keyless oEmbed endpoint
//                                     (title + cover) with the artist parsed
//                                     from the public track page when oEmbed
//                                     omits it. Credentials are only ever
//                                     read server-side and never shipped to
//                                     the browser. spotify.link short links
//                                     are resolved (redirects followed,
//                                     final host verified) before either
//                                     path.

export type MusicPlatform = "youtube" | "soundcloud" | "vimeo" | "spotify" | "apple";

export interface ResolvedMusic {
  url: string;
  platform: MusicPlatform;
  title: string;
  artist: string | null;
  coverUrl: string | null;
}

const OEmbed_TIMEOUT_MS = 8000;

function detectPlatform(host: string): MusicPlatform | null {
  const h = host.replace(/^www\./, "").replace(/^m\./, "");
  if (h === "youtube.com" || h === "youtu.be") return "youtube";
  if (h === "soundcloud.com") return "soundcloud";
  if (h === "vimeo.com") return "vimeo";
  if (h === "open.spotify.com" || h === "play.spotify.com" || h === "spotify.link") return "spotify";
  if (h === "music.apple.com" || h === "itunes.apple.com") return "apple";
  return null;
}

/** Extracts a YouTube video id from watch/shorts/embed/youtu.be URLs. */
function youtubeVideoId(url: URL): string | null {
  if (url.hostname === "youtu.be") {
    return url.pathname.split("/")[1] ?? null;
  }
  const v = url.searchParams.get("v");
  if (v) return v;
  const m = url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/);
  return m ? m[1] : null;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OEmbed_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "HierarchyClass/1.0 (music metadata resolution)",
        ...init?.headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetchWithTimeout(url, init);
  if (!res.ok) throw new Error(`metadata endpoint responded ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/** Retries a keyless JSON fetch a few times - Spotify's oEmbed endpoint can
 *  occasionally return an empty body under load. */
async function fetchJsonRetry(url: string, attempts = 3): Promise<Record<string, unknown>> {
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchJson(url);
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastError;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Parses the artist out of Spotify's public track page - the og:description
 *  meta is "Artist · Album · Song · Year", so the artist is the first
 *  segment. Keyless; only used when oEmbed omits the artist. */
async function spotifyArtistFromPage(trackId: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`https://open.spotify.com/track/${trackId}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HierarchyClass/1.0)" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/property="og:description" content="([^"]*)"/i);
    if (!match) return null;
    const artist = decodeEntities(match[1]).split(" · ")[0]?.trim();
    return artist || null;
  } catch {
    return null;
  }
}

// Spotify client-credentials token, cached for the token lifetime (1 hour).
let spotifyToken: { token: string; expiresAt: number } | null = null;

async function getSpotifyToken(): Promise<string> {
  const now = Date.now();
  if (spotifyToken && spotifyToken.expiresAt > now + 30_000) return spotifyToken.token;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("spotify-not-configured");

  const res = await fetchWithTimeout("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("spotify-auth-failed");
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("spotify-auth-failed");

  spotifyToken = { token: data.access_token, expiresAt: now + (data.expires_in ?? 3600) * 1000 };
  return spotifyToken.token;
}

function error(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  let body: { url?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // malformed body handled below
  }

  const raw = typeof body.url === "string" ? body.url.trim() : "";
  if (!raw) return error("Enter a valid music link.", 400);

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return error("Enter a valid music link.", 400);
  }
  if (url.protocol !== "https:") return error("Enter a valid music link.", 400);

  const platform = detectPlatform(url.hostname);
  if (!platform) return error("That music platform isn't supported yet.", 422);

  try {
    if (platform === "youtube") {
      const id = youtubeVideoId(url);
      if (!id) return error("Music information could not be retrieved.", 422);
      const canonicalUrl = `https://www.youtube.com/watch?v=${id}`;
      const data = await fetchJson(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`
      );
      return ok(canonicalUrl, platform, data.title, data.author_name, data.thumbnail_url);
    }

    if (platform === "soundcloud") {
      const data = await fetchJson(
        `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(raw)}`
      );
      return ok(raw, platform, data.title, data.author_name, data.thumbnail_url);
    }

    if (platform === "vimeo") {
      const data = await fetchJson(
        `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(raw)}`
      );
      return ok(raw, platform, data.title, data.author_name, data.thumbnail_url);
    }

    if (platform === "spotify") {
      // Resolve Spotify short links (spotify.link) - fetch follows the
      // redirect, then verify the final host before trusting it.
      if (url.hostname === "spotify.link") {
        const res = await fetchWithTimeout(url.toString());
        const finalUrl = new URL(res.url);
        if (finalUrl.hostname !== "open.spotify.com" && finalUrl.hostname !== "play.spotify.com") {
          return error("Music information could not be retrieved.", 422);
        }
        url = finalUrl;
      }

      const match = url.pathname.match(/^\/track\/([\w]+)/);
      if (!match) return error("Music information could not be retrieved.", 422);
      const trackId = match[1];
      const canonicalUrl = `https://open.spotify.com/track/${trackId}`;

      // Preferred: the Spotify Web API returns full metadata (title, artist,
      // cover) but needs OAuth credentials. Only used when the server env has
      // them; any failure falls through to the keyless path below.
      if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
        try {
          const token = await getSpotifyToken();
          const track = (await fetchJson(`https://api.spotify.com/v1/tracks/${trackId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })) as {
            name?: string;
            artists?: { name?: string }[];
            album?: { images?: { url?: string }[]; name?: string };
            external_urls?: { spotify?: string };
          };
          const title = (track.name ?? "").trim();
          if (!title) throw new Error("empty-track");
          return ok(
            track.external_urls?.spotify ?? canonicalUrl,
            platform,
            title,
            track.artists?.[0]?.name,
            track.album?.images?.[0]?.url
          );
        } catch {
          // fall through to the keyless oEmbed path rather than failing
        }
      }

      // Keyless fallback: Spotify's public oEmbed endpoint returns title +
      // cover with no credentials. Artist is not included, so when it is
      // missing we parse it from the public track page's og:description
      // ("Artist · Album · Song · Year").
      const data = await fetchJsonRetry(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`
      );
      const artist = (data.author_name as string | undefined) ?? (await spotifyArtistFromPage(trackId));
      return ok(canonicalUrl, platform, data.title, artist, data.thumbnail_url);
    }

    // apple
    const trackId = url.searchParams.get("i");
    const albumMatch = url.pathname.match(/\/id(\d+)/);
    const id = trackId ?? albumMatch?.[1];
    if (!id) return error("Music information could not be retrieved.", 422);
    const lookup = (await fetchJson(`https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}`)) as {
      results?: {
        trackName?: string;
        collectionName?: string;
        artistName?: string;
        artworkUrl100?: string;
        trackViewUrl?: string;
        collectionViewUrl?: string;
      }[];
    };
    const result = lookup.results?.[0];
    const title = (result?.trackName ?? result?.collectionName ?? "").trim();
    if (!title) return error("Music information could not be retrieved.", 422);
    const artwork = (result?.artworkUrl100 ?? "").replace("100x100bb", "600x600bb");
    return ok(
      result?.trackViewUrl ?? result?.collectionViewUrl ?? raw,
      platform,
      title,
      result?.artistName,
      artwork || null
    );
  } catch (err) {
    return error("Music information could not be retrieved.", 502);
  }
}

function ok(
  url: string,
  platform: MusicPlatform,
  title: unknown,
  author: unknown,
  thumbnail: unknown
) {
  const t = typeof title === "string" ? title.trim() : "";
  if (!t) return error("Music information could not be retrieved.", 422);
  const artist = typeof author === "string" ? author.trim() : "";
  const coverUrl = typeof thumbnail === "string" ? thumbnail : null;
  const resolved: ResolvedMusic = { url, platform, title: t, artist: artist || null, coverUrl };
  return NextResponse.json({ ok: true, data: resolved });
}
