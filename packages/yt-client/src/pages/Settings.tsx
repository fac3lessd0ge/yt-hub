import { useCallback, useEffect } from "react";
import { DefaultFormatSetting } from "@/components/settings/DefaultFormatSetting";
import { DownloadLocationSetting } from "@/components/settings/DownloadLocationSetting";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { useAppVersion } from "@/hooks/useAppVersion";
import { useSettings } from "@/hooks/useSettings";
import type { Settings as SettingsType } from "@/types/electron";

const REPO_URL = "https://github.com/fac3lessd0ge/yt-hub";

function applyTheme(theme: SettingsType["theme"]) {
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  document.documentElement.classList.toggle("dark", resolved === "dark");
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </div>
      {children}
    </div>
  );
}

export function Settings() {
  const { settings, updateSetting } = useSettings();
  const version = useAppVersion();

  const handleOpenRepo = useCallback(() => {
    window.electronAPI?.openExternal?.(REPO_URL).catch((err) => {
      console.error("Failed to open repository link", err);
    });
  }, []);

  const handleThemeChange = useCallback(
    (theme: SettingsType["theme"]) => {
      applyTheme(theme);
      updateSetting("theme", theme);
    },
    [updateSetting],
  );

  // Listen for OS theme changes when in system mode
  useEffect(() => {
    if (settings?.theme !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings?.theme]);

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-10 p-8">
      <h1 className="text-lg font-semibold tracking-tight text-foreground">
        Settings
      </h1>

      <SettingsSection title="Appearance">
        <SettingsRow
          label="Theme"
          description="Choose how YT Hub looks. System follows your OS preference."
        >
          <ThemeToggle value={settings.theme} onChange={handleThemeChange} />
        </SettingsRow>
      </SettingsSection>

      <div className="h-px bg-border" />

      <SettingsSection title="Downloads">
        <SettingsRow
          label="Download Location"
          description="When set, files save directly without a dialog."
        >
          <DownloadLocationSetting
            value={settings.defaultDownloadDir}
            onChange={(path) => updateSetting("defaultDownloadDir", path)}
          />
        </SettingsRow>

        <SettingsRow
          label="Default Format"
          description="Pre-selected format for new downloads."
        >
          <DefaultFormatSetting
            value={settings.defaultFormat}
            onChange={(fmt) => updateSetting("defaultFormat", fmt)}
          />
        </SettingsRow>
      </SettingsSection>

      <div className="h-px bg-border" />

      <SettingsSection title="About">
        <SettingsRow
          label="YT Hub"
          description={version ? `Version ${version}` : "Version unavailable"}
        >
          <button
            type="button"
            onClick={handleOpenRepo}
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Open on GitHub
          </button>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
