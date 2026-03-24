import { useEffect, useRef, useState } from "react";
import { fetchMetadata } from "@/lib/apiClient";
import type { MetadataResponse } from "@/types/api";

export function useMetadata(link: string) {
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMetadata(null);
    setError(null);

    if (!link) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setLoading(true);
      fetchMetadata(link)
        .then(setMetadata)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, 500);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [link]);

  return { metadata, loading, error };
}
