import { useEffect, useState } from "react";
import { useFormats } from "@/hooks/useFormats";
import { useMetadata } from "@/hooks/useMetadata";
import { cn } from "@/lib/utils";
import type { DownloadRequest, FormatInfo } from "@/types/api";

interface DownloadFormProps {
  onSubmit: (request: DownloadRequest) => void;
}

export function DownloadForm({ onSubmit }: DownloadFormProps) {
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [format, setFormat] = useState("");
  const { formats } = useFormats();
  const { metadata, loading: metadataLoading } = useMetadata(link);

  useEffect(() => {
    if (metadata?.title && !name) {
      setName(metadata.title);
    }
  }, [metadata, name]);

  useEffect(() => {
    if (formats.length > 0 && !format) {
      setFormat(formats[0].id);
    }
  }, [formats, format]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!link || !name || !format) return;
    onSubmit({ link, format, name });
  };

  const isValid = link && name && format;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="link" className="text-sm font-medium">
          YouTube Link
        </label>
        <input
          id="link"
          type="text"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {metadataLoading && (
          <p className="text-xs text-muted-foreground">Fetching metadata...</p>
        )}
        {metadata && (
          <p className="text-xs text-muted-foreground">
            {metadata.title} by {metadata.author_name}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="format" className="text-sm font-medium">
          Format
        </label>
        <select
          id="format"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {formats.map((f: FormatInfo) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

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
