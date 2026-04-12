import { FolderOpen } from "lucide-react";

interface DownloadLocationSettingProps {
  value: string | null;
  onChange: (path: string | null) => void;
}

export function DownloadLocationSetting({
  value,
  onChange,
}: DownloadLocationSettingProps) {
  const handleBrowse = async () => {
    const selected = await window.electronAPI?.selectFolder();
    if (selected) {
      onChange(selected);
    }
  };

  const handleClear = () => {
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 rounded-md border border-border bg-muted/30 px-3 py-2">
          {value ? (
            <code className="block truncate text-sm text-foreground">
              {value}
            </code>
          ) : (
            <span className="block text-sm text-muted-foreground italic">
              Not set — save dialog will appear each time
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleBrowse}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Browse
        </button>
      </div>
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Clear default location
        </button>
      )}
    </div>
  );
}
