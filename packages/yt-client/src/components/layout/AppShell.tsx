import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  activePage: string;
  onNavigate: (page: string) => void;
  children: ReactNode;
}

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  return (
    <div className="flex h-screen">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
