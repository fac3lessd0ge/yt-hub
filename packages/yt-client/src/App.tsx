import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Downloads } from "@/pages/Downloads";

export default function App() {
  const [activePage, setActivePage] = useState("downloads");

  return (
    <AppShell activePage={activePage} onNavigate={setActivePage}>
      {activePage === "downloads" && <Downloads />}
      {activePage === "settings" && (
        <div className="text-muted-foreground">Settings coming soon</div>
      )}
    </AppShell>
  );
}
