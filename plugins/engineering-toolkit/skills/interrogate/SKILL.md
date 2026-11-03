---
name: interrogate
description: "Use for \"interrogate\", \"adversarial review\", \"multi-model review\", \"challenge this\", \"stress test this code\", \"find blind spots\", or \"tear this apart\". Adversaries try to break a change or design, and only findings proven by a run survive."
---

# Interrogate

Adversaries try to break a change or a design. A finding survives only when a command proves it. Report the findings. Do not apply fixes.

**Dispatch contract.** Read [`provider-dispatch.md`](../engineering-mode/references/provider-dispatch.md) before launching reviewers. Configured entries are Routes written as `[provider:]model@effort`; the parent starts the read-only lanes directly. On Codex, resolve remaining Claude tool names via [`codex-tools.md`](../engineering-mode/references/codex-tools.md).

## Frame

The scope is what the user names. Otherwise it is the branch diff from its merge base with the base branch, through the working tree. State the intent with the **in-your-own-words** skill, from the user's message, the commits, and the PR description. Ask the user when the intent is unclear.

## Fan out

Run Phase A steps 3 and 4 and Phase B of the **arena** skill, with these changes. Read the `interrogate reviewers` line in the active model sheet (see [`t3-tools.md`](../engineering-mode/references/t3-tools.md)) in place of `arena runners`. One reviewer runs per entry on that line. Setup writes one entry per served family, and this skill does not change that count. Copy the scope's uncommitted changes into each worktree. Each adversary is a read-only lane on its configured Route, with its own output path. If the descriptor is `inherit-parent` or `auto`, use the parent subagent primitive without a model override. A Route follows [`provider-dispatch.md`](../engineering-mode/references/provider-dispatch.md). If a configured entry does not resolve, record a dropout and continue with the completed reviewers. Never pick the closest model or silently fall back. Do not spawn `generalPurpose`.

In place of the arena task and rationale, give each adversary the scope, the intent, and this brief:

> Break this change. Prove each finding with a run against the real code, such as a failing test, a repro script, or command output that shows the wrong behavior. For a design or plan, run a prototype or probe the current tree. Keep repros in your own worktree. Report each finding with a title, the exact command, the output it printed, and the output the intent requires. Leave out anything you did not run. That covers style, naming, structure, and risks that need a future change to matter. No findings is a valid result.

## Verify

The lead reruns each finding's command, the check arena Phase F names. Keep a finding when the output shows the failure and the failure breaks the intent. Drop the rest. Merge findings that share a root cause.

Skip arena Phases C, D, and E. Adversaries find different failures, so the verdict keeps every verified finding, not one adversary's list.

## Output

- **Intent**: the restatement.
- **Findings**: for each verified finding, the command, its output, how it breaks the intent, and the adversaries that found it. Say "no verified findings" when none survive.
- **Dropped**: for each adversary, the count of dropped findings and why.
