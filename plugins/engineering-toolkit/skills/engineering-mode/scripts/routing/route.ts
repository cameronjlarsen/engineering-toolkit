export const PARENT_HOSTS = ["claude-code", "codex", "cursor"] as const;
export const APP_IDS = ["claude-code", "codex", "cursor", "grok"] as const;
export const CLI_CHILD_APPS = ["claude-code", "codex", "cursor", "grok"] as const;
export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export const SONNET_5_5_MODEL = "claude-sonnet-5-5";

export type ParentHost = (typeof PARENT_HOSTS)[number];
export type AppId = (typeof APP_IDS)[number];
export type CliChildApp = (typeof CLI_CHILD_APPS)[number];
export type Effort = (typeof EFFORTS)[number];
export type ModelSlug = string & { readonly __modelSlug: unique symbol };

export interface Route {
  readonly model: ModelSlug;
  readonly app: AppId;
  readonly effort: Effort;
}

export type InheritBinding =
  | { readonly kind: "inherit-parent" }
  | { readonly kind: "auto" };

export type RoleBinding = InheritBinding | { readonly kind: "route"; readonly route: Route };

export type McpBoundRoleId =
  | "why investigators, synthesizer"
  | "reflect tooling, judgment, divergent, synthesizer";

export type PanelRoleId =
  | "arena runners"
  | "arena cross-judge pool"
  | "architect runners"
  | "interrogate reviewers"
  | "swarm workers";

export type SingleRoleId =
  | "feature, refactoring"
  | "bug-fix"
  | "perf-issue"
  | "hillclimb"
  | "judgment and prose"
  | "hardest tasks"
  | "how explorer"
  | "how explainer"
  | McpBoundRoleId;

export type RoleId = SingleRoleId | PanelRoleId;

export type RoleMap = {
  readonly [K in SingleRoleId]: K extends McpBoundRoleId ? InheritBinding : RoleBinding;
} & {
  readonly [K in PanelRoleId]: readonly RoleBinding[];
};

export interface ProbedModel {
  readonly slug: ModelSlug;
  readonly selectableEfforts: readonly Effort[];
}

export type CliModel =
  | { readonly effort: "flag"; readonly model: string }
  | { readonly effort: "in-slug"; readonly model: `${string}{effort}${string}` };

export interface ModelEntry {
  readonly family: ModelSlug;
  readonly efforts: readonly Effort[];
  readonly cli: CliModel;
}

export interface AppRecord {
  readonly id: AppId;
  readonly models: ReadonlyMap<ModelSlug, ModelEntry>;
}

export type ResolveError = { readonly tag: "invalid-model-slug"; readonly raw: string };

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function modelSlug(raw: string): Result<ModelSlug, ResolveError> {
  if (raw.trim() === "") {
    return { ok: false, error: { tag: "invalid-model-slug", raw } };
  }

  const rollingAlias = /^claude-fable-[0-9]+(?:-[0-9]+)*$/.test(raw)
    ? "fable"
    : /^claude-opus-[0-9]+(?:-[0-9]+)*$/.test(raw)
      ? "opus"
      : null;
  if (rollingAlias !== null) {
    return { ok: true, value: rollingAlias as ModelSlug };
  }

  if (raw === SONNET_5_5_MODEL) {
    return { ok: true, value: raw as ModelSlug };
  }

  if (/^claude-.+-[0-9]+(?:-[a-z0-9]+)*$/i.test(raw)) {
    return { ok: false, error: { tag: "invalid-model-slug", raw } };
  }

  return { ok: true, value: raw as ModelSlug };
}

export function route(input: Route): Route {
  return { model: input.model, app: input.app, effort: input.effort };
}
