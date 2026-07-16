import { describe, expect, it } from "vitest";
import { STUI_JSON_LD, STUI_RELEASE } from "../stui-release";

describe("stui release metadata", () => {
  it("keeps the public release contract on v2.2.0", () => {
    expect(STUI_RELEASE).toMatchObject({
      version: "2.2.0",
      releaseDateIso: "2026-07-11",
      installCommand: expect.stringContaining("stui-terminal==2.2.0"),
    });
    expect(STUI_JSON_LD).toMatchObject({
      "@id": "https://marmarlabs.com/stui#software",
      softwareVersion: STUI_RELEASE.version,
      runtimePlatform: "Python 3.11+",
    });
    expect(STUI_JSON_LD).not.toHaveProperty("operatingSystem");
  });
});
