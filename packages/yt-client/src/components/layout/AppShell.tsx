import type { ReactNode } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { OfflineBanner } from "./OfflineBanner";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  activePage: string;
  onNavigate: (page: string) => void;
  children: ReactNode;
}

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  const isOnline = useOnlineStatus();

  return (
    <div className="flex h-screen flex-col">
      {!isOnline && <OfflineBanner />}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activePage={activePage} onNavigate={onNavigate} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
