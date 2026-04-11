import type { z } from "zod";
import type { DownloadProgressSchema } from "~/schemas";

export type DownloadProgress = z.infer<typeof DownloadProgressSchema>;
export type ProgressCallback = (progress: DownloadProgress) => void;
