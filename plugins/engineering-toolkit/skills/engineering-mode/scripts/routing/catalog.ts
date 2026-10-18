import {
  EFFORTS,
  type AppId,
  type AppRecord,
  type CliModel,
  type Effort,
  type ModelEntry,
  type ModelSlug,
  SONNET_5_5_MODEL,
} from "./route.ts";

export type AppCatalog = ReadonlyMap<AppId, AppRecord>;

export const SOL_CLI_MODEL = "gpt-6-sol" as ModelSlug;

function model(
  family: string,
  cli: CliModel,
  efforts: readonly Effort[] = EFFORTS
): ModelEntry {
  return { family: family as ModelSlug, efforts, cli };
}

function flag(slug: string): CliModel {
  return { effort: "flag", model: slug };
}

function inSlug(template: `${string}{effort}${string}`): CliModel {
  return { effort: "in-slug", model: template };
}

function byFamily(entries: readonly ModelEntry[]): ReadonlyMap<ModelSlug, ModelEntry> {
  return new Map(entries.map((entry) => [entry.family, entry]));
}

export function shippedCatalog(): AppCatalog {
  const sonnet = model(SONNET_5_5_MODEL, flag(SONNET_5_5_MODEL));
  const claudeCode: AppRecord = {
    id: "claude-code",
    models: byFamily([
      model("fable", flag("fable")),
      model("opus", flag("opus")),
      sonnet,
    ]),
  };
  const codex: AppRecord = {
    id: "codex",
    models: byFamily([model(SOL_CLI_MODEL, flag(SOL_CLI_MODEL))]),
  };
  const grok: AppRecord = {
    id: "grok",
    models: byFamily([model("grok-4.7", flag("grok-4.7"))]),
  };
  const cursor: AppRecord = {
    id: "cursor",
    models: byFamily([
      model("fable", inSlug("claude-fable-5-1-{effort}")),
      model("opus", inSlug("claude-opus-5-5-{effort}")),
      model(SONNET_5_5_MODEL, inSlug("claude-sonnet-5-5-{effort}")),
      model("grok-4.7", inSlug("grok-4.7-{effort}"), [
        "low",
        "medium",
        "high",
        "xhigh",
      ]),
    ]),
  };
  return new Map<AppId, AppRecord>([
    ["claude-code", claudeCode],
    ["codex", codex],
    ["grok", grok],
    ["cursor", cursor],
  ]);
}

export function cliModelFor(entry: ModelEntry, effort: Effort): string {
  return entry.cli.effort === "in-slug"
    ? entry.cli.model.replace("{effort}", effort)
    : entry.cli.model;
}

export function soleModel(app: AppId, catalog: AppCatalog): ModelSlug | null {
  const models = catalog.get(app)?.models;
  if (models === undefined || models.size !== 1) return null;
  for (const slug of models.keys()) return slug;
  return null;
}
