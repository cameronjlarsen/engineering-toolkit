# T3 Code tool mapping for Engineering Toolkit

Shared skills retain Claude Code tool language (`Skill`, `Agent`, `AskUserQuestion`) in shared prose. A T3 thread is a Claude Code or Codex session that also has the `t3-code` MCP tools, so read [`codex-tools.md`](codex-tools.md) for a Codex thread and use Claude's tool names as written for a Claude thread. This file changes only how subagents launch. It applies when the session has `delegate_task` and `orchestrator_capabilities`. Without them, the parent app's mapping applies.

## Subagent actions

| Shared skill / Claude action | T3 equivalent |
|------------------------------|---------------|
| Dispatch a subagent (`Agent`, `spawn_agent`) | `delegate_task` with `mode: "async"` and an explicit `target` |
| Dispatch N parallel subagents in one turn | N `delegate_task` calls in one response |
| Wait for a subagent result | End the turn. A child's completion wakes the thread. Call `task_status` only when a result is needed mid-turn. |
| Stop a subagent | `task_cancel`, then `task_status` until the task is terminal |
| Follow-up to a finished child | A fresh `delegate_task` with the consolidated brief |

Give each call its own `clientRequestId`, stable across retries of that call, and keep each returned `taskId`. A child gets only its brief, so pass absolute paths. A persona (`engineering-agent`, `comment-sicko`) is a brief that opens with "Read `<plugin root>/agents/<name>.md` in full and act as it says". Writers get a worktree or a unique output directory, as in the parent app's mapping.

## Routes

On T3, `delegate_task` replaces the native and external lanes in [`provider-dispatch.md`](provider-dispatch.md). Do not start `pstack-runner`. The parent resolves every configured Route once, before any spawn, and children never route.

1. Call `orchestrator_capabilities` once per parent run, before any spawn. It lists the provider instances this machine can run, each with `canRunChildTask`, its models, and each model's options. Instances differ per machine and can be disabled.
2. `inherit-parent` and `auto` omit `target`, so the child runs on the parent's model.
3. Resolve a Route `provider:model@effort` in this order. The first failure is a named dropout, and no step searches for an alternative.
   - **Instance.** Use the instance whose `driverKind` matches the provider in the table below and that has `canRunChildTask`. With none, the dropout is `instance-missing`, or `instance-cannot-run` with the first entry of its `constraints`. With two or more, the dropout is `ambiguous-instance`. Do not choose by order.
   - **Model.** The Route's model must equal a model `id` in that instance exactly. Do not strip a prefix, match a bare name, or prefer one backend over another: `glm-5.3` does not match `opencode-go/glm-5.3`. A miss is `model-not-served`; list any ids that end in the requested name. The only exception is the Claude aliases `opus` and `fable`, which resolve to the model with the highest numeric revision among `claude-<alias>-N` and `claude-<alias>-N-M`, compared as (N, M) with M = 0 when absent. Never use list order. With no match the dropout is `alias-unresolved`.
   - **Effort.** The model must have the select option named in the table, and that option must list the Route's effort verbatim. A miss is `effort-option-missing` or `effort-not-offered`. Never map `max` to `xhigh` or pick a nearby value.
4. Pass `target: { providerInstanceId, model, options: { <effort option id>: <effort> } }`. Always pass the effort. Set no other option.

| Route provider | `driverKind` | Effort option id |
|----------------|--------------|------------------|
| `claude` | `claudeAgent` | `effort` |
| `codex` | `codex` | `reasoningEffort` |
| `opencode` | `opencode` | `variant` |
| `cursor`, `grok` | `cursor`, `grok` | not observed yet, so `effort-option-missing` |

The `codex` option id is unverified until a Codex instance is enabled. The `opencode` provider exists once the grammar accepts it (pull request 20). Models whose options are empty cannot carry an effort, so they cannot serve a Route.

A Route names its harness. Never move a lane to another provider's instance, even when that instance serves the same model. Moving a lane is an edit to the sheet that the user accepts in setup.

A panel that loses lanes continues with the completed ones, as `provider-dispatch.md` requires, and says how many providers ran. A required review with no completed reviewer stays blocked.

## Ledger

End a reply that dispatched work with one line per delegated step: the role, then the `providerInstanceId/model` it ran on and, for an alias, the requested name, or `dropout: <tag> <reason>`, or `in-thread: <reason>`. Finish with `N of M lanes ran, P providers`.
