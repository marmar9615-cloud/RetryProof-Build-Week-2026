import { describe, expect, it } from "vitest";

import { stageFor } from "../retryproof-lab";

type ProgressState = Parameters<typeof stageFor>[0];

describe("RetryProof lab progress", () => {
  it("keeps a loaded workflow on the Import step until analysis finishes", () => {
    expect(stageFor({ workflow: {} } as ProgressState)).toBe(1);
  });

  it("advances only when each stage has produced its required artifact", () => {
    expect(stageFor({})).toBe(1);
    expect(stageFor({ analysis: {} } as ProgressState)).toBe(2);
    expect(stageFor({ approved: {} } as ProgressState)).toBe(3);
    expect(stageFor({ before: {} } as ProgressState)).toBe(4);
    expect(stageFor({ repair: {} } as ProgressState)).toBe(4);
    expect(stageFor({ artifact: {} } as ProgressState)).toBe(5);
  });
});
