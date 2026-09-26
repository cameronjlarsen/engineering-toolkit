# Cursor tool mapping for Engineering Toolkit

Shared skills retain Claude Code tool language (`Skill`, `Agent`, `AskUserQuestion`) in shared prose. On Cursor the files are the same; only those tool names resolve differently. Model execution is not translated here. Read [`provider-dispatch.md`](provider-dispatch.md) for the parent-owned route table and typed Route values written as `provider:model@effort`.

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

A Cursor parent plans `cursor:` routes as native, from `nativeHandle`.

- plugin-agent: Call `Task` with `subagent_type` `pstack-<stem>-<effort>` and `model` set to a live Cursor selector from this session's Task model list that matches the route's family and effort. Opus matches `claude-opus-*`. Fable matches `claude-fable-*`. Do not pass `opus` or `fable`. Do not omit `model`. An omitted or unmatched selector inherits the parent and is a dropout. Do not set `model` to a different family's slug such as `grok-4.7-high`. If this session has no matching selector, drop the lane.
- host-spawn: Call `Task` with `model` set to a live Cursor selector for the route's model and effort. Confirm the slug against this session's Task model list. Cursor lists Grok as `grok-4.7-<effort>`, from `low` through `xhigh`. Do not use a plugin-agent `subagent_type`. Do not invoke Grok CLI for a `cursor:grok-4.7` route; `grok:grok-4.7` is the Grok CLI.
- `inherit-parent` and `auto`: `engineering-agent` with `model` omitted or `inherit`.

Writers get a worktree or a unique output directory. Plugin-agent definitions already forbid nested `Agent` and `Task`.

## External lanes

`pstack-runner --parent cursor --app <claude-code|codex|grok>` runs `claude:`, `codex:`, and `grok:` routes. Start it through `Shell` in the background and retain the handle. Never put a `Task` in front of the runner. `--app cursor` is for Claude Code and Codex parents; on a Cursor parent the runner rejects it as same-host.

## Instructions file

Where a skill says "your instructions file", on Cursor that is `AGENTS.md` plus the always-apply grammar 3 body in `~/.cursor/rules/engineering-toolkit-models.mdc`.
