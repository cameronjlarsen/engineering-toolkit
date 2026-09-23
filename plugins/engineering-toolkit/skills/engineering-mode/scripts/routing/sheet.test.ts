import { describe, expect, it } from "bun:test";
import {
  currentHost,
  destinationDefault,
  explicitEffort,
  modelSlug,
  namedApp,
  route,
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

function sheet(values: Partial<Record<(typeof roles)[number], string>> = {}): string {
  return sheetAt(2, values);
}

function sheetAt(
  grammar: 2 | 3,
  values: Partial<Record<(typeof roles)[number], string>> = {}
): string {
  return [
    "# Engineering Toolkit model configuration",
    `Descriptor grammar: ${grammar}`,
    ...roles.map((role) => `${role}: ${values[role] ?? "inherit-parent"}`),
  ].join("\n");
}

function slug(raw: string) {
  const parsed = modelSlug(raw);
  if (!parsed.ok) throw new Error("invalid test model");
  return parsed.value;
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
    expect(printed).toContain("Descriptor grammar: 3");
    expect(printed).toContain("feature, refactoring: grok/grok-4.6@xhigh");
    expect(printed).not.toContain("grok:grok-4.6@xhigh");
  });
});

describe("sheet validation and round trips", () => {
  it("round-trips a grammar 2 map and prints grammar 3", () => {
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

  it("round-trips a grammar 3 solo then-chain without splitting panel commas", () => {
    const initial = loadRoleMap(
      sheetAt(3, {
        "how explorer": "grok/grok-4.6@xhigh then opus@xhigh",
        "arena runners": "fable@max, grok/grok-4.6@xhigh",
      })
    );
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    expect(initial.value["how explorer"]).toEqual({
      kind: "failover",
      routes: [
        route({
          model: slug("grok-4.6"),
          app: namedApp("grok"),
          effort: explicitEffort("xhigh"),
        }),
        route({
          model: slug("opus"),
          app: currentHost(),
          effort: explicitEffort("xhigh"),
        }),
      ],
    });
    expect(printRoleMap(initial.value)).toContain(
      "how explorer: grok/grok-4.6@xhigh then opus@xhigh"
    );
    expect(printRoleMap(initial.value)).toContain(
      "arena runners: fable@max, grok/grok-4.6@xhigh"
    );
    expect(loadRoleMap(printRoleMap(initial.value))).toEqual(initial);
  });

  it("round-trips a grammar 3 then-chain on a panel lane without collapsing commas", () => {
    const initial = loadRoleMap(
      sheetAt(3, {
        "arena runners": "grok/grok-4.6@xhigh then opus@xhigh, fable@max",
      })
    );
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    expect(initial.value["arena runners"]).toEqual([
      {
        kind: "failover",
        routes: [
          route({
            model: slug("grok-4.6"),
            app: namedApp("grok"),
            effort: explicitEffort("xhigh"),
          }),
          route({
            model: slug("opus"),
            app: currentHost(),
            effort: explicitEffort("xhigh"),
          }),
        ],
      },
      routeValue("fable", currentHost(), explicitEffort("max")),
    ]);
    expect(printRoleMap(initial.value)).toContain(
      "arena runners: grok/grok-4.6@xhigh then opus@xhigh, fable@max"
    );
    expect(loadRoleMap(printRoleMap(initial.value))).toEqual(initial);
  });

  it("rejects a then-chain on an MCP-bound role", () => {
    expect(
      loadRoleMap(
        sheetAt(3, {
          "why investigators, synthesizer": "opus@xhigh then fable@max",
        })
      )
    ).toEqual({
      ok: false,
      error: {
        tag: "mcp-bound-must-inherit",
        role: "why investigators, synthesizer",
      },
    });
  });

  it("rejects omitted effort on a failover hop", () => {
    expect(
      loadRoleMap(
        sheetAt(3, {
          "how explorer": "grok/grok-4.6 then opus@xhigh",
        })
      )
    ).toEqual({
      ok: false,
      error: { tag: "failover-requires-explicit-effort" },
    });
  });

  it("rejects a weaker later hop on the same app and model", () => {
    expect(
      loadRoleMap(
        sheetAt(3, {
          "how explorer": "grok/grok-4.6@xhigh then grok/grok-4.6@high",
        })
      )
    ).toEqual({
      ok: false,
      error: {
        tag: "failover-weaker-effort",
        model: slug("grok-4.6"),
        app: namedApp("grok"),
      },
    });
  });

  it("rejects then inside grammar 2", () => {
    expect(
      loadRoleMap(
        sheet({
          "how explorer": "grok/grok-4.6@xhigh then opus@xhigh",
        })
      )
    ).toEqual({
      ok: false,
      error: {
        tag: "invalid-descriptor",
        role: "how explorer",
        raw: "grok/grok-4.6@xhigh then opus@xhigh",
      },
    });
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

const ALL_EFFORTS: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];

function mustLoad(values: Partial<Record<(typeof roles)[number], string>> = {}): RoleMap {
  const result = loadRoleMap(sheet(values));
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
      "judgment and prose": "fable@max",
      "arena runners": "grok/grok-4.6@xhigh, inherit-parent",
    });
    const budget = parseBudgetLine("# budget: small (medium)");
    expect(budget.ok).toBe(true);
    if (!budget.ok) return;
    const result = applyBudget(roles, budget.value, () => ALL_EFFORTS);
    expect(result.needsChoice).toEqual([]);
    expect(result.roles["judgment and prose"]).toEqual(
      routeValue("fable", currentHost(), explicitEffort("medium"))
    );
    expect(result.roles["arena runners"]).toEqual([
      routeValue("grok-4.6", namedApp("grok"), explicitEffort("medium")),
      { kind: "inherit-parent" },
    ]);
    expect(result.roles["why investigators, synthesizer"]).toEqual({ kind: "inherit-parent" });
  });

  it("leaves explicit and destination-default efforts under unlimited", () => {
    const roles = mustLoad({
      "judgment and prose": "fable@max",
      "feature, refactoring": "fable",
    });
    const budget = parseBudgetLine("# budget: unlimited (max)");
    expect(budget.ok).toBe(true);
    if (!budget.ok) return;
    const result = applyBudget(roles, budget.value, () => ALL_EFFORTS);
    expect(result.needsChoice).toEqual([]);
    expect(result.roles["judgment and prose"]).toEqual(
      routeValue("fable", currentHost(), explicitEffort("max"))
    );
    expect(result.roles["feature, refactoring"]).toEqual(routeValue("fable"));
  });

  it("marks needsChoice when no selectable effort is at or below the target", () => {
    const roles = mustLoad({ "judgment and prose": "fable@max" });
    const budget = parseBudgetLine("# budget: small (medium)");
    expect(budget.ok).toBe(true);
    if (!budget.ok) return;
    const result = applyBudget(roles, budget.value, () => ["high", "xhigh", "max"]);
    expect(result.needsChoice).toEqual(["judgment and prose"]);
    expect(result.roles["judgment and prose"]).toEqual(
      routeValue("fable", currentHost(), explicitEffort("max"))
    );
  });

  it("prints an optional budget comment before the role rows", () => {
    const roles = mustLoad({ "judgment and prose": "fable@max" });
    const printed = printRoleMap(roles, { label: "large", target: "xhigh" });
    expect(printed).toContain("Descriptor grammar: 3\n");
    expect(printed).toContain("# budget: large (xhigh)\n");
    expect(loadRoleMap(printed).ok).toBe(true);
  });

  it("applies small to every hop of a failover chain", () => {
    const loaded = loadRoleMap(
      sheetAt(3, {
        "how explorer": "grok/grok-4.6@xhigh then opus@xhigh",
      })
    );
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const budget = parseBudgetLine("# budget: small (medium)");
    expect(budget.ok).toBe(true);
    if (!budget.ok) return;
    const result = applyBudget(loaded.value, budget.value, () => ALL_EFFORTS);
    expect(result.needsChoice).toEqual([]);
    expect(result.roles["how explorer"]).toEqual({
      kind: "failover",
      routes: [
        route({
          model: slug("grok-4.6"),
          app: namedApp("grok"),
          effort: explicitEffort("medium"),
        }),
        route({
          model: slug("opus"),
          app: currentHost(),
          effort: explicitEffort("medium"),
        }),
      ],
    });
  });

  it("applies small to a then-chain inside a panel lane", () => {
    const loaded = loadRoleMap(
      sheetAt(3, {
        "arena runners": "grok/grok-4.6@xhigh then opus@xhigh, fable@max",
      })
    );
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const budget = parseBudgetLine("# budget: small (medium)");
    expect(budget.ok).toBe(true);
    if (!budget.ok) return;
    const result = applyBudget(loaded.value, budget.value, () => ALL_EFFORTS);
    expect(result.roles["arena runners"][0]).toEqual({
      kind: "failover",
      routes: [
        route({
          model: slug("grok-4.6"),
          app: namedApp("grok"),
          effort: explicitEffort("medium"),
        }),
        route({
          model: slug("opus"),
          app: currentHost(),
          effort: explicitEffort("medium"),
        }),
      ],
    });
    expect(result.roles["arena runners"][1]).toEqual(
      routeValue("fable", currentHost(), explicitEffort("medium"))
    );
  });

  it("still loads a sheet that records a budget among the comments", () => {
    const result = loadRoleMap(
      [
        "# Engineering Toolkit model configuration",
        "# budget: large (xhigh)",
        "Descriptor grammar: 2",
        ...roles.map((role) => `${role}: inherit-parent`),
      ].join("\n")
    );
    expect(result.ok).toBe(true);
  });
});
