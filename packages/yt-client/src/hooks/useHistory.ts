import { useCallback, useEffect, useMemo, useState } from "react";
import type { HistoryEntry } from "@/types/electron";

type FormatFilter = "all" | "video" | "audio";

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [fileExists, setFileExists] = useState<Map<string, boolean>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    const history = await window.electronAPI?.getHistory();
    if (history) {
      setEntries(history);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Check file existence for all entries on load
  useEffect(() => {
    if (entries.length === 0) return;

    const checkFiles = async () => {
      const results = new Map<string, boolean>();
      await Promise.all(
        entries.map(async (entry) => {
          const exists =
            (await window.electronAPI?.checkFileExists(entry.localPath)) ??
            false;
          results.set(entry.id, exists);
        }),
      );
      setFileExists(results);
    };

    checkFiles();
  }, [entries]);

  const filtered = useMemo(() => {
    let result = entries;

    if (formatFilter !== "all") {
      result = result.filter((e) => e.formatType === formatFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.author.toLowerCase().includes(q),
      );
    }

    return result;
  }, [entries, search, formatFilter]);

  const removeEntry = useCallback(async (id: string) => {
    await window.electronAPI?.removeHistoryEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    await window.electronAPI?.clearHistory();
    setEntries([]);
  }, []);

  return {
    entries: filtered,
    totalCount: entries.length,
    loading,
    search,
    setSearch,
    formatFilter,
    setFormatFilter,
    fileExists,
    removeEntry,
    clearAll,
    reload: load,
  };
}
