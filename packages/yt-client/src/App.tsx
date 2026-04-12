import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Downloads } from "@/pages/Downloads";
import { Settings } from "@/pages/Settings";

export default function App() {
  const [activePage, setActivePage] = useState("downloads");

  return (
    <AppShell activePage={activePage} onNavigate={setActivePage}>
      {activePage === "downloads" && <Downloads />}
      {activePage === "settings" && <Settings />}
    </AppShell>
  );
}
