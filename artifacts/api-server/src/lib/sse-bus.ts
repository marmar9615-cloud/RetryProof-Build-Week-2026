import { logger } from "./logger";

export type AuditPhase =
  | "ingesting"
  | "detecting-stack"
  | "calling-llm"
  | "running-smoke"
  | "done"
  | "error";

export type AuditEvent = {
  ts: number;
  phase: AuditPhase;
  message: string;
};

const BUFFER_LIMIT = 50;
const buffers = new Map<string, AuditEvent[]>();
type Subscriber = (event: AuditEvent) => void;
const subscribers = new Map<string, Set<Subscriber>>();

export function publishAuditEvent(
  auditId: string,
  phase: AuditPhase,
  message: string,
): void {
  const event: AuditEvent = { ts: Date.now(), phase, message };
  const buf = buffers.get(auditId) ?? [];
  buf.push(event);
  if (buf.length > BUFFER_LIMIT) buf.splice(0, buf.length - BUFFER_LIMIT);
  buffers.set(auditId, buf);

  const subs = subscribers.get(auditId);
  if (subs) {
    for (const sub of subs) {
      try {
        sub(event);
      } catch (err) {
        logger.warn(
          { auditId, err: err instanceof Error ? err.message : err },
          "SSE subscriber threw",
        );
      }
    }
  }

  // Drop the buffer once we reach a terminal state and there are no
  // active subscribers, to avoid unbounded memory growth.
  if ((phase === "done" || phase === "error") && (!subs || subs.size === 0)) {
    setTimeout(() => {
      const stillSubs = subscribers.get(auditId);
      if (!stillSubs || stillSubs.size === 0) buffers.delete(auditId);
    }, 30_000);
  }
}

export function getBufferedEvents(auditId: string): AuditEvent[] {
  return buffers.get(auditId) ?? [];
}

/**
 * Drop the buffered events for an audit (used when the user re-runs the
 * pipeline so subscribers don't see stale phases from the previous run).
 */
export function resetAuditEvents(auditId: string): void {
  buffers.delete(auditId);
}

export function subscribeAuditEvents(
  auditId: string,
  cb: Subscriber,
): () => void {
  const set = subscribers.get(auditId) ?? new Set<Subscriber>();
  set.add(cb);
  subscribers.set(auditId, set);
  return () => {
    const s = subscribers.get(auditId);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) subscribers.delete(auditId);
  };
}
