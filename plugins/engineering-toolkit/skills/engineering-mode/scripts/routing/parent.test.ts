import { describe, expect, it } from "bun:test";
import { shippedCatalog, SOL_CLI_MODEL } from "./catalog.ts";
import {
  parentIdentityKeys,
  proposeStalePinMigrations,
  unwrapStoredSheet,
} from "./parent.ts";
import { modelSlug, type ParentHost, type RoleMap } from "./route.ts";
import { loadRoleMap, printRoleMap } from "./sheet.ts";

const BASE_SHEET = `# Engineering Toolkit model configuration

Descriptor grammar: 3

feature, refactoring: grok:grok-4.7@xhigh
bug-fix: codex:gpt-6-sol@max
perf-issue: codex:gpt-6-sol@max
hillclimb: codex:gpt-6-sol@max
judgment and prose: claude:fable@max
hardest tasks: claude:fable@max
how explorer: grok:grok-4.7@xhigh
how explainer: claude:fable@max
why investigators, synthesizer: inherit-parent
reflect tooling, judgment, divergent, synthesizer: inherit-parent
arena runners: claude:fable@max, codex:gpt-6-sol@max, grok:grok-4.7@xhigh, claude:opus@xhigh
arena cross-judge pool: claude:fable@max, codex:gpt-6-sol@max, grok:grok-4.7@xhigh, claude:opus@xhigh
swarm workers: grok:grok-4.7@xhigh
architect runners: claude:fable@max, codex:gpt-6-sol@max, grok:grok-4.7@xhigh, claude:opus@xhigh
interrogate reviewers: claude:fable@max, codex:gpt-6-sol@max, grok:grok-4.7@xhigh, claude:opus@xhigh
`;

function slug(raw: string) {
  const parsed = modelSlug(raw);
  if (!parsed.ok) throw new Error(raw);
  return parsed.value;
}

describe("stored sheets", () => {
  it("passes a bare grammar 3 sheet through unchanged", () => {
    expect(unwrapStoredSheet(BASE_SHEET)).toEqual({ ok: true, value: BASE_SHEET });
  });

  it("unwraps a Cursor always-apply mdc to the grammar 3 body", () => {
    const stored = `---
description: Engineering Toolkit model configuration
alwaysApply: true
---

${BASE_SHEET}`;
    expect(unwrapStoredSheet(stored)).toEqual({ ok: true, value: BASE_SHEET });
  });

  it("stops when a Cursor mdc is an upstream Task-slug rule", () => {
    const stored = `---
description: pstack models
alwaysApply: true
---

Use grok-4.6-fast-xhigh for arena.
`;
    expect(unwrapStoredSheet(stored)).toEqual({
      ok: false,
      error: { tag: "inconsistent-integration" },
    });
  });

  it("exports identity keys for every parent including Cursor", () => {
    expect(parentIdentityKeys().cursor).toEqual(["CURSOR_AGENT"]);
  });
});

describe("stale pin migrations", () => {
  const catalog = shippedCatalog();

  function mustLoad(text: string, parent: ParentHost = "claude-code"): RoleMap {
    const loaded = loadRoleMap(text, parent);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) throw new Error(loaded.error.tag);
    return loaded.value;
  }

  function sheetWith(overrides: Record<string, string>): string {
    const lines = BASE_SHEET.split("\n").map((line) => {
      const colon = line.indexOf(": ");
      if (colon < 0) return line;
      const role = line.slice(0, colon);
      return role in overrides ? `${role}: ${overrides[role]}` : line;
    });
    return lines.join("\n");
  }

  it("proposes sole-model cutovers without rewriting the role map", () => {
    const roles = mustLoad(
      sheetWith({ "bug-fix": "codex:gpt-5.6-sol@high" })
    );
    const before = printRoleMap(roles);
    expect(before).toContain("bug-fix: codex:gpt-5.6-sol@high");
    expect(catalog.get("codex")?.models.has(slug("gpt-5.6-sol"))).toBe(false);
    expect(catalog.get("codex")?.models.has(SOL_CLI_MODEL)).toBe(true);

    const proposals = proposeStalePinMigrations(roles, catalog);
    expect(proposals).toEqual([
      {
        site: { role: "bug-fix" },
        app: "codex",
        from: slug("gpt-5.6-sol"),
        to: SOL_CLI_MODEL,
      },
    ]);
    expect(printRoleMap(roles)).toBe(before);

    const migrated = mustLoad(
      sheetWith({ "bug-fix": `codex:${SOL_CLI_MODEL}@high` })
    );
    expect(proposeStalePinMigrations(migrated, catalog)).toEqual([]);

    expect(
      proposeStalePinMigrations(
        mustLoad(sheetWith({ "bug-fix": "claude:fable@max" })),
        catalog
      )
    ).toEqual([]);

    const typo = mustLoad(sheetWith({ "bug-fix": "codex:gpt-6-sool@high" }));
    expect(proposeStalePinMigrations(typo, catalog)).toEqual([
      {
        site: { role: "bug-fix" },
        app: "codex",
        from: slug("gpt-6-sool"),
        to: SOL_CLI_MODEL,
      },
    ]);

    const codexParent = mustLoad(
      sheetWith({ "bug-fix": "codex:gpt-5.6-sol@max" }),
      "codex"
    );
    expect(proposeStalePinMigrations(codexParent, catalog)).toEqual([
      {
        site: { role: "bug-fix" },
        app: "codex",
        from: slug("gpt-5.6-sol"),
        to: SOL_CLI_MODEL,
      },
    ]);
  });

  it("does not sole-map when a probed list is present", () => {
    const catalog = shippedCatalog();
    const probed = [
      {
        slug: slug("gpt-6.1-sol"),
        selectableEfforts: ["low", "medium", "high", "xhigh", "max"] as const,
      },
    ];
    const legal = mustLoad(sheetWith({ "bug-fix": "codex:gpt-6.1-sol@high" }));
    expect(proposeStalePinMigrations(legal, catalog, probed)).toEqual([]);

    const retired = mustLoad(sheetWith({ "bug-fix": "codex:gpt-5.6-sol@high" }));
    expect(proposeStalePinMigrations(retired, catalog, probed)).toEqual([]);
  });
});
