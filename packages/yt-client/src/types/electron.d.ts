export interface Settings {
  theme: "system" | "light" | "dark";
  defaultDownloadDir: string | null;
  defaultFormat: string;
}

export interface ElectronAPI {
  getApiBaseUrl?: () => string | undefined;
  getInitialTheme: () => string;
  selectFolder: () => Promise<string | null>;
  showItemInFolder: (filePath: string) => Promise<void>;
  saveDownload: (
    downloadUrl: string,
    suggestedFilename: string,
    destDir?: string,
  ) => Promise<{ filePath: string } | null>;
  getSettings: () => Promise<Settings>;
  getSetting: <K extends keyof Settings>(key: K) => Promise<Settings[K]>;
  setSetting: <K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ) => Promise<Settings[K]>;
  readClipboardText: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
