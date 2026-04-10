export interface ElectronAPI {
  getApiBaseUrl?: () => string | undefined;
  selectFolder: () => Promise<string | null>;
  showItemInFolder: (filePath: string) => Promise<void>;
  saveDownload: (
    downloadUrl: string,
    suggestedFilename: string,
  ) => Promise<{ filePath: string } | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
