import { describe, expect, it } from "bun:test";
import { shippedCatalog } from "./catalog.ts";
import { applyOverride, planLane } from "./dispatch.ts";
import {
  currentHost,
  explicitEffort,
  modelSlug,
  namedApp,
  route,
  type Access,
  type AppInventoryEntry,
  type RoleBinding,
} from "./route.ts";

const access: Access = { mode: "read-only", worktree: null };

function model(raw: string) {
  const result = modelSlug(raw);
  if (!result.ok) throw new Error(`invalid test model: ${raw}`);
  return result.value;
}

function inventory(app: AppInventoryEntry["app"], readiness: AppInventoryEntry["readiness"]): AppInventoryEntry {
  return { app, readiness };
}

function routeBinding(raw: string, app = currentHost(), effort = explicitEffort("high" as const)): RoleBinding {
  return { kind: "route", route: route({ model: model(raw), app, effort }) };
}

describe("dispatch", () => {
  it("plans an omitted-app route as native on the parent", () => {
    const result = planLane({
      parent: "claude-code",
      binding: routeBinding("fable"),
      override: undefined,
      catalog: shippedCatalog(),
      inventory: [inventory("claude-code", { kind: "launch-ready" })],
      access,
      role: "feature, refactoring",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe("native");
    if (result.value.kind === "native" && result.value.inherit !== true) {
      expect(result.value.route.app).toBe("claude-code");
    }
  });

  it("plans a named grok route as external", () => {
    const result = planLane({
      parent: "claude-code",
      binding: routeBinding("grok-4.6", namedApp("grok"), explicitEffort("xhigh")),
      override: undefined,
      catalog: shippedCatalog(),
      inventory: [inventory("grok", { kind: "launch-ready" })],
      access,
      role: "arena runners",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe("external");
    if (result.value.kind === "external") expect(result.value.route.app).toBe("grok");
  });

  it("rejects an unknown destination default", () => {
    const result = planLane({
      parent: "claude-code",
      binding: { kind: "route", route: route({ model: model("fable") }) },
      override: undefined,
      catalog: shippedCatalog(),
      inventory: [inventory("claude-code", { kind: "launch-ready" })],
      access,
      role: "feature, refactoring",
    });
    expect(result).toEqual({
      ok: false,
      error: { tag: "destination-default-unknown", app: "claude-code", model: model("fable") },
    });
  });

  it("rejects an external override for Why", () => {
    const result = planLane({
      parent: "claude-code",
      binding: { kind: "inherit-parent" },
      override: { app: namedApp("grok") },
      catalog: shippedCatalog(),
      inventory: [],
      access,
      role: "why investigators, synthesizer",
    });
    expect(result).toEqual({
      ok: false,
      error: { tag: "unsupported-external-override", role: "why investigators, synthesizer" },
    });
  });

  it("rejects an inherit effort-only override", () => {
    const result = applyOverride(
      { kind: "inherit-parent" },
      { effort: explicitEffort("high") },
      "feature, refactoring"
    );
    expect(result).toEqual({
      ok: false,
      error: { tag: "inherit-does-not-accept-partial-effort" },
    });
  });

  it("plans inherit-parent without consulting the catalog", () => {
    const result = planLane({
      parent: "codex",
      binding: { kind: "inherit-parent" },
      override: undefined,
      catalog: new Map(),
      inventory: [],
      access,
      role: "feature, refactoring",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      kind: "native",
      parent: "codex",
      inherit: true,
      access,
      worker: {
        mayChooseRoute: false,
        maySpawnAgents: false,
        inheritCoordinatorMcp: false,
      },
    });
  });

  it("rejects unknown readiness for a selected external app", () => {
    const result = planLane({
      parent: "claude-code",
      binding: routeBinding("grok-4.6", namedApp("grok")),
      override: undefined,
      catalog: shippedCatalog(),
      inventory: [],
      access,
      role: "arena runners",
    });
    expect(result).toEqual({ ok: false, error: { tag: "readiness-unknown", app: "grok" } });
  });

  it("rejects cursor as an unlistable child without substituting another app", () => {
    const result = planLane({
      parent: "claude-code",
      binding: routeBinding("fable", namedApp("cursor")),
      override: undefined,
      catalog: shippedCatalog(),
      inventory: [inventory("cursor", { kind: "launch-ready" })],
      access,
      role: "feature, refactoring",
    });
    expect(result).toEqual({
      ok: false,
      error: { tag: "no-launch-interface", app: "cursor" },
    });
  });

  it("plans omitted-app fable as native on a cursor parent", () => {
    const result = planLane({
      parent: "cursor",
      binding: routeBinding("fable"),
      override: undefined,
      catalog: shippedCatalog(),
      inventory: [],
      access,
      role: "architect runners",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe("native");
    if (result.value.kind === "native" && result.value.inherit !== true) {
      expect(result.value.route.app).toBe("cursor");
    }
  });

  it("plans named claude-code fable as external from a cursor parent", () => {
    const result = planLane({
      parent: "cursor",
      binding: routeBinding("fable", namedApp("claude-code")),
      override: undefined,
      catalog: shippedCatalog(),
      inventory: [inventory("claude-code", { kind: "launch-ready" })],
      access,
      role: "architect runners",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe("external");
    if (result.value.kind === "external") expect(result.value.launch.app).toBe("claude-code");
  });
});
