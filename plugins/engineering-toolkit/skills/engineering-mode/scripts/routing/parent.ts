import { soleModel, type AppCatalog } from "./catalog.ts";
import {
  type AppId,
  type ModelSlug,
  type PanelRoleId,
  type ParentHost,
  type ProbedModel,
  type Result,
  type RoleBinding,
  type RoleMap,
  type SingleRoleId,
} from "./route.ts";
import { PANEL_ROLE_IDS, SINGLE_ROLE_IDS } from "./sheet.ts";

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

export type RouteSite =
  | { readonly role: SingleRoleId }
  | { readonly role: PanelRoleId; readonly lane: number };

export type PinMigration = {
  readonly site: RouteSite;
  readonly app: AppId;
  readonly from: ModelSlug;
  readonly to: ModelSlug;
};

function resolvedApp(binding: RoleBinding): AppId | null {
  if (binding.kind !== "route") return null;
  return binding.route.app;
}

export function proposeStalePinMigrations(
  roles: RoleMap,
  catalog: AppCatalog,
  probed?: readonly ProbedModel[]
): readonly PinMigration[] {
  const migrations: PinMigration[] = [];

  const consider = (site: RouteSite, binding: RoleBinding): void => {
    if (binding.kind !== "route") return;
    const app = resolvedApp(binding);
    if (app === null) return;
    if (catalog.get(app)?.models.has(binding.route.model) === true) return;
    if (probed !== undefined) return;
    const sole = soleModel(app, catalog);
    if (sole === null) return;
    migrations.push({
      site,
      app,
      from: binding.route.model,
      to: sole,
    });
  };

  for (const role of SINGLE_ROLE_IDS) {
    consider({ role }, roles[role]);
  }
  for (const role of PANEL_ROLE_IDS) {
    const lanes = roles[role];
    for (let lane = 0; lane < lanes.length; lane++) {
      consider({ role, lane }, lanes[lane]);
    }
  }
  return migrations;
}

const STORED_GRAMMAR = /^Descriptor grammar: [23]\r?$/m;

export function unwrapStoredSheet(
  stored: string
): Result<string, { readonly tag: "inconsistent-integration" }> {
  if (!stored.startsWith("---")) {
    if (!STORED_GRAMMAR.test(stored)) {
      return { ok: false, error: { tag: "inconsistent-integration" } };
    }
    return { ok: true, value: stored };
  }
  const close = stored.indexOf("\n---\n", 4);
  if (close < 0) return { ok: false, error: { tag: "inconsistent-integration" } };
  const frontmatter = stored.slice(4, close);
  let body = stored.slice(close + 5);
  if (body.startsWith("\n")) body = body.slice(1);
  if (/alwaysApply:\s*true/.test(frontmatter) && !STORED_GRAMMAR.test(body)) {
    return { ok: false, error: { tag: "inconsistent-integration" } };
  }
  return { ok: true, value: body };
}

export function parentIdentityKeys(): Record<ParentHost, readonly string[]> {
  return {
    "claude-code": CLAUDE_IDENTITY,
    codex: CODEX_IDENTITY,
    cursor: CURSOR_IDENTITY,
  };
}
