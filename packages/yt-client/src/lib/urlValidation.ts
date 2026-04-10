const YOUTUBE_URL_RE =
  /^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?.*v=[\w-]+|shorts\/[\w-]+)|youtu\.be\/[\w-]+)/;

export function isValidYoutubeUrl(url: string): boolean {
  return YOUTUBE_URL_RE.test(url);
}

export function getUrlValidationError(url: string): string | null {
  if (!url) return null;
  if (!/^https?:\/\//.test(url)) return "URL must start with http:// or https://";
  if (!isValidYoutubeUrl(url)) return "Not a recognized YouTube URL";
  return null;
}
