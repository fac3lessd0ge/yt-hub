import type { QueueItem as QueueItemData } from "@/hooks/useQueue";
import { QueueItem } from "./QueueItem";

interface QueueListProps {
  items: QueueItemData[];
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

export function QueueList({
  items,
  onCancel,
  onRemove,
  onRetry,
}: QueueListProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Queue ({items.length})
      </h3>
      <div className="flex flex-col gap-1.5" aria-live="polite">
        {items.map((item) => (
          <QueueItem
            key={item.id}
            item={item}
            onCancel={onCancel}
            onRemove={onRemove}
            onRetry={onRetry}
          />
        ))}
      </div>
    </div>
  );
}
