import type { DownloadComplete } from "@/types/api";
import { getBaseUrl } from "./apiClient";

/** Same rules as yt-downloader storage sanitizer, for a human-visible save-as name. */
const DIALOG_NAME_FORBIDDEN =
  /[/\\:*?"<>|\uFF0F\uFF3C\uFF1A\uFF02\uFF1C\uFF1D\uFF1F\uFF5C\uFF0A\u2215\u2044]/g;

/** Last path segment from a Windows or POSIX output path. */
export function basenameFromOutputPath(outputPath: string): string {
  if (!outputPath) return "";
  const i = Math.max(outputPath.lastIndexOf("/"), outputPath.lastIndexOf("\\"));
  return i === -1 ? outputPath : outputPath.slice(i + 1);
}

/** Absolute URL to fetch the completed artifact from yt-api. */
export function resolveDownloadFetchUrl(data: DownloadComplete): string {
  const trimmed = data.download_url?.trim();
  if (trimmed) {
    return `${getBaseUrl()}${trimmed}`;
  }
  const base = basenameFromOutputPath(data.output_path);
  if (!base) {
    return getBaseUrl();
  }
  return `${getBaseUrl()}/api/downloads/${encodeURIComponent(base)}`;
}

/**
 * Default name in the system save dialog — from video title + format, not the hashed on-disk name.
 */
export function suggestedDownloadFilename(data: DownloadComplete): string {
  const extRaw = (data.format_id || "mp4").toLowerCase();
  const ext = /^[a-z0-9]+$/.test(extRaw) ? extRaw : "mp4";
  let stem = (data.title?.trim() || "download").replace(
    DIALOG_NAME_FORBIDDEN,
    "_",
  );
  stem = stem.replace(/_+/g, "_").replace(/^[\s.]+|[\s.]+$/g, "");
  stem = stem.slice(0, 180);
  if (!stem) stem = "download";
  return `${stem}.${ext}`;
}
