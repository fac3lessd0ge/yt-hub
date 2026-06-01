import { useEffect, useRef, useState } from "react";
import type { MetadataResponse } from "@/types/api";

export function useMetadata(link: string) {
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setMetadata(null);
    setError(null);

    // Invalidate any in-flight request.
    requestIdRef.current += 1;

    if (!link) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;

      setLoading(true);
      window.electronAPI
        ?.getMetadata(link)
        .then((data) => {
          if (requestId === requestIdRef.current) {
            setMetadata(data);
          }
        })
        .catch((err: unknown) => {
          if (requestId === requestIdRef.current) {
            setError(err instanceof Error ? err.message : "Unknown error");
          }
        })
        .finally(() => {
          if (requestId === requestIdRef.current) {
            setLoading(false);
          }
        });
    }, 500);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // Drop any pending/in-flight result for the previous link.
      requestIdRef.current += 1;
    };
  }, [link]);

  return { metadata, loading, error };
}
