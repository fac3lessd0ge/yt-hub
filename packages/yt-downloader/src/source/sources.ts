// Provider declarations for every media source yt-hub supports.
// A provider is pure data + a URL matcher — it carries NO download logic.
// Downloading stays generic (`yt-dlp <link>`); these only gate which URLs are
// accepted and which formats the UI offers.

export type MediaSource = "youtube" | "soundcloud" | "bandcamp";

/** A single track/video vs. a collection (playlist/album/set). */
export type MediaKind = "track" | "playlist";

export interface FormatCapability {
  id: string;
  label: string;
}

export interface SourceProvider {
  source: MediaSource;
  /** Human-readable name shown in the UI (badge, errors). */
  label: string;
  /** Audio-only source — the UI offers no video formats. */
  audioOnly: boolean;
  /** Download formats offered for this source, by backend format id. */
  formats: FormatCapability[];
  /**
   * Decide whether `url` belongs to this source.
   * `host` is already lower-cased and stripped of `www.`/`m.` prefixes.
   * Returns the media kind on a match, or null if this provider doesn't own
   * the URL.
   */
  match(url: URL, host: string): MediaKind | null;
}

const MP4: FormatCapability = { id: "mp4", label: "MP4 video" };
const MP3: FormatCapability = { id: "mp3", label: "MP3 audio" };

export const SOURCES: readonly SourceProvider[] = [
  {
    source: "youtube",
    label: "YouTube",
    audioOnly: false,
    formats: [MP4, MP3],
    match(url, host) {
      if (host === "youtu.be") {
        return url.pathname.length > 1 ? "track" : null;
      }
      if (host !== "youtube.com") return null;
      if (url.pathname === "/watch") {
        if (url.searchParams.get("v")) return "track";
        return null;
      }
      if (
        url.pathname.startsWith("/shorts/") &&
        url.pathname.length > "/shorts/".length
      ) {
        return "track";
      }
      if (url.pathname === "/playlist" && url.searchParams.get("list")) {
        return "playlist";
      }
      return null;
    },
  },
  {
    source: "soundcloud",
    label: "SoundCloud",
    audioOnly: true,
    formats: [MP3],
    match(url, host) {
      if (host !== "soundcloud.com") return null;
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.includes("sets")) return "playlist";
      // /<artist>/<track> — at least two path segments is a real track URL.
      if (segments.length >= 2) return "track";
      return null;
    },
  },
  {
    source: "bandcamp",
    label: "Bandcamp",
    audioOnly: true,
    formats: [MP3],
    match(url, host) {
      // Artist subdomains (artist.bandcamp.com) or the apex bandcamp.com.
      if (host !== "bandcamp.com" && !host.endsWith(".bandcamp.com")) {
        return null;
      }
      if (url.pathname.startsWith("/album/")) return "playlist";
      if (url.pathname.startsWith("/track/")) return "track";
      return null;
    },
  },
] as const;
