import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cliModelFor, shippedCatalog } from "./catalog.ts";
import { parseCursorModels } from "./cursor-catalog.ts";
import { resolveRoute } from "./dispatch.ts";
import { route, type ModelSlug, type ProbedModel } from "./route.ts";

const FIXTURE = readFileSync(join(import.meta.dir, "fixtures/cursor-agent-models.txt"), "utf8");

function parsed(): readonly ProbedModel[] {
  const result = parseCursorModels(FIXTURE);
  if (!result.ok) throw new Error(result.error.tag);
  return result.value;
}

function family(slug: string): ProbedModel | undefined {
  return parsed().find((model) => model.slug === slug);
}

describe("parseCursorModels", () => {
  it("derives grok-4.7 as the shipped in-slug template without max or fast efforts", () => {
    const shipped = shippedCatalog().get("cursor")?.models.get("grok-4.7" as ModelSlug);
    expect(family("grok-4.7")).toEqual({
      slug: "grok-4.7" as ModelSlug,
      selectableEfforts: shipped?.efforts ?? [],
      cli: shipped?.cli ?? { effort: "flag", model: "" },
    });
  });

  it("lists every shipped Cursor slug for every shipped effort", () => {
    const slugs = new Set(FIXTURE.split(/\r?\n/).map((line) => line.split(" - ")[0]));
    for (const entry of shippedCatalog().get("cursor")?.models.values() ?? []) {
      for (const effort of entry.efforts) {
        expect(slugs.has(cliModelFor(entry, effort))).toBe(true);
      }
    }
  });

  it("skips versioned Claude families, which normalize to rolling aliases or are invalid", () => {
    const slugs = parsed().map((model) => model.slug);
    for (const skipped of ["claude-opus-5-5", "claude-opus-4-8", "claude-fable-5-1", "claude-sonnet-5", "opus", "fable"]) {
      expect(slugs).not.toContain(skipped);
    }
  });

  it("reads an unshipped family with its template and non-fast efforts", () => {
    expect(family("claude-fable-5-1-thinking")).toEqual({
      slug: "claude-fable-5-1-thinking" as ModelSlug,
      selectableEfforts: ["low", "medium", "high", "xhigh", "max"],
      cli: { effort: "in-slug", model: "claude-fable-5-1-thinking-{effort}" },
    });
    expect(family("cursor-grok-4.6")?.selectableEfforts).toEqual(["high"]);
    expect(family("gpt-5.6-luna")).toBeUndefined();
  });

  it("ignores slugs without an effort suffix and efforts outside the universe", () => {
    const slugs = parsed().map((model) => model.slug);
    for (const skipped of ["auto", "gpt-5.3-codex", "composer-2.5", "gpt-5.6-sol", "muse-spark-1.3", "claude-4.6-opus-high-thinking"]) {
      expect(slugs).not.toContain(skipped);
    }
    expect(family("gpt-5.5-extra")).toEqual({
      slug: "gpt-5.5-extra" as ModelSlug,
      selectableEfforts: ["high"],
      cli: { effort: "in-slug", model: "gpt-5.5-extra-{effort}" },
    });
  });

  it("rejects text that is not a model list", () => {
    expect(parseCursorModels("Error: not logged in")).toEqual({
      ok: false,
      error: { tag: "invalid-cursor-model-list" },
    });
  });

  it("lets dispatch accept an unshipped Cursor family only at a listed effort", () => {
    const slug = "claude-fable-5-1-thinking" as ModelSlug;
    const inventory = [
      { app: "cursor" as const, readiness: { kind: "launch-ready" as const }, probedModels: parsed() },
    ];
    expect(
      resolveRoute("claude-code", route({ model: slug, app: "cursor", effort: "max" }), shippedCatalog(), inventory)
    ).toEqual({ ok: true, value: { model: slug, app: "cursor", effort: "max", lane: "external" } });
    const grok46 = "cursor-grok-4.6" as ModelSlug;
    expect(
      resolveRoute("claude-code", route({ model: grok46, app: "cursor", effort: "low" }), shippedCatalog(), inventory)
    ).toEqual({
      ok: false,
      error: { tag: "effort-not-selectable", app: "cursor", model: grok46, effort: "low" },
    });
  });
});
