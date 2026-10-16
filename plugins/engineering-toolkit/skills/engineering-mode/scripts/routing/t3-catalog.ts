import type { Result } from "./route.ts";

export type ProviderInstanceId = string & { readonly __providerInstanceId: unique symbol };
export type T3ModelId = string & { readonly __t3ModelId: unique symbol };

export type T3Option =
  | { readonly kind: "select"; readonly values: readonly string[] }
  | { readonly kind: "boolean" };

export interface T3Model {
  readonly options: ReadonlyMap<string, T3Option>;
}

export interface T3Provider {
  readonly driverKind: string;
  readonly launchable: boolean;
  readonly constraints: readonly string[];
  readonly models: ReadonlyMap<T3ModelId, T3Model>;
}

export interface T3Catalog {
  readonly inheritedProviderInstanceId: ProviderInstanceId;
  readonly inheritedModel: T3ModelId;
  readonly providers: ReadonlyMap<ProviderInstanceId, T3Provider>;
}

const INVALID = { tag: "invalid-t3-catalog" as const };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function parseOptions(input: unknown): Result<ReadonlyMap<string, T3Option>, typeof INVALID> {
  if (!Array.isArray(input)) return { ok: false, error: INVALID };
  const options = new Map<string, T3Option>();
  for (const option of input) {
    if (!isRecord(option) || !isId(option.id) || options.has(option.id)) {
      return { ok: false, error: INVALID };
    }
    if (option.type === "boolean") {
      options.set(option.id, { kind: "boolean" });
    } else if (option.type === "select" && Array.isArray(option.options)) {
      const values: string[] = [];
      for (const value of option.options) {
        if (
          !isRecord(value) || !isId(value.id) || values.includes(value.id) ||
          (value.isDefault !== undefined && typeof value.isDefault !== "boolean")
        ) {
          return { ok: false, error: INVALID };
        }
        values.push(value.id);
      }
      options.set(option.id, { kind: "select", values });
    } else {
      return { ok: false, error: INVALID };
    }
  }
  return { ok: true, value: options };
}

export function parseT3Catalog(
  input: unknown
): Result<T3Catalog, { readonly tag: "invalid-t3-catalog" }> {
  let parsed: unknown = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      return { ok: false, error: INVALID };
    }
  }
  if (
    !isRecord(parsed) || !isId(parsed.inheritedProviderInstanceId) ||
    !isId(parsed.inheritedModel) || !Array.isArray(parsed.providers)
  ) {
    return { ok: false, error: INVALID };
  }
  const providers = new Map<ProviderInstanceId, T3Provider>();
  for (const provider of parsed.providers) {
    if (
      !isRecord(provider) || !isId(provider.providerInstanceId) ||
      !isId(provider.driverKind) || typeof provider.canRunChildTask !== "boolean" ||
      !Array.isArray(provider.constraints) ||
      !provider.constraints.every((constraint: unknown) => typeof constraint === "string") ||
      !Array.isArray(provider.models)
    ) {
      return { ok: false, error: INVALID };
    }
    const id = provider.providerInstanceId as ProviderInstanceId;
    if (providers.has(id)) return { ok: false, error: INVALID };
    const models = new Map<T3ModelId, T3Model>();
    for (const model of provider.models) {
      if (!isRecord(model) || !isId(model.id)) return { ok: false, error: INVALID };
      const modelId = model.id as T3ModelId;
      if (models.has(modelId)) return { ok: false, error: INVALID };
      const options = parseOptions(model.options);
      if (!options.ok) return options;
      models.set(modelId, { options: options.value });
    }
    providers.set(id, {
      driverKind: provider.driverKind,
      launchable: provider.canRunChildTask && provider.constraints.length === 0,
      constraints: provider.constraints,
      models,
    });
  }
  return {
    ok: true,
    value: {
      inheritedProviderInstanceId: parsed.inheritedProviderInstanceId as ProviderInstanceId,
      inheritedModel: parsed.inheritedModel as T3ModelId,
      providers,
    },
  };
}
