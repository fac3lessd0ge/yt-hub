import { useEffect, useState } from "react";
import { getProxyValidationError } from "@/lib/proxyValidation";

interface ProxySettingProps {
  value: string;
  onChange: (proxy: string) => void;
}

export function ProxySetting({ value, onChange }: ProxySettingProps) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  // Reflect external changes to the stored value into the local draft.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    const validationError = getProxyValidationError(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setDraft(trimmed);
    if (trimmed !== value) {
      onChange(trimmed);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="text"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) {
            setError(getProxyValidationError(e.target.value));
          }
        }}
        onBlur={commit}
        placeholder="socks5://127.0.0.1:2080"
        spellCheck={false}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : (
        <span className="text-xs text-muted-foreground">
          Routes downloads through a proxy (e.g. your VPN) to bypass throttling.
          Leave empty for a direct connection.
        </span>
      )}
    </div>
  );
}
