import { useCallback, useEffect, useState } from "react";

export function useBackends() {
  const [backends, setBackends] = useState<string[]>([]);
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
      .listBackends()
      .then((res) => setBackends(res.backends))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Unknown error"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { backends, loading, error, refetch };
}
