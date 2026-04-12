import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Settings } from "@/types/electron";

interface SettingsContextValue {
  settings: Settings | null;
  updateSetting: <K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ) => Promise<void>;
}

const defaultSettings: Settings = {
  theme: "system",
  defaultDownloadDir: null,
  defaultFormat: "mp4",
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultSettings,
  updateSetting: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    window.electronAPI?.getSettings().then(setSettings);
  }, []);

  const updateSetting = useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]) => {
      const updated = await window.electronAPI?.setSetting(key, value);
      setSettings((prev) =>
        prev ? { ...prev, [key]: updated ?? value } : prev,
      );
    },
    [],
  );

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
