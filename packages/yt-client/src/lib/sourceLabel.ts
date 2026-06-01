// Maps a stored history `source` string to its provider display name
// ("youtube" → "YouTube") via the shared media-source registry. The registry
// is pure (renderer-safe). Unknown/legacy values fall back to the raw string.

import { capabilities, SOURCES } from "yt-downloader/source";

const KNOWN_SOURCES = new Set<string>(SOURCES.map((p) => p.source));

/** Human-readable provider name for a stored source id, e.g. "SoundCloud". */
export function getSourceLabel(source: string): string {
  if (KNOWN_SOURCES.has(source)) {
    return capabilities(source as Parameters<typeof capabilities>[0]).label;
  }
  return source;
}
