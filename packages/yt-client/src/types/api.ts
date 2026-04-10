// HTTP API response types — derived from proto definitions in
// packages/yt-service/proto/yt_service.proto (package yt_hub.v1).
// Run `npm run codegen` in yt-service to regenerate proto types.
//
// These types represent the HTTP/JSON API served by yt-api (Rust),
// which may add fields beyond the gRPC proto (e.g. download_url).

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

// download_url is added by yt-api HTTP layer (not in proto)
export interface DownloadComplete {
  output_path: string;
  download_url: string;
  title: string;
  author_name: string;
  format_id: string;
  format_label: string;
}

export interface DownloadError {
  code: string;
  message: string;
  retryable?: boolean;
}
