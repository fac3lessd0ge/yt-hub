export class DownloadError extends Error {
  constructor(
    public readonly exitCode: number,
    public readonly stderr?: string,
  ) {
    const base = `yt-dlp exited with code ${exitCode}`;
    super(stderr ? `${base}: ${stderr.slice(0, 500)}` : base);
    this.name = "DownloadError";
  }
}
