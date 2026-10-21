# Cursor tool mapping for Engineering Toolkit

Shared skills retain Claude Code tool language (`Skill`, `Agent`, `AskUserQuestion`) in shared prose. On Cursor the files are the same; only those tool names resolve differently. Model execution is not translated here. Read [`provider-dispatch.md`](provider-dispatch.md) for the model sheet, the Route format, and the dropout policy.

## Tool actions

| Shared skill / Claude action | Cursor equivalent |
|------------------------------|-------------------|
| Read a file | `Read` |
| Create / edit / delete a file | `Write` / `StrReplace` / `Delete` |
| Run a shell command | `Shell` |
| Search file contents / find files | `Grep` / `Glob` |
| Fetch a URL | `WebFetch` |
| Search the web | `WebSearch` |
| Invoke a skill | Skills load natively. Follow the instructions presented. |
| Dispatch a subagent (`Agent`) | `Task` with `subagent_type` |
| Dispatch N parallel subagents in one turn | N `Task` calls in one response |
| Wait for a subagent result | End the turn, or keep working. Cursor notifies on completion. |
| Track tasks | `TodoWrite` |
| Ask the human a fixed-choice question (`AskUserQuestion`) | `AskQuestion` |

## Native lanes

A Route with no provider, or with the provider `cursor`, is native on a Cursor parent.

- plugin-agent: Call `Task` with `subagent_type` `pstack-lane` and `model` set to a live Cursor selector from this session's Task model list that matches the route's family and effort. Opus matches `claude-opus-*`. Fable matches `claude-fable-*`. Sonnet 5.5 selectors are `claude-sonnet-5-5-low`, `claude-sonnet-5-5-medium`, `claude-sonnet-5-5-high`, `claude-sonnet-5-5-xhigh`, and `claude-sonnet-5-5-max`; use the selector matching the resolved effort. Do not pass `opus` or `fable`. Do not pass `sonnet` as the selector. Do not guess another Sonnet selector or use another Sonnet revision. Do not omit `model`. An omitted or unmatched selector would run the lane on the parent's model, so it is a dropout. Do not set `model` to a different family's slug such as `grok-4.7-high` or `gpt-6-sol-medium`. If this session has no matching selector, drop the lane.
- host-spawn: Call `Task` with `model` set to a live Cursor selector for the route's model and effort. Confirm the slug against this session's Task model list. Do not use the `pstack-lane` `subagent_type`. 
- `inherit-parent` and `auto`: `engineering-agent` with `model` omitted or `inherit`.

Writers get a worktree or a unique output directory. The `pstack-lane` prompt forbids nested `Agent` and `Task`. Cursor ignores the `disallowedTools` and `background` fields in the definition, so the prompt is the only guard.

## Other providers

When the session is not a delegate host, a Route whose provider is not `cursor` is a named dropout, as `provider-dispatch.md` specifies: report the role and Route, and start no `Task` and no substitute. A panel continues with the lanes that ran and says how many providers ran. On a delegate host, [`t3-tools.md`](t3-tools.md) sets the active sheet and resolves Routes.

## Instructions file

Where a skill says "your instructions file", on Cursor that is `AGENTS.md` plus the always-apply model sheet in `~/.cursor/rules/engineering-toolkit-models.mdc`.
