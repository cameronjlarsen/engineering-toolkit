# T3 Code tool mapping for Engineering Toolkit

Shared skills retain Claude Code tool language (`Skill`, `Agent`, `AskUserQuestion`) in shared prose. A T3 thread is a Claude Code or Codex session that also has the `t3-code` MCP tools, so read [`codex-tools.md`](codex-tools.md) for a Codex thread and use Claude's tool names as written for a Claude thread. This file changes how subagents launch and how a GitHub PR wait ends. It applies when the session has `delegate_task` and `orchestrator_capabilities`. Without them, the parent app's mapping applies.

## Subagent actions

| Shared skill / Claude action | T3 equivalent |
|------------------------------|---------------|
| Dispatch a subagent (`Agent`, `spawn_agent`) | `delegate_task` with `mode: "async"` and an explicit `target` |
| Dispatch N parallel subagents in one turn | N `delegate_task` calls in one response |
| Wait for a subagent result | End the turn. A child's completion wakes the thread. Call `task_status` only when a result is needed mid-turn. |
| Stop a subagent | `task_cancel`, then `task_status` until the task is terminal |
| Follow-up to a finished child | A fresh `delegate_task` with the consolidated brief |

Give each call its own `clientRequestId`, stable across retries of that call, and keep each returned `taskId`. A child gets only its brief, so pass absolute paths. A persona (`engineering-agent`, `comment-sicko`) is a brief that opens with "Read `<plugin root>/agents/<name>.md` in full and act as it says". Writers get a worktree or a unique output directory, as in the parent app's mapping.

## GitHub PR wait

| Shared skill / Claude action | T3 equivalent |
|------------------------------|---------------|
| Babysit wait on a GitHub PR (`watch-pr`, `gh pr checks --watch`, `/loop`) | Triage the existing comments, call `watch_pull_request`, and end the turn |

T3 wakes the thread when a check fails, the required checks pass, someone else comments or reviews, or the branch conflicts. Only comments posted after the call wake it, so handle the existing ones first. A wake is news, not a merge decision: read the PR state again before you act. When you hand the work back, call `unwatch_pull_request` first. A subagent cannot watch. Origin and Azure DevOps keep the Babysit playbook's own wait.

## Routes

On T3, `delegate_task` replaces the native and external lanes in [`provider-dispatch.md`](provider-dispatch.md). Do not start `pstack-runner`. The parent resolves every configured Route once, before any spawn, and children never route.

1. Call `orchestrator_capabilities` once per parent run, before any spawn. It lists the provider instances this machine can run, each with `canRunChildTask`, its models, and each model's options. Instances differ per machine and can be disabled.
2. `inherit-parent` and `auto` omit `target`, so the child runs on the parent's model.
3. Resolve a Route `provider:model@effort` in this order. The first failure is a named dropout, and no step searches for an alternative.
   - **Instance.** The Route's provider names an instance: it equals the instance's `driverKind` or `providerInstanceId`, with `claude` naming `claudeAgent`. The instance must have `canRunChildTask`. With none, the dropout is `instance-missing`, or `instance-cannot-run` with the first entry of its `constraints`. With two or more, the dropout is `ambiguous-instance`. Do not choose by order. The toolkit keeps no list of providers. Whatever `orchestrator_capabilities` reports is the list.
   - **Model.** The Route's model must equal a model `id` in that instance exactly. Do not strip a prefix, match a bare name, or prefer one backend over another: `glm-5.3` does not match `opencode-go/glm-5.3`. A miss is `model-not-served`; list any ids that end in the requested name. The only exception is the Claude aliases `opus` and `fable`, which resolve to the model with the highest numeric revision among `claude-<alias>-N` and `claude-<alias>-N-M`, compared as (N, M) with M = 0 when absent. Never use list order. With no match the dropout is `alias-unresolved`.
   - **Effort.** The effort option is the model's one select option whose values include the Route's effort, usually `effort`, `reasoningEffort` or `variant`. No such option is `effort-option-missing`. More than one is `ambiguous-effort-option`. A model with no options cannot carry an effort. The value must be listed verbatim, or the dropout is `effort-not-offered`. Never map `max` to `xhigh` or pick a nearby value.
4. Pass `target: { providerInstanceId, model, options: { <effort option id>: <effort> } }`. Always pass the effort. Set no other option.

A Route names its harness. Never move a lane to another provider's instance, even when that instance serves the same model. Moving a lane is an edit to the sheet that the user accepts in setup.

A panel that loses lanes continues with the completed ones, as `provider-dispatch.md` requires, and says how many providers ran. A required review with no completed reviewer stays blocked.

## Ledger

End a reply that dispatched work with one line per delegated step: the role, then the `providerInstanceId/model` it ran on and, for an alias, the requested name, or `dropout: <tag> <reason>`, or `in-thread: <reason>`. Finish with `N of M lanes ran, P providers`.
