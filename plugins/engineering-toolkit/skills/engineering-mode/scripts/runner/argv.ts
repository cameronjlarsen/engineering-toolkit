import type { LanePlan } from "../routing/route.ts";
import type { AccessMode } from "./types.ts";

export function runnerArgv(
  plan: Extract<LanePlan, { kind: "external" }>,
  io: {
    readonly promptPath: string;
    readonly cwd: string;
    readonly outputPath: string;
    readonly receiptPath: string;
    readonly mode: AccessMode;
    readonly timeoutMs: number | null;
  }
): readonly string[] {
  const argv = [
    "--parent",
    plan.parent,
    "--app",
    plan.launch.app,
    "--model",
    plan.launch.model,
    "--effort",
    plan.launch.effort,
    "--mode",
    io.mode,
    "--prompt",
    io.promptPath,
    "--cwd",
    io.cwd,
    "--output",
    io.outputPath,
    "--receipt",
    io.receiptPath,
  ];
  if (io.timeoutMs !== null) {
    argv.push("--timeout", String(io.timeoutMs / 1_000));
  }
  return argv;
}
