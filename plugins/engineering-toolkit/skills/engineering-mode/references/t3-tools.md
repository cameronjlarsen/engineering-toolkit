# Delegation host contract

Shared skills keep Claude Code tool language (`Skill`, `Agent`, `AskUserQuestion`). This file is the contract for a **delegate host**: a session that has both a capability list and a delegate tool, so it can start a child on a chosen provider, model, and effort. Today those tools are T3 Code's `orchestrator_capabilities` and `delegate_task`. A session with only one of them is not a delegate host. The parent app's mapping applies there and in every other session: [`codex-tools.md`](codex-tools.md) on Codex, [`cursor-tools.md`](cursor-tools.md) on Cursor, Claude's names as written on Claude Code.

This file is the only place that defines a delegate host and the active model sheet. Other files link here instead of restating the rule.

## What a host must provide

| Capability | Required behavior |
|------------|-------------------|
| Capabilities | One call that lists every provider instance this machine can run, each with whether it can run a child, the models it serves, and each model's selectable options (effort / reasoning / variant). |
| Spawn | Start a child with an explicit target (instance, model, effort options), an async mode, a stable client request id, and a complete brief. Parallel fan-out is N spawn calls in one turn. |
| Wait | End the turn after dispatch. A child's completion wakes the parent. Probe status mid-turn only when a result is needed before the wake. |
| Steer / cancel | Cancel a running child and wait until it is terminal. A follow-up to a finished child is a fresh spawn with a consolidated brief, not a silent resume that changes the Route. |
| Model + effort | Resolve `provider:model@effort` against the live capability list. No substitution: a miss is a named dropout. `inherit-parent` and `auto` omit the target so the child runs on the parent's model. |
| Existing-worktree attach | A writer may run in a dedicated worktree or unique output directory the parent already created. Pass absolute paths in the brief. The host does not invent a second checkout policy; it attaches to the path the parent assigned. |

A child gets only its brief. A persona (`engineering-agent`, `comment-sicko`) is a brief that opens with "Read `<plugin root>/agents/<name>.md` in full and act as it says".

## Active model sheet

Skills that dispatch roles read the active model sheet. Never rewrite a Route onto another model.

**On a delegate host**, only the host sheet `~/.agents/engineering-toolkit-models.md` counts.

- One host sheet serves every parent harness, so it must not depend on the parent: every Route names its provider (`provider:model@effort`). A bare model in the host sheet is a dropout for that role, because no parent provider can complete it. The line format is in [`provider-dispatch.md`](provider-dispatch.md). A line the parent cannot read is a dropout for that role only, and the ledger reports `host sheet line unreadable: <role>`.
- If the host sheet is missing, or a role line is missing, the role is `inherit-parent`. If the host sheet is missing and the parent's per-app sheet exists, report once in the ledger: `host sheet missing; <per-app path> ignored; run /setup-engineering-toolkit to migrate it`. Do not read Routes from the per-app sheet.
- An instruction file can load a per-app sheet into context on every session: the `@` include in `~/.claude/CLAUDE.md`, the marker block in `~/.codex/AGENTS.md`, or Cursor's always-apply `.mdc`. On a delegate host, ignore that text, with or without its scope line (below). Setup leaves these hooks in place, because sessions that are not delegate hosts still need them.

**In every other session**, only the per-app sheet for the parent harness counts:

- Claude Code: `~/.claude/engineering-toolkit-models.md`
- Codex: `~/.codex/engineering-toolkit-models.md`
- Cursor: `~/.cursor/rules/engineering-toolkit-models.mdc`

If that sheet is missing, or a role line is missing, the role is `inherit-parent`. A Route that names another provider is a named dropout ([`provider-dispatch.md`](provider-dispatch.md)). Setup writes the per-app sheet with this scope line under its title, so a reader of the always-loaded text knows when it applies:

```text
# Applies only without delegate_task. With delegate_task, use ~/.agents/engineering-toolkit-models.md and ignore this sheet.
```

`/setup-engineering-toolkit` writes the host sheet on a delegate host and the per-app sheet otherwise.

### Example host sheet

This example is not a default, and setup never writes it unless the operator asks for it. It splits work across three provider instances: Claude for judgment and prose, OpenCode for throughput, and Codex for bug, perf, and hillclimb work. Before you use it, replace every Route that your capability list does not serve with a Route it does serve. Use the exact model `id` and effort value that the list reports. Do not choose a closest match.

```markdown
# Engineering Toolkit model configuration

# budget: medium (high)
judgment and prose: claude:opus@high
hardest tasks: claude:opus@high
how explainer: claude:opus@high
feature, refactoring: opencode:opencode-go/glm-5.3@high
how explorer: opencode:opencode-go/glm-5.3@high
swarm workers: opencode:opencode-go/glm-5.3@high
bug-fix: codex:gpt-6-sol@high
perf-issue: codex:gpt-6-sol@high
hillclimb: codex:gpt-6-sol@high
arena runners: claude:opus@high, codex:gpt-6-sol@high, opencode:opencode-go/glm-5.3@high
arena cross-judge pool: claude:opus@high, codex:gpt-6-sol@high, opencode:opencode-go/glm-5.3@high
architect runners: claude:opus@high, codex:gpt-6-sol@high, opencode:opencode-go/glm-5.3@high
interrogate reviewers: claude:opus@high, codex:gpt-6-sol@high, opencode:opencode-go/glm-5.3@high
why investigators, synthesizer: inherit-parent
reflect tooling, judgment, divergent, synthesizer: inherit-parent
```

## T3 mapping

T3 is one host that satisfies this contract. Shared skill / Claude actions map as follows.

### Subagent actions

| Shared skill / Claude action | T3 tool |
|------------------------------|---------|
| Dispatch a subagent (`Agent`, `spawn_agent`) | `delegate_task` with `mode: "async"` and an explicit `target` |
| Dispatch N parallel subagents in one turn | N `delegate_task` calls in one response |
| Wait for a subagent result | End the turn. A child's completion wakes the thread. Call `task_status` only when a result is needed mid-turn. |
| Stop a subagent | `task_cancel`, then `task_status` until the task is terminal |
| Follow-up to a finished child | A fresh `delegate_task` with the consolidated brief |

Give each call its own `clientRequestId`, stable across retries of that call, and keep each returned `taskId`.

### GitHub PR wait

| Shared skill / Claude action | T3 tool |
|------------------------------|---------|
| Babysit wait on a GitHub PR (`watch-pr`, `gh pr checks --watch`, `/loop`) | Triage the existing comments, call `watch_pull_request`, and end the turn |

T3 wakes the thread when a check fails, the required checks pass, someone else comments or reviews, or the branch conflicts. Only comments posted after the call wake it, so handle the existing ones first. A wake is news, not a merge decision: read the PR state again before you act. When you hand the work back, call `unwatch_pull_request` first. A subagent cannot watch. Origin and Azure DevOps keep the Babysit playbook's own wait.

### Routes

On a host that satisfies this contract, the delegate tool replaces the native and external lanes in [`provider-dispatch.md`](provider-dispatch.md). Do not start `pstack-runner`. The parent resolves every configured Route once, before any spawn, and children never route.

1. Call `orchestrator_capabilities` once per parent run, before any spawn. It lists the provider instances this machine can run, each with `canRunChildTask`, its models, and each model's options. Instances differ per machine and can be disabled. A T3 parent may be Claude Code, Codex, OpenCode, or another enabled instance; the capability list is the source of truth, not this file.
2. `inherit-parent` and `auto` omit `target`, so the child runs on the parent's model.
3. Resolve a Route `provider:model@effort` in this order. The first failure is a named dropout, and no step searches for an alternative.
   - **Instance.** The Route's provider names an instance: it equals the instance's `driverKind` or `providerInstanceId`, with `claude` naming `claudeAgent`. The instance must have `canRunChildTask`. With none, the dropout is `instance-missing`, or `instance-cannot-run` with the first entry of its `constraints`. With two or more, the dropout is `ambiguous-instance`. Do not choose by order. The toolkit keeps no list of providers. Whatever `orchestrator_capabilities` reports is the list.
   - **Model.** The Route's model must equal a model `id` in that instance exactly. Do not strip a prefix, match a bare name, or prefer one backend over another: `glm-5.3` does not match `opencode-go/glm-5.3`. A miss is `model-not-served`; list any ids that end in the requested name. The only exception is the Claude aliases `opus` and `fable`, which resolve to the model with the highest numeric revision among `claude-<alias>-N` and `claude-<alias>-N-M`, compared as (N, M) with M = 0 when absent. Never use list order. With no match the dropout is `alias-unresolved`.
   - **Effort.** When the Route has an `@effort`, the effort option is the model's one select option whose values include it, usually `effort`, `reasoningEffort` or `variant`. No such option is `effort-option-missing`. More than one is `ambiguous-effort-option`. The value must be listed verbatim, or the dropout is `effort-not-offered`. Never map `max` to `xhigh` or pick a nearby value. A Route with no `@effort` is valid only for a model that lists no effort option, such as `opencode-go/kimi-k2.7-code`. For a model that lists one, the dropout is `effort-required`.
4. Pass `target: { providerInstanceId, model, options: { <effort option id>: <effort> } }`, or omit `options` for a model with no effort option. Set no other option.

A Route names its harness. Never move a lane to another provider's instance, even when that instance serves the same model. Moving a lane is an edit to the sheet that the user accepts in setup.

A panel that loses lanes continues with the completed ones, as `provider-dispatch.md` requires, and says how many providers ran. A required review with no completed reviewer stays blocked.

### Ledger

End a reply that dispatched work with one line per delegated step: the role, then the `providerInstanceId/model` it ran on and, for an alias, the requested name, or `dropout: <tag> <reason>`, or `in-thread: <reason>`. Finish with `N of M lanes ran, P providers`.
