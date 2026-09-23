export const PARENT_HOSTS = ["claude-code", "codex", "cursor"] as const;
export const APP_IDS = ["claude-code", "codex", "cursor", "grok"] as const;
export const CLI_CHILD_APPS = ["claude-code", "codex", "grok"] as const;
export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

export type ParentHost = (typeof PARENT_HOSTS)[number];
export type AppId = (typeof APP_IDS)[number];
export type CliChildApp = (typeof CLI_CHILD_APPS)[number];
export type Effort = (typeof EFFORTS)[number];
export type ChildLaunch = "cli-auth" | "none";
export type ModelSlug = string & { readonly __modelSlug: unique symbol };
export type VendorId = "anthropic" | "openai" | "xai" | "unknown";

export type AppRef =
  | { readonly kind: "current-host" }
  | { readonly kind: "named"; readonly app: AppId };

export type EffortRef =
  | { readonly kind: "destination-default" }
  | { readonly kind: "explicit"; readonly effort: Effort };

export interface Route {
  readonly model: ModelSlug;
  readonly app: AppRef;
  readonly effort: EffortRef;
}

export type InheritBinding =
  | { readonly kind: "inherit-parent" }
  | { readonly kind: "auto" };

export type RoleBinding = InheritBinding | { readonly kind: "route"; readonly route: Route };

export type FailoverRoutes = readonly [Route, Route, ...Route[]];

export type FailoverBinding = {
  readonly kind: "failover";
  readonly routes: FailoverRoutes;
};

export type LaneAssignment = RoleBinding | FailoverBinding;
export type SoloAssignment = LaneAssignment;

export const EFFORT_RANK: Record<Effort, 0 | 1 | 2 | 3 | 4> = {
  low: 0,
  medium: 1,
  high: 2,
  xhigh: 3,
  max: 4,
};

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

export type FailoverRoleId = Exclude<SingleRoleId, McpBoundRoleId> | PanelRoleId;

export type RoleMap = {
  readonly [K in SingleRoleId]: K extends McpBoundRoleId ? InheritBinding : SoloAssignment;
} & {
  readonly [K in PanelRoleId]: readonly LaneAssignment[];
};

export interface RoutePatch {
  readonly model?: ModelSlug;
  readonly app?: AppRef;
  readonly effort?: EffortRef;
}

export type Lane = "native" | "external";

export interface ResolvedRoute {
  readonly model: ModelSlug;
  readonly app: AppId;
  readonly effort: Effort;
  readonly lane: Lane;
}

export type Access =
  | { readonly mode: "read-only"; readonly worktree: null }
  | { readonly mode: "isolated-write"; readonly worktree: IsolatedWorktree };

export interface IsolatedWorktree {
  readonly path: string;
}

export interface WorkerPolicy {
  readonly mayChooseRoute: false;
  readonly maySpawnAgents: false;
  readonly inheritCoordinatorMcp: false;
}

export interface CliLaunchSpec {
  readonly app: CliChildApp;
  readonly model: ModelSlug;
  readonly effort: Effort;
}

export type LanePlan =
  | {
      readonly kind: "native";
      readonly parent: ParentHost;
      readonly inherit: true;
      readonly access: Access;
      readonly worker: WorkerPolicy;
    }
  | {
      readonly kind: "native";
      readonly parent: ParentHost;
      readonly inherit?: false;
      readonly route: ResolvedRoute & { readonly lane: "native"; readonly app: ParentHost };
      readonly access: Access;
      readonly worker: WorkerPolicy;
    }
  | {
      readonly kind: "external";
      readonly parent: ParentHost;
      readonly route: ResolvedRoute & { readonly lane: "external" };
      readonly launch: CliLaunchSpec;
      readonly access: Access;
      readonly worker: WorkerPolicy;
    };

export type Readiness =
  | { readonly kind: "unknown" }
  | { readonly kind: "installed" }
  | { readonly kind: "launch-ready" }
  | { readonly kind: "unavailable"; readonly reason: string };

export interface AppInventoryEntry {
  readonly app: AppId;
  readonly readiness: Readiness;
}

export interface ModelOnApp {
  readonly slug: ModelSlug;
  readonly vendor: VendorId;
  readonly destinationDefaultEffort: Effort | { readonly kind: "unknown" };
  readonly selectableEfforts: readonly Effort[];
  readonly nativeStem: string | null;
}

export interface AppRecord {
  readonly id: AppId;
  readonly launch: ChildLaunch;
  readonly models: ReadonlyMap<ModelSlug, ModelOnApp>;
}

export type DropoutClass =
  | "capacity"
  | "unauthenticated"
  | "unavailable-cli"
  | "unavailable-model"
  | "timed-out"
  | "cancelled"
  | "malformed-output"
  | "child-failed"
  | "resolve-reject";

export type FailoverAuthoringError =
  | { readonly tag: "failover-too-short" }
  | { readonly tag: "failover-duplicate-route" }
  | { readonly tag: "failover-weaker-effort"; readonly model: ModelSlug; readonly app: AppRef }
  | { readonly tag: "failover-requires-explicit-effort" }
  | { readonly tag: "failover-inherit-forbidden" };

export type ResolveError =
  | { readonly tag: "unsupported-external-override"; readonly role: McpBoundRoleId }
  | { readonly tag: "inherit-does-not-accept-partial-effort" }
  | { readonly tag: "app-does-not-serve-model"; readonly app: AppId; readonly model: ModelSlug }
  | { readonly tag: "destination-default-unknown"; readonly app: AppId; readonly model: ModelSlug }
  | { readonly tag: "effort-not-selectable"; readonly app: AppId; readonly model: ModelSlug; readonly effort: Effort }
  | { readonly tag: "readiness-unknown"; readonly app: AppId }
  | { readonly tag: "not-launch-ready"; readonly app: AppId; readonly readiness: Readiness }
  | { readonly tag: "no-launch-interface"; readonly app: AppId }
  | { readonly tag: "invalid-model-slug"; readonly raw: string };

export type SoloRoleStop =
  | { readonly tag: "complete"; readonly attemptIndex: number }
  | { readonly tag: "chain-exhausted"; readonly last: DropoutClass }
  | { readonly tag: "non-capacity-dropout"; readonly class: Exclude<DropoutClass, "capacity"> }
  | ResolveError
  | { readonly tag: "attempt-already-observed" }
  | { readonly tag: "unknown-readiness-is-not-failover"; readonly app: AppId };

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

  if (/^claude-.+-[0-9]+(?:-[0-9]+)*$/.test(raw)) {
    return { ok: false, error: { tag: "invalid-model-slug", raw } };
  }

  return { ok: true, value: raw as ModelSlug };
}

export function currentHost(): AppRef {
  return { kind: "current-host" };
}

export function namedApp(app: AppId): AppRef {
  return { kind: "named", app };
}

export function isParentHost(id: AppId): id is ParentHost {
  return (PARENT_HOSTS as readonly string[]).includes(id);
}

export function isCliChildApp(id: AppId): id is CliChildApp {
  return (CLI_CHILD_APPS as readonly string[]).includes(id);
}

export function destinationDefault(): EffortRef {
  return { kind: "destination-default" };
}

export function explicitEffort(effort: Effort): EffortRef {
  return { kind: "explicit", effort };
}

export function route(input: {
  readonly model: ModelSlug;
  readonly app?: AppRef;
  readonly effort?: EffortRef;
}): Route {
  return {
    model: input.model,
    app: input.app ?? currentHost(),
    effort: input.effort ?? destinationDefault(),
  };
}

export function printRouteWire(configured: Route): string {
  const app = configured.app.kind === "named" ? `${configured.app.app}/` : "";
  const effort = configured.effort.kind === "explicit" ? `@${configured.effort.effort}` : "";
  return `${app}${configured.model}${effort}`;
}
