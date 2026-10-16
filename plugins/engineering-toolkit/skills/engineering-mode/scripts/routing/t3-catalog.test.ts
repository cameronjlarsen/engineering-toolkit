import { describe, expect, it } from "bun:test";
import fixture from "./fixtures/t3-capabilities.json";
import { parseT3Catalog } from "./t3-catalog.ts";

function minimal() {
  return {
    inheritedProviderInstanceId: "codex",
    inheritedModel: "gpt-6.1-sol",
    providers: [{
      providerInstanceId: "codex",
      driverKind: "codex",
      canRunChildTask: true,
      constraints: [] as string[],
      models: [{ id: "gpt-6.1-sol", options: [] as unknown[] }],
    }],
  };
}

describe("parseT3Catalog", () => {
  it("parses the live fixture without filtering or normalizing options", () => {
    const result = parseT3Catalog(fixture);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const catalog = result.value;
    expect(catalog.inheritedProviderInstanceId as string).toBe("codex");
    expect(catalog.inheritedModel as string).toBe("gpt-6.1-sol");
    expect(catalog.providers.size).toBe(4);
    const codex = catalog.providers.get(catalog.inheritedProviderInstanceId);
    expect(codex?.driverKind).toBe("codex");
    expect(codex?.launchable).toBe(true);
    expect(codex?.models.get(catalog.inheritedModel)?.options).toEqual(new Map([
      ["reasoningEffort", { kind: "select", values: ["low", "medium", "high", "xhigh", "max", "ultra"] }],
      ["serviceTier", { kind: "select", values: ["default", "priority"] }],
    ]));
    const claude = [...catalog.providers.values()].find((provider) => provider.driverKind === "claudeAgent");
    const opus = [...(claude?.models ?? [])].find(([id]) => id === "claude-opus-5-5")?.[1];
    expect(opus?.options.get("effort")).toEqual({
      kind: "select", values: ["low", "medium", "high", "xhigh", "max", "ultracode", "ultrathink"],
    });
    expect(opus?.options.get("fastMode")).toEqual({ kind: "boolean" });
    const grok = [...catalog.providers.values()].find((provider) => provider.driverKind === "grok");
    expect(grok?.launchable).toBe(false);
    expect(grok?.constraints).toEqual(fixture.providers.find((provider) => provider.driverKind === "grok")?.constraints);
    expect(parseT3Catalog(JSON.stringify(fixture))).toEqual(result);
  });

  it("ignores unknown fields and option types at every level", () => {
    const input = minimal();
    const expanded = {
      ...input, extra: null,
      providers: input.providers.map((provider) => ({
        ...provider, extra: 1,
        models: [{ id: "gpt-6.1-sol", extra: [], options: [
          { id: "effort", type: "select", extra: false, options: [{ id: "custom", isDefault: true, extra: {} }] },
          { id: "fast", type: "boolean", extra: "ignored" },
          { id: "temperature", type: "number" },
        ] }],
      })),
    };
    const result = parseT3Catalog(expanded);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.providers.get(result.value.inheritedProviderInstanceId)?.models.get(result.value.inheritedModel)?.options)
      .toEqual(new Map([
        ["effort", { kind: "select", values: ["custom"] }],
        ["fast", { kind: "boolean" }],
      ]));
  });

  it.each([
    [false, []], [true, ["Blocked."]], [false, ["Blocked."]],
  ] as const)("marks canRunChildTask=%s and constraints=%j unavailable", (canRunChildTask, constraints) => {
    const input = minimal();
    input.providers[0].canRunChildTask = canRunChildTask;
    input.providers[0].constraints = [...constraints];
    const result = parseT3Catalog(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.providers.get(result.value.inheritedProviderInstanceId)?.launchable).toBe(false);
  });

  const valid = minimal();
  const provider = valid.providers[0];
  const model = provider.models[0];
  const malformed: unknown[] = [
    "not json", null, [], {},
    { ...valid, inheritedProviderInstanceId: 1 },
    { ...valid, inheritedProviderInstanceId: " " },
    { ...valid, inheritedModel: null },
    { ...valid, inheritedModel: "" },
    { ...valid, providers: {} },
    ...[null, [], {},
      { ...provider, providerInstanceId: "" },
      { ...provider, driverKind: false },
      { ...provider, canRunChildTask: "true" },
      { ...provider, constraints: "blocked" },
      { ...provider, constraints: [null] },
      { ...provider, models: null },
    ].map((bad) => ({ ...valid, providers: [bad] })),
    { ...valid, providers: [provider, provider] },
    ...[null, [], {}, { ...model, id: "" }, { ...model, id: 4 },
      { ...model, options: undefined }, { ...model, options: {} },
    ].map((bad) => ({ ...valid, providers: [{ ...provider, models: [bad] }] })),
    { ...valid, providers: [{ ...provider, models: [model, model] }] },
    ...[null, [], {}, { id: "", type: "boolean" },
      { id: "x", type: "select", options: null },
      ...[null, [], {}, { id: "" }, { id: 1 }, { id: "high", isDefault: "true" }]
        .map((bad) => ({ id: "x", type: "select", options: [bad] })),
      { id: "x", type: "select", options: [{ id: "high" }, { id: "high" }] },
    ].map((bad) => ({ ...valid, providers: [{ ...provider, models: [{ ...model, options: [bad] }] }] })),
    { ...valid, providers: [{ ...provider, models: [{ ...model, options: [
      { id: "x", type: "boolean" }, { id: "x", type: "boolean" },
    ] }] }] },
  ];

  it.each(malformed.map((input, index) => [index, input] as const))("rejects malformed input %i", (_, input) => {
    expect(parseT3Catalog(input)).toEqual({ ok: false, error: { tag: "invalid-t3-catalog" } });
  });
});
