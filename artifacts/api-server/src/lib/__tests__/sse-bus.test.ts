import { describe, it, expect, beforeEach } from "vitest";
import {
  publishAuditEvent,
  subscribeAuditEvents,
  getBufferedEvents,
} from "../sse-bus";

function uniqueId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

describe("sse-bus", () => {
  it("buffers events in order for late subscribers (replay)", () => {
    const id = uniqueId("buf");
    publishAuditEvent(id, "ingesting", "step 1");
    publishAuditEvent(id, "detecting-stack", "step 2");
    publishAuditEvent(id, "calling-llm", "step 3");

    const buffered = getBufferedEvents(id);
    expect(buffered.map((e) => e.phase)).toEqual([
      "ingesting",
      "detecting-stack",
      "calling-llm",
    ]);
    // Timestamps must be monotonically non-decreasing
    for (let i = 1; i < buffered.length; i++) {
      expect(buffered[i].ts).toBeGreaterThanOrEqual(buffered[i - 1].ts);
    }
  });

  it("delivers subsequent events to subscribers in order", () => {
    const id = uniqueId("sub");
    const received: string[] = [];
    const unsubscribe = subscribeAuditEvents(id, (ev) => {
      received.push(ev.phase);
    });
    publishAuditEvent(id, "ingesting", "a");
    publishAuditEvent(id, "running-smoke", "b");
    publishAuditEvent(id, "done", "c");
    unsubscribe();
    expect(received).toEqual(["ingesting", "running-smoke", "done"]);
  });

  it("isolates buffers and subscribers per auditId", () => {
    const a = uniqueId("a");
    const b = uniqueId("b");
    publishAuditEvent(a, "ingesting", "for a");
    expect(getBufferedEvents(a).length).toBe(1);
    expect(getBufferedEvents(b).length).toBe(0);

    const got: string[] = [];
    const unsubA = subscribeAuditEvents(a, (e) => got.push(`a:${e.phase}`));
    const unsubB = subscribeAuditEvents(b, (e) => got.push(`b:${e.phase}`));
    publishAuditEvent(a, "done", "ok");
    publishAuditEvent(b, "error", "no");
    unsubA();
    unsubB();
    expect(got).toEqual(["a:done", "b:error"]);
  });
});
