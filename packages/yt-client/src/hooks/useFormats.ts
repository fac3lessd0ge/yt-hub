import { useEffect, useState } from "react";
import { fetchFormats } from "@/lib/apiClient";
import type { FormatInfo } from "@/types/api";

export function useFormats() {
  const [formats, setFormats] = useState<FormatInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFormats()
      .then((res) => setFormats(res.formats))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { formats, loading, error };
}
