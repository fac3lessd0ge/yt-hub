import type { Dependency } from "~/dependencies";

export interface FormatInfo {
  id: string;
  label: string;
}

export interface IDownloadBackend {
  readonly name: string;
  supportedFormats(): FormatInfo[];
  requiredDependencies(): Dependency[];
  download(link: string, outputPath: string, formatId: string): Promise<void>;
}
