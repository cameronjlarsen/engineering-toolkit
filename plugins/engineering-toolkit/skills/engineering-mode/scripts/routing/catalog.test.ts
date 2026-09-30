import { describe, expect, it } from "bun:test";
import { cliModelFor, launchableApps, shippedCatalog, soleModel, SOL_CLI_MODEL } from "./catalog.ts";

describe("shipped catalog", () => {
  it("contains the four shipped apps", () => {
    expect([...shippedCatalog().keys()]).toEqual(["claude-code", "codex", "grok", "cursor"]);
  });

  it("does not serve fable from grok", () => {
    expect(shippedCatalog().get("grok")?.models.has("fable" as never)).toBe(false);
  });

  it("serves fixed Sonnet 5.5 natively through Claude Code and Cursor", () => {
    const catalog = shippedCatalog();
    const claudeSonnet = catalog.get("claude-code")?.models.get("claude-sonnet-5-5" as never);
    expect(claudeSonnet).toMatchObject({
      family: "claude-sonnet-5-5",
      vendor: "anthropic",
      efforts: ["low", "medium", "high", "xhigh", "max"],
      cli: { effort: "flag", model: "claude-sonnet-5-5" },
      nativeStem: "sonnet",
    });
    const cursorSonnet = catalog.get("cursor")?.models.get("claude-sonnet-5-5" as never);
    expect(cursorSonnet).toMatchObject({
      family: "claude-sonnet-5-5",
      nativeStem: "sonnet",
    });
    if (cursorSonnet === undefined) throw new Error("missing Cursor Sonnet model");
    expect(cliModelFor(cursorSonnet, "xhigh")).toBe("claude-sonnet-5-5-xhigh");
    expect(catalog.get("codex")?.models.has("claude-sonnet-5-5" as never)).toBe(false);
    expect(catalog.get("grok")?.models.has("claude-sonnet-5-5" as never)).toBe(false);
  });

  it("makes Cursor a launchable app that serves Fable, Opus, Sonnet, and Grok", () => {
    const cursor = shippedCatalog().get("cursor");
    expect(cursor?.launch).toBe("cli-auth");
    expect([...(cursor?.models.keys() ?? [])].map(String).sort()).toEqual([
      "claude-sonnet-5-5",
      "fable",
      "grok-4.7",
      "opus",
    ]);
    expect(cursor?.models.get("grok-4.7" as never)?.nativeStem).toBeNull();
  });

  it("puts the effort in Cursor slugs and keeps a flag for CLI apps", () => {
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

  it("lists per-entry efforts, and Cursor Grok stops at xhigh", () => {
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

  it("exposes every app, Cursor included, as a CLI child", () => {
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
