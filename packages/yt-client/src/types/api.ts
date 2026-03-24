export interface MetadataResponse {
  title: string;
  author_name: string;
}

export interface FormatInfo {
  id: string;
  label: string;
}

export interface FormatsResponse {
  formats: FormatInfo[];
}

export interface BackendsResponse {
  backends: string[];
}

export interface DownloadRequest {
  link: string;
  format: string;
  name: string;
  destination?: string;
  backend?: string;
}

export interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
}

export interface DownloadComplete {
  output_path: string;
  title: string;
  author_name: string;
  format_id: string;
  format_label: string;
}

export interface DownloadError {
  code: string;
  message: string;
}
