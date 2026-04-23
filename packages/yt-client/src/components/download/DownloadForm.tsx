import { ClipboardPaste } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFormats } from "@/hooks/useFormats";
import { useMetadata } from "@/hooks/useMetadata";
import { useSettings } from "@/hooks/useSettings";
import { getUrlValidationError, isValidYoutubeUrl } from "@/lib/urlValidation";
import { cn } from "@/lib/utils";
import type { DownloadRequest, FormatInfo } from "@/types/api";
import { BatchForm } from "./BatchForm";

type Tab = "single" | "batch";

interface DownloadFormProps {
  onSubmit: (request: DownloadRequest) => void;
  onBatchAdd?: (items: DownloadRequest[]) => void;
  queueMode?: boolean;
  hasItems?: boolean;
}

export function DownloadForm({
  onSubmit,
  onBatchAdd,
  queueMode,
  hasItems,
}: DownloadFormProps) {
  const [tab, setTab] = useState<Tab>("single");
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [format, setFormat] = useState("");
  const linkRef = useRef<HTMLInputElement>(null);
  const awaitingMetadataName = useRef(false);
  const {
    formats,
    loading: formatsLoading,
    error: formatsError,
    refetch: refetchFormats,
  } = useFormats();
  const { settings } = useSettings();

  useEffect(() => {
    if (tab === "single") linkRef.current?.focus();
  }, [tab]);

  const urlError = getUrlValidationError(link);
  const {
    metadata,
    loading: metadataLoading,
    error: metadataError,
  } = useMetadata(urlError ? "" : link);

  const prevMetadataRef = useRef(metadata);
  useEffect(() => {
    if (metadata?.title && metadata !== prevMetadataRef.current) {
      if (!name || awaitingMetadataName.current) {
        setName(metadata.title);
        awaitingMetadataName.current = false;
      }
    }
    prevMetadataRef.current = metadata;
  }, [metadata, name]);

  useEffect(() => {
    if (metadataError && awaitingMetadataName.current) {
      setName("");
      awaitingMetadataName.current = false;
    }
  }, [metadataError]);

  useEffect(() => {
    if (format) return;
    if (formats.length === 0) return;
    const preferred = settings?.defaultFormat;
    if (preferred && formats.some((f) => f.id === preferred)) {
      setFormat(preferred);
      return;
    }
    setFormat(formats[0].id);
  }, [formats, format, settings?.defaultFormat]);

  const handlePaste = async () => {
    const text = await window.electronAPI?.readClipboardText();
    if (text && isValidYoutubeUrl(text.trim())) {
      setLink(text.trim());
      awaitingMetadataName.current = true;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!link || urlError || !name || !format) return;
    onSubmit({ link, format, name });
    if (queueMode) {
      setLink("");
      setName("");
      awaitingMetadataName.current = false;
      linkRef.current?.focus();
    }
  };

  const handleBatchAdd = useCallback(
    (items: DownloadRequest[]) => {
      onBatchAdd?.(items);
    },
    [onBatchAdd],
  );

  const switchToSingle = useCallback(() => {
    setTab("single");
  }, []);

  const isValid = link && !urlError && name && format;

  return (
    <div className="flex flex-col gap-4">
      {/* Tab switcher — only in queue mode */}
      {queueMode && onBatchAdd && (
        <div className="flex gap-1 rounded-lg border border-border bg-muted/50 p-0.5 self-start">
          {(["single", "batch"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-all duration-150",
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "single" ? "Single" : "Batch"}
            </button>
          ))}
        </div>
      )}

      {tab === "single" ? (
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
              <p
                id="link-error"
                role="alert"
                className="text-xs text-destructive"
              >
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
              <p className="text-xs text-muted-foreground">
                Fetching metadata...
              </p>
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
              onChange={(e) => {
                setName(e.target.value);
                awaitingMetadataName.current = false;
              }}
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
            {queueMode && hasItems ? "+ Add" : "Download"}
          </button>
        </form>
      ) : (
        <BatchForm onAdd={handleBatchAdd} onSwitchToSingle={switchToSingle} />
      )}
    </div>
  );
}
