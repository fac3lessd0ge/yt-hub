export interface YtDlpConfig {
  audioQuality: string;
  customArgs: string[];
  proxy: string | undefined;
  cookiesFile: string | undefined;
  cookiesFromBrowser: string | undefined;
  socketTimeout: number;
  processTimeout: number;
}

// Browsers yt-dlp can extract cookies from via --cookies-from-browser. Used to
// gate user-supplied values: only a name on this list may ever reach yt-dlp,
// so a stray/hostile string can't be smuggled into the cookie source.
const SUPPORTED_COOKIE_BROWSERS = [
  "firefox",
  "chrome",
  "chromium",
  "brave",
  "edge",
  "vivaldi",
  "opera",
  "safari",
  "whale",
] as const;

export type SupportedCookieBrowser = (typeof SUPPORTED_COOKIE_BROWSERS)[number];

/** True when `name` is a browser yt-dlp can read cookies from. */
export function isSupportedCookieBrowser(name: string): boolean {
  return (SUPPORTED_COOKIE_BROWSERS as readonly string[]).includes(name);
}

const BLOCKED_FLAGS = [
  "--exec",
  "--exec-before-dl",
  "--exec-after-dl",
  "--ffmpeg-location",
  "--batch-file",
  "--download-archive",
  "--config-location",
  "--config-locations",
  "--plugin-dirs",
];

export function sanitizeCustomArgs(args: string[]): string[] {
  return args.filter((arg) => {
    const flag = arg.split("=")[0].toLowerCase();
    if (BLOCKED_FLAGS.includes(flag)) {
      console.warn(`Blocked dangerous yt-dlp flag: ${arg}`);
      return false;
    }
    return true;
  });
}

export function loadYtDlpConfig(): YtDlpConfig {
  const customArgsRaw = process.env.YT_DLP_CUSTOM_ARGS ?? "";

  return {
    audioQuality: process.env.YT_DLP_AUDIO_QUALITY ?? "0",
    customArgs: customArgsRaw
      ? sanitizeCustomArgs(customArgsRaw.split(/\s+/).filter(Boolean))
      : [],
    proxy: process.env.YT_DLP_PROXY || undefined,
    cookiesFile: process.env.YT_DLP_COOKIES_FILE || undefined,
    cookiesFromBrowser: process.env.YT_DLP_COOKIES_FROM_BROWSER || undefined,
    socketTimeout: Number(process.env.YT_DLP_SOCKET_TIMEOUT ?? 30),
    processTimeout: Number(process.env.YT_DLP_PROCESS_TIMEOUT ?? 3600),
  };
}
