import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fixture from "./fixtures/t3-capabilities.json";
import { PANEL_ROLE_IDS, SINGLE_ROLE_IDS } from "./sheet.ts";
import { parseT3Catalog } from "./t3-catalog.ts";
import { summarizeT3Catalog } from "./t3-capabilities.ts";

const script = join(import.meta.dir, "t3-capabilities.ts");

function run(files: Record<string, string>, names: readonly string[]) {
  const dir = mkdtempSync(join(tmpdir(), "t3-capabilities-"));
  try {
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
    const result = Bun.spawnSync([process.execPath, script, ...names.map((name) => join(dir, name))]);
    return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const elided = {
  ...fixture,
  providers: fixture.providers.map((provider) =>
    provider.driverKind === "codex" || provider.driverKind === "claudeAgent"
      ? provider
      : { ...provider, models: [] }
  ),
};

// The smallest copy of orchestrator_capabilities that setup tells the agent to write.
const minimal = {
  inheritedProviderInstanceId: fixture.inheritedProviderInstanceId,
  inheritedModel: fixture.inheritedModel,
  providers: fixture.providers.map((provider) => ({
    providerInstanceId: provider.providerInstanceId,
    driverKind: provider.driverKind,
    canRunChildTask: provider.canRunChildTask,
    constraints: provider.constraints,
    models:
      provider.driverKind === "codex" || provider.driverKind === "claudeAgent"
        ? provider.models.map((model) => ({
            id: model.id,
            options: model.options.map((option) =>
              option.type === "select"
                ? { id: option.id, type: option.type, options: (option.options ?? []).map(({ id }) => ({ id })) }
                : { id: option.id, type: option.type }
            ),
          }))
        : [],
  })),
};

function sheet(bugFix: string): string {
  const roles = [...SINGLE_ROLE_IDS, ...PANEL_ROLE_IDS];
  return [
    "Descriptor grammar: 4",
    "# budget: medium (high)",
    ...roles.map((role) => `${role}: ${role === "bug-fix" ? bugFix : "inherit-parent"}`),
  ].join("\n");
}

describe("summarizeT3Catalog", () => {
  it("states the model count and status of every provider", () => {
    const parsed = parseT3Catalog(fixture);
    if (!parsed.ok) throw new Error("expected a T3 catalog");
    const lines = summarizeT3Catalog(parsed.value);
    expect(lines[0]).toBe("inherited: codex/gpt-6.1-sol");
    const codex = fixture.providers.find((provider) => provider.driverKind === "codex");
    expect(lines).toContain(`codex driver=codex launchable models=${codex?.models.length}`);
    expect(lines.some((line) => line.startsWith("cursor driver=cursor not-allowed"))).toBe(true);
    expect(lines.some((line) => line.startsWith("grok driver=grok not-allowed"))).toBe(true);
  });
});

describe("minimal capabilities shape", () => {
  it("parses to the same targets as the full output for delegation drivers", () => {
    const full = parseT3Catalog(fixture);
    const small = parseT3Catalog(minimal);
    if (!full.ok || !small.ok) throw new Error("expected both shapes to parse");
    expect(small.value.inheritedModel).toBe(full.value.inheritedModel);
    for (const id of ["codex", "claudeAgent"]) {
      const key = id as Parameters<typeof full.value.providers.get>[0];
      expect(small.value.providers.get(key)).toEqual(full.value.providers.get(key));
    }
    expect(summarizeT3Catalog(small.value).filter((line) => !/not-allowed/.test(line))).toEqual(
      summarizeT3Catalog(full.value).filter((line) => !/not-allowed/.test(line))
    );
  });

  it("checks a sheet against the minimal copy without an unknown-option issue", () => {
    const result = run(
      { "capabilities.json": JSON.stringify(minimal), "sheet.md": sheet("codex/gpt-6.1-sol reasoningEffort=high") },
      ["capabilities.json", "sheet.md"]
    );
    expect(result.code).toBe(0);
    expect(result.out).toContain("issues: 0");
  });
});

describe("t3-capabilities CLI", () => {
  it("summarizes a capabilities file whose other providers elide their models", () => {
    const result = run({ "capabilities.json": JSON.stringify(elided) }, ["capabilities.json"]);
    expect(result.code).toBe(0);
    expect(result.out).toContain("cursor driver=cursor not-allowed models=0");
    expect(result.out).toContain("codex driver=codex launchable models=");
  });

  it("checks a sheet and reports a disallowed driver without an unknown-model issue", () => {
    const result = run(
      { "capabilities.json": JSON.stringify(elided), "sheet.md": sheet("cursor/grok-4.7") },
      ["capabilities.json", "sheet.md"]
    );
    expect(result.code).toBe(0);
    expect(result.out).toContain('"tag":"provider-not-allowed"');
    expect(result.out).not.toContain("unknown-model");
    expect(result.out).toContain("issues: 1");
  });

  it("fails on malformed capabilities and on a missing argument", () => {
    const bad = run({ "capabilities.json": "{}" }, ["capabilities.json"]);
    expect(bad.code).toBe(1);
    expect(bad.err).toContain("invalid-t3-catalog");
    expect(run({}, []).code).toBe(2);
  });
});
