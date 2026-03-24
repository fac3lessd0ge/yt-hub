import type { DownloadComplete } from "@/types/api";

interface DownloadResultProps {
  result: DownloadComplete;
  onReset: () => void;
}

export function DownloadResult({ result, onReset }: DownloadResultProps) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="mb-2 text-sm font-medium text-green-600">
        Download Complete
      </h3>
      <div className="flex flex-col gap-1 text-sm">
        <p>
          <span className="text-muted-foreground">Title:</span> {result.title}
        </p>
        <p>
          <span className="text-muted-foreground">Author:</span>{" "}
          {result.author_name}
        </p>
        <p>
          <span className="text-muted-foreground">Format:</span>{" "}
          {result.format_label}
        </p>
        <p className="mt-1 break-all text-xs text-muted-foreground">
          {result.output_path}
        </p>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Download Another
      </button>
    </div>
  );
}
