import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
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
const SETUP_PATH = join(PLUGIN_ROOT, "skills/setup-engineering-toolkit/SKILL.md");

const MATRIX_HEADER = [
  "Family",
  "Upstream pstack choice",
  "Provider",
  "Model",
  "Default effort",
  "Selectable efforts",
] as const;
const ADDITIONAL_HEADER = [
  "Model",
  "Provider",
  "Selectable efforts",
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

interface SupportedModel {
  provider: string;
  model: string;
  selectableEfforts: Effort[];
}

interface MatrixRow extends SupportedModel {
  family: string;
  upstreamChoice: string;
  defaultEffort: Effort;
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
    ] = cells;
    if (!(PROVIDERS as readonly string[]).includes(provider)) {
      throw new Error(`invalid provider: ${provider}`);
    }
    const selectableEfforts = selectableRaw.split(/\s+/).map(asEffort);
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
    };
  });
}

function parseAdditionalModels(markdown: string): SupportedModel[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "## Additional selectable models");
  if (start < 0) throw new Error("missing ## Additional selectable models");
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
  if (table.length < 3) throw new Error("additional selectable models table is empty");
  const header = splitRow(table[0]);
  if (header.join("|") !== ADDITIONAL_HEADER.join("|")) {
    throw new Error(`unexpected additional-model header: ${header.join(" | ")}`);
  }
  if (!isSeparator(splitRow(table[1]))) {
    throw new Error("additional-model table separator missing");
  }
  return table.slice(2).map((line) => {
    const cells = splitRow(line);
    if (cells.length !== ADDITIONAL_HEADER.length) {
      throw new Error(`additional-model row has ${cells.length} cells: ${line}`);
    }
    const [model, provider, selectableRaw] = cells;
    if (!(PROVIDERS as readonly string[]).includes(provider)) {
      throw new Error(`invalid provider: ${provider}`);
    }
    const selectableEfforts = selectableRaw.split(/\s+/).map(asEffort);
    return { model, provider, selectableEfforts };
  });
}

function namedApp(row: Pick<SupportedModel, "provider">): string {
  return row.provider === "claude" ? "claude-code" : row.provider;
}

function firstRunDescriptor(row: MatrixRow): string {
  return `${row.provider}:${row.model}@${row.defaultEffort}`;
}

function defaultDescriptors(rows: MatrixRow[]): string[] {
  return rows.map(firstRunDescriptor);
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
  const dispatch = readFileSync(DISPATCH_PATH, "utf8").replaceAll("\r\n", "\n");
  const rows = parseModelMatrix(dispatch);
  const additionalModels = parseAdditionalModels(dispatch);
  const supportedModels: SupportedModel[] = [...rows, ...additionalModels];
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

  it("keeps Sonnet 5.5 explicitly selectable outside the default matrix", () => {
    expect(additionalModels).toEqual([
      {
        model: "claude-sonnet-5-5",
        provider: "claude",
        selectableEfforts: [...EFFORTS],
      },
    ]);
    expect(rows).toHaveLength(4);
    expect(setup).not.toContain("claude-sonnet-5-5@");
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
      const expectedModels = supportedModels
        .filter((row) => row.provider === provider)
        .map((row) => row.model)
        .sort();
      const catalogModels = [...(catalog.get(app)?.models.keys() ?? [])]
        .map((slug) => String(slug))
        .sort();
      expect(catalogModels).toEqual(expectedModels);
    }
    const cursorModels = [...(catalog.get("cursor")?.models.keys() ?? [])]
      .map((slug) => String(slug))
      .sort();
    expect(cursorModels).toEqual(
      supportedModels.filter((row) => row.provider !== "codex").map((row) => row.model).sort()
    );
    for (const row of supportedModels) {
      const home = namedApp(row);
      const onApp = catalog.get(home as "claude-code" | "codex" | "grok")?.models.get(
        row.model as ModelSlug
      );
      expect(onApp?.efforts).toEqual(row.selectableEfforts);
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
