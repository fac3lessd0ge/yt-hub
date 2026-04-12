import { FileText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormats } from "@/hooks/useFormats";
import { isValidYoutubeUrl } from "@/lib/urlValidation";
import { cn } from "@/lib/utils";
import type { DownloadRequest, FormatInfo } from "@/types/api";

interface BatchFormProps {
  onAdd: (items: DownloadRequest[]) => void;
  onSwitchToSingle: () => void;
  disabled?: boolean;
}

function parseUrls(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function BatchForm({
  onAdd,
  onSwitchToSingle,
  disabled,
}: BatchFormProps) {
  const [text, setText] = useState("");
  const [format, setFormat] = useState("");
  const { formats, loading: formatsLoading } = useFormats();

  useEffect(() => {
    if (formats.length > 0 && !format) {
      setFormat(formats[0].id);
    }
  }, [formats, format]);

  const { validUrls, invalidCount } = useMemo(() => {
    const lines = parseUrls(text);
    const valid = lines.filter(isValidYoutubeUrl);
    const invalid = lines.length - valid.length;
    return { validUrls: valid, invalidCount: invalid };
  }, [text]);

  const handleImport = useCallback(async () => {
    const content = await window.electronAPI?.openTextFile();
    if (content) {
      setText((prev) => (prev ? `${prev}\n${content}` : content));
    }
  }, []);

  const handleAdd = useCallback(() => {
    if (validUrls.length === 0 || !format) return;

    const items: DownloadRequest[] = validUrls.map((url) => ({
      link: url,
      format,
      name: url,
    }));

    onAdd(items);
    setText("");
    onSwitchToSingle();
  }, [validUrls, format, onAdd, onSwitchToSingle]);

  const totalLines = parseUrls(text).length;

  return (
    <div className="flex flex-col gap-3">
      {/* Header: label + format */}
      <div className="flex items-center justify-between">
        <label
          htmlFor="batch-urls"
          className="text-sm font-medium text-foreground"
        >
          YouTube Links
        </label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          disabled={formatsLoading}
          className="shrink-0 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          aria-label="Format for all URLs"
        >
          {formatsLoading && <option>...</option>}
          {formats.map((f: FormatInfo) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Textarea */}
      <textarea
        id="batch-urls"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Paste URLs, one per line..."}
        rows={6}
        className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {/* Footer: validation + actions */}
      <div className="flex items-center justify-between">
        <div className="text-xs">
          {totalLines > 0 ? (
            <>
              <span className="text-green-500">
                {validUrls.length} valid
              </span>
              {invalidCount > 0 && (
                <span className="text-destructive-foreground">
                  {" · "}
                  {invalidCount} invalid
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">No URLs entered</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleImport}
            className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <FileText className="h-3.5 w-3.5" />
            Import .txt
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={disabled || validUrls.length === 0}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              validUrls.length > 0 && !disabled
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            + Add {validUrls.length > 0 ? validUrls.length : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
