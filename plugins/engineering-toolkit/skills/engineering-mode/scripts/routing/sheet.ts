import {
  APP_IDS,
  EFFORTS,
  type AppId,
  type Effort,
  type ModelSlug,
  type ParentHost,
  type RoleBinding,
  type RoleId,
  type RoleMap,
  type Result,
  type Route,
  modelSlug,
  route,
} from "./route.ts";

export const SINGLE_ROLE_IDS = [
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

export const PANEL_ROLE_IDS = [
  "arena runners",
  "arena cross-judge pool",
  "architect runners",
  "interrogate reviewers",
  "swarm workers",
] as const;

const ROLE_IDS = [...SINGLE_ROLE_IDS, ...PANEL_ROLE_IDS] as readonly RoleId[];

export type SheetError =
  | { readonly tag: "invalid-grammar-version"; readonly raw: string }
  | { readonly tag: "invalid-lane"; readonly role: RoleId; readonly raw: string }
  | { readonly tag: "invalid-descriptor"; readonly role: RoleId; readonly raw: string }
  | { readonly tag: "missing-role"; readonly role: RoleId }
  | { readonly tag: "duplicate-role"; readonly role: RoleId }
  | { readonly tag: "mcp-bound-must-inherit"; readonly role: RoleId }
  | { readonly tag: "invalid-model-slug"; readonly raw: string }
  | { readonly tag: "unknown-provider"; readonly provider: string }
  | { readonly tag: "missing-effort"; readonly role: RoleId; readonly raw: string }
  | { readonly tag: "invalid-budget"; readonly raw: string };

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
type Grammar = 1 | 2 | 3;

const PROVIDER_APPS: Record<string, AppId> = {
  claude: "claude-code",
  codex: "codex",
  cursor: "cursor",
  grok: "grok",
};

const GRAMMAR_1_PROVIDERS = ["claude", "codex", "grok"] as const;
const GRAMMAR_3_PROVIDERS = Object.keys(PROVIDER_APPS);

function providerOf(app: AppId): string {
  return app === "claude-code" ? "claude" : app;
}

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

function routeBinding(model: ModelSlug, app: AppId, effort: Effort): ParsedDescriptor {
  return { kind: "route", route: route({ model, app, effort }) };
}

function parseV2Descriptor(
  raw: string,
  role: RoleId,
  parent: ParentHost
): Result<ParsedDescriptor, SheetError> {
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
  const effort = atParts[1];
  if (effort === undefined) {
    return { ok: false, error: { tag: "missing-effort", role, raw } };
  }
  if (!isEffort(effort)) {
    return { ok: false, error: { tag: "invalid-descriptor", role, raw } };
  }
  return { ok: true, value: routeBinding(model.value, appToken ?? parent, effort) };
}

function parseProviderDescriptor(
  raw: string,
  role: RoleId,
  providers: readonly string[]
): Result<ParsedDescriptor, SheetError> {
  const colon = raw.indexOf(":");
  if (colon <= 0 || colon !== raw.lastIndexOf(":")) {
    return { ok: false, error: { tag: "invalid-descriptor", role, raw } };
  }
  const provider = raw.slice(0, colon);
  const app = PROVIDER_APPS[provider];
  if (app === undefined || !providers.includes(provider)) {
    return { ok: false, error: { tag: "unknown-provider", provider } };
  }
  const body = raw.slice(colon + 1);
  const at = body.lastIndexOf("@");
  if (at <= 0 || at === body.length - 1) {
    return { ok: false, error: { tag: "missing-effort", role, raw } };
  }
  const model = parseModel(body.slice(0, at));
  if (!model.ok) return model;
  const effort = body.slice(at + 1);
  if (!isEffort(effort)) {
    return { ok: false, error: { tag: "invalid-descriptor", role, raw } };
  }
  return { ok: true, value: routeBinding(model.value, app, effort) };
}

function parseDescriptor(
  raw: string,
  role: RoleId,
  grammar: Grammar,
  parent: ParentHost
): Result<ParsedDescriptor, SheetError> {
  if (raw === "inherit-parent" || raw === "auto") {
    return { ok: true, value: { kind: raw } };
  }
  const parsed =
    grammar === 2
      ? parseV2Descriptor(raw, role, parent)
      : parseProviderDescriptor(
          raw,
          role,
          grammar === 1 ? GRAMMAR_1_PROVIDERS : GRAMMAR_3_PROVIDERS
        );
  if (!parsed.ok) return parsed;
  if (MCP_BOUND_ROLE_IDS.has(role) && parsed.value.kind === "route") {
    return { ok: false, error: { tag: "mcp-bound-must-inherit", role } };
  }
  return parsed;
}

function parseRoleLine(
  role: RoleId,
  rawValue: string,
  grammar: Grammar,
  parent: ParentHost
): Result<RoleBinding | readonly RoleBinding[], SheetError> {
  if (PANEL_ROLE_IDS.includes(role as (typeof PANEL_ROLE_IDS)[number])) {
    const lanes = rawValue.split(",").map((lane) => lane.trim());
    if (lanes.some((lane) => lane === "")) {
      return { ok: false, error: { tag: "invalid-lane", role, raw: rawValue } };
    }
    const parsed: RoleBinding[] = [];
    for (const lane of lanes) {
      const value = parseDescriptor(lane, role, grammar, parent);
      if (!value.ok) return value;
      parsed.push(value.value);
    }
    return { ok: true, value: parsed };
  }
  return parseDescriptor(rawValue.trim(), role, grammar, parent);
}

export function loadRoleMap(
  sheetText: string,
  parent: ParentHost
): Result<RoleMap, SheetError> {
  const lines = sheetText.split(/\r?\n/);
  let grammar: Grammar = 1;
  let sawHeader = false;
  const entries = new Map<string, string>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const header = /^Descriptor grammar:\s*(\S+)$/.exec(trimmed);
    if (header !== null) {
      if (sawHeader || !["1", "2", "3"].includes(header[1])) {
        return { ok: false, error: { tag: "invalid-grammar-version", raw: header[1] } };
      }
      sawHeader = true;
      grammar = Number(header[1]) as Grammar;
      continue;
    }
    if (trimmed.startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const role = line.slice(0, separator).trim();
    if (!(ROLE_IDS as readonly string[]).includes(role)) continue;
    if (entries.has(role)) {
      return { ok: false, error: { tag: "duplicate-role", role: role as RoleId } };
    }
    entries.set(role, line.slice(separator + 1).trim());
  }

  for (const role of ROLE_IDS) {
    if (!entries.has(role)) return { ok: false, error: { tag: "missing-role", role } };
  }

  const result: Record<string, RoleBinding | readonly RoleBinding[]> = {};
  for (const role of ROLE_IDS) {
    const parsed = parseRoleLine(role, entries.get(role) as string, grammar, parent);
    if (!parsed.ok) return parsed;
    result[role] = parsed.value;
  }
  return { ok: true, value: result as RoleMap };
}

function printBinding(binding: RoleBinding): string {
  if (binding.kind !== "route") return binding.kind;
  const { app, model, effort } = binding.route;
  return `${providerOf(app)}:${model}@${effort}`;
}

export function printRoleMap(roles: RoleMap, budget?: Budget): string {
  const lines = ["# Engineering Toolkit model configuration", "", "Descriptor grammar: 3", ""];
  if (budget !== undefined) {
    lines.push(`# budget: ${budget.label} (${budget.target})`, "");
  }
  for (const role of SINGLE_ROLE_IDS) {
    lines.push(`${role}: ${printBinding(roles[role])}`);
  }
  for (const role of PANEL_ROLE_IDS) {
    lines.push(`${role}: ${roles[role].map(printBinding).join(", ")}`);
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

function remapBudgetBinding(
  binding: RoleBinding,
  role: RoleId,
  budget: Budget,
  selectable: (route: Route) => readonly Effort[],
  needsChoice: RoleId[]
): RoleBinding {
  if (binding.kind !== "route") return binding;
  const clamped = highestSelectableAtOrBelow(budget.target, selectable(binding.route));
  if (clamped === undefined) {
    if (!needsChoice.includes(role)) needsChoice.push(role);
    return binding;
  }
  return {
    kind: "route",
    route: route({
      model: binding.route.model,
      app: binding.route.app,
      effort: clamped,
    }),
  };
}

export function applyBudget(
  roles: RoleMap,
  budget: Budget,
  selectable: (route: Route) => readonly Effort[]
): { roles: RoleMap; needsChoice: readonly RoleId[] } {
  if (budget.label === "unlimited") {
    return { roles, needsChoice: [] };
  }

  const needsChoice: RoleId[] = [];
  const next: Record<string, RoleBinding | readonly RoleBinding[]> = {};
  for (const role of SINGLE_ROLE_IDS) {
    next[role] = remapBudgetBinding(roles[role], role, budget, selectable, needsChoice);
  }
  for (const role of PANEL_ROLE_IDS) {
    next[role] = roles[role].map((binding) =>
      remapBudgetBinding(binding, role, budget, selectable, needsChoice)
    );
  }
  return { roles: next as RoleMap, needsChoice };
}
