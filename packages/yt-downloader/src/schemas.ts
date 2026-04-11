import { z } from "zod";

export const DownloadProgressSchema = z.object({
  percent: z.number(),
  speed: z.string(),
  eta: z.string(),
});

export const DownloadCompleteSchema = z.object({
  output_path: z.string(),
  download_url: z.string(),
  title: z.string(),
  author_name: z.string(),
  format_id: z.string(),
  format_label: z.string(),
});

export const DownloadErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean().optional(),
});

export const VideoMetadataSchema = z.object({
  title: z.string(),
  authorName: z.string(),
});

export const FormatInfoSchema = z.object({
  id: z.string(),
  label: z.string(),
});

export const MetadataRequestSchema = z.object({
  link: z.string().min(1, "link is required"),
});

export const DownloadRequestSchema = z.object({
  link: z.string().min(1, "link is required"),
  format: z.string().min(1, "format is required"),
  name: z.string().min(1, "name is required"),
  destination: z.string().optional(),
  backend: z.string().optional(),
});

export const MetadataResponseSchema = VideoMetadataSchema;

export const FormatsResponseSchema = z.object({
  formats: z.array(FormatInfoSchema),
});

export const BackendsResponseSchema = z.object({
  backends: z.array(z.string()),
});
