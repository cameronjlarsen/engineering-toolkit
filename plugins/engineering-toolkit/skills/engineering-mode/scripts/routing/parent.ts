import { homedir } from "node:os";
import { join } from "node:path";
import { launchHome, type AppCatalog } from "./catalog.ts";
import {
  type Effort,
  type LanePlan,
  type ModelSlug,
  type ParentHost,
  type Result,
  type RoleMap,
  currentHost,
  explicitEffort,
  modelSlug,
  namedApp,
  route,
} from "./route.ts";

export type PluginAgentName = string & { readonly __pluginAgentName: unique symbol };

export type NativeHandle =
  | { readonly kind: "inherit"; readonly wrapper: "engineering-agent" }
  | { readonly kind: "plugin-agent"; readonly name: PluginAgentName }
  | { readonly kind: "host-spawn"; readonly model: ModelSlug; readonly effort: Effort };

export type ParentDetectError =
  | { readonly tag: "unknown-parent" }
  | { readonly tag: "ambiguous-parent"; readonly candidates: readonly ParentHost[] };

export interface ParentSurface {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly tools: ReadonlySet<string>;
}

export type IntegrationPatch =
  | { readonly kind: "none" }
  | { readonly kind: "ensure-line"; readonly path: string; readonly line: string }
  | {
      readonly kind: "replace-bounded-block";
      readonly path: string;
      readonly begin: string;
      readonly end: string;
      readonly body: string;
    };

export interface ParentProfile {
  readonly parent: ParentHost;
  readonly sheetPath: string;
  readonly identityKeys: readonly string[];
  readonly mappingDoc: "provider-dispatch.md" | "codex-tools.md" | "cursor-tools.md";
  readonly integration:
    | { readonly kind: "at-include"; readonly path: string; readonly line: string }
    | {
        readonly kind: "bounded-block";
        readonly path: string;
        readonly begin: "<!-- engineering-toolkit:models:begin -->";
        readonly end: "<!-- engineering-toolkit:models:end -->";
      }
    | { readonly kind: "mdc-sheet" };
}

export interface RenderedParentFiles {
  readonly sheet: { readonly path: string; readonly contents: string };
  readonly integration: IntegrationPatch;
}

const CLAUDE_IDENTITY = [
  "CLAUDECODE",
  "CLAUDE_CODE_CHILD_SESSION",
  "CLAUDE_CODE_SESSION_ID",
  "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS",
] as const;

const CODEX_IDENTITY = [
  "CODEX_THREAD_ID",
  "CODEX_SESSION_ID",
  "CODEX_CI",
  "CODEX_SHELL",
  "CODEX_SANDBOX",
  "CODEX_SANDBOX_NETWORK_DISABLED",
  "CODEX_INTERNAL_ORIGINATOR_OVERRIDE",
] as const;

const CURSOR_IDENTITY = ["CURSOR_AGENT"] as const;

const MDC_FRONTMATTER = `---
description: Engineering Toolkit model configuration
alwaysApply: true
---
`;

const FAMILY_SEED = [
  { family: "fable", model: "fable", effort: "max" },
  { family: "sol", model: "gpt-5.6-sol", effort: "max" },
  { family: "grok", model: "grok-4.6", effort: "xhigh" },
  { family: "opus", model: "opus", effort: "xhigh" },
] as const;

type FamilyId = (typeof FAMILY_SEED)[number]["family"];

const SINGLE_FAMILY: Record<
  Exclude<
    keyof RoleMap,
    | "arena runners"
    | "arena cross-judge pool"
    | "architect runners"
    | "interrogate reviewers"
    | "swarm workers"
    | "why investigators, synthesizer"
    | "reflect tooling, judgment, divergent, synthesizer"
  >,
  FamilyId
> = {
  "feature, refactoring": "grok",
  "bug-fix": "sol",
  "perf-issue": "sol",
  hillclimb: "sol",
  "judgment and prose": "fable",
  "hardest tasks": "fable",
  "how explorer": "grok",
  "how explainer": "fable",
};

function requiredSlug(raw: string): ModelSlug {
  const parsed = modelSlug(raw);
  if (!parsed.ok) throw new Error(`invalid shipped model: ${raw}`);
  return parsed.value;
}

function familyOf(id: FamilyId): (typeof FAMILY_SEED)[number] {
  const row = FAMILY_SEED.find((entry) => entry.family === id);
  if (row === undefined) throw new Error(`unknown family: ${id}`);
  return row;
}

export function serveLocally(
  parent: ParentHost,
  model: ModelSlug,
  catalog: AppCatalog
): boolean {
  return catalog.get(parent)?.models.has(model) === true;
}

function familyBinding(
  parent: ParentHost,
  catalog: AppCatalog,
  family: FamilyId
): RoleMap["feature, refactoring"] {
  const row = familyOf(family);
  const model = requiredSlug(row.model);
  const home = launchHome(model, catalog);
  if (home === null) throw new Error(`no unique CLI home for ${row.model}`);
  return {
    kind: "route",
    route: route({
      model,
      app: serveLocally(parent, model, catalog) ? currentHost() : namedApp(home),
      effort: explicitEffort(row.effort),
    }),
  };
}

export function detectParent(
  surface: ParentSurface
): Result<ParentHost, ParentDetectError> {
  let toolHit: ParentHost | null = null;
  if (surface.tools.has("spawn_agent")) toolHit = "codex";
  else if (surface.tools.has("Task")) toolHit = "cursor";
  else if (surface.tools.has("Agent")) toolHit = "claude-code";

  const envHits = new Set<ParentHost>();
  if (surface.env.CLAUDECODE) envHits.add("claude-code");
  if (surface.env.CODEX_THREAD_ID || surface.env.CODEX_CI) envHits.add("codex");
  if (surface.env.CURSOR_AGENT) envHits.add("cursor");

  if (toolHit !== null) {
    if (envHits.size > 0 && !envHits.has(toolHit)) {
      return {
        ok: false,
        error: {
          tag: "ambiguous-parent",
          candidates: [...new Set([toolHit, ...envHits])],
        },
      };
    }
    return { ok: true, value: toolHit };
  }

  if (envHits.size === 1) return { ok: true, value: [...envHits][0] };
  if (envHits.size > 1) {
    return {
      ok: false,
      error: { tag: "ambiguous-parent", candidates: [...envHits] },
    };
  }
  return { ok: false, error: { tag: "unknown-parent" } };
}

export function parentProfile(parent: ParentHost): ParentProfile {
  const home = homedir();
  if (parent === "claude-code") {
    const sheetPath = join(home, ".claude", "engineering-toolkit-models.md");
    return {
      parent,
      sheetPath,
      identityKeys: CLAUDE_IDENTITY,
      mappingDoc: "provider-dispatch.md",
      integration: {
        kind: "at-include",
        path: join(home, ".claude", "CLAUDE.md"),
        line: "@~/.claude/engineering-toolkit-models.md",
      },
    };
  }
  if (parent === "codex") {
    const sheetPath = join(home, ".codex", "engineering-toolkit-models.md");
    return {
      parent,
      sheetPath,
      identityKeys: CODEX_IDENTITY,
      mappingDoc: "codex-tools.md",
      integration: {
        kind: "bounded-block",
        path: join(home, ".codex", "AGENTS.md"),
        begin: "<!-- engineering-toolkit:models:begin -->",
        end: "<!-- engineering-toolkit:models:end -->",
      },
    };
  }
  return {
    parent,
    sheetPath: join(home, ".cursor", "rules", "engineering-toolkit-models.mdc"),
    identityKeys: CURSOR_IDENTITY,
    mappingDoc: "cursor-tools.md",
    integration: { kind: "mdc-sheet" },
  };
}

export function firstRunRoleMap(parent: ParentHost, catalog: AppCatalog): RoleMap {
  const panel = [
    familyBinding(parent, catalog, "fable"),
    familyBinding(parent, catalog, "sol"),
    familyBinding(parent, catalog, "grok"),
    familyBinding(parent, catalog, "opus"),
  ] as const;
  return {
    "feature, refactoring": familyBinding(parent, catalog, SINGLE_FAMILY["feature, refactoring"]),
    "bug-fix": familyBinding(parent, catalog, SINGLE_FAMILY["bug-fix"]),
    "perf-issue": familyBinding(parent, catalog, SINGLE_FAMILY["perf-issue"]),
    hillclimb: familyBinding(parent, catalog, SINGLE_FAMILY.hillclimb),
    "judgment and prose": familyBinding(parent, catalog, SINGLE_FAMILY["judgment and prose"]),
    "hardest tasks": familyBinding(parent, catalog, SINGLE_FAMILY["hardest tasks"]),
    "how explorer": familyBinding(parent, catalog, SINGLE_FAMILY["how explorer"]),
    "how explainer": familyBinding(parent, catalog, SINGLE_FAMILY["how explainer"]),
    "why investigators, synthesizer": { kind: "inherit-parent" },
    "reflect tooling, judgment, divergent, synthesizer": { kind: "inherit-parent" },
    "arena runners": panel,
    "arena cross-judge pool": panel,
    "swarm workers": [familyBinding(parent, catalog, "grok")],
    "architect runners": panel,
    "interrogate reviewers": panel,
  };
}

export function pluginAgentName(stem: string, effort: Effort): PluginAgentName {
  return `pstack-${stem}-${effort}` as PluginAgentName;
}

export function nativeHandle(
  plan: Extract<LanePlan, { kind: "native" }>,
  catalog: AppCatalog
): NativeHandle {
  if (plan.inherit === true) {
    return { kind: "inherit", wrapper: "engineering-agent" };
  }
  const model = catalog.get(plan.parent)?.models.get(plan.route.model);
  if (model?.nativeStem) {
    return {
      kind: "plugin-agent",
      name: pluginAgentName(model.nativeStem, plan.route.effort),
    };
  }
  return {
    kind: "host-spawn",
    model: plan.route.model,
    effort: plan.route.effort,
  };
}

export function unwrapStoredSheet(
  stored: string
): Result<string, { readonly tag: "inconsistent-integration" }> {
  if (!stored.startsWith("---")) {
    if (!stored.includes("Descriptor grammar: 2")) {
      return { ok: false, error: { tag: "inconsistent-integration" } };
    }
    return { ok: true, value: stored };
  }
  const close = stored.indexOf("\n---\n", 4);
  if (close < 0) return { ok: false, error: { tag: "inconsistent-integration" } };
  const frontmatter = stored.slice(4, close);
  let body = stored.slice(close + 5);
  if (body.startsWith("\n")) body = body.slice(1);
  if (/alwaysApply:\s*true/.test(frontmatter) && !body.includes("Descriptor grammar: 2")) {
    return { ok: false, error: { tag: "inconsistent-integration" } };
  }
  return { ok: true, value: body };
}

export function wrapMdc(grammar2: string): string {
  const unwrapped = unwrapStoredSheet(grammar2);
  const body = unwrapped.ok ? unwrapped.value : grammar2;
  const normalized = body.endsWith("\n") ? body : `${body}\n`;
  return `${MDC_FRONTMATTER}\n${normalized}`;
}

export function renderParentFiles(
  profile: ParentProfile,
  sheetText: string
): RenderedParentFiles {
  if (profile.integration.kind === "mdc-sheet") {
    return {
      sheet: { path: profile.sheetPath, contents: wrapMdc(sheetText) },
      integration: { kind: "none" },
    };
  }
  if (profile.integration.kind === "at-include") {
    return {
      sheet: { path: profile.sheetPath, contents: sheetText },
      integration: {
        kind: "ensure-line",
        path: profile.integration.path,
        line: profile.integration.line,
      },
    };
  }
  return {
    sheet: { path: profile.sheetPath, contents: sheetText },
    integration: {
      kind: "replace-bounded-block",
      path: profile.integration.path,
      begin: profile.integration.begin,
      end: profile.integration.end,
      body: sheetText,
    },
  };
}

function countNeedle(haystack: string, needle: string): number {
  let count = 0;
  let from = 0;
  while (from < haystack.length) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) break;
    count += 1;
    from = at + needle.length;
  }
  return count;
}

export function applyIntegrationPatch(
  currentBytes: string | null,
  patch: IntegrationPatch
): Result<string, { readonly tag: "inconsistent-integration" }> {
  if (patch.kind === "none") return { ok: true, value: currentBytes ?? "" };
  if (patch.kind === "ensure-line") {
    const current = currentBytes ?? "";
    const lines = current.split(/\r?\n/);
    if (lines.includes(patch.line)) return { ok: true, value: current };
    const prefix = current.length === 0 || current.endsWith("\n") ? current : `${current}\n`;
    return { ok: true, value: `${prefix}${patch.line}\n` };
  }
  const body = patch.body.endsWith("\n") ? patch.body : `${patch.body}\n`;
  const block = `${patch.begin}\n${body}${patch.end}\n`;
  if (currentBytes === null || currentBytes.length === 0) {
    return { ok: true, value: block };
  }
  const begins = countNeedle(currentBytes, patch.begin);
  const ends = countNeedle(currentBytes, patch.end);
  if (begins === 0 && ends === 0) {
    const prefix = currentBytes.endsWith("\n") ? currentBytes : `${currentBytes}\n`;
    return { ok: true, value: `${prefix}${block}` };
  }
  const beginAt = currentBytes.indexOf(patch.begin);
  const endAt = currentBytes.indexOf(patch.end);
  if (begins !== 1 || ends !== 1 || beginAt < 0 || endAt <= beginAt) {
    return { ok: false, error: { tag: "inconsistent-integration" } };
  }
  return {
    ok: true,
    value:
      currentBytes.slice(0, beginAt) +
      block +
      currentBytes.slice(endAt + patch.end.length).replace(/^\r?\n/, ""),
  };
}

export function parentIdentityKeys(): Record<ParentHost, readonly string[]> {
  return {
    "claude-code": CLAUDE_IDENTITY,
    codex: CODEX_IDENTITY,
    cursor: CURSOR_IDENTITY,
  };
}
