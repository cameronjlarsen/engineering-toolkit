import { describe, expect, it } from "bun:test";
import { parseCodexDebugModels } from "./codex-catalog.ts";
import { EFFORTS, modelSlug } from "./route.ts";

function slug(raw: string) {
  const parsed = modelSlug(raw);
  if (!parsed.ok) throw new Error(raw);
  return parsed.value;
}

describe("parseCodexDebugModels", () => {
  it("filters ultra from the selectable efforts", () => {
    const result = parseCodexDebugModels(
      JSON.stringify({
        models: [
          {
            slug: "gpt-6.1-sol",
            default_reasoning_level: "high",
            supported_reasoning_levels: [
              { effort: "ultra" },
              { effort: "high" },
            ],
          },
        ],
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([
      {
        slug: slug("gpt-6.1-sol"),
        selectableEfforts: ["high"],
      },
    ]);
    expect(result.value[0]?.selectableEfforts).toContain("high");
    expect(result.value[0]?.selectableEfforts).not.toContain("ultra");
  });

  it("parses gpt-6-sol with the five known efforts", () => {
    const result = parseCodexDebugModels(
      JSON.stringify({
        models: [
          {
            slug: "gpt-6-sol",
            default_reasoning_level: "medium",
            supported_reasoning_levels: EFFORTS.map((effort) => ({ effort })),
          },
        ],
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([
      {
        slug: slug("gpt-6-sol"),
        selectableEfforts: [...EFFORTS],
      },
    ]);
  });

  it("rejects non-json input", () => {
    expect(parseCodexDebugModels("not json")).toEqual({
      ok: false,
      error: { tag: "invalid-codex-model-catalog" },
    });
  });
});
