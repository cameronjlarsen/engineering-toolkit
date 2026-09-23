import { describe, expect, it } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import { shippedCatalog, SOL_CLI_MODEL } from "./catalog.ts";
import { planLane, resolveRoute } from "./dispatch.ts";
import {
  applyAcceptedMigrations,
  applyIntegrationPatch,
  detectParent,
  firstRunRoleMap,
  nativeHandle,
  parentIdentityKeys,
  parentProfile,
  pluginAgentName,
  proposeStalePinMigrations,
  renderParentFiles,
  unwrapStoredSheet,
  wrapMdc,
} from "./parent.ts";
import {
  currentHost,
  explicitEffort,
  modelSlug,
  namedApp,
  route,
  type Access,
  type RoleMap,
} from "./route.ts";
import { loadRoleMap, printRoleMap } from "./sheet.ts";

const access: Access = { mode: "read-only", worktree: null };

function slug(raw: string) {
  const parsed = modelSlug(raw);
  if (!parsed.ok) throw new Error(raw);
  return parsed.value;
}

describe("detectParent", () => {
  it("classifies from exclusive tools and treats env as corroboration", () => {
    expect(
      detectParent({ env: {}, tools: new Set(["Task"]) })
    ).toEqual({ ok: true, value: "cursor" });
    expect(
      detectParent({ env: { CLAUDECODE: "1" }, tools: new Set(["Agent"]) })
    ).toEqual({ ok: true, value: "claude-code" });
    expect(
      detectParent({ env: { CODEX_CI: "1" }, tools: new Set(["spawn_agent"]) })
    ).toEqual({ ok: true, value: "codex" });
  });

  it("uses env only when tools are silent", () => {
    expect(
      detectParent({ env: { CURSOR_AGENT: "1" }, tools: new Set() })
    ).toEqual({ ok: true, value: "cursor" });
  });

  it("does not guess when tools and env disagree", () => {
    const result = detectParent({
      env: { CLAUDECODE: "1" },
      tools: new Set(["Task"]),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.tag).toBe("ambiguous-parent");
  });

  it("reports unknown when nothing matches", () => {
    expect(detectParent({ env: {}, tools: new Set() })).toEqual({
      ok: false,
      error: { tag: "unknown-parent" },
    });
  });
});

describe("firstRunRoleMap", () => {
  it("omits the app when the parent already serves the model", () => {
    const catalog = shippedCatalog();
    const cursor = printRoleMap(firstRunRoleMap("cursor", catalog));
    const claude = printRoleMap(firstRunRoleMap("claude-code", catalog));
    expect(cursor).toContain("judgment and prose: fable@max");
    expect(cursor).toContain("hardest tasks: fable@max");
    expect(cursor).toContain(
      "arena runners: fable@max, codex/gpt-6-sol@max, grok-4.6@xhigh, opus@xhigh"
    );
    expect(cursor).not.toContain("claude-code/fable");
    expect(cursor).not.toContain("grok/grok-4.6");
    expect(claude).toContain(
      "arena runners: fable@max, codex/gpt-6-sol@max, grok/grok-4.6@xhigh, opus@xhigh"
    );

    const codex = printRoleMap(firstRunRoleMap("codex", catalog));
    expect(codex).toContain("bug-fix: gpt-6-sol@max");
    expect(codex).toContain("judgment and prose: claude-code/fable@max");
    expect(codex).toContain(
      "arena runners: claude-code/fable@max, gpt-6-sol@max, grok/grok-4.6@xhigh, claude-code/opus@xhigh"
    );
  });
});

describe("nativeHandle", () => {
  it("names the plugin-agent wire without host primitives", () => {
    const planned = planLane({
      parent: "cursor",
      binding: {
        kind: "route",
        route: route({
          model: slug("fable"),
          app: currentHost(),
          effort: explicitEffort("max"),
        }),
      },
      override: undefined,
      catalog: shippedCatalog(),
      inventory: [],
      access,
      role: "architect runners",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok || planned.value.kind !== "native") return;
    expect(nativeHandle(planned.value, shippedCatalog())).toEqual({
      kind: "plugin-agent",
      name: pluginAgentName("fable", "max"),
    });
  });

  it("maps omitted-app grok on cursor to host-spawn", () => {
    const planned = planLane({
      parent: "cursor",
      binding: {
        kind: "route",
        route: route({
          model: slug("grok-4.6"),
          app: currentHost(),
          effort: explicitEffort("xhigh"),
        }),
      },
      override: undefined,
      catalog: shippedCatalog(),
      inventory: [],
      access,
      role: "feature, refactoring",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok || planned.value.kind !== "native") return;
    expect(nativeHandle(planned.value, shippedCatalog())).toEqual({
      kind: "host-spawn",
      model: slug("grok-4.6"),
      effort: "xhigh",
    });
  });

  it("maps inherit-parent to the engineering-agent wrapper", () => {
    const planned = planLane({
      parent: "cursor",
      binding: { kind: "inherit-parent" },
      override: undefined,
      catalog: shippedCatalog(),
      inventory: [],
      access,
      role: "why investigators, synthesizer",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok || planned.value.kind !== "native") return;
    expect(nativeHandle(planned.value, shippedCatalog())).toEqual({
      kind: "inherit",
      wrapper: "engineering-agent",
    });
  });
});

describe("parent files", () => {
  it("persists Cursor as one always-apply grammar 2 mdc", () => {
    const profile = parentProfile("cursor");
    expect(profile.sheetPath).toBe(
      join(homedir(), ".cursor", "rules", "engineering-toolkit-models.mdc")
    );
    expect(profile.mappingDoc).toBe("cursor-tools.md");
    const sheet = printRoleMap(firstRunRoleMap("cursor", shippedCatalog()));
    const files = renderParentFiles(profile, sheet);
    expect(files.integration.kind).toBe("none");
    expect(files.sheet.contents.startsWith("---\n")).toBe(true);
    expect(files.sheet.contents).toContain("alwaysApply: true");
    const unwrapped = unwrapStoredSheet(files.sheet.contents);
    expect(unwrapped).toEqual({ ok: true, value: sheet });
    expect(wrapMdc(files.sheet.contents)).toBe(files.sheet.contents);
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

  it("is idempotent for Claude include and Codex bounded-block patches", () => {
    const claude = applyIntegrationPatch("# notes\n", {
      kind: "ensure-line",
      path: "CLAUDE.md",
      line: "@~/.claude/engineering-toolkit-models.md",
    });
    expect(claude.ok).toBe(true);
    if (!claude.ok) return;
    expect(
      applyIntegrationPatch(claude.value, {
        kind: "ensure-line",
        path: "CLAUDE.md",
        line: "@~/.claude/engineering-toolkit-models.md",
      })
    ).toEqual(claude);

    const sheet = "# Engineering Toolkit model configuration\n\nDescriptor grammar: 2\n";
    const first = applyIntegrationPatch("prefix\n", {
      kind: "replace-bounded-block",
      path: "AGENTS.md",
      begin: "<!-- engineering-toolkit:models:begin -->",
      end: "<!-- engineering-toolkit:models:end -->",
      body: sheet,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(
      applyIntegrationPatch(first.value, {
        kind: "replace-bounded-block",
        path: "AGENTS.md",
        begin: "<!-- engineering-toolkit:models:begin -->",
        end: "<!-- engineering-toolkit:models:end -->",
        body: sheet,
      })
    ).toEqual(first);
  });

  it("exports identity keys for every parent including Cursor", () => {
    expect(parentIdentityKeys().cursor).toEqual(["CURSOR_AGENT"]);
  });
});

describe("named claude-code from cursor stays external", () => {
  it("does not rewrite to Task", () => {
    const planned = planLane({
      parent: "cursor",
      binding: {
        kind: "route",
        route: route({
          model: slug("fable"),
          app: namedApp("claude-code"),
          effort: explicitEffort("max"),
        }),
      },
      override: undefined,
      catalog: shippedCatalog(),
      inventory: [{ app: "claude-code", readiness: { kind: "launch-ready" } }],
      access,
      role: "architect runners",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok || planned.value.kind !== "external") return;
    expect(planned.value.launch.app).toBe("claude-code");
  });
});

describe("stale pin migrations", () => {
  const catalog = shippedCatalog();

  function mustLoad(text: string): RoleMap {
    const loaded = loadRoleMap(text);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) throw new Error(loaded.error.tag);
    return loaded.value;
  }

  function sheetWith(overrides: Record<string, string>): string {
    const base = firstRunRoleMap("claude-code", catalog);
    const printed = printRoleMap(base);
    const lines = printed.split("\n").map((line) => {
      const colon = line.indexOf(": ");
      if (colon < 0) return line;
      const role = line.slice(0, colon);
      return role in overrides ? `${role}: ${overrides[role]}` : line;
    });
    return `${lines.join("\n")}\n`;
  }

  it("proposes sole-model cutovers without rewriting until accepted", () => {
    const roles = mustLoad(
      sheetWith({ "bug-fix": "codex/gpt-5.6-sol@high" })
    );
    expect(printRoleMap(roles)).toContain("bug-fix: codex/gpt-5.6-sol@high");

    const proposals = proposeStalePinMigrations("claude-code", roles, catalog);
    expect(proposals).toEqual([
      {
        site: { role: "bug-fix" },
        app: "codex",
        from: slug("gpt-5.6-sol"),
        to: SOL_CLI_MODEL,
      },
    ]);

    const stale = roles["bug-fix"];
    expect(stale.kind).toBe("route");
    if (stale.kind !== "route") return;
    expect(
      resolveRoute("claude-code", stale.route, catalog, [
        { app: "codex", readiness: { kind: "launch-ready" } },
      ])
    ).toEqual({
      ok: false,
      error: {
        tag: "app-does-not-serve-model",
        app: "codex",
        model: slug("gpt-5.6-sol"),
      },
    });

    expect(applyAcceptedMigrations(roles, proposals, [])).toEqual(roles);
    expect(printRoleMap(applyAcceptedMigrations(roles, proposals, []))).toContain(
      "bug-fix: codex/gpt-5.6-sol@high"
    );

    const accepted = applyAcceptedMigrations(roles, proposals, [{ role: "bug-fix" }]);
    const fixed = accepted["bug-fix"];
    expect(fixed.kind).toBe("route");
    if (fixed.kind !== "route") return;
    expect(fixed.route.model).toBe(SOL_CLI_MODEL);
    expect(fixed.route.effort).toEqual(explicitEffort("high"));
    expect(fixed.route.app).toEqual(namedApp("codex"));
    expect(
      resolveRoute("claude-code", fixed.route, catalog, [
        { app: "codex", readiness: { kind: "launch-ready" } },
      ])
    ).toEqual({
      ok: true,
      value: {
        model: SOL_CLI_MODEL,
        app: "codex",
        effort: "high",
        lane: "external",
      },
    });
    expect(proposeStalePinMigrations("claude-code", accepted, catalog)).toEqual([]);
    expect(
      applyAcceptedMigrations(accepted, proposeStalePinMigrations("claude-code", accepted, catalog), [
        { role: "bug-fix" },
      ])
    ).toEqual(accepted);

    expect(
      proposeStalePinMigrations(
        "claude-code",
        mustLoad(sheetWith({ "bug-fix": "claude-code/fable@max" })),
        catalog
      )
    ).toEqual([]);

    const typo = mustLoad(sheetWith({ "bug-fix": "codex/gpt-6-sool@high" }));
    const typoProposals = proposeStalePinMigrations("claude-code", typo, catalog);
    expect(typoProposals).toEqual([
      {
        site: { role: "bug-fix" },
        app: "codex",
        from: slug("gpt-6-sool"),
        to: SOL_CLI_MODEL,
      },
    ]);
    const typoLeft = applyAcceptedMigrations(typo, typoProposals, []);
    const typoRoute = typoLeft["bug-fix"];
    expect(typoRoute.kind).toBe("route");
    if (typoRoute.kind !== "route") return;
    expect(
      resolveRoute("claude-code", typoRoute.route, catalog, [
        { app: "codex", readiness: { kind: "launch-ready" } },
      ]).ok
    ).toBe(false);

    const codexParent = mustLoad(
      printRoleMap({
        ...firstRunRoleMap("codex", catalog),
        "bug-fix": {
          kind: "route",
          route: route({
            model: slug("gpt-5.6-sol"),
            app: currentHost(),
            effort: explicitEffort("max"),
          }),
        },
      })
    );
    const omitted = proposeStalePinMigrations("codex", codexParent, catalog);
    expect(omitted).toEqual([
      {
        site: { role: "bug-fix" },
        app: "codex",
        from: slug("gpt-5.6-sol"),
        to: SOL_CLI_MODEL,
      },
    ]);
    const omittedAccepted = applyAcceptedMigrations(codexParent, omitted, [
      { role: "bug-fix" },
    ]);
    const omittedRoute = omittedAccepted["bug-fix"];
    expect(omittedRoute.kind).toBe("route");
    if (omittedRoute.kind !== "route") return;
    expect(omittedRoute.route.app).toEqual(currentHost());
    expect(omittedRoute.route.model).toBe(SOL_CLI_MODEL);
  });

  it("does not sole-map when a probed list is present", () => {
    const catalog = shippedCatalog();
    const probed = [
      {
        slug: slug("gpt-6.1-sol"),
        selectableEfforts: ["low", "medium", "high", "xhigh", "max"] as const,
        destinationDefaultEffort: "medium" as const,
      },
    ];
    const legal = mustLoad(sheetWith({ "bug-fix": "codex/gpt-6.1-sol@high" }));
    expect(proposeStalePinMigrations("claude-code", legal, catalog, probed)).toEqual([]);

    const retired = mustLoad(sheetWith({ "bug-fix": "codex/gpt-5.6-sol@high" }));
    expect(proposeStalePinMigrations("claude-code", retired, catalog, probed)).toEqual([]);
  });
});
