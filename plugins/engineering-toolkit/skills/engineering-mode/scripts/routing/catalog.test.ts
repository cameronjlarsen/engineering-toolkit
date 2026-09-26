import { describe, expect, it } from "bun:test";
import { cliModelFor, launchableApps, shippedCatalog, soleModel, SOL_CLI_MODEL } from "./catalog.ts";

describe("shipped catalog", () => {
  it("contains the four shipped apps", () => {
    expect([...shippedCatalog().keys()]).toEqual(["claude-code", "codex", "grok", "cursor"]);
  });

  it("does not serve fable from grok", () => {
    expect(shippedCatalog().get("grok")?.models.has("fable" as never)).toBe(false);
  });

  it("makes cursor a launchable app that serves fable, opus, and grok by family name", () => {
    const cursor = shippedCatalog().get("cursor");
    expect(cursor?.launch).toBe("cli-auth");
    expect([...(cursor?.models.keys() ?? [])].map(String).sort()).toEqual(["fable", "grok-4.7", "opus"]);
    expect(cursor?.models.get("grok-4.7" as never)?.nativeStem).toBeNull();
  });

  it("puts the effort in the Cursor slug and keeps a flag elsewhere", () => {
    const catalog = shippedCatalog();
    const cursorOpus = catalog.get("cursor")?.models.get("opus" as never);
    const cursorFable = catalog.get("cursor")?.models.get("fable" as never);
    const cursorGrok = catalog.get("cursor")?.models.get("grok-4.7" as never);
    const claudeOpus = catalog.get("claude-code")?.models.get("opus" as never);
    if (!cursorOpus || !cursorFable || !cursorGrok || !claudeOpus) throw new Error("missing models");
    expect(cliModelFor(cursorOpus, "medium")).toBe("claude-opus-5-5-medium");
    expect(cliModelFor(cursorFable, "max")).toBe("claude-fable-5-1-max");
    expect(cliModelFor(cursorGrok, "high")).toBe("grok-4.7-high");
    expect(cliModelFor(claudeOpus, "high")).toBe("opus");
  });

  it("lists per-entry efforts, and Cursor grok stops at xhigh", () => {
    const catalog = shippedCatalog();
    expect(catalog.get("cursor")?.models.get("grok-4.7" as never)?.efforts).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(catalog.get("cursor")?.models.get("opus" as never)?.efforts).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ]);
    expect(catalog.get("grok")?.models.get("grok-4.7" as never)?.efforts).toContain("max");
  });

  it("exposes every app, cursor included, as a CLI child", () => {
    expect(launchableApps()).toEqual(["claude-code", "codex", "cursor", "grok"]);
  });

  it("reports the sole model only when an app serves exactly one", () => {
    const catalog = shippedCatalog();
    expect(catalog.get("codex")?.models.get(SOL_CLI_MODEL)?.family).toBe(SOL_CLI_MODEL);
    expect(soleModel("codex", catalog)).toBe(SOL_CLI_MODEL);
    expect(String(soleModel("grok", catalog))).toBe("grok-4.7");
    expect(soleModel("claude-code", catalog)).toBeNull();
    expect(soleModel("cursor", catalog)).toBeNull();
  });
});
