// Single source of truth for "which media source does this URL belong to" and
// "what can that source do". Replaces the hard-coded YouTube allow-list that
// used to live in InputValidator (downloader) and urlValidation.ts (client).

import {
  type FormatCapability,
  type MediaKind,
  type MediaSource,
  type SourceProvider,
  SOURCES,
} from "./sources";

const MAX_URL_LENGTH = 2048;

export interface DetectedSource {
  source: MediaSource;
  kind: MediaKind;
}

/** Strips `www.` / `m.` prefixes and lower-cases a hostname. */
function normalizeHost(hostname: string): string {
  let h = hostname.toLowerCase();
  if (h.startsWith("www.")) h = h.slice(4);
  if (h.startsWith("m.")) h = h.slice(2);
  return h;
}

/**
 * Identify which supported source (if any) a raw URL string belongs to.
 * Returns null for unsupported hosts, malformed URLs, non-http(s) schemes, or
 * over-long input — i.e. anything the app should reject.
 */
export function detectSource(input: string): DetectedSource | null {
  if (!input || input.length > MAX_URL_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = normalizeHost(url.hostname);
  for (const provider of SOURCES) {
    const kind = provider.match(url, host);
    if (kind) return { source: provider.source, kind };
  }
  return null;
}

/** Look up a provider's static capabilities by source id. */
export function getProvider(source: MediaSource): SourceProvider {
  const provider = SOURCES.find((p) => p.source === source);
  if (!provider) {
    throw new Error(`Unknown media source: ${source}`);
  }
  return provider;
}

export interface SourceCapabilities {
  audioOnly: boolean;
  needsAuth: boolean;
  formats: FormatCapability[];
  label: string;
}

export function capabilities(source: MediaSource): SourceCapabilities {
  const p = getProvider(source);
  return {
    audioOnly: p.audioOnly,
    needsAuth: p.needsAuth,
    formats: [...p.formats],
    label: p.label,
  };
}

/** True when the URL belongs to any supported source. */
export function isSupportedUrl(input: string): boolean {
  return detectSource(input) !== null;
}
