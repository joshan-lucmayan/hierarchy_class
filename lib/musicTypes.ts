/**
 * Shared music-metadata types.
 *
 * Lives in lib/ (not in the API route file) because the standalone Android
 * export build moves app/api aside - client code must be able to import these
 * types without pulling in server code.
 */

export type MusicPlatform = "youtube" | "soundcloud" | "vimeo" | "spotify" | "apple";

export interface ResolvedMusic {
  url: string;
  platform: MusicPlatform;
  title: string;
  artist: string | null;
  coverUrl: string | null;
}
