import {
  APP_IDS,
  EFFORTS,
  type AppId,
  type Effort,
  type EffortRef,
  type ModelSlug,
  type RoleBinding,
  type RoleId,
  type RoleMap,
  type Result,
  currentHost,
  destinationDefault,
  explicitEffort,
  modelSlug,
  namedApp,
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
  | { readonly tag: "v1-missing-effort"; readonly raw: string };

type ParsedDescriptor = RoleBinding;

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

function parseDescriptor(raw: string, role: RoleId, grammar: 1 | 2): Result<ParsedDescriptor, SheetError> {
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

function parseRoleLine(
  role: RoleId,
  rawValue: string,
  grammar: 1 | 2
): Result<RoleBinding | readonly RoleBinding[], SheetError> {
  if (PANEL_ROLE_IDS.includes(role as (typeof PANEL_ROLE_IDS)[number])) {
    const lanes = rawValue.split(",").map((lane) => lane.trim());
    if (lanes.some((lane) => lane === "")) {
      return { ok: false, error: { tag: "invalid-lane", role, raw: rawValue } };
    }
    const parsed: RoleBinding[] = [];
    for (const lane of lanes) {
      const value = parseDescriptor(lane, role, grammar);
      if (!value.ok) return value;
      parsed.push(value.value);
    }
    return { ok: true, value: parsed };
  }
  return parseDescriptor(rawValue.trim(), role, grammar);
}

export function loadRoleMap(sheetText: string): Result<RoleMap, SheetError> {
  const lines = sheetText.split(/\r?\n/);
  let grammar: 1 | 2 = 1;
  let sawHeader = false;
  const entries = new Map<string, string>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const header = /^Descriptor grammar:\s*(\S+)$/.exec(trimmed);
    if (header !== null) {
      if (sawHeader || (header[1] !== "2" && header[1] !== "1")) {
        return { ok: false, error: { tag: "invalid-grammar-version", raw: header[1] } };
      }
      sawHeader = true;
      grammar = header[1] === "2" ? 2 : 1;
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

  const result: Record<string, RoleBinding | readonly RoleBinding[]> = {};
  for (const role of ROLE_IDS) {
    const parsed = parseRoleLine(role, entries.get(role) as string, grammar);
    if (!parsed.ok) return parsed;
    result[role] = parsed.value;
  }
  return { ok: true, value: result as RoleMap };
}

function printBinding(binding: RoleBinding): string {
  if (binding.kind !== "route") return binding.kind;
  const app = binding.route.app.kind === "named" ? `${binding.route.app.app}/` : "";
  const effort = binding.route.effort.kind === "explicit" ? `@${binding.route.effort.effort}` : "";
  return `${app}${binding.route.model}${effort}`;
}

export function printRoleMap(roles: RoleMap): string {
  const lines = ["# pstack model configuration", "", "Descriptor grammar: 2", ""];
  for (const role of SINGLE_ROLE_IDS) {
    lines.push(`${role}: ${printBinding(roles[role])}`);
  }
  for (const role of PANEL_ROLE_IDS) {
    lines.push(`${role}: ${roles[role].map(printBinding).join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}
