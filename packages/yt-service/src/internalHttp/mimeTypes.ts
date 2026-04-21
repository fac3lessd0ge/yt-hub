// KEEP IN SYNC WITH: packages/yt-api/src/file_delivery/mime.rs

import { extname } from "node:path";

export function mimeFromExtension(filename: string): string {
  switch (extname(filename).toLowerCase()) {
    case ".mp3":
      return "audio/mpeg";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".m4a":
      return "audio/mp4";
    case ".ogg":
    case ".oga":
      return "audio/ogg";
    case ".wav":
      return "audio/wav";
    case ".flac":
      return "audio/flac";
    case ".mkv":
      return "video/x-matroska";
    default:
      return "application/octet-stream";
  }
}
