import { useEffect, useRef, useState } from "react";
import { fetchMetadata } from "@/lib/apiClient";
import type { MetadataResponse } from "@/types/api";

export function useMetadata(link: string) {
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMetadata(null);
    setError(null);

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    if (!link) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      fetchMetadata(link, { signal: controller.signal })
        .then((data) => {
          if (!controller.signal.aborted) {
            setMetadata(data);
          }
        })
        .catch((err) => {
          if (!controller.signal.aborted) {
            setError(err.message);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 500);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [link]);

  return { metadata, loading, error };
}
