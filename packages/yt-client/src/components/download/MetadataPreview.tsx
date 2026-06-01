import { ImageOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface MetadataPreviewProps {
  title: string;
  author: string;
  thumbnailUrl: string | null;
  /** When true, show the "tags only, no cover art" caveat for mp4. */
  hasCoverArt: boolean;
}

export function MetadataPreview({
  title,
  author,
  thumbnailUrl,
  hasCoverArt,
}: MetadataPreviewProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const showThumbnail = thumbnailUrl !== null && !imgFailed;

  return (
    <section
      className="flex flex-col gap-2 rounded-md border border-border bg-muted/50 px-3 py-2.5"
      aria-label="File tags preview"
    >
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-none">
        Will be tagged as
      </p>

      <div className="flex items-start gap-3">
        {/* Thumbnail / placeholder */}
        <div
          className={cn(
            "shrink-0 h-12 w-12 rounded-sm overflow-hidden border border-border bg-muted flex items-center justify-center",
          )}
          aria-hidden="true"
        >
          {showThumbnail ? (
            <img
              src={thumbnailUrl}
              alt={`Thumbnail for ${title}`}
              className="h-full w-full object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <ImageOff className="h-4 w-4 text-muted-foreground/50" />
          )}
        </div>

        {/* Tag rows */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-xs text-muted-foreground w-10">
              Title
            </span>
            <span className="text-xs font-medium text-foreground truncate">
              {title}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-xs text-muted-foreground w-10">
              Artist
            </span>
            <span className="text-xs font-medium text-foreground truncate">
              {author}
            </span>
          </div>
          {!hasCoverArt && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              mp4: tags only &mdash; no cover art embedded
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
