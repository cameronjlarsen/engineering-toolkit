import {
  type Access,
  type AppId,
  type AppInventoryEntry,
  type AppRef,
  type Effort,
  type LanePlan,
  type McpBoundRoleId,
  type ParentHost,
  type Readiness,
  type ResolvedRoute,
  type ResolveError,
  type Result,
  type RoleBinding,
  type RoleId,
  type Route,
  type RoutePatch,
  type WorkerPolicy,
  isCliChildApp,
  route,
} from "./route.ts";
import type { AppCatalog } from "./catalog.ts";

const WORKER: WorkerPolicy = {
  mayChooseRoute: false,
  maySpawnAgents: false,
  inheritCoordinatorMcp: false,
};

const MCP_BOUND_ROLES = new Set<McpBoundRoleId>([
  "why investigators, synthesizer",
  "reflect tooling, judgment, divergent, synthesizer",
]);

function isMcpBound(role: RoleId): role is McpBoundRoleId {
  return MCP_BOUND_ROLES.has(role as McpBoundRoleId);
}

function isCurrentHost(app: AppRef | undefined): boolean {
  return app?.kind === "current-host";
}

export function applyOverride(
  binding: RoleBinding,
  patch: RoutePatch | undefined,
  role: RoleId
): Result<RoleBinding, ResolveError> {
  if (patch === undefined) return { ok: true, value: binding };
  if (patch.model === undefined && patch.app === undefined && patch.effort === undefined) {
    return { ok: true, value: binding };
  }
  if (isMcpBound(role) && patch.app?.kind === "named") {
    return { ok: false, error: { tag: "unsupported-external-override", role } };
  }

  if (binding.kind !== "route") {
    if (isMcpBound(role) && isCurrentHost(patch.app) && patch.model === undefined && patch.effort === undefined) {
      return { ok: true, value: binding };
    }
    if (patch.model === undefined) {
      return { ok: false, error: { tag: "inherit-does-not-accept-partial-effort" } };
    }
    return {
      ok: true,
      value: {
        kind: "route",
        route: route({
          model: patch.model,
          app: patch.app,
          effort: patch.effort,
        }),
      },
    };
  }

  return {
    ok: true,
    value: {
      kind: "route",
      route: {
        model: patch.model ?? binding.route.model,
        app: patch.app ?? binding.route.app,
        effort: patch.effort ?? binding.route.effort,
      },
    },
  };
}

function readinessFor(
  app: AppId,
  inventory: readonly AppInventoryEntry[]
): Readiness {
  return inventory.find((entry) => entry.app === app)?.readiness ?? { kind: "unknown" };
}

export function resolveRoute(
  parent: ParentHost,
  configured: Route,
  catalog: AppCatalog,
  inventory: readonly AppInventoryEntry[]
): Result<ResolvedRoute, ResolveError> {
  const app = configured.app.kind === "current-host" ? parent : configured.app.app;
  const appRecord = catalog.get(app);
  const modelRecord = appRecord?.models.get(configured.model);
  if (modelRecord === undefined) {
    return {
      ok: false,
      error: { tag: "app-does-not-serve-model", app, model: configured.model },
    };
  }

  let effort: Effort;
  if (configured.effort.kind === "explicit") {
    effort = configured.effort.effort;
    if (!modelRecord.selectableEfforts.includes(effort)) {
      return {
        ok: false,
        error: { tag: "effort-not-selectable", app, model: configured.model, effort },
      };
    }
  } else {
    const destinationDefault = modelRecord.destinationDefaultEffort;
    if (typeof destinationDefault !== "string") {
      return {
        ok: false,
        error: { tag: "destination-default-unknown", app, model: configured.model },
      };
    }
    effort = destinationDefault;
  }

  const lane = parent === app ? "native" : "external";
  const readiness = readinessFor(app, inventory);
  if (lane === "external") {
    if (readiness.kind === "unknown") return { ok: false, error: { tag: "readiness-unknown", app } };
    if (readiness.kind !== "launch-ready") {
      return { ok: false, error: { tag: "not-launch-ready", app, readiness } };
    }
    if (appRecord?.launch === "none") {
      return { ok: false, error: { tag: "no-launch-interface", app } };
    }
  }

  return { ok: true, value: { model: configured.model, app, effort, lane } };
}

export function planLane(input: {
  readonly parent: ParentHost;
  readonly binding: RoleBinding;
  readonly override: RoutePatch | undefined;
  readonly catalog: AppCatalog;
  readonly inventory: readonly AppInventoryEntry[];
  readonly access: Access;
  readonly role: RoleId;
}): Result<LanePlan, ResolveError> {
  const applied = applyOverride(input.binding, input.override, input.role);
  if (!applied.ok) return applied;
  if (applied.value.kind !== "route") {
    return {
      ok: true,
      value: {
        kind: "native",
        parent: input.parent,
        inherit: true,
        access: input.access,
        worker: WORKER,
      },
    };
  }

  const resolved = resolveRoute(input.parent, applied.value.route, input.catalog, input.inventory);
  if (!resolved.ok) return resolved;
  switch (resolved.value.lane) {
    case "native":
      return {
        ok: true,
        value: {
          kind: "native",
          parent: input.parent,
          route: {
            model: resolved.value.model,
            app: input.parent,
            effort: resolved.value.effort,
            lane: "native",
          },
          access: input.access,
          worker: WORKER,
        },
      };
    case "external": {
      if (!isCliChildApp(resolved.value.app)) {
        return { ok: false, error: { tag: "no-launch-interface", app: resolved.value.app } };
      }
      return {
        ok: true,
        value: {
          kind: "external",
          parent: input.parent,
          route: {
            model: resolved.value.model,
            app: resolved.value.app,
            effort: resolved.value.effort,
            lane: "external",
          },
          launch: {
            app: resolved.value.app,
            model: resolved.value.model,
            effort: resolved.value.effort,
          },
          access: input.access,
          worker: WORKER,
        },
      };
    }
    default: {
      const _exhaustive: never = resolved.value.lane;
      return _exhaustive;
    }
  }
}
