import { Check, RotateCcw, X } from "lucide-react";
import { friendlyError } from "@/lib/errorMessages";
import { cn } from "@/lib/utils";
import type { QueueItem as QueueItemData } from "@/hooks/useQueue";

interface QueueItemProps {
  item: QueueItemData;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

export function QueueItem({
  item,
  onCancel,
  onRemove,
  onRetry,
}: QueueItemProps) {
  const isActive =
    item.status === "downloading" || item.status === "saving";
  const isDone = item.status === "complete";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border border-border px-3 py-2.5 transition-opacity",
        isDone && "opacity-50",
      )}
    >
      {/* Left: info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {item.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {item.format}
          {item.status === "error" && item.error && (
            <span className="text-destructive-foreground">
              {" — "}
              {friendlyError(item.error.code, item.error.message)}
            </span>
          )}
        </p>
      </div>

      {/* Right: status */}
      <div className="flex shrink-0 items-center gap-2">
        {item.status === "pending" && (
          <>
            <span className="text-xs text-muted-foreground">Waiting</span>
            <button
              type="button"
              onClick={() => onCancel(item.id)}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        {item.status === "downloading" && (
          <>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${item.progress ?? 0}%` }}
                />
              </div>
              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                {(item.progress ?? 0).toFixed(0)}%
              </span>
            </div>
            <button
              type="button"
              onClick={() => onCancel(item.id)}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Cancel download"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        {item.status === "saving" && (
          <span className="text-xs text-muted-foreground">Saving...</span>
        )}

        {item.status === "complete" && (
          <>
            <Check className="h-4 w-4 text-green-500" />
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        {item.status === "error" && (
          <>
            {item.error?.retryable && (
              <button
                type="button"
                onClick={() => onRetry(item.id)}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Retry"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
