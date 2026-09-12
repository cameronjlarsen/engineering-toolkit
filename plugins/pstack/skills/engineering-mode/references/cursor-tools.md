# Cursor tool mapping for pstack

pstack skills retain Claude Code tool language (`Skill`, `Agent`, `AskUserQuestion`) in shared prose. On Cursor the files are the same; only those tool names resolve differently. Model execution is not translated here. Read [`provider-dispatch.md`](provider-dispatch.md) for the parent-owned route table and typed Route values written as `app/model@effort`.

## Tool actions

| pstack / Claude action | Cursor equivalent |
|------------------------|-------------------|
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

A Cursor parent plans native plugin-agent routes as `pstack-<stem>-<effort>`. Call `Task` with that value as `subagent_type`. Do not set `Task` `model` to a Cursor host slug such as `cursor-grok-4.6-high` or `gpt-5.6-sol-medium`. `inherit-parent` and `auto` use `engineering-agent` with `model` omitted or `inherit`.

Writers get a worktree or a unique output directory. Plugin-agent definitions already forbid nested `Agent` and `Task`.

## External lanes

`pstack-runner --parent cursor --app <claude-code|codex|grok>`. Start it through `Shell` in the background and retain the handle. Never put a `Task` in front of the runner. `--app cursor` is not a runner choice.

## Instructions file

Where a pstack skill says "your instructions file", on Cursor that is `AGENTS.md` plus the always-apply grammar 2 body in `~/.cursor/rules/pstack-models.mdc`.
