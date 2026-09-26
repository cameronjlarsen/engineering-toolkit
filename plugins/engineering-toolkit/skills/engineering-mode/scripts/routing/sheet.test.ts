import { describe, expect, it } from "bun:test";
import { shippedCatalog } from "./catalog.ts";
import {
  modelSlug,
  route,
  type AppId,
  type Effort,
  type RoleMap,
} from "./route.ts";
import {
  applyBudget,
  loadRoleMap,
  parseBudgetLine,
  printRoleMap,
} from "./sheet.ts";

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

function sheet(
  values: Partial<Record<(typeof roles)[number], string>> = {},
  grammar = "3"
): string {
  return [
    "# Engineering Toolkit model configuration",
    `Descriptor grammar: ${grammar}`,
    ...roles.map((role) => `${role}: ${values[role] ?? "inherit-parent"}`),
  ].join("\n");
}

function routeValue(model: string, app: AppId, effort: Effort) {
  const parsed = modelSlug(model);
  if (!parsed.ok) throw new Error("invalid test model");
  return { kind: "route" as const, route: route({ model: parsed.value, app, effort }) };
}

describe("sheet grammar 3", () => {
  it("parses provider:model@effort for every provider", () => {
    const result = loadRoleMap(
      sheet({
        "feature, refactoring": "claude:opus@medium",
        "bug-fix": "codex:gpt-6-sol@high",
        "how explorer": "cursor:grok-4.7@high",
        "how explainer": "grok:grok-4.7@xhigh",
      }),
      "claude-code"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value["feature, refactoring"]).toEqual(routeValue("opus", "claude-code", "medium"));
    expect(result.value["bug-fix"]).toEqual(routeValue("gpt-6-sol", "codex", "high"));
    expect(result.value["how explorer"]).toEqual(routeValue("grok-4.7", "cursor", "high"));
    expect(result.value["how explainer"]).toEqual(routeValue("grok-4.7", "grok", "xhigh"));
  });

  it("names the same family on two providers without rewriting it", () => {
    const result = loadRoleMap(
      sheet({ "arena runners": "claude:opus@high, cursor:opus@high" }),
      "codex"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value["arena runners"]).toEqual([
      routeValue("opus", "claude-code", "high"),
      routeValue("opus", "cursor", "high"),
    ]);
  });

  it("requires an effort", () => {
    expect(loadRoleMap(sheet({ "swarm workers": "cursor:grok-4.7" }), "claude-code")).toEqual({
      ok: false,
      error: { tag: "missing-effort", role: "swarm workers", raw: "cursor:grok-4.7" },
    });
  });

  it("rejects an unknown provider and an out-of-universe effort", () => {
    expect(loadRoleMap(sheet({ "bug-fix": "openai:gpt-6-sol@high" }), "codex")).toEqual({
      ok: false,
      error: { tag: "unknown-provider", provider: "openai" },
    });
    expect(loadRoleMap(sheet({ "bug-fix": "codex:gpt-6-sol@ultra" }), "codex")).toEqual({
      ok: false,
      error: { tag: "invalid-descriptor", role: "bug-fix", raw: "codex:gpt-6-sol@ultra" },
    });
  });

  it("rejects the grammar 2 app/model form under a grammar 3 header", () => {
    expect(loadRoleMap(sheet({ "bug-fix": "codex/gpt-6-sol@high" }), "codex").ok).toBe(false);
  });

  it("parses inherit-parent and auto", () => {
    const result = loadRoleMap(
      sheet({
        "feature, refactoring": "inherit-parent",
        "bug-fix": "auto",
      }),
      "cursor"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value["feature, refactoring"]).toEqual({ kind: "inherit-parent" });
    expect(result.value["bug-fix"]).toEqual({ kind: "auto" });
  });

  it("ignores prose lines, including ones that contain a colon", () => {
    const text = [
      "# Engineering Toolkit model configuration",
      "",
      "Descriptor grammar: 3",
      "",
      "Route choices. Every role names its provider, model, and effort.",
      "Note: inherit-parent and auto count as one panel lane.",
      "how critics: claude:opus@high",
      "",
      ...roles.map((role) => `${role}: inherit-parent`),
    ].join("\n");
    expect(loadRoleMap(text, "claude-code").ok).toBe(true);
  });
});

describe("sheet grammar 2 migration", () => {
  it("gives an omitted app the parent's provider", () => {
    const text = sheet({ "feature, refactoring": "fable@max" }, "2");
    const onClaude = loadRoleMap(text, "claude-code");
    const onCursor = loadRoleMap(text, "cursor");
    expect(onClaude.ok && onClaude.value["feature, refactoring"]).toEqual(
      routeValue("fable", "claude-code", "max")
    );
    expect(onCursor.ok && onCursor.value["feature, refactoring"]).toEqual(
      routeValue("fable", "cursor", "max")
    );
  });

  it("maps the claude-code app id to the claude provider", () => {
    const result = loadRoleMap(sheet({ "bug-fix": "claude-code/fable@high" }, "2"), "codex");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value["bug-fix"]).toEqual(routeValue("fable", "claude-code", "high"));
    expect(printRoleMap(result.value)).toContain("bug-fix: claude:fable@high");
  });

  it("rejects a route without an effort so setup can ask for one", () => {
    expect(loadRoleMap(sheet({ "feature, refactoring": "grok/grok-4.7" }, "2"), "claude-code")).toEqual({
      ok: false,
      error: { tag: "missing-effort", role: "feature, refactoring", raw: "grok/grok-4.7" },
    });
  });

  it("rejects a provider-qualified descriptor in grammar 2", () => {
    expect(loadRoleMap(sheet({ "feature, refactoring": "claude:fable@max" }, "2"), "claude-code")).toEqual({
      ok: false,
      error: { tag: "invalid-descriptor", role: "feature, refactoring", raw: "claude:fable@max" },
    });
  });

  it("migrates a setup-written grammar 2 sheet with prose and prints grammar 3", () => {
    const written = [
      "# Engineering Toolkit model configuration",
      "",
      "Descriptor grammar: 2",
      "",
      "Route choices. App is omitted for opus (native on Claude Code).",
      "Fable is intentionally excluded from every role (limited Fable usage",
      "credits). Grok is not installed on this host: panel roles run 2 lanes",
      "(Codex + Opus) instead of 4 until the Grok CLI is installed and this skill",
      "is re-run. Operator override: every Opus route runs @medium; Codex routes",
      "follow the budget (@high).",
      "",
      "# budget: medium (high)",
      "feature, refactoring: opus@medium",
      "bug-fix: codex/gpt-6-sol@high",
      "perf-issue: codex/gpt-6-sol@high",
      "hillclimb: codex/gpt-6-sol@high",
      "judgment and prose: opus@medium",
      "hardest tasks: opus@medium",
      "how explorer: opus@medium",
      "how explainer: opus@medium",
      "why investigators, synthesizer: inherit-parent",
      "reflect tooling, judgment, divergent, synthesizer: inherit-parent",
      "arena runners: codex/gpt-6-sol@high, opus@medium",
      "arena cross-judge pool: codex/gpt-6-sol@high, opus@medium",
      "swarm workers: opus@medium",
      "architect runners: codex/gpt-6-sol@high, opus@medium",
      "interrogate reviewers: codex/gpt-6-sol@high, opus@medium",
      "",
    ].join("\n");
    const result = loadRoleMap(written, "claude-code");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const printed = printRoleMap(result.value);
    expect(printed).toContain("Descriptor grammar: 3");
    expect(printed).toContain("feature, refactoring: claude:opus@medium");
    expect(printed).toContain("arena runners: codex:gpt-6-sol@high, claude:opus@medium");
    expect(loadRoleMap(printed, "codex")).toEqual(result);
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

  it("migrates provider rows and preserves inheritance", () => {
    const result = loadRoleMap(v1, "claude-code");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value["feature, refactoring"]).toEqual(routeValue("grok-4.6", "grok", "xhigh"));
    expect(result.value["bug-fix"]).toEqual(routeValue("gpt-5.6-sol", "codex", "max"));
    expect(result.value["judgment and prose"]).toEqual(routeValue("fable", "claude-code", "max"));
    expect(result.value["why investigators, synthesizer"]).toEqual({ kind: "inherit-parent" });
  });

  it("prints migrated routes with a grammar 3 header", () => {
    const result = loadRoleMap(v1, "claude-code");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const printed = printRoleMap(result.value);
    expect(printed).toContain("Descriptor grammar: 3");
    expect(printed).toContain("feature, refactoring: grok:grok-4.6@xhigh");
  });

  it("does not know the cursor provider", () => {
    expect(loadRoleMap(v1.replace("swarm workers: grok:", "swarm workers: cursor:"), "claude-code")).toEqual({
      ok: false,
      error: { tag: "unknown-provider", provider: "cursor" },
    });
  });
});

describe("sheet validation and round trips", () => {
  it("round-trips a grammar 3 map", () => {
    const initial = loadRoleMap(
      sheet({
        "feature, refactoring": "claude:fable@max",
        "bug-fix": "cursor:opus@high",
        "arena runners": "grok:grok-4.7@xhigh, auto, cursor:grok-4.7@high",
      }),
      "claude-code"
    );
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    expect(loadRoleMap(printRoleMap(initial.value), "claude-code")).toEqual(initial);
  });

  it("rejects a route saved for an MCP-bound role", () => {
    expect(
      loadRoleMap(sheet({ "why investigators, synthesizer": "claude:fable@max" }), "claude-code")
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
    expect(loadRoleMap(`Descriptor grammar: 3\n${incomplete}`, "claude-code")).toEqual({
      ok: false,
      error: { tag: "missing-role", role: "bug-fix" },
    });
  });

  it("rejects a duplicate role", () => {
    const text = `${sheet()}\nbug-fix: auto`;
    expect(loadRoleMap(text, "claude-code")).toEqual({
      ok: false,
      error: { tag: "duplicate-role", role: "bug-fix" },
    });
  });
});

const ALL_EFFORTS: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];

function mustLoad(values: Partial<Record<(typeof roles)[number], string>> = {}): RoleMap {
  const result = loadRoleMap(sheet(values), "claude-code");
  if (!result.ok) throw new Error("expected a role map");
  return result.value;
}

describe("sheet budget", () => {
  it("parses unlimited and small budget lines", () => {
    expect(parseBudgetLine("# budget: unlimited (max)")).toEqual({
      ok: true,
      value: { label: "unlimited", target: "max" },
    });
    expect(parseBudgetLine("  # budget: small (medium)")).toEqual({
      ok: true,
      value: { label: "small", target: "medium" },
    });
  });

  it("rejects a budget line whose label and target disagree", () => {
    expect(parseBudgetLine("# budget: small (max)")).toEqual({
      ok: false,
      error: { tag: "invalid-budget", raw: "# budget: small (max)" },
    });
  });

  it("applies small to real routes and leaves inherit-parent", () => {
    const roles = mustLoad({
      "judgment and prose": "claude:fable@max",
      "arena runners": "grok:grok-4.6@xhigh, inherit-parent",
    });
    const budget = parseBudgetLine("# budget: small (medium)");
    expect(budget.ok).toBe(true);
    if (!budget.ok) return;
    const result = applyBudget(roles, budget.value, () => ALL_EFFORTS);
    expect(result.needsChoice).toEqual([]);
    expect(result.roles["judgment and prose"]).toEqual(routeValue("fable", "claude-code", "medium"));
    expect(result.roles["arena runners"]).toEqual([
      routeValue("grok-4.6", "grok", "medium"),
      { kind: "inherit-parent" },
    ]);
    expect(result.roles["why investigators, synthesizer"]).toEqual({ kind: "inherit-parent" });
  });

  it("clamps each route to its own provider's efforts", () => {
    const catalog = shippedCatalog();
    const roles = mustLoad({
      "arena runners": "grok:grok-4.7@max, cursor:grok-4.7@max",
    });
    const result = applyBudget(
      roles,
      { label: "large", target: "xhigh" },
      (configured) => catalog.get(configured.app)?.models.get(configured.model)?.efforts ?? []
    );
    expect(result.roles["arena runners"]).toEqual([
      routeValue("grok-4.7", "grok", "xhigh"),
      routeValue("grok-4.7", "cursor", "xhigh"),
    ]);
  });

  it("leaves explicit efforts under unlimited", () => {
    const roles = mustLoad({ "judgment and prose": "claude:fable@max" });
    const budget = parseBudgetLine("# budget: unlimited (max)");
    expect(budget.ok).toBe(true);
    if (!budget.ok) return;
    const result = applyBudget(roles, budget.value, () => ALL_EFFORTS);
    expect(result.needsChoice).toEqual([]);
    expect(result.roles["judgment and prose"]).toEqual(routeValue("fable", "claude-code", "max"));
  });

  it("marks needsChoice when no selectable effort is at or below the target", () => {
    const roles = mustLoad({ "judgment and prose": "claude:fable@max" });
    const budget = parseBudgetLine("# budget: small (medium)");
    expect(budget.ok).toBe(true);
    if (!budget.ok) return;
    const result = applyBudget(roles, budget.value, () => ["high", "xhigh", "max"]);
    expect(result.needsChoice).toEqual(["judgment and prose"]);
    expect(result.roles["judgment and prose"]).toEqual(routeValue("fable", "claude-code", "max"));
  });

  it("prints an optional budget comment before the role rows", () => {
    const roles = mustLoad({ "judgment and prose": "claude:fable@max" });
    const printed = printRoleMap(roles, { label: "large", target: "xhigh" });
    expect(printed).toContain("# budget: large (xhigh)\n");
    expect(loadRoleMap(printed, "claude-code").ok).toBe(true);
  });

  it("still loads a sheet that records a budget among the comments", () => {
    const result = loadRoleMap(
      [
        "# Engineering Toolkit model configuration",
        "# budget: large (xhigh)",
        "Descriptor grammar: 3",
        ...roles.map((role) => `${role}: inherit-parent`),
      ].join("\n"),
      "claude-code"
    );
    expect(result.ok).toBe(true);
  });
});
