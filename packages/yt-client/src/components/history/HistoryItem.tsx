import { ExternalLink, FolderOpen, Music, Trash2, Video } from "lucide-react";

interface HistoryItemProps {
  title: string;
  author: string;
  format: string;
  formatType: "video" | "audio";
  link: string;
  localPath: string;
  downloadedAt: number;
  fileExists: boolean;
  onShow: () => void;
  onRedownload: () => void;
  onRemove: () => void;
}

export function HistoryItem({
  title,
  author,
  format,
  formatType,
  downloadedAt,
  fileExists,
  onShow,
  onRedownload,
  onRemove,
}: HistoryItemProps) {
  const time = new Date(downloadedAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const FormatIcon = formatType === "audio" ? Music : Video;

  return (
    <div className="group flex items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/50">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted">
        <FormatIcon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">
          {format}
          {author && ` · ${author}`}
          {` · ${time}`}
        </p>
        {!fileExists && (
          <p className="mt-0.5 text-xs text-destructive-foreground">
            File not found
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {fileExists && (
          <button
            type="button"
            onClick={onShow}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Show in folder"
            title="Show in folder"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onRedownload}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Re-download"
          title="Re-download"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive-foreground"
          aria-label="Remove from history"
          title="Remove"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
