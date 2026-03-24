import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  selectFolder: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:selectFolder"),
  showItemInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("shell:showItemInFolder", filePath),
});
