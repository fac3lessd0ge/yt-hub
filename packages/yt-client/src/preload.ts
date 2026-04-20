import { contextBridge, ipcRenderer } from "electron";

// Read once during preload execution (before renderer event loop starts).
// sendSync is acceptable here — it runs once, does not block the renderer.
const cachedApiBaseUrl: string | undefined =
  ipcRenderer.sendSync("config:getApiBaseUrl") || undefined;

const cachedTheme: string =
  ipcRenderer.sendSync("settings:getTheme") || "system";

const cachedAppVersion: string = ipcRenderer.sendSync("app:getVersion") || "";

contextBridge.exposeInMainWorld("electronAPI", {
  getApiBaseUrl: (): string | undefined => cachedApiBaseUrl,
  getInitialTheme: (): string => cachedTheme,
  getAppVersion: (): string => cachedAppVersion,
  selectFolder: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:selectFolder"),
  showItemInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("shell:showItemInFolder", filePath),
  saveDownload: (
    downloadUrl: string,
    suggestedFilename: string,
    destDir?: string,
  ): Promise<{ filePath: string } | null> =>
    ipcRenderer.invoke(
      "dialog:saveDownload",
      downloadUrl,
      suggestedFilename,
      destDir,
    ),
  getSettings: () => ipcRenderer.invoke("settings:getAll"),
  getSetting: (key: string) => ipcRenderer.invoke("settings:get", key),
  setSetting: (key: string, value: unknown) =>
    ipcRenderer.invoke("settings:set", key, value),
  readClipboardText: (): Promise<string> =>
    ipcRenderer.invoke("clipboard:readText"),
  openTextFile: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:openTextFile"),
  getHistory: () => ipcRenderer.invoke("history:getAll"),
  addHistoryEntry: (entry: Record<string, unknown>) =>
    ipcRenderer.invoke("history:add", entry),
  removeHistoryEntry: (id: string) => ipcRenderer.invoke("history:remove", id),
  clearHistory: () => ipcRenderer.invoke("history:clear"),
  checkFileExists: (filePath: string) =>
    ipcRenderer.invoke("history:checkFile", filePath),
});
