import { readFileSync } from "node:fs";
import { parseT3Catalog, type T3Catalog } from "./t3-catalog.ts";
import {
  checkT3RoleMap,
  DELEGATION_DRIVERS,
  loadT3RoleMap,
  type T3CheckIssue,
  type T3Target,
} from "./t3-sheet.ts";

const label = (target: T3Target): string => `${target.providerInstanceId}/${target.model}`;

export function summarizeT3Catalog(catalog: T3Catalog): readonly string[] {
  const lines = [`inherited: ${catalog.inheritedProviderInstanceId}/${catalog.inheritedModel}`];
  for (const [id, provider] of catalog.providers) {
    const status = !(DELEGATION_DRIVERS as readonly string[]).includes(provider.driverKind)
      ? "not-allowed"
      : provider.launchable
        ? "launchable"
        : `dropout (${provider.constraints.join("; ") || "cannot run child tasks"})`;
    lines.push(`${id} driver=${provider.driverKind} ${status} models=${provider.models.size}`);
  }
  return lines;
}

export function describeT3Issue(issue: T3CheckIssue): string {
  const { entry, ...rest } = issue;
  const target = "providerInstanceId" in entry ? label(entry) : entry.map(label).join(", ");
  return JSON.stringify({ ...rest, target });
}

function main(args: readonly string[]): number {
  const [capabilitiesPath, sheetPath] = args;
  if (capabilitiesPath === undefined) {
    console.error("usage: t3-capabilities.ts <capabilities.json> [<grammar 4 sheet>]");
    return 2;
  }
  const catalog = parseT3Catalog(readFileSync(capabilitiesPath, "utf8"));
  if (!catalog.ok) {
    console.error(JSON.stringify(catalog.error));
    return 1;
  }
  console.log(summarizeT3Catalog(catalog.value).join("\n"));
  if (sheetPath === undefined) return 0;
  const sheet = loadT3RoleMap(readFileSync(sheetPath, "utf8"));
  if (!sheet.ok) {
    console.error(JSON.stringify(sheet.error));
    return 1;
  }
  const issues = checkT3RoleMap(sheet.value, catalog.value);
  for (const issue of issues) console.log(describeT3Issue(issue));
  console.log(`issues: ${issues.length}`);
  return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
