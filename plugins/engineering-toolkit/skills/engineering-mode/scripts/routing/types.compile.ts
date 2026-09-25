import type {
  Access,
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

const worktree: IsolatedWorktree = { path: "worktree" };
void [
  whyRoute,
  reflectRoute,
  isolatedWithoutWorktree,
  choosingWorker,
  spawningWorker,
  inheritingWorker,
  cursorParent,
  grokParent,
  worktree,
];
