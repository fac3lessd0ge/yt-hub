import { useEffect, useState } from "react";
import type { VkAccess } from "@/types/electron";

interface VkAccessSectionProps {
  value: VkAccess;
  onChange: (value: VkAccess) => void;
}

// Browsers yt-dlp can read cookies from. Kept in sync with the engine allowlist
// (isSupportedCookieBrowser); declared locally so the renderer stays Node-free.
export const BROWSERS: { id: string; label: string }[] = [
  { id: "firefox", label: "Firefox (most reliable)" },
  { id: "chrome", label: "Chrome" },
  { id: "chromium", label: "Chromium" },
  { id: "brave", label: "Brave" },
  { id: "edge", label: "Edge" },
  { id: "vivaldi", label: "Vivaldi" },
  { id: "opera", label: "Opera" },
  { id: "safari", label: "Safari" },
  { id: "whale", label: "Whale" },
];

const MODES: { id: VkAccess["mode"]; label: string }[] = [
  { id: "off", label: "Don't download VK" },
  { id: "browser", label: "Use my browser login" },
  { id: "file", label: "Import cookies.txt file" },
];

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok" }
  | { status: "error"; message: string };

export function VkAccessSection({ value, onChange }: VkAccessSectionProps) {
  const [test, setTest] = useState<TestState>({ status: "idle" });

  // Any change to the configured access invalidates a previous test result.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on config change
  useEffect(() => {
    setTest({ status: "idle" });
  }, [value.mode, value.browser, value.cookiesFile]);

  const setMode = (mode: VkAccess["mode"]) => onChange({ ...value, mode });
  const setBrowser = (browser: string) => onChange({ ...value, browser });
  const setCookiesFile = (cookiesFile: string) =>
    onChange({ ...value, cookiesFile });

  const browse = async () => {
    const picked = await window.electronAPI?.selectCookiesFile();
    if (picked) setCookiesFile(picked);
  };

  const runTest = async () => {
    setTest({ status: "testing" });
    const result = await window.electronAPI?.testVkAccess(value);
    if (!result) {
      setTest({ status: "error", message: "Test unavailable." });
      return;
    }
    if (result.ok) {
      setTest({ status: "ok" });
    } else {
      setTest({ status: "error", message: result.error });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        role="radiogroup"
        aria-label="VK download access"
        className="flex flex-col gap-2"
      >
        {MODES.map((m) => (
          <label key={m.id} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="vk-access-mode"
              value={m.id}
              checked={value.mode === m.id}
              onChange={() => setMode(m.id)}
              className="h-4 w-4"
            />
            <span className="text-foreground">{m.label}</span>
          </label>
        ))}
      </div>

      {value.mode === "browser" && (
        <select
          aria-label="Browser to read VK login from"
          value={value.browser}
          onChange={(e) => setBrowser(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {BROWSERS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      )}

      {value.mode === "file" && (
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            aria-label="Path to cookies.txt"
            value={value.cookiesFile}
            onChange={(e) => setCookiesFile(e.target.value)}
            placeholder="/path/to/cookies.txt"
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={browse}
            className="shrink-0 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Browse…
          </button>
        </div>
      )}

      {value.mode !== "off" && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={runTest}
            disabled={test.status === "testing"}
            className="w-fit rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          >
            {test.status === "testing" ? "Testing…" : "Test connection"}
          </button>
          {test.status === "ok" && (
            <span className="text-sm text-green-600 dark:text-green-500">
              ✓ VK access works
            </span>
          )}
          {test.status === "error" && (
            <span className="text-sm text-destructive">✗ {test.message}</span>
          )}
        </div>
      )}

      <span className="text-xs text-muted-foreground">
        Cookies are read locally only for VK requests — never for YouTube,
        SoundCloud, or Bandcamp.
      </span>
    </div>
  );
}
