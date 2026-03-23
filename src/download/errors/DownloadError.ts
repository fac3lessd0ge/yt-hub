export class DownloadError extends Error {
  constructor(public readonly exitCode: number) {
    super(`yt-dlp exited with code ${exitCode}`);
    this.name = "DownloadError";
  }
}
