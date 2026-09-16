import { describe, expect, it } from "bun:test";
import { classifyNativeCapacity, classifyProcessFailure } from "./capacity.ts";

describe("classifyProcessFailure", () => {
  it("classifies quota text as capacity-exhausted before auth markers", () => {
    expect(
      classifyProcessFailure({
        exitCode: 1,
        combinedText: "usage limit exceeded; not logged in",
      })
    ).toBe("capacity-exhausted");
    expect(
      classifyProcessFailure({
        exitCode: 1,
        combinedText: "HTTP 429 too many requests; authentication required",
      })
    ).toBe("capacity-exhausted");
  });

  it("still classifies auth-only text as unauthenticated", () => {
    expect(
      classifyProcessFailure({
        exitCode: 1,
        combinedText: "Not logged in. Run grok auth login.",
      })
    ).toBe("unauthenticated");
  });

  it("does not treat unmatched text as capacity", () => {
    expect(
      classifyProcessFailure({ exitCode: 1, combinedText: "" })
    ).toBe("child-failed");
    expect(
      classifyProcessFailure({
        exitCode: 1,
        combinedText: "segmentation fault",
      })
    ).toBe("child-failed");
  });
});

describe("classifyNativeCapacity", () => {
  it("uses DropoutClass names for quota and unmatched native errors", () => {
    expect(
      classifyNativeCapacity({
        message: "Task failed",
        evidence: "resource exhausted",
      })
    ).toBe("capacity");
    expect(
      classifyNativeCapacity({
        message: "Agent failed",
        evidence: "tool error",
      })
    ).toBe("child-failed");
  });
});
