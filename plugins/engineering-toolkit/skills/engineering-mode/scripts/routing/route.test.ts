import { describe, expect, it } from "bun:test";
import * as routeDomain from "./route.ts";
import { modelSlug, route } from "./route.ts";

describe("route constructor", () => {
  it("keeps the app, model, and effort it was given", () => {
    const model = modelSlug("grok-4.7");
    if (!model.ok) throw new Error("expected valid model");

    expect(route({ model: model.value, app: "cursor", effort: "high" })).toEqual({
      model: model.value,
      app: "cursor",
      effort: "high",
    });
  });
});

describe("modelSlug", () => {
  it("rejects empty and whitespace-only values", () => {
    expect(modelSlug("")).toEqual({
      ok: false,
      error: { tag: "invalid-model-slug", raw: "" },
    });
    expect(modelSlug(" \t")).toEqual({
      ok: false,
      error: { tag: "invalid-model-slug", raw: " \t" },
    });
  });

  it("normalizes versioned rolling Claude aliases", () => {
    const fable = modelSlug("claude-fable-9-9");
    const opus = modelSlug("claude-opus-4-6");
    if (!fable.ok || !opus.ok) throw new Error("expected valid aliases");

    expect(fable.value as string).toBe("fable");
    expect(opus.value as string).toBe("opus");
  });

  it("rejects other versioned Claude pins", () => {
    expect(modelSlug("claude-sonnet-4-5")).toEqual({
      ok: false,
      error: { tag: "invalid-model-slug", raw: "claude-sonnet-4-5" },
    });
  });

  it("does not treat a model slug as an app id", () => {
    const model = modelSlug("grok");
    expect(model.ok).toBe(true);
    if (!model.ok) return;

    expect(route({ model: model.value, app: "codex", effort: "low" }).app).toBe("codex");
  });

  it("does not export a Provider identifier", () => {
    expect("Provider" in routeDomain).toBe(false);
  });
});
