import { useCallback, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Downloads } from "@/pages/Downloads";
import { History } from "@/pages/History";
import { Settings } from "@/pages/Settings";
import type { HistoryEntry } from "@/types/electron";

export interface RedownloadRequest {
  link: string;
  format: string;
  name: string;
}

export default function App() {
  const [activePage, setActivePage] = useState("downloads");
  const [redownload, setRedownload] = useState<RedownloadRequest | null>(null);

  const handleRedownload = useCallback((entry: HistoryEntry) => {
    setRedownload({
      link: entry.link,
      format: entry.format,
      name: entry.title,
    });
    setActivePage("downloads");
  }, []);

  const consumeRedownload = useCallback(() => {
    const req = redownload;
    setRedownload(null);
    return req;
  }, [redownload]);

  return (
    <AppShell activePage={activePage} onNavigate={setActivePage}>
      {activePage === "downloads" && (
        <Downloads consumeRedownload={consumeRedownload} />
      )}
      {activePage === "history" && <History onRedownload={handleRedownload} />}
      {activePage === "settings" && <Settings />}
    </AppShell>
  );
}
