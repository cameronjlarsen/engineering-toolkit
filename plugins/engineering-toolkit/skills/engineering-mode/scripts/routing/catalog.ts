import {
  CLI_CHILD_APPS,
  EFFORTS,
  type AppId,
  type AppRecord,
  type CliChildApp,
  type CliModel,
  type Effort,
  type ModelEntry,
  type ModelSlug,
} from "./route.ts";

export type AppCatalog = ReadonlyMap<AppId, AppRecord>;

export const SOL_CLI_MODEL = "gpt-6-sol" as ModelSlug;

function model(
  family: string,
  vendor: ModelEntry["vendor"],
  cli: CliModel,
  nativeStem: string | null,
  efforts: readonly Effort[] = EFFORTS
): ModelEntry {
  return { family: family as ModelSlug, vendor, efforts, cli, nativeStem };
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
  const claudeCode: AppRecord = {
    id: "claude-code",
    launch: "cli-auth",
    models: byFamily([
      model("fable", "anthropic", flag("fable"), "fable"),
      model("opus", "anthropic", flag("opus"), "opus"),
    ]),
  };
  const codex: AppRecord = {
    id: "codex",
    launch: "cli-auth",
    models: byFamily([model(SOL_CLI_MODEL, "openai", flag(SOL_CLI_MODEL), null)]),
  };
  const grok: AppRecord = {
    id: "grok",
    launch: "cli-auth",
    models: byFamily([model("grok-4.7", "xai", flag("grok-4.7"), null)]),
  };
  const cursor: AppRecord = {
    id: "cursor",
    launch: "cli-auth",
    models: byFamily([
      model("fable", "anthropic", inSlug("claude-fable-5-1-{effort}"), "fable"),
      model("opus", "anthropic", inSlug("claude-opus-5-5-{effort}"), "opus"),
      model("grok-4.7", "xai", inSlug("grok-4.7-{effort}"), null, ["low", "medium", "high", "xhigh"]),
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

export function launchableApps(): readonly CliChildApp[] {
  return CLI_CHILD_APPS;
}
