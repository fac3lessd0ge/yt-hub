import { useCallback, useEffect, useState } from "react";
import { fetchBackends } from "@/lib/apiClient";

export function useBackends() {
  const [backends, setBackends] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchBackends()
      .then((res) => setBackends(res.backends))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { backends, loading, error, refetch };
}
