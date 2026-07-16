import { useEffect, useState } from "react";

export type HealthState = "checking" | "ok" | "down";

export function useHealthCheck(intervalMs = 30_000): HealthState {
  const [state, setState] = useState<HealthState>("checking");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function check() {
      try {
        const res = await fetch("/api/healthz", { credentials: "same-origin" });
        if (!res.ok || !res.headers.get("content-type")?.includes("application/json")) {
          if (!cancelled) setState("down");
          return;
        }
        const data = (await res.json()) as { status?: string };
        if (!cancelled) setState(data.status === "ok" ? "ok" : "down");
      } catch {
        if (!cancelled) setState("down");
      }
    }

    void check();
    timer = setInterval(check, intervalMs);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [intervalMs]);

  return state;
}
