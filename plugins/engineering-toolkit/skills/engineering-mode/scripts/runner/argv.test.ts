import { describe, expect, it } from "bun:test";
import {
  modelSlug,
  type Access,
  type CliChildApp,
  type Effort,
  type LanePlan,
  type ModelSlug,
  type ParentHost,
  type WorkerPolicy,
} from "../routing/route.ts";
import { runnerArgv } from "./argv.ts";
import { parseArgs } from "./cli.ts";

const access: Access = { mode: "read-only", worktree: null };
const worker: WorkerPolicy = {
  mayChooseRoute: false,
  maySpawnAgents: false,
  inheritCoordinatorMcp: false,
};

function externalPlan(
  parent: ParentHost,
  app: CliChildApp,
  model: ModelSlug,
  effort: Effort
): Extract<LanePlan, { kind: "external" }> {
  return {
    kind: "external",
    parent,
    route: { model, app, effort, lane: "external" },
    launch: { app, model, effort },
    access,
    worker,
  };
}

describe("runnerArgv", () => {
  it("builds --parent cursor --app grok without naming cursor as the child", () => {
    const grok = modelSlug("grok-4.7");
    if (!grok.ok) throw new Error("grok");
    const planned = externalPlan("cursor", "grok", grok.value, "xhigh");
    const argv = runnerArgv(planned, {
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

  it("preserves the fixed Sonnet 5.5 ID in Claude CLI arguments", () => {
    const sonnet = modelSlug("claude-sonnet-5-5");
    if (!sonnet.ok) throw new Error("sonnet");
    const planned = externalPlan("codex", "claude-code", sonnet.value, "medium");
    const argv = runnerArgv(planned, {
      promptPath: "prompt.md",
      cwd: "/repo",
      outputPath: "out.md",
      receiptPath: "receipt.json",
      mode: "read-only",
      timeoutMs: null,
    });
    expect(argv.slice(0, 8)).toEqual([
      "--parent",
      "codex",
      "--app",
      "claude-code",
      "--model",
      "claude-sonnet-5-5",
      "--effort",
      "medium",
    ]);
  });
});
