import { describe, expect, it } from "vitest";
import { isPrivateIp } from "../smoke-runner";

describe("smoke-runner SSRF IP guard", () => {
  it("blocks IPv4 private, metadata, documentation, and multicast ranges", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.2.3.4")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true);
    expect(isPrivateIp("192.0.2.10")).toBe(true);
    expect(isPrivateIp("224.0.0.1")).toBe(true);
  });

  it("blocks IPv6 loopback, mapped IPv4, local, documentation, and multicast ranges", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("::ffff:7f00:1")).toBe(true);
    expect(isPrivateIp("fe90::1")).toBe(true);
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("2001:db8::1")).toBe(true);
    expect(isPrivateIp("ff02::1")).toBe(true);
  });

  it("allows ordinary public addresses", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
  });
});
