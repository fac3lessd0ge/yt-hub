import { useCallback, useEffect, useState } from "react";
import type { FormatInfo } from "@/types/api";

export function useFormats() {
  const [formats, setFormats] = useState<FormatInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    const api = window.electronAPI;
    if (!api) {
      setError("Electron bridge unavailable");
      setLoading(false);
      return;
    }
    api
      .listFormats()
      .then((res) => setFormats(res.formats))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Unknown error"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { formats, loading, error, refetch };
}
