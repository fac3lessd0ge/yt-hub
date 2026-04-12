import { Search } from "lucide-react";
import { groupByDate } from "@/lib/dateGroups";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/types/electron";
import { HistoryDateGroup } from "./HistoryDateGroup";
import { HistoryItem } from "./HistoryItem";

type FormatFilter = "all" | "video" | "audio";

const filterOptions: { value: FormatFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
];

interface HistoryListProps {
  entries: HistoryEntry[];
  search: string;
  onSearchChange: (value: string) => void;
  formatFilter: FormatFilter;
  onFilterChange: (value: FormatFilter) => void;
  fileExists: Map<string, boolean>;
  onShow: (entry: HistoryEntry) => void;
  onRedownload: (entry: HistoryEntry) => void;
  onRemove: (id: string) => void;
}

export function HistoryList({
  entries,
  search,
  onSearchChange,
  formatFilter,
  onFilterChange,
  fileExists,
  onShow,
  onRedownload,
  onRemove,
}: HistoryListProps) {
  const groups = groupByDate(entries);

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by title or author..."
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Filter pills */}
      <div className="flex gap-1">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onFilterChange(opt.value)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              formatFilter === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Grouped list */}
      {groups.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {search || formatFilter !== "all"
            ? "No matching downloads"
            : "No downloads yet"}
        </p>
      )}

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <HistoryDateGroup key={group.label} label={group.label}>
            {group.entries.map((entry) => (
              <HistoryItem
                key={entry.id}
                title={entry.title}
                author={entry.author}
                format={entry.format}
                formatType={entry.formatType}
                link={entry.link}
                localPath={entry.localPath}
                downloadedAt={entry.downloadedAt}
                fileExists={fileExists.get(entry.id) ?? true}
                onShow={() => onShow(entry)}
                onRedownload={() => onRedownload(entry)}
                onRemove={() => onRemove(entry.id)}
              />
            ))}
          </HistoryDateGroup>
        ))}
      </div>
    </div>
  );
}
