import { describe, expect, it } from "bun:test";
import {
  currentHost,
  destinationDefault,
  explicitEffort,
  modelSlug,
  namedApp,
  route,
} from "./route.ts";
import { loadRoleMap, printRoleMap } from "./sheet.ts";

const roles = [
  "feature, refactoring",
  "bug-fix",
  "perf-issue",
  "hillclimb",
  "judgment and prose",
  "hardest tasks",
  "how explorer",
  "how explainer",
  "why investigators, synthesizer",
  "reflect tooling, judgment, divergent, synthesizer",
  "arena runners",
  "arena cross-judge pool",
  "architect runners",
  "interrogate reviewers",
  "swarm workers",
] as const;

function sheet(values: Partial<Record<(typeof roles)[number], string>> = {}): string {
  return [
    "# Engineering Toolkit model configuration",
    "Descriptor grammar: 2",
    ...roles.map((role) => `${role}: ${values[role] ?? "inherit-parent"}`),
  ].join("\n");
}

function routeValue(model: string, app = currentHost(), effort = destinationDefault()) {
  const parsed = modelSlug(model);
  if (!parsed.ok) throw new Error("invalid test model");
  return { kind: "route" as const, route: route({ model: parsed.value, app, effort }) };
}

describe("sheet grammar 2", () => {
  it("defaults omitted app and effort", () => {
    const result = loadRoleMap(sheet({ "feature, refactoring": "fable" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value["feature, refactoring"]).toEqual(routeValue("fable"));
  });

  it("parses a named grok app with a destination default", () => {
    const result = loadRoleMap(sheet({ "feature, refactoring": "grok/grok-4.6" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value["feature, refactoring"]).toEqual(
      routeValue("grok-4.6", namedApp("grok"))
    );
  });

  it("parses a named Claude app with explicit effort", () => {
    const result = loadRoleMap(sheet({ "feature, refactoring": "claude-code/fable@high" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value["feature, refactoring"]).toEqual(
      routeValue("fable", namedApp("claude-code"), explicitEffort("high"))
    );
  });

  it("rejects a provider-qualified descriptor in grammar 2", () => {
    expect(loadRoleMap(sheet({ "feature, refactoring": "claude:fable@max" }))).toEqual({
      ok: false,
      error: { tag: "invalid-descriptor", role: "feature, refactoring", raw: "claude:fable@max" },
    });
  });

  it("parses inherit-parent and auto", () => {
    const result = loadRoleMap(
      sheet({
        "feature, refactoring": "inherit-parent",
        "bug-fix": "auto",
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value["feature, refactoring"]).toEqual({ kind: "inherit-parent" });
    expect(result.value["bug-fix"]).toEqual({ kind: "auto" });
  });
});

describe("sheet grammar 1 migration", () => {
  const v1 = [
    "# Engineering Toolkit model configuration",
    "feature, refactoring: grok:grok-4.6@xhigh",
    "bug-fix: codex:gpt-5.6-sol@max",
    "perf-issue: codex:gpt-5.6-sol@max",
    "hillclimb: codex:gpt-5.6-sol@max",
    "judgment and prose: claude:fable@max",
    "hardest tasks: claude:fable@max",
    "how explorer: grok:grok-4.6@xhigh",
    "how explainer: claude:fable@max",
    "why investigators, synthesizer: inherit-parent",
    "reflect tooling, judgment, divergent, synthesizer: inherit-parent",
    "arena runners: claude:fable@max, codex:gpt-5.6-sol@max, grok:grok-4.6@xhigh, claude:opus@xhigh",
    "arena cross-judge pool: claude:fable@max, codex:gpt-5.6-sol@max, grok:grok-4.6@xhigh, claude:opus@xhigh",
    "swarm workers: grok:grok-4.6@xhigh",
    "architect runners: claude:fable@max, codex:gpt-5.6-sol@max, grok:grok-4.6@xhigh, claude:opus@xhigh",
    "interrogate reviewers: claude:fable@max, codex:gpt-5.6-sol@max, grok:grok-4.6@xhigh, claude:opus@xhigh",
  ].join("\n");

  it("migrates provider rows to named apps and preserves inheritance", () => {
    const result = loadRoleMap(v1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value["feature, refactoring"]).toEqual(
      routeValue("grok-4.6", namedApp("grok"), explicitEffort("xhigh"))
    );
    expect(result.value["bug-fix"]).toEqual(
      routeValue("gpt-5.6-sol", namedApp("codex"), explicitEffort("max"))
    );
    expect(result.value["judgment and prose"]).toEqual(
      routeValue("fable", namedApp("claude-code"), explicitEffort("max"))
    );
    expect(result.value["why investigators, synthesizer"]).toEqual({ kind: "inherit-parent" });
  });

  it("prints migrated routes with grammar 2 app/model wire", () => {
    const result = loadRoleMap(v1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const printed = printRoleMap(result.value);
    expect(printed).toContain("Descriptor grammar: 2");
    expect(printed).toContain("feature, refactoring: grok/grok-4.6@xhigh");
    expect(printed).not.toContain("grok:grok-4.6@xhigh");
  });
});

describe("sheet validation and round trips", () => {
  it("round-trips a grammar 2 map", () => {
    const initial = loadRoleMap(
      sheet({
        "feature, refactoring": "fable",
        "bug-fix": "claude-code/fable@high",
        "arena runners": "grok/grok-4.6, auto",
      })
    );
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    expect(loadRoleMap(printRoleMap(initial.value))).toEqual(initial);
  });

  it("rejects a route saved for an MCP-bound role", () => {
    expect(
      loadRoleMap(sheet({ "why investigators, synthesizer": "fable" }))
    ).toEqual({
      ok: false,
      error: {
        tag: "mcp-bound-must-inherit",
        role: "why investigators, synthesizer",
      },
    });
  });

  it("requires every documented role", () => {
    const incomplete = roles
      .filter((role) => role !== "bug-fix")
      .map((role) => `${role}: inherit-parent`)
      .join("\n");
    expect(loadRoleMap(`Descriptor grammar: 2\n${incomplete}`)).toEqual({
      ok: false,
      error: { tag: "missing-role", role: "bug-fix" },
    });
  });
});
