import type { Dependency } from "~/dependencies";
import type { ProgressCallback } from "./DownloadProgress";

export interface FormatInfo {
  id: string;
  label: string;
}

export interface IDownloadBackend {
  readonly name: string;
  supportedFormats(): FormatInfo[];
  requiredDependencies(): Dependency[];
  download(
    link: string,
    outputPath: string,
    formatId: string,
    onProgress?: ProgressCallback
  ): Promise<void>;
}
