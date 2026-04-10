import type { DownloadProgress as DownloadProgressData } from "@/types/api";

interface DownloadProgressProps {
  progress: DownloadProgressData | null;
  reconnecting?: boolean;
  onCancel: () => void;
}

export function DownloadProgress({
  progress,
  reconnecting,
  onCancel,
}: DownloadProgressProps) {
  const percent = progress?.percent ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {reconnecting ? "Reconnecting..." : "Downloading..."}
        </span>
        <span className="text-muted-foreground">{percent.toFixed(1)}%</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      {progress && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Speed: {progress.speed}</span>
          <span>ETA: {progress.eta}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="self-start rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        Cancel
      </button>
    </div>
  );
}
