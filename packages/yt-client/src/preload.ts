import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
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
