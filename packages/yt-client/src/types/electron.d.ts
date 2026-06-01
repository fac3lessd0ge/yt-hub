import type {
  BackendsResponse,
  DownloadCompleteEvent,
  DownloadErrorEvent,
  DownloadProgressEvent,
  DownloadRequest,
  FormatsResponse,
  MetadataResponse,
} from "./api";

export interface HistoryEntry {
  id: string;
  title: string;
  author: string;
  format: string;
  formatType: "video" | "audio";
  link: string;
  localPath: string;
  downloadedAt: number;
  source: string;
}

export interface Settings {
  theme: "system" | "light" | "dark";
  defaultDownloadDir: string | null;
  defaultFormat: string;
  /** Optional proxy for downloads (e.g. socks5://127.0.0.1:2080). Empty = direct. */
  proxy: string;
}

export interface ElectronAPI {
  getInitialTheme: () => string;
  getAppVersion: () => string;

  // Downloads (in-process)
  startDownload: (params: DownloadRequest) => Promise<void>;
  cancelDownload: (downloadId: string) => Promise<void>;
  onDownloadProgress: (
    callback: (payload: DownloadProgressEvent) => void,
  ) => () => void;
  onDownloadComplete: (
    callback: (payload: DownloadCompleteEvent) => void,
  ) => () => void;
  onDownloadError: (
    callback: (payload: DownloadErrorEvent) => void,
  ) => () => void;

  // Metadata / formats / backends (in-process)
  getMetadata: (url: string) => Promise<MetadataResponse>;
  listFormats: () => Promise<FormatsResponse>;
  listBackends: () => Promise<BackendsResponse>;

  // Dialog / shell
  selectFolder: () => Promise<string | null>;
  showItemInFolder: (filePath: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  openTextFile: () => Promise<string | null>;

  // Settings
  getSettings: () => Promise<Settings>;
  getSetting: <K extends keyof Settings>(key: K) => Promise<Settings[K]>;
  setSetting: <K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ) => Promise<Settings[K]>;

  // Clipboard
  readClipboardText: () => Promise<string>;

  // History
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
