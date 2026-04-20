import type { HistoryEntry } from "@/types/electron";

export interface DateGroup {
  label: string;
  entries: HistoryEntry[];
}

export function groupByDate(entries: HistoryEntry[]): DateGroup[] {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const yesterdayStart = todayStart - 86400000;
  const currentYear = now.getFullYear();

  const groups = new Map<string, HistoryEntry[]>();

  for (const entry of entries) {
    const ts = entry.downloadedAt;
    let label: string;

    if (ts >= todayStart) {
      label = "Today";
    } else if (ts >= yesterdayStart) {
      label = "Yesterday";
    } else {
      const d = new Date(ts);
      if (d.getFullYear() === currentYear) {
        label = d.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
        });
      } else {
        label = d.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      }
    }

    const existing = groups.get(label);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(label, [entry]);
    }
  }

  return Array.from(groups, ([label, groupEntries]) => ({
    label,
    entries: groupEntries,
  }));
}
