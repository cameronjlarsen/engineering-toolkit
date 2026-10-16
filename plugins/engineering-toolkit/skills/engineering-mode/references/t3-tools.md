# T3 tool mapping for Engineering Toolkit

Shared skills keep Claude Code tool names (`Agent`, `Task`, `AskUserQuestion`, `loop`). On T3 the files are the same; those names resolve here. Model routes for Claude Code, Codex, and Cursor stay in [`provider-dispatch.md`](provider-dispatch.md). This file does not translate those routes.

T3 is the parent when `delegate_task` or `t3_thread_launch` is present. That wins over `Agent`, `Task`, `spawn_agent`, and `CLAUDECODE`. Cursor, Claude Code, and Codex are kid providers that T3 launches. They are not parents.

A grammar 4 role line is a raw T3 target, or `inherit-parent`. The token before `/` is `providerInstanceId`. The token after `/` and before the first space is `model`. Each later `optionId=value` word is one option. `inherit-parent` omits `target`, so the child inherits this thread. Use the line as written. Do not rewrite it as `provider:model@effort`.

Only a launchable `claudeAgent` or `codex` provider can hold a target. A missing or disabled provider is a dropout. Do not pick another model, and do not delegate to `cursor` or `grok`.

## Tool actions

| Shared skill / Claude action | T3 equivalent |
|------------------------------|---------------|
| Dispatch a subagent (`Agent` or `Task`) | `delegate_task` |
| Dispatch N parallel subagents in one turn | N `delegate_task` calls in one response |
| Wait for a subagent | End the turn. Completion wakes this thread. |
| Stop a subagent | `task_cancel` |
| Read a subagent mid-turn | `task_status` |
| Recurring re-check (`loop`, `/loop`) | `schedule_task` |
| GitHub babysit wait | `watch_pull_request`, then end the turn |
| Bind a writer to an existing slice worktree | `t3_thread_launch` with `workspaceStrategy.type` `existing_worktree` |
| Steer another thread | `t3_thread_send` |
| Wait for another thread | `t3_thread_wait`, then end the turn |
| Read another thread | `t3_thread_read` or `t3_thread_search` |
| Link the PR this thread is working | `link_pull_request` |
| Ask a fixed-choice question (`AskUserQuestion`) | Plain text in this thread |
| Answer a question in another thread | `t3_pending_request_list`, `t3_pending_request_read`, `t3_pending_request_respond` |
| Drive a browser or preview | `preview_*`, `html_preview`, `html_render` |
| Drive a device | `device_*` |

## Workers

`delegate_task` runs a child of this thread. The `task` stands alone. Include the goal, the scope, the paths, how to verify, and what to report. Do not rely on the child seeing this conversation.

Use `mode: "async"` for background work. Pass `target` from the role line:

```json
{
  "providerInstanceId": "codex",
  "model": "gpt-6.1-sol",
  "options": [{ "id": "reasoningEffort", "value": "high" }]
}
```

That object is the sheet line `codex/gpt-6.1-sol reasoningEffort=high`. Option ids come from the sheet and the live catalog, not from a fixed list.

`isolation: "worktree"` creates a new checkout from this thread's current commit. It does not attach a path that already exists. Uncommitted edits are not copied. Omit `isolation` to share this checkout.

An async child's completion wakes this thread. End the turn. Do not poll, sleep, or spawn a watcher. Call `task_status` only when a later step in this same turn needs the result. `mode: "wait"` is for a probe, or for a step that cannot continue without the result.

## Slice writers

A lead or a writer that must use a pre-made `{repo}-wt/<slice>` tree is a top-level thread, not a `delegate_task` child. Call `t3_thread_launch` with `title`, a `message` that stands alone, and `workspaceStrategy` set to that tree:

```json
{
  "title": "<short title>",
  "message": "<brief that stands alone>",
  "workspaceStrategy": {
    "type": "existing_worktree",
    "worktreePath": "<absolute path to {repo}-wt/<slice>>"
  }
}
```

Prefer that attach. `worktreePath` must already be a git worktree of this project. If no slice tree exists, set `workspaceStrategy` to `{ "type": "worktree", "baseRef": "<ref>" }`. `{ "type": "root" }` uses the project checkout. Omitting `workspaceStrategy` also means the project root, not this thread's checkout. Do not ask the child to create the worktree in a shell. Do not remove a `{repo}-wt/<slice>` tree. The Worktree cleanup playbook holds those paths.

## Steer and wait

`t3_thread_send` steers a thread that already exists. `t3_thread_wait` waits for its run. Arm the wait and end the turn. A timeout does not cancel the work. Do not poll in a loop.

## Pull requests

Call `link_pull_request` with the PR URL when this thread opens or picks up a PR.

On GitHub, triage comments already on the PR, call `watch_pull_request`, and end the turn. That replaces the Babysit playbook's `watch-pr` poll and any `/loop` re-check. A later wake is new status. It is not a merge decision. Do not run `gh pr checks --watch` or a background watcher. When you hand the PR back, call `unwatch_pull_request`.

Origin and Azure DevOps stay on the Babysit playbook's forge path. `watch_pull_request` does not replace that path.

## Cadence

A skill that says `loop` or `/loop` means `schedule_task` on T3. Pass `schedule` as an object, for example `{ "type": "interval", "everyMs": 1200000 }` for a 20 minute heartbeat. The prompt stands alone. Do not invoke the Claude `loop` skill.

## Instructions file

Where a skill says "your instructions file", on T3 that is the Claude Code sheet path from `parentProfile("t3")`: `~/.claude/engineering-toolkit-models.md`, loaded from `~/.claude/CLAUDE.md`.
