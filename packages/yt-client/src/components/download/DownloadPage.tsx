import { useMemo } from "react";
import { useDownload } from "@/hooks/useDownload";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { DownloadForm } from "./DownloadForm";
import { DownloadProgress } from "./DownloadProgress";
import { DownloadResult } from "./DownloadResult";

export function DownloadPage() {
  const {
    state,
    progress,
    result,
    localPath,
    error,
    start,
    cancel,
    reset,
  } = useDownload();

  const shortcuts = useMemo(
    (): Record<string, () => void> =>
      state === "downloading" ? { Escape: cancel } : {},
    [state, cancel],
  );
  useKeyboardShortcuts(shortcuts);

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="mb-6 text-xl font-semibold">Download</h2>

      <div aria-live="polite">
        {state === "idle" && <DownloadForm onSubmit={start} />}

        {state === "downloading" && (
          <DownloadProgress
            progress={progress}
            onCancel={cancel}
          />
        )}

        {state === "saving" && (
          <p aria-busy="true" className="text-sm text-muted-foreground">
            Saving file...
          </p>
        )}

        {state === "complete" && result && (
          <DownloadResult
            result={result}
            localPath={localPath}
            onReset={reset}
          />
        )}

        {state === "error" && error && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/50 bg-destructive/10 p-4"
          >
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
    </div>
  );
}
