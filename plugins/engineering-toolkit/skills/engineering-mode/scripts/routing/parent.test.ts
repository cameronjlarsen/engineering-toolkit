import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { shippedCatalog, SOL_CLI_MODEL } from "./catalog.ts";
import { planLane, resolveRoute } from "./dispatch.ts";
import {
  applyAcceptedMigrations,
  applyIntegrationPatch,
  applyOpencodeInstructions,
  detectParent,
  firstRunRoleMap,
  nativeHandle,
  opencodeLaneName,
  parentIdentityKeys,
  parentProfile,
  pluginAgentName,
  proposeStalePinMigrations,
  renderOpencodeLane,
  renderParentFiles,
  unwrapStoredSheet,
  wrapMdc,
} from "./parent.ts";
import {
  modelSlug,
  route,
  type Access,
  type ParentHost,
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
    expect(
      detectParent({ env: { OPENCODE: "1" }, tools: new Set() })
    ).toEqual({ ok: true, value: "opencode" });
    expect(
      detectParent({ env: { OPENCODE_PID: "123" }, tools: new Set() })
    ).toEqual({ ok: true, value: "opencode" });
  });

  it("detects OpenCode from its lowercase skill tool", () => {
    expect(detectParent({ env: {}, tools: new Set(["skill"]) })).toEqual({
      ok: true,
      value: "opencode",
    });
    expect(
      detectParent({ env: { OPENCODE: "1" }, tools: new Set(["skill"]) })
    ).toEqual({ ok: true, value: "opencode" });
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
  it("uses the parent's provider when the parent serves the model", () => {
    const catalog = shippedCatalog();
    const cursor = printRoleMap(firstRunRoleMap("cursor", catalog));
    const claude = printRoleMap(firstRunRoleMap("claude-code", catalog));
    expect(cursor).toContain("judgment and prose: cursor:fable@max");
    expect(cursor).toContain("hardest tasks: cursor:fable@max");
    expect(cursor).toContain(
      "arena runners: cursor:fable@max, codex:gpt-6-sol@max, cursor:grok-4.7@xhigh, cursor:opus@xhigh"
    );
    expect(cursor).not.toContain("claude-code/fable");
    expect(cursor).not.toContain("grok/grok-4.7");
    expect(cursor).not.toContain("claude:fable");
    expect(cursor).not.toContain("grok:grok-4.7");
    expect(cursor).not.toContain("claude-sonnet-5-5");
    expect(claude).toContain(
      "arena runners: claude:fable@max, codex:gpt-6-sol@max, grok:grok-4.7@xhigh, claude:opus@xhigh"
    );

    const codex = printRoleMap(firstRunRoleMap("codex", catalog));
    expect(codex).toContain("bug-fix: codex:gpt-6-sol@max");
    expect(codex).toContain("judgment and prose: claude:fable@max");
    expect(codex).toContain(
      "arena runners: claude:fable@max, codex:gpt-6-sol@max, grok:grok-4.7@xhigh, claude:opus@xhigh"
    );
  });

  it("writes a sheet that loads back on every parent", () => {
    const catalog = shippedCatalog();
    for (const parent of ["claude-code", "codex", "cursor", "opencode"] as const satisfies readonly ParentHost[]) {
      const roles = firstRunRoleMap(parent, catalog);
      expect(loadRoleMap(printRoleMap(roles), parent)).toEqual({ ok: true, value: roles });
    }
  });

  it("seeds OpenCode with upstream externals until setup selects opencode families", () => {
    const printed = printRoleMap(firstRunRoleMap("opencode", shippedCatalog()));
    expect(printed).toContain("bug-fix: codex:gpt-6-sol@max");
    expect(printed).toContain("judgment and prose: claude:fable@max");
    expect(printed).toContain(
      "arena runners: claude:fable@max, codex:gpt-6-sol@max, grok:grok-4.7@xhigh, opencode:opus@xhigh"
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
          app: "cursor",
          effort: "max",
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

  it("names the Sonnet 5.5 plugin agent on Claude Code and Cursor", () => {
    for (const parent of ["claude-code", "cursor"] as const) {
      const planned = planLane({
        parent,
        binding: {
          kind: "route",
          route: route({
          model: slug("claude-sonnet-5-5"),
            app: parent,
            effort: "medium",
          }),
        },
        override: undefined,
        catalog: shippedCatalog(),
        inventory: parent === "claude-code"
          ? [{ app: "claude-code", readiness: { kind: "launch-ready" } }]
          : [],
        access,
        role: "feature, refactoring",
      });
      expect(planned.ok).toBe(true);
      if (!planned.ok) throw new Error(`route failed for ${parent}`);
      expect(planned.value.kind).toBe("native");
      if (planned.value.kind !== "native") {
        throw new Error(`expected a native Sonnet route for ${parent}`);
      }
      expect(nativeHandle(planned.value, shippedCatalog())).toEqual({
        kind: "plugin-agent",
        name: pluginAgentName("sonnet", "medium"),
      });
    }
  });

  it("maps cursor:grok-4.7 on a cursor parent to host-spawn", () => {
    const planned = planLane({
      parent: "cursor",
      binding: {
        kind: "route",
        route: route({
          model: slug("grok-4.7"),
          app: "cursor",
          effort: "xhigh",
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
      model: slug("grok-4.7"),
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

  it("plans opencode:glm-5.3 natively on an opencode parent as host-spawn", () => {
    const planned = planLane({
      parent: "opencode",
      binding: {
        kind: "route",
        route: route({
          model: slug("glm-5.3"),
          app: "opencode",
          effort: "max",
        }),
      },
      override: undefined,
      catalog: shippedCatalog(),
      inventory: [],
      access,
      role: "architect runners",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok || planned.value.kind !== "native" || !("route" in planned.value)) {
      throw new Error("expected a routed opencode native lane");
    }
    expect(planned.value.route.app).toBe("opencode");
    expect(nativeHandle(planned.value, shippedCatalog())).toEqual({
      kind: "host-spawn",
      model: slug("glm-5.3"),
      effort: "max",
    });
  });
});

describe("parent files", () => {
  it("persists Cursor as one always-apply grammar 3 mdc", () => {
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

    const sheet = "# Engineering Toolkit model configuration\n\nDescriptor grammar: 3\n";
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
    expect(parentIdentityKeys().opencode).toEqual(["OPENCODE", "OPENCODE_PID"]);
  });

  it("wires OpenCode through an instructions entry plus generated lanes", () => {
    const profile = parentProfile("opencode");
    expect(profile.sheetPath).toBe(
      join(homedir(), ".config", "opencode", "engineering-toolkit-models.md")
    );
    expect(profile.mappingDoc).toBe("opencode-tools.md");
    expect(profile.integration).toEqual({
      kind: "opencode-instructions",
      path: join(homedir(), ".config", "opencode", "opencode.json"),
      entry: profile.sheetPath,
    });
    const sheet = printRoleMap(firstRunRoleMap("opencode", shippedCatalog()));
    const files = renderParentFiles(profile, sheet);
    expect(files.sheet).toEqual({ path: profile.sheetPath, contents: sheet });
    expect(files.integration).toEqual({
      kind: "opencode-instructions",
      path: join(homedir(), ".config", "opencode", "opencode.json"),
      entry: profile.sheetPath,
    });
  });

  it("inserts the OpenCode instructions entry idempotently", () => {
    const entry = "/home/u/.config/opencode/engineering-toolkit-models.md";
    const fresh = applyOpencodeInstructions(null, entry);
    expect(fresh).toEqual({
      ok: true,
      value: `${JSON.stringify({ instructions: [entry] }, null, 2)}\n`,
    });
    const merged = applyOpencodeInstructions(
      JSON.stringify({ model: "x/y", instructions: ["AGENTS.md"] }, null, 2),
      entry
    );
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    const parsed = JSON.parse(merged.value) as { instructions: string[]; model: string };
    expect(parsed.instructions).toEqual(["AGENTS.md", entry]);
    expect(parsed.model).toBe("x/y");
    expect(applyOpencodeInstructions(merged.value, entry)).toEqual(merged);
  });

  it("rejects non-JSON and non-array OpenCode instructions state", () => {
    const entry = "/sheet.md";
    expect(applyOpencodeInstructions("not json {", entry)).toEqual({
      ok: false,
      error: { tag: "inconsistent-integration" },
    });
    expect(
      applyOpencodeInstructions(JSON.stringify({ instructions: "AGENTS.md" }), entry)
    ).toEqual({ ok: false, error: { tag: "inconsistent-integration" } });
    expect(
      applyOpencodeInstructions(JSON.stringify({ instructions: [42] }), entry)
    ).toEqual({ ok: false, error: { tag: "inconsistent-integration" } });
  });

  it("renders pinned opencode lane files with edit-deny read-only lanes", () => {
    expect(opencodeLaneName(slug("glm-5.3"), "max")).toBe("pstack-glm-5.3-max.md");
    const readOnly = renderOpencodeLane({
      descriptor: "opencode:glm-5.3@max",
      concreteModel: "opencode-go/glm-5.3",
      readOnly: true,
    });
    expect(readOnly).toContain("model: opencode-go/glm-5.3");
    expect(readOnly).toContain("mode: subagent");
    expect(readOnly).toContain("opencode:glm-5.3@max");
    expect(readOnly).toContain("permission:\n  edit: deny");
    const writer = renderOpencodeLane({
      descriptor: "opencode:glm-5.3@max",
      concreteModel: "opencode-go/glm-5.3",
      readOnly: false,
    });
    expect(writer).not.toContain("edit: deny");
  });

  it("binds the renderer byte-for-byte to the lane templates in setup", () => {
    const setup = readFileSync(
      join(import.meta.dir, "../../../../skills/setup-engineering-toolkit/SKILL.md"),
      "utf8"
    ).replaceAll("\r\n", "\n");
    const fences = [...setup.matchAll(/```lane\n([\s\S]*?)```/g)].map((match) => match[1]);
    expect(fences).toHaveLength(2);
    const [readOnlyTemplate, writerTemplate] = fences as [string, string];
    expect(
      renderOpencodeLane({
        descriptor: "opencode:glm-5.3@max",
        concreteModel: "opencode-go/glm-5.3",
        readOnly: true,
      })
    ).toBe(readOnlyTemplate);
    expect(
      renderOpencodeLane({
        descriptor: "opencode:glm-5.3@max",
        concreteModel: "opencode-go/glm-5.3",
        readOnly: false,
      })
    ).toBe(writerTemplate);
  });
});

describe("claude:fable from cursor stays external", () => {
  it("does not rewrite to Task", () => {
    const planned = planLane({
      parent: "cursor",
      binding: {
        kind: "route",
        route: route({
          model: slug("fable"),
          app: "claude-code",
          effort: "max",
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

describe("opencode lanes stay native-only", () => {
  it("rejects an opencode route from any other parent", () => {
    const planned = planLane({
      parent: "claude-code",
      binding: {
        kind: "route",
        route: route({
          model: slug("glm-5.3"),
          app: "opencode",
          effort: "max",
        }),
      },
      override: undefined,
      catalog: shippedCatalog(),
      inventory: [{ app: "opencode", readiness: { kind: "launch-ready" } }],
      access,
      role: "architect runners",
    });
    expect(planned.ok).toBe(false);
    if (planned.ok) return;
    expect(planned.error).toEqual({ tag: "no-launch-interface", app: "opencode" });
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
      sheetWith({ "bug-fix": "codex:gpt-5.6-sol@high" })
    );
    expect(printRoleMap(roles)).toContain("bug-fix: codex:gpt-5.6-sol@high");

    const proposals = proposeStalePinMigrations(roles, catalog);
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
      "bug-fix: codex:gpt-5.6-sol@high"
    );

    const accepted = applyAcceptedMigrations(roles, proposals, [{ role: "bug-fix" }]);
    const fixed = accepted["bug-fix"];
    expect(fixed.kind).toBe("route");
    if (fixed.kind !== "route") return;
    expect(fixed.route.model).toBe(SOL_CLI_MODEL);
    expect(fixed.route.effort).toBe("high");
    expect(fixed.route.app).toBe("codex");
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
    expect(proposeStalePinMigrations(accepted, catalog)).toEqual([]);
    expect(
      applyAcceptedMigrations(accepted, proposeStalePinMigrations(accepted, catalog), [
        { role: "bug-fix" },
      ])
    ).toEqual(accepted);

    expect(
      proposeStalePinMigrations(
        mustLoad(sheetWith({ "bug-fix": "claude:fable@max" })),
        catalog
      )
    ).toEqual([]);

    const typo = mustLoad(sheetWith({ "bug-fix": "codex:gpt-6-sool@high" }));
    const typoProposals = proposeStalePinMigrations(typo, catalog);
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
            app: "codex",
            effort: "max",
          }),
        },
      }),
      "codex"
    );
    const omitted = proposeStalePinMigrations(codexParent, catalog);
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
    expect(omittedRoute.route.app).toBe("codex");
    expect(omittedRoute.route.model).toBe(SOL_CLI_MODEL);
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
