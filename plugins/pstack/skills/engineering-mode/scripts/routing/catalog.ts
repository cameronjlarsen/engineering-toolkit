import type { AppId, AppRecord, ModelOnApp, ModelSlug } from "./route.ts";

export type AppCatalog = ReadonlyMap<AppId, AppRecord>;

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
  const claudeCode: AppRecord = {
    id: "claude-code",
    parentEligible: true,
    launch: "cli-auth",
    models: new Map([
      ["fable" as ModelSlug, model("fable", "anthropic", "fable")],
      ["opus" as ModelSlug, model("opus", "anthropic", "opus")],
    ]),
  };
  const codex: AppRecord = {
    id: "codex",
    parentEligible: true,
    launch: "cli-auth",
    models: new Map([
      ["gpt-5.6-sol" as ModelSlug, model("gpt-5.6-sol", "openai", null)],
    ]),
  };
  const grok: AppRecord = {
    id: "grok",
    parentEligible: false,
    launch: "cli-auth",
    models: new Map([["grok-4.6" as ModelSlug, model("grok-4.6", "xai", null)]]),
  };
  const cursor: AppRecord = {
    id: "cursor",
    parentEligible: false,
    launch: "none",
    models: new Map(),
  };
  return new Map<AppId, AppRecord>([
    ["claude-code", claudeCode],
    ["codex", codex],
    ["grok", grok],
    ["cursor", cursor],
  ]);
}
