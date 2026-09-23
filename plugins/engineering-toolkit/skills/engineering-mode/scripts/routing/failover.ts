import { join } from "node:path";
import type { AppCatalog } from "./catalog.ts";
import { planLane } from "./dispatch.ts";
import type { RunnerReceipt } from "../runner/types.ts";
import {
  EFFORT_RANK,
  type Access,
  type AppInventoryEntry,
  type DropoutClass,
  type FailoverAuthoringError,
  type FailoverBinding,
  type LanePlan,
  type FailoverRoleId,
  type ParentHost,
  type Result,
  type ResolveError,
  type RoleBinding,
  type RoleMap,
  type Route,
  type SoloAssignment,
  type SoloRoleStop,
  printRouteWire,
} from "./route.ts";

function sameApp(left: Route["app"], right: Route["app"]): boolean {
  if (left.kind === "current-host" && right.kind === "current-host") return true;
  if (left.kind === "named" && right.kind === "named") return left.app === right.app;
  return false;
}

export function failoverBinding(
  routes: readonly Route[]
): Result<FailoverBinding, FailoverAuthoringError> {
  if (routes.length < 2) {
    return { ok: false, error: { tag: "failover-too-short" } };
  }

  for (const hop of routes) {
    if (hop.effort.kind === "destination-default") {
      return { ok: false, error: { tag: "failover-requires-explicit-effort" } };
    }
  }

  const seen = new Set<string>();
  for (const hop of routes) {
    const identity = printRouteWire(hop);
    if (seen.has(identity)) {
      return { ok: false, error: { tag: "failover-duplicate-route" } };
    }
    seen.add(identity);
  }

  for (let later = 1; later < routes.length; later += 1) {
    const next = routes[later];
    if (next.effort.kind !== "explicit") continue;
    for (let earlier = 0; earlier < later; earlier += 1) {
      const prev = routes[earlier];
      if (prev.effort.kind !== "explicit") continue;
      if (prev.model !== next.model || !sameApp(prev.app, next.app)) continue;
      if (EFFORT_RANK[next.effort.effort] < EFFORT_RANK[prev.effort.effort]) {
        return {
          ok: false,
          error: {
            tag: "failover-weaker-effort",
            model: next.model,
            app: next.app,
          },
        };
      }
    }
  }

  return {
    ok: true,
    value: { kind: "failover", routes: routes as FailoverBinding["routes"] },
  };
}

export interface AttemptLocator {
  readonly attemptIndex: number;
  readonly promptPath: string;
  readonly outputPath: string;
  readonly receiptPath: string;
}

export interface SoloAttempt {
  readonly attemptIndex: number;
  readonly binding: RoleBinding;
  readonly plan: LanePlan;
  readonly paths: AttemptLocator;
}

export interface SoloRoleSession {
  readonly role: FailoverRoleId;
  readonly assignment: SoloAssignment;
  readonly attempt: SoloAttempt;
  readonly observed: readonly DropoutClass[];
  readonly parent: ParentHost;
  readonly catalog: AppCatalog;
  readonly inventory: readonly AppInventoryEntry[];
  readonly access: Access;
  readonly runRoot: string;
}

export type LaneEvidence =
  | {
      readonly source: "external";
      readonly receipt: RunnerReceipt;
    }
  | {
      readonly source: "native";
      readonly status: Exclude<DropoutClass, "capacity"> | "complete" | "capacity";
      readonly message: string;
      readonly evidence: string;
    };

function locator(runRoot: string, attemptIndex: number): AttemptLocator {
  const dir = join(runRoot, `attempt-${attemptIndex}`);
  return {
    attemptIndex,
    promptPath: join(dir, "prompt"),
    outputPath: join(dir, "output"),
    receiptPath: join(dir, "receipt"),
  };
}

function firstBinding(assignment: SoloAssignment): RoleBinding {
  if (assignment.kind === "failover") {
    return { kind: "route", route: assignment.routes[0] };
  }
  return assignment;
}

function nextBinding(
  assignment: SoloAssignment,
  nextIndex: number
): RoleBinding | null {
  if (assignment.kind !== "failover") return null;
  if (nextIndex >= assignment.routes.length) return null;
  return { kind: "route", route: assignment.routes[nextIndex] };
}

export function classifyLaneEvidence(evidence: LaneEvidence): "complete" | DropoutClass {
  if (evidence.source === "native") {
    return evidence.status;
  }
  switch (evidence.receipt.status) {
    case "complete":
      return "complete";
    case "capacity-exhausted":
      return "capacity";
    case "cancelled":
      return "cancelled";
    case "unavailable-cli":
      return "unavailable-cli";
    case "unauthenticated":
      return "unauthenticated";
    case "unavailable-model":
      return "unavailable-model";
    case "timed-out":
      return "timed-out";
    case "child-failed":
      return "child-failed";
    case "malformed-output":
      return "malformed-output";
    default: {
      const _exhaustive: never = evidence.receipt.status;
      return _exhaustive;
    }
  }
}

export function beginSoloRole(input: {
  readonly parent: ParentHost;
  readonly role: FailoverRoleId;
  readonly assignment: SoloAssignment;
  readonly catalog: AppCatalog;
  readonly inventory: readonly AppInventoryEntry[];
  readonly access: Access;
  readonly runRoot: string;
}): Result<SoloRoleSession, ResolveError> {
  const binding = firstBinding(input.assignment);
  const planned = planLane({
    parent: input.parent,
    binding,
    override: undefined,
    catalog: input.catalog,
    inventory: input.inventory,
    access: input.access,
    role: input.role,
  });
  if (!planned.ok) return planned;
  return {
    ok: true,
    value: {
      role: input.role,
      assignment: input.assignment,
      attempt: {
        attemptIndex: 0,
        binding,
        plan: planned.value,
        paths: locator(input.runRoot, 0),
      },
      observed: [],
      parent: input.parent,
      catalog: input.catalog,
      inventory: input.inventory,
      access: input.access,
      runRoot: input.runRoot,
    },
  };
}

export function observeSoloRole(
  session: SoloRoleSession,
  evidence: LaneEvidence
): Result<SoloRoleSession, SoloRoleStop> {
  if (session.observed.length !== session.attempt.attemptIndex) {
    return { ok: false, error: { tag: "attempt-already-observed" } };
  }
  const classified = classifyLaneEvidence(evidence);
  if (classified === "complete") {
    return {
      ok: false,
      error: { tag: "complete", attemptIndex: session.attempt.attemptIndex },
    };
  }
  if (classified !== "capacity") {
    return { ok: false, error: { tag: "non-capacity-dropout", class: classified } };
  }
  const nextIndex = session.attempt.attemptIndex + 1;
  const binding = nextBinding(session.assignment, nextIndex);
  if (binding === null) {
    return { ok: false, error: { tag: "chain-exhausted", last: "capacity" } };
  }
  const planned = planLane({
    parent: session.parent,
    binding,
    override: undefined,
    catalog: session.catalog,
    inventory: session.inventory,
    access: session.access,
    role: session.role,
  });
  if (!planned.ok) {
    if (planned.error.tag === "readiness-unknown") {
      return {
        ok: false,
        error: { tag: "unknown-readiness-is-not-failover", app: planned.error.app },
      };
    }
    return planned;
  }
  return {
    ok: true,
    value: {
      ...session,
      attempt: {
        attemptIndex: nextIndex,
        binding,
        plan: planned.value,
        paths: locator(session.runRoot, nextIndex),
      },
      observed: [...session.observed, "capacity"],
    },
  };
}

export function selectedRoutes(map: RoleMap): readonly Route[] {
  const collected: Route[] = [];
  const takeBinding = (binding: RoleBinding): void => {
    if (binding.kind === "route") collected.push(binding.route);
  };
  const takeAssignment = (assignment: SoloAssignment): void => {
    if (assignment.kind === "failover") {
      collected.push(...assignment.routes);
      return;
    }
    takeBinding(assignment);
  };
  for (const value of Object.values(map)) {
    if ("kind" in value) {
      takeAssignment(value);
      continue;
    }
    for (const lane of value) takeAssignment(lane);
  }
  return collected;
}
