import { failoverBinding } from "./failover.ts";
import {
  APP_IDS,
  EFFORTS,
  type AppId,
  type Effort,
  type EffortRef,
  type FailoverAuthoringError,
  type ModelSlug,
  type RoleBinding,
  type RoleId,
  type RoleMap,
  type Result,
  type Route,
  type SoloAssignment,
  currentHost,
  destinationDefault,
  explicitEffort,
  modelSlug,
  namedApp,
  printRouteWire,
  route,
} from "./route.ts";

const SINGLE_ROLE_IDS = [
  "feature, refactoring",
  "bug-fix",
  "perf-issue",
  "hillclimb",
  "judgment and prose",
  "hardest tasks",
  "how explorer",
  "how explainer",
  "why investigators, synthesizer",
  "reflect tooling, judgment, divergent, synthesizer",
] as const;

const MCP_BOUND_ROLE_IDS = new Set<RoleId>([
  "why investigators, synthesizer",
  "reflect tooling, judgment, divergent, synthesizer",
]);

const PANEL_ROLE_IDS = [
  "arena runners",
  "arena cross-judge pool",
  "architect runners",
  "interrogate reviewers",
  "swarm workers",
] as const;

const ROLE_IDS = [...SINGLE_ROLE_IDS, ...PANEL_ROLE_IDS] as readonly RoleId[];

export type GrammarVersion = 1 | 2 | 3;

export type SheetError =
  | { readonly tag: "invalid-grammar-version"; readonly raw: string }
  | { readonly tag: "invalid-lane"; readonly role: RoleId; readonly raw: string }
  | { readonly tag: "invalid-descriptor"; readonly role: RoleId; readonly raw: string }
  | { readonly tag: "missing-role"; readonly role: RoleId }
  | { readonly tag: "duplicate-role"; readonly role: RoleId }
  | { readonly tag: "unknown-role"; readonly role: string }
  | { readonly tag: "mcp-bound-must-inherit"; readonly role: RoleId }
  | { readonly tag: "invalid-model-slug"; readonly raw: string }
  | { readonly tag: "v1-unknown-provider"; readonly provider: string }
  | { readonly tag: "v1-missing-effort"; readonly raw: string }
  | { readonly tag: "invalid-budget"; readonly raw: string }
  | FailoverAuthoringError;

export const BUDGET_LABELS = ["unlimited", "large", "medium", "small"] as const;
export type BudgetLabel = (typeof BUDGET_LABELS)[number];
export type Budget = { readonly label: BudgetLabel; readonly target: Effort };

export const BUDGET_TARGETS: Record<BudgetLabel, Effort> = {
  unlimited: "max",
  large: "xhigh",
  medium: "high",
  small: "medium",
};

type ParsedDescriptor = RoleBinding;

const THEN = " then ";

const V1_APPS: Record<string, AppId> = {
  claude: "claude-code",
  codex: "codex",
  grok: "grok",
};

function isEffort(value: string): value is Effort {
  return (EFFORTS as readonly string[]).includes(value);
}

function isAppId(value: string): value is AppId {
  return (APP_IDS as readonly string[]).includes(value);
}

function parseModel(raw: string): Result<ModelSlug, SheetError> {
  const parsed = modelSlug(raw);
  if (!parsed.ok) {
    return {
      ok: false,
      error: {
        tag: "invalid-model-slug",
        raw: parsed.error.tag === "invalid-model-slug" ? parsed.error.raw : raw,
      },
    };
  }
  return parsed;
}

function parseEffort(
  raw: string | undefined,
  role: RoleId,
  descriptor: string
): Result<EffortRef, SheetError> {
  if (raw === undefined) return { ok: true, value: destinationDefault() };
  if (!isEffort(raw)) {
    return { ok: false, error: { tag: "invalid-descriptor", role, raw: descriptor } };
  }
  return { ok: true, value: explicitEffort(raw) };
}

function parseV2Descriptor(raw: string, role: RoleId): Result<ParsedDescriptor, SheetError> {
  if (raw.includes(":") || (raw.includes("@") && raw.split("@").length > 2)) {
    return { ok: false, error: { tag: "invalid-descriptor", role, raw } };
  }

  const slashParts = raw.split("/");
  if (slashParts.length > 2) {
    return { ok: false, error: { tag: "invalid-descriptor", role, raw } };
  }
  const appToken = slashParts.length === 2 ? slashParts[0] : undefined;
  const modelAndEffort = slashParts.length === 2 ? slashParts[1] : slashParts[0];
  if (appToken !== undefined && !isAppId(appToken)) {
    return { ok: false, error: { tag: "invalid-lane", role, raw } };
  }

  const atParts = modelAndEffort.split("@");
  if (atParts.length > 2 || atParts[0] === "") {
    return { ok: false, error: { tag: "invalid-descriptor", role, raw } };
  }
  const model = parseModel(atParts[0]);
  if (!model.ok) return model;
  const effort = parseEffort(atParts[1], role, raw);
  if (!effort.ok) return effort;
  return {
    ok: true,
    value: {
      kind: "route",
      route: route({
        model: model.value,
        app: appToken === undefined ? currentHost() : namedApp(appToken),
        effort: effort.value,
      }),
    },
  };
}

function parseV1Descriptor(raw: string, role: RoleId): Result<ParsedDescriptor, SheetError> {
  const colon = raw.indexOf(":");
  if (colon <= 0 || colon !== raw.lastIndexOf(":")) {
    return { ok: false, error: { tag: "invalid-descriptor", role, raw } };
  }
  const provider = raw.slice(0, colon);
  const app = V1_APPS[provider];
  if (app === undefined) {
    return { ok: false, error: { tag: "v1-unknown-provider", provider } };
  }
  const body = raw.slice(colon + 1);
  const at = body.lastIndexOf("@");
  if (at <= 0 || at === body.length - 1) {
    return { ok: false, error: { tag: "v1-missing-effort", raw } };
  }
  const model = parseModel(body.slice(0, at));
  if (!model.ok) return model;
  const effort = body.slice(at + 1);
  if (!isEffort(effort)) {
    return { ok: false, error: { tag: "invalid-descriptor", role, raw } };
  }
  return {
    ok: true,
    value: { kind: "route", route: route({ model: model.value, app: namedApp(app), effort: explicitEffort(effort) }) },
  };
}

function parseDescriptor(
  raw: string,
  role: RoleId,
  grammar: GrammarVersion
): Result<ParsedDescriptor, SheetError> {
  if (raw === "inherit-parent" || raw === "auto") {
    return { ok: true, value: { kind: raw } };
  }
  const parsed = grammar === 1 ? parseV1Descriptor(raw, role) : parseV2Descriptor(raw, role);
  if (!parsed.ok) return parsed;
  if (MCP_BOUND_ROLE_IDS.has(role) && parsed.value.kind === "route") {
    return { ok: false, error: { tag: "mcp-bound-must-inherit", role } };
  }
  return parsed;
}

function parseSoloValue(
  role: RoleId,
  rawValue: string,
  grammar: GrammarVersion
): Result<SoloAssignment, SheetError> {
  const raw = rawValue.trim();
  if (raw.includes(THEN)) {
    if (grammar < 3) {
      return { ok: false, error: { tag: "invalid-descriptor", role, raw } };
    }
    if (MCP_BOUND_ROLE_IDS.has(role)) {
      return { ok: false, error: { tag: "mcp-bound-must-inherit", role } };
    }
    const tokens = raw.split(THEN).map((token) => token.trim());
    if (tokens.some((token) => token === "")) {
      return { ok: false, error: { tag: "invalid-descriptor", role, raw } };
    }
    const hops: Route[] = [];
    for (const token of tokens) {
      if (token === "inherit-parent" || token === "auto") {
        return { ok: false, error: { tag: "failover-inherit-forbidden" } };
      }
      const parsed = parseDescriptor(token, role, grammar);
      if (!parsed.ok) return parsed;
      if (parsed.value.kind !== "route") {
        return { ok: false, error: { tag: "failover-inherit-forbidden" } };
      }
      hops.push(parsed.value.route);
    }
    return failoverBinding(hops);
  }
  return parseDescriptor(raw, role, grammar);
}

function parseRoleLine(
  role: RoleId,
  rawValue: string,
  grammar: GrammarVersion
): Result<SoloAssignment | readonly SoloAssignment[], SheetError> {
  if (PANEL_ROLE_IDS.includes(role as (typeof PANEL_ROLE_IDS)[number])) {
    const lanes = rawValue.split(",").map((lane) => lane.trim());
    if (lanes.some((lane) => lane === "")) {
      return { ok: false, error: { tag: "invalid-lane", role, raw: rawValue } };
    }
    const parsed: SoloAssignment[] = [];
    for (const lane of lanes) {
      const value = parseSoloValue(role, lane, grammar);
      if (!value.ok) return value;
      parsed.push(value.value);
    }
    return { ok: true, value: parsed };
  }
  return parseSoloValue(role, rawValue, grammar);
}

export function loadRoleMap(sheetText: string): Result<RoleMap, SheetError> {
  const lines = sheetText.split(/\r?\n/);
  let grammar: GrammarVersion = 1;
  let sawHeader = false;
  const entries = new Map<string, string>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const header = /^Descriptor grammar:\s*(\S+)$/.exec(trimmed);
    if (header !== null) {
      if (sawHeader || (header[1] !== "3" && header[1] !== "2" && header[1] !== "1")) {
        return { ok: false, error: { tag: "invalid-grammar-version", raw: header[1] } };
      }
      sawHeader = true;
      grammar = Number(header[1]) as GrammarVersion;
      continue;
    }
    if (trimmed.startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator < 0) {
      return { ok: false, error: { tag: "unknown-role", role: trimmed } };
    }
    const role = line.slice(0, separator).trim();
    if (!(ROLE_IDS as readonly string[]).includes(role)) {
      return { ok: false, error: { tag: "unknown-role", role } };
    }
    if (entries.has(role)) {
      return { ok: false, error: { tag: "duplicate-role", role: role as RoleId } };
    }
    entries.set(role, line.slice(separator + 1).trim());
  }

  for (const role of ROLE_IDS) {
    if (!entries.has(role)) return { ok: false, error: { tag: "missing-role", role } };
  }

  const result: Record<string, SoloAssignment | readonly SoloAssignment[]> = {};
  for (const role of ROLE_IDS) {
    const parsed = parseRoleLine(role, entries.get(role) as string, grammar);
    if (!parsed.ok) return parsed;
    result[role] = parsed.value;
  }
  return { ok: true, value: result as RoleMap };
}

function printBinding(binding: RoleBinding): string {
  if (binding.kind !== "route") return binding.kind;
  return printRouteWire(binding.route);
}

function printAssignment(assignment: SoloAssignment): string {
  if (assignment.kind === "failover") {
    return assignment.routes.map(printRouteWire).join(" then ");
  }
  return printBinding(assignment);
}

export function printRoleMap(roles: RoleMap, budget?: Budget): string {
  const lines = ["# Engineering Toolkit model configuration", "", "Descriptor grammar: 3", ""];
  if (budget !== undefined) {
    lines.push(`# budget: ${budget.label} (${budget.target})`, "");
  }
  for (const role of SINGLE_ROLE_IDS) {
    lines.push(`${role}: ${printAssignment(roles[role])}`);
  }
  for (const role of PANEL_ROLE_IDS) {
    lines.push(`${role}: ${roles[role].map(printAssignment).join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}

function isBudgetLabel(value: string): value is BudgetLabel {
  return (BUDGET_LABELS as readonly string[]).includes(value);
}

export function parseBudgetLine(line: string): Result<Budget, SheetError> {
  const parsed = /^\s*#\s*budget:\s*(\S+)\s*\((\S+)\)\s*$/.exec(line);
  if (parsed === null) {
    return { ok: false, error: { tag: "invalid-budget", raw: line } };
  }
  const label = parsed[1];
  const target = parsed[2];
  if (
    label === undefined ||
    target === undefined ||
    !isBudgetLabel(label) ||
    !isEffort(target) ||
    BUDGET_TARGETS[label] !== target
  ) {
    return { ok: false, error: { tag: "invalid-budget", raw: line } };
  }
  return { ok: true, value: { label, target } };
}

function highestSelectableAtOrBelow(
  target: Effort,
  selectable: readonly Effort[]
): Effort | undefined {
  const cap = EFFORTS.indexOf(target);
  let best: Effort | undefined;
  for (const effort of selectable) {
    const rank = EFFORTS.indexOf(effort);
    if (rank === -1 || rank > cap) continue;
    if (best === undefined || EFFORTS.indexOf(best) < rank) {
      best = effort;
    }
  }
  return best;
}

function remapBudgetAssignment(
  assignment: SoloAssignment,
  role: RoleId,
  budget: Budget,
  selectable: (model: ModelSlug) => readonly Effort[],
  needsChoice: RoleId[]
): SoloAssignment {
  if (assignment.kind === "failover") {
    const hops = assignment.routes.map((hop) =>
      remapBudgetBinding({ kind: "route", route: hop }, role, budget, selectable, needsChoice)
    );
    const rebuilt = failoverBinding(
      hops.flatMap((hop) => (hop.kind === "route" ? [hop.route] : []))
    );
    if (!rebuilt.ok) {
      if (!needsChoice.includes(role)) needsChoice.push(role);
      return assignment;
    }
    return rebuilt.value;
  }
  return remapBudgetBinding(assignment, role, budget, selectable, needsChoice);
}

function remapBudgetBinding(
  binding: RoleBinding,
  role: RoleId,
  budget: Budget,
  selectable: (model: ModelSlug) => readonly Effort[],
  needsChoice: RoleId[]
): RoleBinding {
  if (binding.kind !== "route") return binding;
  const clamped = highestSelectableAtOrBelow(budget.target, selectable(binding.route.model));
  if (clamped === undefined) {
    if (!needsChoice.includes(role)) needsChoice.push(role);
    return binding;
  }
  return {
    kind: "route",
    route: route({
      model: binding.route.model,
      app: binding.route.app,
      effort: explicitEffort(clamped),
    }),
  };
}

export function applyBudget(
  roles: RoleMap,
  budget: Budget,
  selectable: (model: ModelSlug) => readonly Effort[]
): { roles: RoleMap; needsChoice: readonly RoleId[] } {
  if (budget.label === "unlimited") {
    return { roles, needsChoice: [] };
  }

  const needsChoice: RoleId[] = [];
  const next: Record<string, SoloAssignment | readonly SoloAssignment[]> = {};
  for (const role of SINGLE_ROLE_IDS) {
    next[role] = remapBudgetAssignment(roles[role], role, budget, selectable, needsChoice);
  }
  for (const role of PANEL_ROLE_IDS) {
    next[role] = roles[role].map((assignment) =>
      remapBudgetAssignment(assignment, role, budget, selectable, needsChoice)
    );
  }
  return { roles: next as RoleMap, needsChoice };
}
