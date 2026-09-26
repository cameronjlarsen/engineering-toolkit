import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { cliModelFor, shippedCatalog } from "../routing/catalog.ts";
import type { AppId, Effort, ModelSlug } from "../routing/route.ts";

const PLUGIN_ROOT = join(import.meta.dir, "../../../..");
const REPO_ROOT = join(PLUGIN_ROOT, "../..");
const SCAN_ROOTS = [
  join(PLUGIN_ROOT, "skills"),
  join(PLUGIN_ROOT, "agents"),
  join(REPO_ROOT, "docs"),
  join(REPO_ROOT, "README.md"),
];

const NAME = /(?<![a-z0-9.])(?:grok-\d+\.\d+|gpt-\d+(?:\.\d+)?-[a-z0-9]|claude-(?:opus|fable)-\d)[a-z0-9.{}-]*/g;
const ROUTE = /(?<![a-z0-9.-])(claude|codex|cursor|grok):([a-z0-9.{}-]+)@([a-z]+)/g;

const ALLOWED = new Map<string, string>([
  ["plugins/engineering-toolkit/skills/engineering-mode/references/provider-dispatch.md gpt-5.6-sol-max", "upstream pstack choice column"],
  ["plugins/engineering-toolkit/skills/engineering-mode/references/provider-dispatch.md grok-4.7-xhigh-fast", "upstream pstack choice column"],
  ["plugins/engineering-toolkit/skills/engineering-mode/references/provider-dispatch.md cursor:grok-4.7@max", "rejection example"],
  ["plugins/engineering-toolkit/skills/setup-engineering-toolkit/SKILL.md cursor:grok-4.7@max", "rejection example"],
]);

function scannedFiles(path: string): string[] {
  if (path.endsWith(".md")) return [path];
  return readdirSync(path, { recursive: true, encoding: "utf8" })
    .filter((file) => !file.includes("node_modules") && !file.includes("fixtures"))
    .filter((file) => file.endsWith(".md") || (file.endsWith(".ts") && !/\.(test|compile)\.ts$/.test(file)))
    .map((file) => join(path, file));
}

function knownNames(): ReadonlySet<string> {
  const names = new Set<string>();
  for (const app of shippedCatalog().values()) {
    for (const entry of app.models.values()) {
      names.add(entry.family);
      names.add(entry.cli.model);
      for (const effort of entry.efforts) names.add(cliModelFor(entry, effort));
    }
  }
  return names;
}

function routeProblem(provider: string, model: string, effort: string): string | null {
  const app = (provider === "claude" ? "claude-code" : provider) as AppId;
  const entry = shippedCatalog().get(app)?.models.get(model as ModelSlug);
  if (entry === undefined) return `${provider} does not serve ${model}`;
  if (!entry.efforts.includes(effort as Effort)) {
    return `${provider}:${model} lists ${entry.efforts.join(", ")}`;
  }
  return null;
}

function driftIn(file: string): string[] {
  const rel = relative(REPO_ROOT, file).replaceAll("\\", "/");
  const names = knownNames();
  const found: string[] = [];
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    const at = `${rel}:${index + 1}`;
    for (const match of line.matchAll(NAME)) {
      const name = match[0].replace(/[.-]+$/, "");
      if (!names.has(name) && !ALLOWED.has(`${rel} ${name}`)) {
        found.push(`${at}: ${name} is not in shippedCatalog()`);
      }
    }
    for (const [text, provider, model, effort] of line.matchAll(ROUTE)) {
      const problem = routeProblem(provider, model, effort);
      if (problem !== null && !ALLOWED.has(`${rel} ${text}`)) {
        found.push(`${at}: ${text}: ${problem}`);
      }
    }
  });
  return found;
}

describe("model drift", () => {
  it("names only shipped models and efforts in skills, agents, and docs", () => {
    const files = SCAN_ROOTS.flatMap(scannedFiles);
    expect(files.length).toBeGreaterThan(50);
    expect(files.flatMap(driftIn)).toEqual([]);
  });
});
