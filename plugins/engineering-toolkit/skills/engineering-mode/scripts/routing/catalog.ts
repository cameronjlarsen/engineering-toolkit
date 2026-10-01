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
  SONNET_5_5_MODEL,
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
  const sonnet = model(SONNET_5_5_MODEL, "anthropic", flag(SONNET_5_5_MODEL), "sonnet");
  const claudeCode: AppRecord = {
    id: "claude-code",
    launch: "cli-auth",
    models: byFamily([
      model("fable", "anthropic", flag("fable"), "fable"),
      model("opus", "anthropic", flag("opus"), "opus"),
      sonnet,
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
      model(
        SONNET_5_5_MODEL,
        "anthropic",
        inSlug("claude-sonnet-5-5-{effort}"),
        "sonnet"
      ),
      model("grok-4.7", "xai", inSlug("grok-4.7-{effort}"), null, [
        "low",
        "medium",
        "high",
        "xhigh",
      ]),
    ]),
  };
  // opencode hosts models behind `opencode models`, not a dedicated CLI per
  // provider. The Model cell is the provider-independent suffix setup resolves
  // to one concrete `provider/model` id; the generated lane file pins that id.
  // Effort is descriptor-only: opencode models expose no reasoning variants.
  // launch is "none" because no external runner adapter targets opencode;
  // opencode descriptors are native-only on an opencode parent.
  const opencode: AppRecord = {
    id: "opencode",
    launch: "none",
    models: byFamily([
      model("glm-5.3", "unknown", flag("glm-5.3"), null),
      model("kimi-k2.7-code", "unknown", flag("kimi-k2.7-code"), null),
      model("deepseek-v4-pro", "unknown", flag("deepseek-v4-pro"), null),
      model("qwen3.8-max", "unknown", flag("qwen3.8-max"), null),
      model("minimax-m3", "unknown", flag("minimax-m3"), null),
      model("gpt-5.6-luna", "unknown", flag("gpt-5.6-luna"), null),
      model("gpt-5.6-sol", "unknown", flag("gpt-5.6-sol"), null),
      model("grok-4.6", "unknown", flag("grok-4.6"), null),
      model("opus", "unknown", flag("opus"), null),
    ]),
  };
  return new Map<AppId, AppRecord>([
    ["claude-code", claudeCode],
    ["codex", codex],
    ["grok", grok],
    ["cursor", cursor],
    ["opencode", opencode],
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
