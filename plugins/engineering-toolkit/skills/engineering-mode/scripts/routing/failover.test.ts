import { describe, expect, it } from "bun:test";
import { shippedCatalog } from "./catalog.ts";
import {
  beginSoloRole,
  failoverBinding,
  observeSoloRole,
  selectedRoutes,
} from "./failover.ts";
import { nativeHandle, pluginAgentName } from "./parent.ts";
import {
  currentHost,
  destinationDefault,
  explicitEffort,
  modelSlug,
  namedApp,
  route,
  type Access,
  type RoleMap,
} from "./route.ts";
import type { RunnerReceipt } from "../runner/types.ts";

function slug(raw: string) {
  const parsed = modelSlug(raw);
  if (!parsed.ok) throw new Error(raw);
  return parsed.value;
}

describe("failoverBinding", () => {
  it("rejects a chain shorter than two routes", () => {
    expect(
      failoverBinding([
        route({
          model: slug("grok-4.6"),
          app: namedApp("grok"),
          effort: explicitEffort("xhigh"),
        }),
      ])
    ).toEqual({ ok: false, error: { tag: "failover-too-short" } });
    expect(failoverBinding([])).toEqual({
      ok: false,
      error: { tag: "failover-too-short" },
    });
  });

  it("rejects destination-default effort on any hop", () => {
    expect(
      failoverBinding([
        route({
          model: slug("grok-4.6"),
          app: namedApp("grok"),
          effort: destinationDefault(),
        }),
        route({
          model: slug("opus"),
          app: currentHost(),
          effort: explicitEffort("xhigh"),
        }),
      ])
    ).toEqual({ ok: false, error: { tag: "failover-requires-explicit-effort" } });
  });

  it("rejects a later weaker effort on the same app and model", () => {
    const grok = namedApp("grok");
    expect(
      failoverBinding([
        route({
          model: slug("grok-4.6"),
          app: grok,
          effort: explicitEffort("xhigh"),
        }),
        route({
          model: slug("grok-4.6"),
          app: grok,
          effort: explicitEffort("high"),
        }),
      ])
    ).toEqual({
      ok: false,
      error: {
        tag: "failover-weaker-effort",
        model: slug("grok-4.6"),
        app: grok,
      },
    });
  });

  it("allows equal or stronger effort on the same app and model", () => {
    const grok = namedApp("grok");
    const result = failoverBinding([
      route({
        model: slug("grok-4.6"),
        app: grok,
        effort: explicitEffort("high"),
      }),
      route({
        model: slug("grok-4.6"),
        app: grok,
        effort: explicitEffort("xhigh"),
      }),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.routes).toHaveLength(2);
  });

  it("rejects a duplicate printed identity", () => {
    const hop = route({
      model: slug("opus"),
      app: currentHost(),
      effort: explicitEffort("xhigh"),
    });
    expect(failoverBinding([hop, hop])).toEqual({
      ok: false,
      error: { tag: "failover-duplicate-route" },
    });
  });

  it("does not rank hops that differ by app or model", () => {
    const result = failoverBinding([
      route({
        model: slug("grok-4.6"),
        app: namedApp("grok"),
        effort: explicitEffort("xhigh"),
      }),
      route({
        model: slug("opus"),
        app: currentHost(),
        effort: explicitEffort("high"),
      }),
    ]);
    expect(result.ok).toBe(true);
  });
});

const access: Access = { mode: "read-only", worktree: null };

function chain() {
  const built = failoverBinding([
    route({
      model: slug("grok-4.6"),
      app: namedApp("grok"),
      effort: explicitEffort("xhigh"),
    }),
    route({
      model: slug("opus"),
      app: currentHost(),
      effort: explicitEffort("xhigh"),
    }),
  ]);
  if (!built.ok) throw new Error("expected chain");
  return built.value;
}

function receiptWith(status: RunnerReceipt["status"]): RunnerReceipt {
  return {
    schemaVersion: 1,
    status,
    parent: "cursor",
    app: "grok",
    model: "grok-4.6",
    effort: "xhigh",
    mode: "read-only",
    cwd: ".",
    promptPath: "prompt",
    outputPath: "output",
    startedAt: "t0",
    completedAt: "t1",
    elapsedMs: 1,
    executable: "grok",
    preflight: { argv: [], status: "passed", evidence: "" },
    argv: [],
    exitCode: status === "complete" ? 0 : 1,
    signal: null,
    reportedModel: null,
    modelVerified: false,
    modelEvidence: null,
    sessionId: null,
    usage: null,
    costUsd: null,
    error: status === "complete" ? null : { message: status, evidence: status },
  };
}

describe("beginSoloRole and observeSoloRole", () => {
  it("plans named grok as CLI on a Cursor parent and does not rewrite it native", () => {
    const started = beginSoloRole({
      parent: "cursor",
      role: "how explorer",
      assignment: chain(),
      catalog: shippedCatalog(),
      inventory: [{ app: "grok", readiness: { kind: "launch-ready" } }],
      access,
      runRoot: "run",
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.attempt.plan.kind).toBe("external");
    if (started.value.attempt.plan.kind === "external") {
      expect(started.value.attempt.plan.launch.app).toBe("grok");
      expect(started.value.attempt.plan.launch.model).toBe(slug("grok-4.6"));
      expect(started.value.attempt.plan.worker.mayChooseRoute).toBe(false);
    }
  });

  it("opens a panel lane with the same session API", () => {
    const started = beginSoloRole({
      parent: "cursor",
      role: "arena runners",
      assignment: chain(),
      catalog: shippedCatalog(),
      inventory: [{ app: "grok", readiness: { kind: "launch-ready" } }],
      access,
      runRoot: "run/panel-0",
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.role).toBe("arena runners");
    expect(started.value.attempt.plan.kind).toBe("external");
  });

  it("stops on hop-0 resolve errors without consulting hop 1", () => {
    const built = failoverBinding([
      route({
        model: slug("fable"),
        app: namedApp("grok"),
        effort: explicitEffort("xhigh"),
      }),
      route({
        model: slug("opus"),
        app: currentHost(),
        effort: explicitEffort("xhigh"),
      }),
    ]);
    if (!built.ok) throw new Error("expected chain");
    const started = beginSoloRole({
      parent: "cursor",
      role: "how explorer",
      assignment: built.value,
      catalog: shippedCatalog(),
      inventory: [{ app: "grok", readiness: { kind: "launch-ready" } }],
      access,
      runRoot: "run",
    });
    expect(started.ok).toBe(false);
    if (started.ok) return;
    expect(started.error).toEqual({
      tag: "app-does-not-serve-model",
      app: "grok",
      model: slug("fable"),
    });
  });

  it("advances only on capacity and mints new paths for native opus", () => {
    const started = beginSoloRole({
      parent: "cursor",
      role: "how explorer",
      assignment: chain(),
      catalog: shippedCatalog(),
      inventory: [{ app: "grok", readiness: { kind: "launch-ready" } }],
      access,
      runRoot: "run",
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const firstPaths = started.value.attempt.paths;
    const observed = observeSoloRole(started.value, {
      source: "external",
      receipt: receiptWith("capacity-exhausted"),
    });
    expect(observed.ok).toBe(true);
    if (!observed.ok) return;
    expect(observed.value.attempt.attemptIndex).toBe(1);
    expect(observed.value.attempt.paths.promptPath).not.toBe(firstPaths.promptPath);
    expect(observed.value.attempt.paths.outputPath).not.toBe(firstPaths.outputPath);
    expect(observed.value.attempt.paths.receiptPath).not.toBe(firstPaths.receiptPath);
    expect(observed.value.attempt.plan.kind).toBe("native");
    if (observed.value.attempt.plan.kind !== "native") return;
    expect(observed.value.attempt.plan.inherit).not.toBe(true);
    if (observed.value.attempt.plan.inherit === true) return;
    expect(nativeHandle(observed.value.attempt.plan, shippedCatalog())).toEqual({
      kind: "plugin-agent",
      name: pluginAgentName("opus", "xhigh"),
    });
  });

  it("does not advance on auth or unknown readiness", () => {
    const started = beginSoloRole({
      parent: "cursor",
      role: "how explorer",
      assignment: chain(),
      catalog: shippedCatalog(),
      inventory: [{ app: "grok", readiness: { kind: "launch-ready" } }],
      access,
      runRoot: "run",
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(
      observeSoloRole(started.value, {
        source: "external",
        receipt: receiptWith("unauthenticated"),
      })
    ).toEqual({
      ok: false,
      error: { tag: "non-capacity-dropout", class: "unauthenticated" },
    });

    const claudeNext = failoverBinding([
      route({
        model: slug("grok-4.6"),
        app: namedApp("grok"),
        effort: explicitEffort("xhigh"),
      }),
      route({
        model: slug("opus"),
        app: namedApp("claude-code"),
        effort: explicitEffort("xhigh"),
      }),
    ]);
    if (!claudeNext.ok) throw new Error("expected chain");
    const readyFirst = beginSoloRole({
      parent: "cursor",
      role: "how explorer",
      assignment: claudeNext.value,
      catalog: shippedCatalog(),
      inventory: [{ app: "grok", readiness: { kind: "launch-ready" } }],
      access,
      runRoot: "run",
    });
    expect(readyFirst.ok).toBe(true);
    if (!readyFirst.ok) return;
    const blocked = observeSoloRole(readyFirst.value, {
      source: "external",
      receipt: receiptWith("capacity-exhausted"),
    });
    expect(blocked).toEqual({
      ok: false,
      error: { tag: "unknown-readiness-is-not-failover", app: "claude-code" },
    });
  });
});

describe("selectedRoutes", () => {
  it("flattens every failover hop and panel lane", () => {
    const map = {
      "feature, refactoring": chain(),
      "bug-fix": { kind: "inherit-parent" as const },
      "perf-issue": { kind: "inherit-parent" as const },
      hillclimb: { kind: "inherit-parent" as const },
      "judgment and prose": { kind: "inherit-parent" as const },
      "hardest tasks": { kind: "inherit-parent" as const },
      "how explorer": chain(),
      "how explainer": {
        kind: "route" as const,
        route: route({
          model: slug("opus"),
          effort: explicitEffort("xhigh"),
        }),
      },
      "why investigators, synthesizer": { kind: "inherit-parent" as const },
      "reflect tooling, judgment, divergent, synthesizer": { kind: "inherit-parent" as const },
      "arena runners": [
        chain(),
        {
          kind: "route" as const,
          route: route({
            model: slug("fable"),
            effort: explicitEffort("max"),
          }),
        },
      ],
      "arena cross-judge pool": [{ kind: "auto" as const }],
      "architect runners": [{ kind: "auto" as const }],
      "interrogate reviewers": [{ kind: "auto" as const }],
      "swarm workers": [{ kind: "auto" as const }],
    } satisfies RoleMap;
    const selected = selectedRoutes(map);
    expect(selected).toHaveLength(8);
    expect(selected.map((entry) => `${entry.app.kind}:${entry.model}`)).toEqual([
      `named:${slug("grok-4.6")}`,
      `current-host:${slug("opus")}`,
      `named:${slug("grok-4.6")}`,
      `current-host:${slug("opus")}`,
      `current-host:${slug("opus")}`,
      `named:${slug("grok-4.6")}`,
      `current-host:${slug("opus")}`,
      `current-host:${slug("fable")}`,
    ]);
  });
});

