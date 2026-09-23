import {
  EFFORTS,
  type Effort,
  type ProbedModel,
  type Result,
  modelSlug,
} from "./route.ts";

const INVALID = { tag: "invalid-codex-model-catalog" as const };

function isEffort(value: string): value is Effort {
  return (EFFORTS as readonly string[]).includes(value);
}

function selectableEffortsFrom(levels: unknown): readonly Effort[] {
  if (!Array.isArray(levels)) return [];
  const raw = new Set<string>();
  for (const level of levels) {
    if (typeof level !== "object" || level === null || !("effort" in level)) continue;
    const effort = (level as { readonly effort: unknown }).effort;
    if (typeof effort === "string") raw.add(effort);
  }
  return EFFORTS.filter((effort) => raw.has(effort));
}

export function parseCodexDebugModels(
  text: string
): Result<readonly ProbedModel[], { readonly tag: "invalid-codex-model-catalog" }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: INVALID };
  }
  if (typeof parsed !== "object" || parsed === null || !("models" in parsed)) {
    return { ok: false, error: INVALID };
  }
  const models = (parsed as { readonly models: unknown }).models;
  if (!Array.isArray(models)) {
    return { ok: false, error: INVALID };
  }

  const probed: ProbedModel[] = [];
  for (const entry of models) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as {
      readonly slug?: unknown;
      readonly default_reasoning_level?: unknown;
      readonly supported_reasoning_levels?: unknown;
    };
    if (typeof record.slug !== "string") continue;
    const branded = modelSlug(record.slug);
    if (!branded.ok) continue;
    const selectableEfforts = selectableEffortsFrom(record.supported_reasoning_levels);
    const defaultRaw = record.default_reasoning_level;
    const destinationDefaultEffort =
      typeof defaultRaw === "string" &&
      isEffort(defaultRaw) &&
      selectableEfforts.includes(defaultRaw)
        ? defaultRaw
        : { kind: "unknown" as const };
    probed.push({
      slug: branded.value,
      selectableEfforts,
      destinationDefaultEffort,
    });
  }
  return { ok: true, value: probed };
}
