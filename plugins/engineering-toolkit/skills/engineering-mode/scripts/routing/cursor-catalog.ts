import {
  EFFORTS,
  type Effort,
  type ModelSlug,
  type ProbedModel,
  type Result,
  modelSlug,
} from "./route.ts";

const INVALID = { tag: "invalid-cursor-model-list" as const };
const LINE = /^([a-z0-9][a-z0-9.-]*) - .+$/;
const EFFORT_SUFFIX = new RegExp(`^(.+)-(${EFFORTS.join("|")})$`);

export function parseCursorModels(
  text: string
): Result<readonly ProbedModel[], { readonly tag: "invalid-cursor-model-list" }> {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  if (!lines.includes("Available models")) return { ok: false, error: INVALID };

  const families = new Map<string, Set<Effort>>();
  for (const line of lines) {
    const slug = LINE.exec(line)?.[1];
    if (slug === undefined || slug.endsWith("-fast")) continue;
    const match = EFFORT_SUFFIX.exec(slug);
    if (match === null) continue;
    const [, family, effort] = match as unknown as [string, string, Effort];
    const branded = modelSlug(family);
    if (!branded.ok || branded.value !== family) continue;
    const efforts = families.get(family) ?? new Set<Effort>();
    efforts.add(effort);
    families.set(family, efforts);
  }

  return {
    ok: true,
    value: [...families].map(([family, efforts]) => ({
      slug: family as ModelSlug,
      selectableEfforts: EFFORTS.filter((effort) => efforts.has(effort)),
      cli: { effort: "in-slug", model: `${family}-{effort}` },
    })),
  };
}
