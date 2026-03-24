import { useDownload } from "@/hooks/useDownload";
import { DownloadForm } from "./DownloadForm";
import { DownloadProgress } from "./DownloadProgress";
import { DownloadResult } from "./DownloadResult";

export function DownloadPage() {
  const { state, progress, result, error, start, cancel, reset } =
    useDownload();

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="mb-6 text-xl font-semibold">Download</h2>

      {state === "idle" && <DownloadForm onSubmit={start} />}

      {state === "downloading" && (
        <DownloadProgress progress={progress} onCancel={cancel} />
      )}

      {state === "complete" && result && (
        <DownloadResult result={result} onReset={reset} />
      )}

      {state === "error" && error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <h3 className="mb-1 text-sm font-medium text-destructive">
            Download Failed
          </h3>
          <p className="text-sm text-destructive/80">
            [{error.code}] {error.message}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
