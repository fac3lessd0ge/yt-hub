import type { Dependency } from "~/dependencies";
import type { z } from "zod";
import type { FormatInfoSchema } from "~/schemas";
import type { ProgressCallback } from "./DownloadProgress";

export type FormatInfo = z.infer<typeof FormatInfoSchema>;

export interface IDownloadBackend {
  readonly name: string;
  supportedFormats(): FormatInfo[];
  requiredDependencies(): Dependency[];
  download(
    link: string,
    outputPath: string,
    formatId: string,
    onProgress?: ProgressCallback,
    signal?: AbortSignal,
  ): Promise<void>;
}
