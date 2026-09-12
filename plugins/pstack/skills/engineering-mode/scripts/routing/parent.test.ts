import { describe, expect, it } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import { shippedCatalog } from "./catalog.ts";
import { planLane } from "./dispatch.ts";
import {
  applyIntegrationPatch,
  detectParent,
  firstRunRoleMap,
  nativeHandle,
  parentIdentityKeys,
  parentProfile,
  pluginAgentName,
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
} from "./route.ts";
import { printRoleMap } from "./sheet.ts";

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
      "arena runners: fable@max, codex/gpt-5.6-sol@max, grok/grok-4.6@xhigh, opus@xhigh"
    );
    expect(cursor).not.toContain("claude-code/fable");
    expect(claude).toBe(cursor);

    const codex = printRoleMap(firstRunRoleMap("codex", catalog));
    expect(codex).toContain("bug-fix: gpt-5.6-sol@max");
    expect(codex).toContain("judgment and prose: claude-code/fable@max");
    expect(codex).toContain(
      "arena runners: claude-code/fable@max, gpt-5.6-sol@max, grok/grok-4.6@xhigh, claude-code/opus@xhigh"
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
      join(homedir(), ".cursor", "rules", "pstack-models.mdc")
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
      line: "@~/.claude/pstack-models.md",
    });
    expect(claude.ok).toBe(true);
    if (!claude.ok) return;
    expect(
      applyIntegrationPatch(claude.value, {
        kind: "ensure-line",
        path: "CLAUDE.md",
        line: "@~/.claude/pstack-models.md",
      })
    ).toEqual(claude);

    const sheet = "# pstack model configuration\n\nDescriptor grammar: 2\n";
    const first = applyIntegrationPatch("prefix\n", {
      kind: "replace-bounded-block",
      path: "AGENTS.md",
      begin: "<!-- pstack:models:begin -->",
      end: "<!-- pstack:models:end -->",
      body: sheet,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(
      applyIntegrationPatch(first.value, {
        kind: "replace-bounded-block",
        path: "AGENTS.md",
        begin: "<!-- pstack:models:begin -->",
        end: "<!-- pstack:models:end -->",
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
