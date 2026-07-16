import { describe, expect, it } from "vitest";
import { hmacHash, normalizeIp, trustedRequestIp } from "../trial-identity";

describe("trial identity helpers", () => {
  it("normalizes forwarded IP values without storing raw request headers", () => {
    expect(normalizeIp("203.0.113.10, 10.0.0.1")).toBe("203.0.113.10");
    expect(normalizeIp("::ffff:198.51.100.4")).toBe("198.51.100.4");
    expect(normalizeIp("192.0.2.7:443")).toBe("192.0.2.7");
    expect(normalizeIp(undefined)).toBe("unknown");
  });

  it("hashes trial identifiers with the configured secret", () => {
    const first = hmacHash("visitor-token", "secret-a");
    expect(first).toHaveLength(43);
    expect(hmacHash("visitor-token", "secret-a")).toBe(first);
    expect(hmacHash("visitor-token", "secret-b")).not.toBe(first);
  });

  it("does not trust spoofable x-forwarded-for headers for trial identity", () => {
    expect(
      trustedRequestIp({
        socketRemoteAddress: "203.0.113.20",
        expressIp: "198.51.100.10",
      }),
    ).toBe("203.0.113.20");
  });
});
