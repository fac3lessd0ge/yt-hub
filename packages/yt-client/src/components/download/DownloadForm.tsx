import { ClipboardPaste } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormats } from "@/hooks/useFormats";
import { useMetadata } from "@/hooks/useMetadata";
import { getUrlValidationError, isValidYoutubeUrl } from "@/lib/urlValidation";
import { cn } from "@/lib/utils";
import type { DownloadRequest, FormatInfo } from "@/types/api";

interface DownloadFormProps {
  onSubmit: (request: DownloadRequest) => void;
}

export function DownloadForm({ onSubmit }: DownloadFormProps) {
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [format, setFormat] = useState("");
  const linkRef = useRef<HTMLInputElement>(null);
  const {
    formats,
    loading: formatsLoading,
    error: formatsError,
    refetch: refetchFormats,
  } = useFormats();

  useEffect(() => {
    linkRef.current?.focus();
  }, []);

  const urlError = getUrlValidationError(link);
  const {
    metadata,
    loading: metadataLoading,
    error: metadataError,
  } = useMetadata(urlError ? "" : link);

  const prevMetadataRef = useRef(metadata);
  useEffect(() => {
    // Only auto-fill when metadata actually changes (new fetch result),
    // not when stale metadata is still around after a link change
    if (metadata?.title && metadata !== prevMetadataRef.current && !name) {
      setName(metadata.title);
    }
    prevMetadataRef.current = metadata;
  }, [metadata, name]);

  useEffect(() => {
    if (formats.length > 0 && !format) {
      setFormat(formats[0].id);
    }
  }, [formats, format]);

  const handlePaste = async () => {
    const text = await window.electronAPI?.readClipboardText();
    if (text && isValidYoutubeUrl(text.trim())) {
      setLink(text.trim());
      setName("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!link || urlError || !name || !format) return;
    onSubmit({ link, format, name });
  };

  const isValid = link && !urlError && name && format;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Row 1: URL + Format + Paste */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="link" className="text-sm font-medium">
          YouTube Link
        </label>
        <div className="flex items-stretch gap-2">
          <input
            ref={linkRef}
            id="link"
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className={cn(
              "min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
              metadataError ? "border-destructive" : "border-input",
            )}
            aria-required="true"
            aria-invalid={!!urlError || !!metadataError}
            aria-describedby={
              urlError
                ? "link-error"
                : metadataError
                  ? "metadata-error"
                  : undefined
            }
          />

          {formatsError ? (
            <div className="flex items-center gap-1.5 rounded-md border border-destructive/25 bg-destructive/10 px-3">
              <span className="whitespace-nowrap text-xs text-destructive">
                Formats failed
              </span>
              <button
                type="button"
                onClick={refetchFormats}
                className="text-xs font-medium text-destructive underline underline-offset-2"
              >
                Retry
              </button>
            </div>
          ) : (
            <select
              id="format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              disabled={formatsLoading}
              className="shrink-0 rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              aria-required="true"
              aria-label="Format"
            >
              {formatsLoading && <option>...</option>}
              {formats.map((f: FormatInfo) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handlePaste}
            className="shrink-0 rounded-md border border-input bg-background px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Paste YouTube URL from clipboard"
            title="Paste from clipboard"
          >
            <ClipboardPaste className="h-4 w-4" />
          </button>
        </div>

        {urlError && (
          <p id="link-error" role="alert" className="text-xs text-destructive">
            {urlError}
          </p>
        )}
        {metadataError && !urlError && (
          <p
            id="metadata-error"
            role="alert"
            className="text-xs text-destructive"
          >
            Could not load video info — server may be unavailable
          </p>
        )}
        {metadataLoading && (
          <p className="text-xs text-muted-foreground">Fetching metadata...</p>
        )}
        {metadata && (
          <p className="text-xs text-muted-foreground">
            {metadata.title} by {metadata.author_name}
          </p>
        )}
      </div>

      {/* Row 2: File Name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          File Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter file name"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-required="true"
        />
      </div>

      <button
        type="submit"
        disabled={!isValid}
        className={cn(
          "mt-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
          isValid
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-muted text-muted-foreground cursor-not-allowed",
        )}
      >
        Download
      </button>
    </form>
  );
}
