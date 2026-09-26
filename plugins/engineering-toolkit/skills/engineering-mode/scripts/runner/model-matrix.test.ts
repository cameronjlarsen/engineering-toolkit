import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { shippedCatalog } from "../routing/catalog.ts";
import { firstRunRoleMap } from "../routing/parent.ts";
import type { ModelSlug } from "../routing/route.ts";
import { loadRoleMap, printRoleMap } from "../routing/sheet.ts";
import { EFFORTS, type Effort } from "./types.ts";

const PLUGIN_ROOT = join(import.meta.dir, "../../../..");
const DISPATCH_PATH = join(
  PLUGIN_ROOT,
  "skills/engineering-mode/references/provider-dispatch.md"
);
const CURSOR_TOOLS_PATH = join(
  PLUGIN_ROOT,
  "skills/engineering-mode/references/cursor-tools.md"
);
const SETUP_PATH = join(PLUGIN_ROOT, "skills/setup-engineering-toolkit/SKILL.md");
const AGENTS_DIR = join(PLUGIN_ROOT, "agents");

const MATRIX_HEADER = [
  "Family",
  "Upstream pstack choice",
  "Provider",
  "Model",
  "Default effort",
  "Selectable efforts",
  "Plugin-agent stem",
] as const;

const FAMILY_ORDER = ["fable", "sol", "grok", "opus"] as const;
const PROVIDERS = ["claude", "codex", "grok"] as const;
const DESCRIPTOR_RE =
  /(?:claude|codex|cursor|grok):[a-z0-9.-]+@(low|medium|high|xhigh|max)/g;
const PANEL_ROLES = [
  "arena runners",
  "arena cross-judge pool",
  "architect runners",
  "interrogate reviewers",
] as const;
const SHEET_ROLES = [
  "feature, refactoring",
  "bug-fix",
  "perf-issue",
  "hillclimb",
  "judgment and prose",
  "hardest tasks",
  "how explorer",
  "how explainer",
  "why investigators, synthesizer",
  "reflect tooling, judgment, divergent, synthesizer",
  "arena runners",
  "arena cross-judge pool",
  "swarm workers",
  "architect runners",
  "interrogate reviewers",
] as const;
const SETUP_SECTION_ORDER = [
  "### 2. Load current state",
  "### 3. Parse selected routes",
  "### 4. Ask for a budget, then apply it",
  "### 5. Probe selected routes",
  "### 6. Render, preserving role families",
  "### 7. Confirm and commit",
] as const;

interface MatrixRow {
  family: string;
  upstreamChoice: string;
  provider: string;
  model: string;
  defaultEffort: Effort;
  selectableEfforts: Effort[];
  pluginAgentStem: string | null;
}

function splitRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    throw new Error(`matrix row must be a pipe table: ${line}`);
  }
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim().replaceAll("`", ""));
}

function isSeparator(cells: string[]): boolean {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function asEffort(value: string): Effort {
  if ((EFFORTS as readonly string[]).includes(value)) {
    return value as Effort;
  }
  throw new Error(`not an effort: ${value}`);
}

function parseModelMatrix(markdown: string): MatrixRow[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "## Model matrix");
  if (start < 0) {
    throw new Error("missing ## Model matrix");
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }
  const table = lines
    .slice(start + 1, end)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));
  if (table.length !== 6) {
    throw new Error(
      `model matrix must be header, separator, and 4 data rows, got ${table.length}`
    );
  }
  const header = splitRow(table[0]);
  if (header.join("|") !== MATRIX_HEADER.join("|")) {
    throw new Error(`unexpected matrix header: ${header.join(" | ")}`);
  }
  if (!isSeparator(splitRow(table[1]))) {
    throw new Error("matrix header separator missing");
  }
  return table.slice(2).map((line) => {
    const cells = splitRow(line);
    if (cells.length !== MATRIX_HEADER.length) {
      throw new Error(`matrix row has ${cells.length} cells: ${line}`);
    }
    const [
      family,
      upstreamChoice,
      provider,
      model,
      defaultEffortRaw,
      selectableRaw,
      stemRaw,
    ] = cells;
    if (!(PROVIDERS as readonly string[]).includes(provider)) {
      throw new Error(`invalid provider: ${provider}`);
    }
    const selectableEfforts = selectableRaw.split(/\s+/).map(asEffort);
    const pluginAgentStem = stemRaw === "-" ? null : stemRaw;
    if (pluginAgentStem !== null && !/^[a-z0-9-]+$/.test(pluginAgentStem)) {
      throw new Error(`invalid plugin-agent stem: ${stemRaw}`);
    }
    if ((provider === "claude") !== (pluginAgentStem !== null)) {
      throw new Error(`${family} stem must be present iff provider is claude`);
    }
    const defaultEffort = asEffort(defaultEffortRaw);
    if (!selectableEfforts.includes(defaultEffort)) {
      throw new Error(`${family} default effort is not selectable`);
    }
    return {
      family,
      upstreamChoice,
      provider,
      model,
      defaultEffort,
      selectableEfforts,
      pluginAgentStem,
    };
  });
}

function appOf(row: MatrixRow): "claude-code" | "codex" | "grok" {
  return row.provider === "claude" ? "claude-code" : (row.provider as "codex" | "grok");
}

function firstRunDescriptor(row: MatrixRow): string {
  return `${row.provider}:${row.model}@${row.defaultEffort}`;
}

function defaultDescriptors(rows: MatrixRow[]): string[] {
  return rows.map(firstRunDescriptor);
}

function parseFrontmatter(text: string): {
  fields: Record<string, string>;
  body: string;
} {
  if (!text.startsWith("---\n")) {
    throw new Error("missing frontmatter");
  }
  const end = text.indexOf("\n---\n", 4);
  if (end < 0) {
    throw new Error("unterminated frontmatter");
  }
  const fields: Record<string, string> = {};
  for (const line of text.slice(4, end).split("\n")) {
    const idx = line.indexOf(": ");
    if (idx < 0) {
      throw new Error(`bad frontmatter line: ${line}`);
    }
    fields[line.slice(0, idx)] = line.slice(idx + 2);
  }
  return { fields, body: text.slice(end + 5) };
}

function firstRunSheet(setup: string): string {
  const match = setup.match(
    /```markdown\n(# Engineering Toolkit model configuration\n[\s\S]*?)```/
  );
  if (!match) {
    throw new Error("setup-engineering-toolkit is missing the first-run sheet fence");
  }
  return match[1];
}

describe("model matrix", () => {
  const rows = parseModelMatrix(
    readFileSync(DISPATCH_PATH, "utf8").replaceAll("\r\n", "\n")
  );
  const setup = readFileSync(SETUP_PATH, "utf8").replaceAll("\r\n", "\n");
  const quad = defaultDescriptors(rows);

  it("owns the effort universe and first-run defaults", () => {
    expect([...EFFORTS]).toEqual(["low", "medium", "high", "xhigh", "max"]);
    expect(rows.map((row) => row.family)).toEqual([...FAMILY_ORDER]);
    for (const row of rows) {
      expect(row.upstreamChoice.length).toBeGreaterThan(0);
      expect(row.model.length).toBeGreaterThan(0);
      expect(row.selectableEfforts.length).toBeGreaterThan(0);
      expect(row.selectableEfforts).toEqual(
        EFFORTS.filter((effort) => row.selectableEfforts.includes(effort))
      );
    }
    expect(
      rows.map((row) => [row.family, row.defaultEffort])
    ).toEqual([
      ["fable", "max"],
      ["sol", "max"],
      ["grok", "xhigh"],
      ["opus", "xhigh"],
    ]);
    expect(
      rows
        .filter((row) => row.family === "fable" || row.family === "opus")
        .map((row) => [row.family, row.model])
    ).toEqual([
      ["fable", "fable"],
      ["opus", "opus"],
    ]);
  });

  it("ships exactly the declared Claude-native frontier agents", () => {
    const expected = new Set<string>();
    const familyBodies = new Map<string, string>();
    for (const row of rows) {
      const stem = row.pluginAgentStem;
      if (stem === null) {
        continue;
      }
      for (const effort of row.selectableEfforts) {
        const name = `pstack-${stem}-${effort}`;
        expected.add(`${name}.md`);
        const text = readFileSync(join(AGENTS_DIR, `${name}.md`), "utf8").replaceAll(
          "\r\n",
          "\n"
        );
        const { fields, body } = parseFrontmatter(text);
        expect(fields).toEqual({
          name,
          description: `Native plugin-agent lane for pstack roles configured as ${row.model}@${effort}.`,
          model: row.model,
          effort,
          background: "true",
          disallowedTools: "Agent, Task",
        });
        const prior = familyBodies.get(stem);
        if (prior === undefined) {
          familyBodies.set(stem, body);
        } else {
          expect(body).toBe(prior);
        }
      }
    }
    const declaredCount = rows.reduce(
      (count, row) =>
        count +
        (row.pluginAgentStem === null
          ? 0
          : row.selectableEfforts.length),
      0
    );
    expect(expected.size).toBe(declaredCount);
    const shipped = readdirSync(AGENTS_DIR)
      .filter((name) => name.startsWith("pstack-") && name.endsWith(".md"))
      .sort();
    expect(shipped).toEqual([...expected].sort());
  });

  it("keeps setup's first-run default panel copy aligned with the matrix", () => {
    const sheet = firstRunSheet(setup);
    const roles = sheet
      .split("\n")
      .filter((line) => line.includes(": "))
      .map((line) => line.slice(0, line.indexOf(": ")))
      .filter((role) => (SHEET_ROLES as readonly string[]).includes(role));
    expect(roles).toEqual([...SHEET_ROLES]);
    const byFamily = new Map<string, MatrixRow>(
      rows.map((row) => [`${row.provider}:${row.model}`, row])
    );
    for (const descriptor of sheet.match(DESCRIPTOR_RE) ?? []) {
      const at = descriptor.lastIndexOf("@");
      const key = descriptor.slice(0, at);
      const effort = descriptor.slice(at + 1);
      const row = byFamily.get(key);
      if (row === undefined) {
        throw new Error(`unknown first-run descriptor: ${descriptor}`);
      }
      expect(effort).toBe(row.defaultEffort);
    }
    const expectedPanel = quad.join(", ");
    for (const role of PANEL_ROLES) {
      const line = sheet
        .split("\n")
        .find((entry) => entry.startsWith(`${role}:`));
      if (line === undefined) {
        throw new Error(`missing first-run panel row: ${role}`);
      }
      expect(line).toBe(`${role}: ${expectedPanel}`);
    }
  });

  it("parses setup's first-run sheet, prose included, on every parent", () => {
    const sheet = firstRunSheet(setup);
    for (const parent of ["claude-code", "codex", "cursor"] as const) {
      const loaded = loadRoleMap(sheet, parent);
      if (!loaded.ok) throw new Error(`${parent}: ${JSON.stringify(loaded.error)}`);
      expect(loaded.value).toEqual(firstRunRoleMap("claude-code", shippedCatalog()));
    }
  });

  it("binds the shipped catalog and first-run sheet to the matrix", () => {
    const catalog = shippedCatalog();
    for (const app of ["claude-code", "codex", "grok"] as const) {
      const provider = app === "claude-code" ? "claude" : app;
      const matrixModels = rows
        .filter((row) => row.provider === provider)
        .map((row) => row.model)
        .sort();
      const catalogModels = [...(catalog.get(app)?.models.keys() ?? [])]
        .map((slug) => String(slug))
        .sort();
      expect(catalogModels).toEqual(matrixModels);
    }
    for (const row of rows) {
      const onApp = catalog.get(appOf(row))?.models.get(row.model as ModelSlug);
      expect(onApp?.efforts).toEqual(row.selectableEfforts);
      expect(onApp?.nativeStem).toBe(row.pluginAgentStem);
    }
    const printed = printRoleMap(firstRunRoleMap("claude-code", catalog));
    expect(printed).toContain("bug-fix: codex:gpt-6-sol@max");
    expect(printed).toContain("perf-issue: codex:gpt-6-sol@max");
    expect(printed).toContain("hillclimb: codex:gpt-6-sol@max");
    const panel = quad.join(", ");
    for (const role of PANEL_ROLES) {
      expect(printed).toContain(`${role}: ${panel}`);
    }
  });

  it("keeps setup's fail-closed reconfiguration order", () => {
    let previous = -1;
    for (const heading of SETUP_SECTION_ORDER) {
      const current = setup.indexOf(heading);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
    expect(setup).toContain("while any inconsistency is unresolved.");
    expect(setup).toContain("A failed probe writes nothing:");
    expect(setup).toContain("Probe only selected routes");
    expect(setup).toContain("normalized complete role map from step 2");
    expect(setup).toContain("`claude-fable-*` and `claude-opus-*`");
    expect(setup).toContain("preserving provider, effort, role,");
    expect(setup).toContain("rolling-alias migrations");
    expect(setup).toContain("documented role remains present.");
    expect(setup).toContain("A changed");
    expect(setup).toContain("<!-- engineering-toolkit:models:begin -->");
    expect(setup).toContain("<!-- engineering-toolkit:models:end -->");
    expect(setup).toContain(
      "| Grok | Grok matrix row + selected effort | Grok CLI | Grok CLI | native Task host-spawn |"
    );
  });

  it("binds Claude-native dispatch to the matrix mapping", () => {
    const dispatch = readFileSync(DISPATCH_PATH, "utf8").replaceAll("\r\n", "\n");
    const nativeStart = dispatch.indexOf("## Native lanes");
    const externalStart = dispatch.indexOf("## External lanes");
    expect(nativeStart).toBeGreaterThan(-1);
    expect(externalStart).toBeGreaterThan(nativeStart);
    const nativeLanes = dispatch.slice(nativeStart, externalStart);
    expect(nativeLanes).toContain(
      "match the route's `(provider, model)` to one model-matrix row"
    );
    expect(nativeLanes).toContain("`pstack-<stem>-<effort>`");
    expect(nativeLanes).toContain("host-spawn");
    expect(nativeLanes).toContain(
      "Set `Task` `model` to a live Cursor selector"
    );
    expect(nativeLanes).toContain("Do not pass `opus` or `fable`");
    expect(nativeLanes).not.toContain(
      "Do not pass a Cursor host model slug onto a plugin-agent Task"
    );
  });

  it("requires Cursor plugin-agent Tasks to pass a live family selector", () => {
    const cursorTools = readFileSync(CURSOR_TOOLS_PATH, "utf8").replaceAll("\r\n", "\n");
    const nativeStart = cursorTools.indexOf("## Native lanes");
    const externalStart = cursorTools.indexOf("## External lanes");
    expect(nativeStart).toBeGreaterThan(-1);
    expect(externalStart).toBeGreaterThan(nativeStart);
    const nativeLanes = cursorTools.slice(nativeStart, externalStart);
    const pluginAgent = nativeLanes
      .split(/\r?\n/)
      .find((line) => line.includes("plugin-agent:"));
    expect(pluginAgent).toBeDefined();
    expect(pluginAgent).toContain("live Cursor selector");
    expect(pluginAgent).toContain("this session's Task model list");
    expect(pluginAgent).toContain("Do not pass `opus` or `fable`");
    expect(pluginAgent).toContain("Do not omit `model`");
    expect(pluginAgent).toContain("inherits the parent");
    expect(pluginAgent).not.toContain(
      "Do not set `Task` `model` to a Cursor host slug"
    );
    const cursorNative = readFileSync(DISPATCH_PATH, "utf8").replaceAll("\r\n", "\n");
    const cursorBullet = cursorNative
      .split(/\r?\n/)
      .filter((line) => line.includes("plugin-agent") || line.includes("`opus`"))
      .join("\n");
    expect(cursorBullet).toContain("live Cursor selector");
    expect(setup).toContain(
      "A Cursor plugin-agent probe must also prove the child is the requested family"
    );
    expect(setup).toContain("A reply that names the parent model");
  });

  it("normalizes old rolling-family pins before any runtime route", () => {
    const dispatch = readFileSync(DISPATCH_PATH, "utf8").replaceAll("\r\n", "\n");
    const normalizationStart = dispatch.indexOf("## Read-time normalization");
    const parentStart = dispatch.indexOf("## The parent owns the route");
    expect(normalizationStart).toBeGreaterThan(-1);
    expect(parentStart).toBeGreaterThan(normalizationStart);
    const normalization = dispatch.slice(normalizationStart, parentStart);
    expect(normalization).toContain("replace the model component in memory");
    expect(normalization).toContain("Never pass the versioned predecessor to Claude.");
    expect(normalization).toContain("without writing user files");
    expect(normalization).toContain("`/setup-engineering-toolkit` will rewrite it");
    expect(normalization).toContain("runner rejects a missed Fable or Opus version pin");
  });
});
