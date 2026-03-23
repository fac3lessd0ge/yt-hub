export interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
}

export type ProgressCallback = (progress: DownloadProgress) => void;
