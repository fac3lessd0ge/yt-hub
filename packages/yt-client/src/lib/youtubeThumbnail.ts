/**
 * Extracts the YouTube video ID from a URL and returns the hqdefault
 * thumbnail URL, or null if no video ID can be derived.
 *
 * Supported URL forms:
 *   - https://www.youtube.com/watch?v=<id>
 *   - https://youtu.be/<id>
 *   - https://www.youtube.com/shorts/<id>
 */
export function getYoutubeThumbnailUrl(url: string): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  let videoId: string | null = null;

  const host = parsed.hostname.replace(/^(www\.|m\.)/, "");

  if (host === "youtu.be") {
    // youtu.be/<id>
    const id = parsed.pathname.slice(1).split("/")[0];
    if (id) videoId = id;
  } else if (host === "youtube.com") {
    if (parsed.pathname === "/watch") {
      // /watch?v=<id>
      videoId = parsed.searchParams.get("v");
    } else if (parsed.pathname.startsWith("/shorts/")) {
      // /shorts/<id>
      const id = parsed.pathname.slice("/shorts/".length).split("/")[0];
      if (id) videoId = id;
    }
  }

  if (!videoId || videoId.length !== 11) return null;

  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
