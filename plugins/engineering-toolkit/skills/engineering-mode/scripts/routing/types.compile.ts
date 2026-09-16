import type { AppCatalog } from "./catalog.ts";
import { planLane } from "./dispatch.ts";
import type {
  Access,
  CliLaunchSpec,
  FailoverBinding,
  IsolatedWorktree,
  ParentHost,
  RoleMap,
  Route,
  WorkerPolicy,
} from "./route.ts";

declare const route: Route;

const whyRoute: RoleMap["why investigators, synthesizer"] = {
  // @ts-expect-error Why is bound to inherit-parent or auto.
  kind: "route",
  route,
};

const reflectRoute: RoleMap["reflect tooling, judgment, divergent, synthesizer"] = {
  // @ts-expect-error Reflect is bound to inherit-parent or auto.
  kind: "route",
  route,
};

// @ts-expect-error Isolated writes require a worktree.
const isolatedWithoutWorktree: Access = {
  mode: "isolated-write",
  worktree: null,
};

const choosingWorker: WorkerPolicy = {
  // @ts-expect-error Workers cannot choose routes.
  mayChooseRoute: true,
  maySpawnAgents: false,
  inheritCoordinatorMcp: false,
};

const spawningWorker: WorkerPolicy = {
  mayChooseRoute: false,
  // @ts-expect-error Workers cannot spawn agents.
  maySpawnAgents: true,
  inheritCoordinatorMcp: false,
};

const inheritingWorker: WorkerPolicy = {
  mayChooseRoute: false,
  maySpawnAgents: false,
  // @ts-expect-error Workers cannot inherit coordinator MCP.
  inheritCoordinatorMcp: true,
};

const cursorParent: ParentHost = "cursor";

// @ts-expect-error Grok is not a parent host.
const grokParent: ParentHost = "grok";

const cursorChildLaunch: CliLaunchSpec = {
  // @ts-expect-error Cursor is not a CLI child.
  app: "cursor",
  model: "fable" as Route["model"],
  effort: "max",
};

const worktree: IsolatedWorktree = { path: "worktree" };
const readAccess: Access = { mode: "read-only", worktree: null };
declare const catalog: AppCatalog;

const failover: FailoverBinding = {
  kind: "failover",
  routes: [route, route],
};

const whyFailover: RoleMap["why investigators, synthesizer"] = {
  // @ts-expect-error Why is bound to inherit-parent or auto.
  kind: "failover",
  routes: [route, route],
};

const reflectFailover: RoleMap["reflect tooling, judgment, divergent, synthesizer"] = {
  // @ts-expect-error Reflect is bound to inherit-parent or auto.
  kind: "failover",
  routes: [route, route],
};

const panelFailover: RoleMap["arena runners"] = [failover];

const shortFailover: FailoverBinding = {
  kind: "failover",
  // @ts-expect-error A failover chain needs at least two routes.
  routes: [route],
};

const featureFailover: RoleMap["feature, refactoring"] = failover;

planLane({
  parent: "cursor",
  // @ts-expect-error planLane takes one RoleBinding, not a failover chain.
  binding: failover,
  override: undefined,
  catalog,
  inventory: [],
  access: readAccess,
  role: "how explorer",
});

void [
  whyRoute,
  reflectRoute,
  isolatedWithoutWorktree,
  choosingWorker,
  spawningWorker,
  inheritingWorker,
  cursorParent,
  grokParent,
  cursorChildLaunch,
  worktree,
  whyFailover,
  reflectFailover,
  panelFailover,
  shortFailover,
  featureFailover,
];
