import { contextBridge, ipcRenderer } from "electron";

// Read once during preload execution (before renderer event loop starts).
// sendSync is acceptable here — it runs once, does not block the renderer.
const cachedApiBaseUrl: string | undefined =
  ipcRenderer.sendSync("config:getApiBaseUrl") || undefined;

contextBridge.exposeInMainWorld("electronAPI", {
  getApiBaseUrl: (): string | undefined => cachedApiBaseUrl,
  selectFolder: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:selectFolder"),
  showItemInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("shell:showItemInFolder", filePath),
  saveDownload: (
    downloadUrl: string,
    suggestedFilename: string,
  ): Promise<{ filePath: string } | null> =>
    ipcRenderer.invoke("dialog:saveDownload", downloadUrl, suggestedFilename),
});
