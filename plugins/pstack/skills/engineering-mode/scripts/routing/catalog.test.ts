import { describe, expect, it } from "bun:test";
import { shippedCatalog } from "./catalog.ts";

describe("shipped catalog", () => {
  it("contains the four shipped apps", () => {
    expect([...shippedCatalog().keys()]).toEqual(["claude-code", "codex", "grok", "cursor"]);
  });

  it("does not serve fable from grok", () => {
    expect(shippedCatalog().get("grok")?.models.has("fable" as never)).toBe(false);
  });

  it("does not make cursor a parent or give it a launch interface", () => {
    const cursor = shippedCatalog().get("cursor");
    expect(cursor?.parentEligible).toBe(false);
    expect(cursor?.launch).toBe("none");
  });

  it("keeps fable destination default unknown", () => {
    const fable = shippedCatalog().get("claude-code")?.models.get("fable" as never);
    expect(fable?.destinationDefaultEffort).toEqual({ kind: "unknown" });
  });
});
