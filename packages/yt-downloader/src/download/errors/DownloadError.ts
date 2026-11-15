export class DownloadError extends Error {
  constructor(
    public readonly exitCode: number,
    public readonly stderr?: string,
  ) {
    const base = `yt-dlp exited with code ${exitCode}`;
    // Warnings precede the actual failure (e.g. an expired media URL). Keep
    // the error, rather than filling the UI with the first 500 warning chars.
    const lines = stderr?.trim().split(/\r?\n/) ?? [];
    const errors = lines.filter((line) => /^ERROR:/i.test(line.trim()));
    const detail = (errors.length ? errors.join("\n") : lines.join("\n")).slice(
      -2000,
    );
    super(detail ? `${base}: ${detail}` : base);
    this.name = "DownloadError";
  }
}
