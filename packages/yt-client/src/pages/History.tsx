import { Trash2 } from "lucide-react";
import { HistoryList } from "@/components/history/HistoryList";
import { useHistory } from "@/hooks/useHistory";
import type { HistoryEntry } from "@/types/electron";

interface HistoryProps {
  onRedownload: (entry: HistoryEntry) => void;
}

export function History({ onRedownload }: HistoryProps) {
  const {
    entries,
    totalCount,
    loading,
    search,
    setSearch,
    formatFilter,
    setFormatFilter,
    fileExists,
    removeEntry,
    clearAll,
  } = useHistory();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 p-8">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            History
          </h1>
          {totalCount > 0 && (
            <span className="text-sm text-muted-foreground">
              {totalCount} download{totalCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {totalCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive-foreground"
          >
            <Trash2 className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>

      <HistoryList
        entries={entries}
        search={search}
        onSearchChange={setSearch}
        formatFilter={formatFilter}
        onFilterChange={setFormatFilter}
        fileExists={fileExists}
        onShow={(entry) =>
          window.electronAPI?.showItemInFolder(entry.localPath)
        }
        onRedownload={onRedownload}
        onRemove={removeEntry}
      />
    </div>
  );
}
