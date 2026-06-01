import { contextBridge, ipcRenderer } from "electron";
import type {
  BackendsResponse,
  DownloadCompleteEvent,
  DownloadErrorEvent,
  DownloadProgressEvent,
  DownloadRequest,
  FormatsResponse,
  MetadataResponse,
} from "./types/api";
import type { HistoryEntry } from "./types/electron";

// Read once during preload execution (before renderer event loop starts).
// sendSync is acceptable here — it runs once, does not block the renderer.
const cachedTheme: string =
  ipcRenderer.sendSync("settings:getTheme") || "system";

const cachedAppVersion: string = ipcRenderer.sendSync("app:getVersion") || "";

/** Subscribe to a main → renderer channel; returns an unsubscribe fn. */
function subscribe<T>(
  channel: string,
  callback: (payload: T) => void,
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => {
    callback(payload);
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

contextBridge.exposeInMainWorld("electronAPI", {
  getInitialTheme: (): string => cachedTheme,
  getAppVersion: (): string => cachedAppVersion,

  // --- Downloads (in-process) ---
  startDownload: (params: DownloadRequest): Promise<void> =>
    ipcRenderer.invoke("download:start", params),
  cancelDownload: (downloadId: string): Promise<void> =>
    ipcRenderer.invoke("download:cancel", downloadId),
  onDownloadProgress: (
    callback: (payload: DownloadProgressEvent) => void,
  ): (() => void) => subscribe("download:progress", callback),
  onDownloadComplete: (
    callback: (payload: DownloadCompleteEvent) => void,
  ): (() => void) => subscribe("download:complete", callback),
  onDownloadError: (
    callback: (payload: DownloadErrorEvent) => void,
  ): (() => void) => subscribe("download:error", callback),

  // --- Metadata / formats / backends (in-process) ---
  getMetadata: (url: string): Promise<MetadataResponse> =>
    ipcRenderer.invoke("metadata:get", url),
  listFormats: (): Promise<FormatsResponse> =>
    ipcRenderer.invoke("formats:list"),
  listBackends: (): Promise<BackendsResponse> =>
    ipcRenderer.invoke("backends:list"),

  // --- Dialog / shell ---
  selectFolder: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:selectFolder"),
  showItemInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("shell:showItemInFolder", filePath),
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke("shell:openExternal", url),
  openTextFile: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:openTextFile"),

  // --- Settings ---
  getSettings: () => ipcRenderer.invoke("settings:getAll"),
  getSetting: (key: string) => ipcRenderer.invoke("settings:get", key),
  setSetting: (key: string, value: unknown) =>
    ipcRenderer.invoke("settings:set", key, value),

  // --- Clipboard ---
  readClipboardText: (): Promise<string> =>
    ipcRenderer.invoke("clipboard:readText"),

  // --- History ---
  getHistory: () => ipcRenderer.invoke("history:getAll"),
  addHistoryEntry: (entry: Omit<HistoryEntry, "id">) =>
    ipcRenderer.invoke("history:add", entry),
  removeHistoryEntry: (id: string) => ipcRenderer.invoke("history:remove", id),
  clearHistory: () => ipcRenderer.invoke("history:clear"),
  checkFileExists: (filePath: string) =>
    ipcRenderer.invoke("history:checkFile", filePath),
});
