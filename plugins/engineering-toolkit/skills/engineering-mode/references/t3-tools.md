# Delegation host contract

Shared skills keep Claude Code tool language (`Skill`, `Agent`, `AskUserQuestion`). This file is the contract for any session that can list provider capabilities and delegate a child to a chosen provider, model, and effort. Today that surface is T3 Code's `delegate_task` and `orchestrator_capabilities`. Without both tools, the parent app's mapping applies: [`codex-tools.md`](codex-tools.md) on Codex, [`cursor-tools.md`](cursor-tools.md) on Cursor, Claude's names as written on Claude Code.

Skills that dispatch roles read the **active model sheet** through the resolution order below. They do not hard-code a host tool name.

## What a host must provide

| Capability | Required behavior |
|------------|-------------------|
| Capabilities | One call that lists every provider instance this machine can run, each with whether it can run a child, the models it serves, and each model's selectable options (effort / reasoning / variant). |
| Spawn | Start a child with an explicit target (instance, model, effort options), an async mode, a stable client request id, and a complete brief. Parallel fan-out is N spawn calls in one turn. |
| Wait | End the turn after dispatch. A child's completion wakes the parent. Probe status mid-turn only when a result is needed before the wake. |
| Steer / cancel | Cancel a running child and wait until it is terminal. A follow-up to a finished child is a fresh spawn with a consolidated brief, not a silent resume that changes the Route. |
| Model + effort | Resolve `[provider:]model@effort` against the live capability list. No substitution: a miss is a named dropout. `inherit-parent` and `auto` omit the target so the child runs on the parent's model. |
| Existing-worktree attach | A writer may run in a dedicated worktree or unique output directory the parent already created. Pass absolute paths in the brief. The host does not invent a second checkout policy; it attaches to the path the parent assigned. |

A child gets only its brief. A persona (`engineering-agent`, `comment-sicko`) is a brief that opens with "Read `<plugin root>/agents/<name>.md` in full and act as it says".

## Active model sheet

Sheet line format is the same everywhere: `[provider:]model@effort`, or `inherit-parent` / `auto`. Grammar 3 writes the provider prefix. A bare slug is valid when the sheet uses one. Only a session with a delegate tool acts on a provider prefix. On any other host, a prefixed Route that names another provider is a named dropout ([`provider-dispatch.md`](provider-dispatch.md)).

**Resolution order** (first match wins; never rewrite a Route onto another model):

1. **Host sheet**, when the session has a delegate tool and `~/.agents/engineering-toolkit-models.md` exists. Skills read that path.
2. **Per-app sheet** for the parent harness, when it exists:
   - Claude Code: `~/.claude/engineering-toolkit-models.md`
   - Codex: `~/.codex/engineering-toolkit-models.md`
   - Cursor: `~/.cursor/rules/engineering-toolkit-models.mdc`
3. **Parent model**: if neither sheet exists, or a role line is missing, the role is `inherit-parent`.

`/setup-engineering-toolkit` writes the per-app sheet for the current parent. In a session with a delegate tool it also writes or explains the host sheet. The host sheet, when present, supersedes the per-app sheet for that session only. It does not delete the per-app sheet.

### Example host sheet (commented; not a default)

Cameron's budget split. Copy into `~/.agents/engineering-toolkit-models.md` only after editing for the models your `orchestrator_capabilities` list actually serves. Opus through a Cursor instance bills shared Cursor usage; keep Opus on the Claude seat (`claude:…`), not `cursor:opus`.

```markdown
# Engineering Toolkit model configuration
# Example only. Not written by setup unless you ask for this budget.

Descriptor grammar: 3

# Claude seat (judgment / hard prose)
judgment and prose: claude:opus@medium
hardest tasks: claude:opus@medium
how explainer: claude:opus@medium

# Included Cursor pool (throughput)
feature, refactoring: cursor:grok-4.7@high
how explorer: cursor:grok-4.7@high
swarm workers: cursor:grok-4.7@high

# Codex (bug / perf / hillclimb)
bug-fix: codex:gpt-6.1-sol@high
perf-issue: codex:gpt-6.1-sol@high
hillclimb: codex:gpt-6.1-sol@high

# Panels: three runners (opus + sol + grok). Not Opus-through-Cursor.
arena runners: claude:opus@medium, codex:gpt-6.1-sol@high, cursor:grok-4.7@high
arena cross-judge pool: claude:opus@medium, codex:gpt-6.1-sol@high, cursor:grok-4.7@high
architect runners: claude:opus@medium, codex:gpt-6.1-sol@high, cursor:grok-4.7@high
interrogate reviewers: claude:opus@medium, codex:gpt-6.1-sol@high, cursor:grok-4.7@high

# MCP-bound roles stay on the parent
why investigators, synthesizer: inherit-parent
reflect tooling, judgment, divergent, synthesizer: inherit-parent
```

If a live capability list uses a different Sol id than `gpt-6.1-sol`, replace that token with the exact model `id` the host reports. Do not invent a closest match.

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
   - **Effort.** The effort option is the model's one select option whose values include the Route's effort, usually `effort`, `reasoningEffort` or `variant`. No such option is `effort-option-missing`. More than one is `ambiguous-effort-option`. A model with no options cannot carry an effort. The value must be listed verbatim, or the dropout is `effort-not-offered`. Never map `max` to `xhigh` or pick a nearby value.
4. Pass `target: { providerInstanceId, model, options: { <effort option id>: <effort> } }`. Always pass the effort. Set no other option.

A Route names its harness. Never move a lane to another provider's instance, even when that instance serves the same model. Moving a lane is an edit to the sheet that the user accepts in setup.

A panel that loses lanes continues with the completed ones, as `provider-dispatch.md` requires, and says how many providers ran. A required review with no completed reviewer stays blocked.

### Ledger

End a reply that dispatched work with one line per delegated step: the role, then the `providerInstanceId/model` it ran on and, for an alias, the requested name, or `dropout: <tag> <reason>`, or `in-thread: <reason>`. Finish with `N of M lanes ran, P providers`.
