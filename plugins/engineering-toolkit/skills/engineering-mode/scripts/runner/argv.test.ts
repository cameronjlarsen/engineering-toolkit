import { describe, expect, it } from "bun:test";
import { shippedCatalog } from "../routing/catalog.ts";
import { planLane } from "../routing/dispatch.ts";
import {
  modelSlug,
  route,
  type Access,
} from "../routing/route.ts";
import { runnerArgv } from "./argv.ts";
import { parseArgs } from "./cli.ts";

const access: Access = { mode: "read-only", worktree: null };

describe("runnerArgv", () => {
  it("builds --parent cursor --app grok without naming cursor as the child", () => {
    const grok = modelSlug("grok-4.7");
    if (!grok.ok) throw new Error("grok");
    const planned = planLane({
      parent: "cursor",
      binding: {
        kind: "route",
        route: route({
          model: grok.value,
          app: "grok",
          effort: "xhigh",
        }),
      },
      override: undefined,
      catalog: shippedCatalog(),
      inventory: [{ app: "grok", readiness: { kind: "launch-ready" } }],
      access,
      role: "arena runners",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok || planned.value.kind !== "external") return;
    const argv = runnerArgv(planned.value, {
      promptPath: "prompt.md",
      cwd: "/repo",
      outputPath: "out.md",
      receiptPath: "receipt.json",
      mode: "read-only",
      timeoutMs: null,
    });
    expect(argv).toEqual([
      "--parent",
      "cursor",
      "--app",
      "grok",
      "--model",
      "grok-4.7",
      "--effort",
      "xhigh",
      "--mode",
      "read-only",
      "--prompt",
      "prompt.md",
      "--cwd",
      "/repo",
      "--output",
      "out.md",
      "--receipt",
      "receipt.json",
    ]);
    expect(argv).not.toContain("cursor-task");
    const parsed = parseArgs(argv);
    expect(parsed?.parent).toBe("cursor");
    expect(parsed?.app).toBe("grok");
    expect(parsed?.timeoutMs).toBeNull();
  });
});
