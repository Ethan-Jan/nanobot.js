import { useCallback, useEffect, useState } from "react";
import { getStatus, type StatusPayload } from "@/shared/api";

export function useDashboardStatus() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const s = await getStatus();
    setData(s);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getStatus();
        if (!cancelled) setData(s);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, err, loading, setData, refresh };
}
