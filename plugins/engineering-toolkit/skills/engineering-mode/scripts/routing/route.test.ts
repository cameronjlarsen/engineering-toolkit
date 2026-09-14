import { describe, expect, it } from "bun:test";
import * as routeDomain from "./route.ts";
import {
  currentHost,
  destinationDefault,
  explicitEffort,
  modelSlug,
  namedApp,
  route,
} from "./route.ts";

describe("route constructors", () => {
  it("defaults the app to the current host", () => {
    const model = modelSlug("fable");
    if (!model.ok) throw new Error("expected valid model");

    expect(route({ model: model.value }).app).toEqual(currentHost());
  });

  it("defaults effort to the destination default", () => {
    const model = modelSlug("fable");
    if (!model.ok) throw new Error("expected valid model");

    expect(route({ model: model.value }).effort).toEqual(destinationDefault());
  });

  it("keeps a named app explicit", () => {
    const model = modelSlug("grok-4.6");
    if (!model.ok) throw new Error("expected valid model");

    expect(route({ model: model.value, app: namedApp("grok") }).app).toEqual(
      namedApp("grok")
    );
  });

  it("keeps an explicit effort", () => {
    const model = modelSlug("fable");
    if (!model.ok) throw new Error("expected valid model");

    expect(route({ model: model.value, effort: explicitEffort("high") }).effort).toEqual(
      explicitEffort("high")
    );
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

    expect(route({ model: model.value }).app).toEqual(currentHost());
  });

  it("does not export a Provider identifier", () => {
    expect("Provider" in routeDomain).toBe(false);
  });
});
