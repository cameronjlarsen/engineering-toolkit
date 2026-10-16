import { describe, expect, it } from "bun:test";
import fixture from "./fixtures/t3-capabilities.json";
import type { PanelRoleId, RoleId } from "./route.ts";
import { MCP_BOUND_ROLE_IDS, PANEL_ROLE_IDS, SINGLE_ROLE_IDS } from "./sheet.ts";
import { parseT3Catalog } from "./t3-catalog.ts";
import {
  checkT3RoleMap,
  DELEGATION_DRIVERS,
  loadT3RoleMap,
  printT3RoleMap,
  type T3RoleMap,
} from "./t3-sheet.ts";

const ROLES = [...SINGLE_ROLE_IDS, ...PANEL_ROLE_IDS];
const PANEL = "claudeAgent/claude-opus-5-5 effort=medium, codex/gpt-6.1-sol reasoningEffort=high";

function sheet(values: Partial<Record<RoleId, string>> = {}): string {
  return ["Descriptor grammar: 4", ...ROLES.map((role) => `${role}: ${values[role] ?? "inherit-parent"}`)].join("\n");
}

function mustLoad(values: Partial<Record<RoleId, string>> = {}): T3RoleMap {
  const result = loadT3RoleMap(sheet(values));
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

function catalogFrom(input: unknown = fixture) {
  const result = parseT3Catalog(input);
  if (!result.ok) throw new Error("expected a T3 catalog");
  return result.value;
}

function bugFixTarget(map: T3RoleMap) {
  const entry = map["bug-fix"];
  if (entry === "inherit-parent") throw new Error("expected a target");
  return entry;
}

function panelTargets(map: T3RoleMap, role: PanelRoleId = "arena runners") {
  const entries = map[role];
  if (entries === "inherit-parent") throw new Error("expected a panel");
  return entries;
}

const catalog = catalogFrom();

describe("loadT3RoleMap and printT3RoleMap", () => {
  it("round-trips raw targets, slash-containing models, options, booleans, and inheritance", () => {
    const text = sheet({
      "feature, refactoring": "claudeAgent/claude-opus-5-5 effort=ultrathink fastMode=false",
      "bug-fix": "codex/gpt-6.1-sol reasoningEffort=ultra serviceTier=priority",
      "hardest tasks": "renamed/vendor/custom-model fastMode=true",
      "arena runners": PANEL,
    });
    const result = loadT3RoleMap(text);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    const map = result.value;
    const feature = map["feature, refactoring"];
    expect(feature).not.toBe("inherit-parent");
    if (feature === "inherit-parent") return;
    expect(feature.providerInstanceId as string).toBe("claudeAgent");
    expect(feature.model as string).toBe("claude-opus-5-5");
    expect(feature.options).toEqual(new Map<string, string | boolean>([
      ["effort", "ultrathink"], ["fastMode", false],
    ]));
    const custom = map["hardest tasks"];
    expect(custom).not.toBe("inherit-parent");
    if (custom === "inherit-parent") return;
    expect(custom.model as string).toBe("vendor/custom-model");
    expect(custom.options.get("fastMode")).toBe(true);
    const printed = printT3RoleMap(map);
    expect(printed).toBe(`${text}\n`);
    expect(loadT3RoleMap(printed)).toEqual({ ok: true, value: map });
  });

  it("accepts targets without options, extra token whitespace, blank lines, and CRLF", () => {
    const result = loadT3RoleMap(`\r\n  ${sheet({
      "bug-fix": "codex/gpt-6.1-sol",
      "feature, refactoring": "claudeAgent/claude-opus-5-5   effort=high\tfastMode=true",
    }).replaceAll("\n", "\r\n\r\n")}\r\n`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const target = result.value["bug-fix"];
    expect(target).not.toBe("inherit-parent");
    if (target === "inherit-parent") return;
    expect(target.options.size).toBe(0);
  });

  it("tolerates budget and operator comment lines after the header", () => {
    const text = sheet({ "bug-fix": "codex/gpt-6.1-sol" }).replace(
      "Descriptor grammar: 4",
      "Descriptor grammar: 4\n# budget: medium (high)\n# Note: keep opus at medium\n# bug-fix: claudeAgent/claude-opus-5-5"
    );
    expect(loadT3RoleMap(text)).toEqual(loadT3RoleMap(sheet({ "bug-fix": "codex/gpt-6.1-sol" })));
  });

  it("ignores non-role lines and matches comma-containing role IDs exactly", () => {
    const text = sheet({ "feature, refactoring": "codex/gpt-6.1-sol" }).replace(
      "Descriptor grammar: 4",
      "Descriptor grammar: 4\n# Comment\nProse\nNote: ignored\nhow critics: ignored\nbug-fix extra: ignored"
    );
    expect(loadT3RoleMap(text)).toEqual(loadT3RoleMap(sheet({ "feature, refactoring": "codex/gpt-6.1-sol" })));
  });

  it.each(["", "Descriptor grammar: 3", "Descriptor grammar: 5", "Descriptor grammar: four", "# Comment"])(
    "requires grammar 4 on the first non-blank line, got %s", (header) => {
      const text = header === "" ? "" : `${header}\n${sheet()}`;
      expect(loadT3RoleMap(text)).toEqual({
        ok: false, error: { tag: "invalid-grammar-version", raw: header },
      });
    }
  );

  it.each(ROLES)("requires role %s", (role) => {
    const text = sheet().split("\n").filter((line) => !line.startsWith(`${role}: `)).join("\n");
    expect(loadT3RoleMap(text)).toEqual({ ok: false, error: { tag: "missing-role", role } });
  });

  it.each(ROLES)("rejects duplicate role %s", (role) => {
    expect(loadT3RoleMap(`${sheet()}\n${role}: inherit-parent`)).toEqual({
      ok: false, error: { tag: "duplicate-role", role },
    });
  });

  it.each([...MCP_BOUND_ROLE_IDS])("requires MCP-bound role %s to inherit", (role) => {
    expect(loadT3RoleMap(sheet({ [role]: "claudeAgent/claude-opus-5-5" }))).toEqual({
      ok: false, error: { tag: "mcp-bound-must-inherit", role },
    });
  });

  it.each(SINGLE_ROLE_IDS.filter((role) => !MCP_BOUND_ROLE_IDS.has(role)))(
    "rejects multiple entries for single role %s", (role) => {
      expect(loadT3RoleMap(sheet({ [role]: PANEL }))).toEqual({
        ok: false, error: { tag: "single-role-multiple-entries", role },
      });
    }
  );

  it.each([
    "", "auto", "codex", "/gpt-6.1-sol", "codex/", "codex/gpt-6.1-sol stray",
    "codex/gpt-6.1-sol =high", "codex/gpt-6.1-sol effort=", "codex/gpt-6.1-sol effort=high=extra",
    "codex/gpt-6.1-sol effort=high effort=low", "codex/gpt-6.1-sol effort =high",
  ])("rejects malformed entry %s", (raw) => {
    expect(loadT3RoleMap(sheet({ "bug-fix": raw }))).toEqual({
      ok: false, error: { tag: "invalid-entry", role: "bug-fix", raw },
    });
  });

  it.each([
    [", codex/gpt-6.1-sol", ""], ["codex/gpt-6.1-sol,", ""],
    ["inherit-parent, codex/gpt-6.1-sol", "inherit-parent"],
    ["codex/gpt-6.1-sol, inherit-parent", "inherit-parent"],
  ])("rejects malformed panel %s", (value, raw) => {
    expect(loadT3RoleMap(sheet({ "arena runners": value }))).toEqual({
      ok: false, error: { tag: "invalid-entry", role: "arena runners", raw },
    });
  });
});

describe("checkT3RoleMap", () => {
  it("accepts valid targets and two-family panels, preserving raw option values", () => {
    const map = mustLoad({
      "feature, refactoring": "claudeAgent/claude-opus-5-5 effort=ultracode fastMode=false",
      "hardest tasks": "claudeAgent/claude-haiku-5-5 effort=ultrathink",
      "bug-fix": "codex/gpt-6.1-sol reasoningEffort=ultra serviceTier=priority",
      ...Object.fromEntries(PANEL_ROLE_IDS.map((role) => [role, PANEL])),
    });
    expect(checkT3RoleMap(map, catalog)).toEqual([]);
    expect(checkT3RoleMap(mustLoad(), catalog)).toEqual([]);
    expect(DELEGATION_DRIVERS).toEqual(["claudeAgent", "codex"]);
  });

  it("reports an unknown provider without substituting a target", () => {
    const map = mustLoad({ "bug-fix": "missing/gpt-6.1-sol" });
    const before = printT3RoleMap(map);
    expect(checkT3RoleMap(map, catalog)).toEqual([
      { tag: "unknown-provider", role: "bug-fix", entry: bugFixTarget(map) },
    ]);
    expect(printT3RoleMap(map)).toBe(before);
  });

  it("reports Grok's live unavailability constraints", () => {
    const map = mustLoad({ "bug-fix": "grok/grok-build" });
    const before = printT3RoleMap(map);
    const grok = fixture.providers.find((provider) => provider.driverKind === "grok");
    if (grok === undefined) throw new Error("expected the Grok fixture provider");
    expect(checkT3RoleMap(map, catalog)).toContainEqual({
      tag: "provider-unavailable", role: "bug-fix", entry: bugFixTarget(map),
      constraints: grok.constraints,
    });
    expect(printT3RoleMap(map)).toBe(before);
  });

  it("rejects the launchable Cursor provider", () => {
    const map = mustLoad({ "bug-fix": "cursor/grok-4.7 reasoning_effort=high" });
    expect(checkT3RoleMap(map, catalog)).toEqual([
      { tag: "provider-not-allowed", role: "bug-fix", entry: bugFixTarget(map), driverKind: "cursor" },
    ]);
  });

  it("reports only the disallowed driver when its models are elided", () => {
    const elided = catalogFrom({
      ...fixture,
      providers: fixture.providers.map((provider) => ({
        ...provider, models: provider.driverKind === "cursor" ? [] : provider.models,
      })),
    });
    const map = mustLoad({ "bug-fix": "cursor/grok-4.7 reasoning_effort=high" });
    expect(checkT3RoleMap(map, elided)).toEqual([
      { tag: "provider-not-allowed", role: "bug-fix", entry: bugFixTarget(map), driverKind: "cursor" },
    ]);
  });

  it("allows renamed instances by driverKind and rejects a disallowed driver named codex", () => {
    const renamed = catalogFrom({
      ...fixture,
      providers: fixture.providers.map((provider) => ({
        ...provider, providerInstanceId: `my-${provider.providerInstanceId}`,
      })),
    });
    expect(checkT3RoleMap(mustLoad({
      "arena runners": "my-claudeAgent/claude-opus-5-5, my-codex/gpt-6.1-sol",
    }), renamed)).toEqual([]);
    const disguised = catalogFrom({
      ...fixture,
      providers: fixture.providers.map((provider) => ({
        ...provider, driverKind: provider.driverKind === "codex" ? "cursor" : provider.driverKind,
      })),
    });
    const map = mustLoad({ "bug-fix": "codex/gpt-6.1-sol" });
    expect(checkT3RoleMap(map, disguised)).toEqual([
      { tag: "provider-not-allowed", role: "bug-fix", entry: bugFixTarget(map), driverKind: "cursor" },
    ]);
  });

  it("reports an unknown model without alias normalization", () => {
    const map = mustLoad({ "bug-fix": "claudeAgent/opus" });
    expect(checkT3RoleMap(map, catalog)).toEqual([
      { tag: "unknown-model", role: "bug-fix", entry: bugFixTarget(map) },
    ]);
  });

  it("reports an unknown option", () => {
    const map = mustLoad({ "bug-fix": "codex/gpt-6.1-sol effort=high" });
    expect(checkT3RoleMap(map, catalog)).toEqual([
      { tag: "unknown-option", role: "bug-fix", entry: bugFixTarget(map), optionId: "effort" },
    ]);
  });

  it.each([
    ["codex/gpt-6.1-sol reasoningEffort=impossible", "reasoningEffort", "impossible", { kind: "select", values: ["low", "medium", "high", "xhigh", "max", "ultra"] }],
    ["codex/gpt-6.1-sol reasoningEffort=true", "reasoningEffort", true, { kind: "select", values: ["low", "medium", "high", "xhigh", "max", "ultra"] }],
    ["claudeAgent/claude-opus-5-5 fastMode=high", "fastMode", "high", { kind: "boolean" }],
  ] as const)("reports an invalid option value in %s", (raw, optionId, value, option) => {
    const map = mustLoad({ "bug-fix": raw });
    expect(checkT3RoleMap(map, catalog)).toEqual([
      { tag: "invalid-option-value", role: "bug-fix", entry: bugFixTarget(map), optionId, value, option },
    ]);
  });

  it.each([...PANEL_ROLE_IDS])("requires two model families in %s", (role) => {
    const map = mustLoad({ [role]: "claudeAgent/claude-opus-5-5, claudeAgent/claude-haiku-5-5" });
    expect(checkT3RoleMap(map, catalog)).toEqual([
      { tag: "panel-single-family", role, entry: panelTargets(map, role), families: ["claude"] },
    ]);
  });

  it("rejects a one-target panel", () => {
    const map = mustLoad({ "arena runners": "codex/gpt-6.1-sol" });
    expect(checkT3RoleMap(map, catalog)).toEqual([
      { tag: "panel-single-family", role: "arena runners", entry: panelTargets(map), families: ["gpt"] },
    ]);
  });

  it("compares model families rather than provider instance IDs", () => {
    const codex = fixture.providers.find((provider) => provider.driverKind === "codex");
    const claude = fixture.providers.find((provider) => provider.driverKind === "claudeAgent");
    if (codex === undefined || claude === undefined) throw new Error("expected fixture providers");
    const expanded = catalogFrom({
      ...fixture,
      providers: [
        ...fixture.providers.filter((provider) => provider.driverKind !== "codex"),
        { ...codex, models: [...codex.models, ...claude.models] },
        { ...codex, providerInstanceId: "codex-backup" },
      ],
    });
    expect(checkT3RoleMap(mustLoad({
      "arena runners": "codex/claude-opus-5-5, codex/gpt-6.1-sol",
    }), expanded)).toEqual([]);
    const map = mustLoad({ "arena runners": "codex/gpt-6.1-sol, codex-backup/gpt-6-astra" });
    expect(checkT3RoleMap(map, expanded)).toEqual([
      { tag: "panel-single-family", role: "arena runners", entry: panelTargets(map), families: ["gpt"] },
    ]);
  });
});
