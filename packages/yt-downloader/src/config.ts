export interface YtDlpConfig {
  audioQuality: string;
  customArgs: string[];
  proxy: string | undefined;
  cookiesFile: string | undefined;
  socketTimeout: number;
}

export function loadYtDlpConfig(): YtDlpConfig {
  const customArgsRaw = process.env.YT_DLP_CUSTOM_ARGS ?? "";

  return {
    audioQuality: process.env.YT_DLP_AUDIO_QUALITY ?? "0",
    customArgs: customArgsRaw
      ? customArgsRaw.split(/\s+/).filter(Boolean)
      : [],
    proxy: process.env.YT_DLP_PROXY || undefined,
    cookiesFile: process.env.YT_DLP_COOKIES_FILE || undefined,
    socketTimeout: Number(process.env.YT_DLP_SOCKET_TIMEOUT ?? 30),
  };
}
