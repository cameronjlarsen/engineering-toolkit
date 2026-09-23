import {
  CLI_CHILD_APPS,
  type AppId,
  type AppRecord,
  type CliChildApp,
  type ModelOnApp,
  type ModelSlug,
} from "./route.ts";

export type AppCatalog = ReadonlyMap<AppId, AppRecord>;

export const SOL_CLI_MODEL = "gpt-6-sol" as ModelSlug;

const SELECTABLE_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

function model(
  slug: string,
  vendor: ModelOnApp["vendor"],
  nativeStem: string | null
): ModelOnApp {
  return {
    slug: slug as ModelSlug,
    vendor,
    destinationDefaultEffort: { kind: "unknown" },
    selectableEfforts: SELECTABLE_EFFORTS,
    nativeStem,
  };
}

export function shippedCatalog(): AppCatalog {
  const fable = model("fable", "anthropic", "fable");
  const opus = model("opus", "anthropic", "opus");
  const pluginAgents = new Map<ModelSlug, ModelOnApp>([
    [fable.slug, fable],
    [opus.slug, opus],
  ]);
  const claudeCode: AppRecord = {
    id: "claude-code",
    launch: "cli-auth",
    models: pluginAgents,
  };
  const sol = model(SOL_CLI_MODEL, "openai", null);
  const codex: AppRecord = {
    id: "codex",
    launch: "cli-auth",
    models: new Map([[SOL_CLI_MODEL, sol]]),
  };
  const grokModel = model("grok-4.6", "xai", null);
  const grok: AppRecord = {
    id: "grok",
    launch: "cli-auth",
    models: new Map([[grokModel.slug, grokModel]]),
  };
  const cursor: AppRecord = {
    id: "cursor",
    launch: "none",
    models: new Map([...pluginAgents, [grokModel.slug, grokModel]]),
  };
  return new Map<AppId, AppRecord>([
    ["claude-code", claudeCode],
    ["codex", codex],
    ["grok", grok],
    ["cursor", cursor],
  ]);
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

export function launchHome(
  model: ModelSlug,
  catalog: AppCatalog
): CliChildApp | null {
  const homes = [...catalog.values()].filter(
    (app): app is AppRecord & { readonly id: CliChildApp; readonly launch: "cli-auth" } =>
      app.launch === "cli-auth" &&
      (CLI_CHILD_APPS as readonly string[]).includes(app.id) &&
      app.models.has(model)
  );
  if (homes.length !== 1) return null;
  return homes[0].id;
}
