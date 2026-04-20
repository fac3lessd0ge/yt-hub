export interface HistoryEntry {
  id: string;
  title: string;
  author: string;
  format: string;
  formatType: "video" | "audio";
  link: string;
  localPath: string;
  downloadedAt: number;
}

export interface Settings {
  theme: "system" | "light" | "dark";
  defaultDownloadDir: string | null;
  defaultFormat: string;
}

export interface ElectronAPI {
  getApiBaseUrl?: () => string | undefined;
  getInitialTheme: () => string;
  getAppVersion: () => string;
  selectFolder: () => Promise<string | null>;
  showItemInFolder: (filePath: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
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
  openTextFile: () => Promise<string | null>;
  getHistory: () => Promise<HistoryEntry[]>;
  addHistoryEntry: (entry: Omit<HistoryEntry, "id">) => Promise<HistoryEntry>;
  removeHistoryEntry: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  checkFileExists: (filePath: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
