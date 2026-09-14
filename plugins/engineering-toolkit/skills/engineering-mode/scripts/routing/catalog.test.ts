import { describe, expect, it } from "bun:test";
import { launchableApps, launchHome, shippedCatalog } from "./catalog.ts";

describe("shipped catalog", () => {
  it("contains the four shipped apps", () => {
    expect([...shippedCatalog().keys()]).toEqual(["claude-code", "codex", "grok", "cursor"]);
  });

  it("does not serve fable from grok", () => {
    expect(shippedCatalog().get("grok")?.models.has("fable" as never)).toBe(false);
  });

  it("makes cursor a parent that serves plugin agents and grok natively and cannot be launched", () => {
    const catalog = shippedCatalog();
    const cursor = catalog.get("cursor");
    const claude = catalog.get("claude-code");
    const grok = catalog.get("grok")?.models.get("grok-4.6" as never);
    expect(cursor?.launch).toBe("none");
    expect(cursor?.models.get("fable" as never)).toEqual(claude?.models.get("fable" as never));
    expect(cursor?.models.get("opus" as never)).toEqual(claude?.models.get("opus" as never));
    expect(cursor?.models.get("grok-4.6" as never)).toEqual(grok);
    expect(grok?.nativeStem).toBeNull();
  });

  it("exposes only CLI children as launchable apps", () => {
    expect(launchableApps()).toEqual(["claude-code", "codex", "grok"]);
  });

  it("names one CLI home per shipped model slug", () => {
    const catalog = shippedCatalog();
    const fable = catalog.get("claude-code")?.models.get("fable" as never);
    const sol = catalog.get("codex")?.models.get("gpt-5.6-sol" as never);
    const grok = catalog.get("grok")?.models.get("grok-4.6" as never);
    if (!fable || !sol || !grok) throw new Error("missing shipped models");
    expect(launchHome(fable.slug, catalog)).toBe("claude-code");
    expect(launchHome(sol.slug, catalog)).toBe("codex");
    expect(launchHome(grok.slug, catalog)).toBe("grok");
  });

  it("keeps fable destination default unknown", () => {
    const fable = shippedCatalog().get("claude-code")?.models.get("fable" as never);
    expect(fable?.destinationDefaultEffort).toEqual({ kind: "unknown" });
  });
});
