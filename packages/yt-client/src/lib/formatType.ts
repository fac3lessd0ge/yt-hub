const AUDIO_FORMATS = new Set(["mp3", "aac", "opus", "flac", "wav", "m4a"]);

export function getFormatType(format: string): "video" | "audio" {
  return AUDIO_FORMATS.has(format.toLowerCase()) ? "audio" : "video";
}
