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

1. Call `orchestrator_capabilities`. It lists the provider instances this machine can run, each with `canRunChildTask` and its models and options. Instances differ per machine and can be disabled.
2. A Route `provider:model@effort` goes to the instance whose `driverKind` matches the provider: `claude` to `claudeAgent`, `codex` to `codex`, `cursor` to `cursor`, `grok` to `grok`. The Route's model must appear in that instance's `models`, and its effort in the model's reasoning option (`effort` or `reasoningEffort`). Pass them as `target: { providerInstanceId, model, options }`.
3. A Route whose instance is disabled, cannot run child tasks, or lacks the model or effort is a named dropout. Do not move it to another instance, another model, or another effort. Do not add a lane in its place.
4. `inherit-parent` and `auto` omit `target`, so the child runs on the parent's model.

A panel that loses lanes continues with the completed ones, as `provider-dispatch.md` requires, and says how many providers ran. A required review with no completed reviewer stays blocked.

## Ledger

End a reply that dispatched work with one line per delegated step: the role, then the `providerInstanceId/model` it ran on, or `dropout: <reason>`, or `in-thread: <reason>`.
