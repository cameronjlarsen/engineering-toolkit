import type { PanelRoleId, Result, RoleId, SingleRoleId } from "./route.ts";
import { MCP_BOUND_ROLE_IDS, PANEL_ROLE_IDS, SINGLE_ROLE_IDS } from "./sheet.ts";
import type { ProviderInstanceId, T3Catalog, T3ModelId, T3Option } from "./t3-catalog.ts";

export interface T3Target {
  readonly providerInstanceId: ProviderInstanceId;
  readonly model: T3ModelId;
  readonly options: ReadonlyMap<string, string | boolean>;
}

export type T3Binding = T3Target | "inherit-parent";

export type T3RoleMap = {
  readonly [K in SingleRoleId]: T3Binding;
} & {
  readonly [K in PanelRoleId]: readonly T3Target[] | "inherit-parent";
};

export const DELEGATION_DRIVERS = ["claudeAgent", "codex"] as const;

export type T3SheetError =
  | { readonly tag: "invalid-grammar-version"; readonly raw: string }
  | { readonly tag: "missing-role"; readonly role: RoleId }
  | { readonly tag: "duplicate-role"; readonly role: RoleId }
  | { readonly tag: "invalid-entry"; readonly role: RoleId; readonly raw: string }
  | { readonly tag: "mcp-bound-must-inherit"; readonly role: RoleId }
  | { readonly tag: "single-role-multiple-entries"; readonly role: SingleRoleId };

export type T3CheckIssue =
  | ({ readonly role: RoleId; readonly entry: T3Target } & (
      | { readonly tag: "unknown-provider" }
      | { readonly tag: "provider-unavailable"; readonly constraints: readonly string[] }
      | { readonly tag: "provider-not-allowed"; readonly driverKind: string }
      | { readonly tag: "unknown-model" }
      | { readonly tag: "unknown-option"; readonly optionId: string }
      | {
          readonly tag: "invalid-option-value";
          readonly optionId: string;
          readonly value: string | boolean;
          readonly option: T3Option;
        }
    ))
  | {
      readonly tag: "panel-single-family";
      readonly role: PanelRoleId;
      readonly entry: readonly T3Target[];
      readonly families: readonly string[];
    };

const ROLE_IDS: readonly RoleId[] = [...SINGLE_ROLE_IDS, ...PANEL_ROLE_IDS];

function parseEntry(raw: string, role: RoleId): Result<T3Target, T3SheetError> {
  const [target, ...pairs] = raw.split(/\s+/);
  const parsed = /^([^/\s,=]+)\/([^\s,=]+)$/.exec(target);
  if (parsed === null) return { ok: false, error: { tag: "invalid-entry", role, raw } };
  const options = new Map<string, string | boolean>();
  for (const pair of pairs) {
    const option = /^([^\s,=]+)=([^\s,=]+)$/.exec(pair);
    if (option === null || options.has(option[1])) {
      return { ok: false, error: { tag: "invalid-entry", role, raw } };
    }
    const value = option[2];
    options.set(option[1], value === "true" ? true : value === "false" ? false : value);
  }
  return {
    ok: true,
    value: {
      providerInstanceId: parsed[1] as ProviderInstanceId,
      model: parsed[2] as T3ModelId,
      options,
    },
  };
}

export function loadT3RoleMap(text: string): Result<T3RoleMap, T3SheetError> {
  const [first = "", ...lines] = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const header = first.trim();
  if (header !== "Descriptor grammar: 4") {
    return { ok: false, error: { tag: "invalid-grammar-version", raw: header } };
  }
  const entries = new Map<RoleId, string>();
  for (const rawLine of lines) {
    const line = rawLine.trimStart();
    const separator = line.indexOf(": ");
    if (separator < 0) continue;
    const role = ROLE_IDS.find((id) => id === line.slice(0, separator));
    if (role === undefined) continue;
    if (entries.has(role)) return { ok: false, error: { tag: "duplicate-role", role } };
    entries.set(role, line.slice(separator + 2).trim());
  }
  for (const role of ROLE_IDS) {
    if (!entries.has(role)) return { ok: false, error: { tag: "missing-role", role } };
  }

  const result: Record<string, T3Binding | readonly T3Target[]> = {};
  for (const role of ROLE_IDS) {
    const raw = entries.get(role) as string;
    if (raw === "inherit-parent") {
      result[role] = raw;
      continue;
    }
    if (MCP_BOUND_ROLE_IDS.has(role)) {
      return { ok: false, error: { tag: "mcp-bound-must-inherit", role } };
    }
    const lanes = raw.split(",").map((entry) => entry.trim());
    const panel = PANEL_ROLE_IDS.find((id) => id === role);
    if (panel === undefined && lanes.length > 1) {
      return { ok: false, error: { tag: "single-role-multiple-entries", role: role as SingleRoleId } };
    }
    const targets: T3Target[] = [];
    for (const lane of lanes) {
      const entry = parseEntry(lane, role);
      if (!entry.ok) return entry;
      targets.push(entry.value);
    }
    result[role] = panel === undefined ? targets[0] : targets;
  }
  return { ok: true, value: result as T3RoleMap };
}

function printTarget(target: T3Target): string {
  const options = [...target.options].map(([id, value]) => `${id}=${value}`);
  return [`${target.providerInstanceId}/${target.model}`, ...options].join(" ");
}

export function printT3RoleMap(map: T3RoleMap): string {
  const lines = ["Descriptor grammar: 4"];
  for (const role of SINGLE_ROLE_IDS) {
    const binding = map[role];
    lines.push(`${role}: ${binding === "inherit-parent" ? binding : printTarget(binding)}`);
  }
  for (const role of PANEL_ROLE_IDS) {
    const binding = map[role];
    lines.push(`${role}: ${binding === "inherit-parent" ? binding : binding.map(printTarget).join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}

function checkEntry(role: RoleId, entry: T3Target, catalog: T3Catalog): readonly T3CheckIssue[] {
  const provider = catalog.providers.get(entry.providerInstanceId);
  if (provider === undefined) return [{ tag: "unknown-provider", role, entry }];
  const issues: T3CheckIssue[] = [];
  if (!provider.launchable) {
    issues.push({ tag: "provider-unavailable", role, entry, constraints: provider.constraints });
  }
  if (!(DELEGATION_DRIVERS as readonly string[]).includes(provider.driverKind)) {
    issues.push({ tag: "provider-not-allowed", role, entry, driverKind: provider.driverKind });
    return issues;
  }
  const model = provider.models.get(entry.model);
  if (model === undefined) {
    issues.push({ tag: "unknown-model", role, entry });
    return issues;
  }
  for (const [optionId, value] of entry.options) {
    const option = model.options.get(optionId);
    if (option === undefined) {
      issues.push({ tag: "unknown-option", role, entry, optionId });
    } else if (
      option.kind === "boolean"
        ? typeof value !== "boolean"
        : typeof value !== "string" || !option.values.includes(value)
    ) {
      issues.push({ tag: "invalid-option-value", role, entry, optionId, value, option });
    }
  }
  return issues;
}

export function checkT3RoleMap(map: T3RoleMap, catalog: T3Catalog): readonly T3CheckIssue[] {
  const issues: T3CheckIssue[] = [];
  for (const role of SINGLE_ROLE_IDS) {
    const entry = map[role];
    if (entry !== "inherit-parent") issues.push(...checkEntry(role, entry, catalog));
  }
  for (const role of PANEL_ROLE_IDS) {
    const entries = map[role];
    if (entries === "inherit-parent") continue;
    for (const entry of entries) issues.push(...checkEntry(role, entry, catalog));
    const families = [...new Set(entries.map((entry) => entry.model.split("-")[0]))];
    if (families.length < 2) {
      issues.push({ tag: "panel-single-family", role, entry: entries, families });
    }
  }
  return issues;
}
