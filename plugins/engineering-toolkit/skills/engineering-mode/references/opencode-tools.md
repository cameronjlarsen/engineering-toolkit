# OpenCode tool mapping for Engineering Toolkit

Shared skills retain Claude Code tool language (`Skill`, `Agent`, `AskUserQuestion`) in shared prose. On OpenCode the files are the same; only those tool names resolve differently. Model execution is not translated here. Read [`provider-dispatch.md`](provider-dispatch.md) for the parent-owned route table and typed Route values written as `provider:model@effort`.

## Tool actions

| Shared skill / Claude action | OpenCode equivalent |
|------------------------------|---------------------|
| Read a file | `read` |
| Create a new file | `write` |
| Edit / delete a file | `edit` / `bash` (`rm`) |
| Run a shell command | `bash` |
| Search file contents / find files | `grep` / `glob` |
| Fetch a URL | `webfetch` |
| Search the web | `websearch` (needs the OpenCode provider or `OPENCODE_ENABLE_EXA` / `OPENCODE_ENABLE_PARALLEL`) |
| Invoke a skill (the `Skill` tool, `/command`) | `skill({ name })`. Skills load natively. Follow the instructions presented. |
| `paths` frontmatter scopes automatic loading | Ignored. Invoke `typescript-best-practices` by name. |
| Dispatch a subagent (the `Agent`/`Task` tool) | `task` (`general` writes, `explore` reads) |
| Dispatch N parallel subagents in one turn | N `task` calls in one response |
| Track tasks (the todolist / `TodoWrite`) | `todowrite` |
| Ask the human a fixed-choice question (`AskUserQuestion`) | `question` |

## Install

Link the shared tree into the agent-compatible skill directory OpenCode already discovers:

```shell
git clone https://github.com/cameronjlarsen/engineering-toolkit.git
cd engineering-toolkit
mkdir -p ~/.agents/skills
for s in plugins/engineering-toolkit/skills/*/; do
  target=~/.agents/skills/"$(basename "$s")"
  test -e "$target" || test -L "$target" || ln -s "$PWD/$s" "$target"
done
```

Keep all skill directories, including the `principle-*` references — `engineering-mode` reads them by path. `name` and `description` frontmatter is what OpenCode uses for discovery; any other frontmatter field is ignored. That means `principle-*` leaves show in the picker despite `user-invocable: false` (same limitation as Codex). To hide them without breaking path reads, deny them in `opencode.json` and keep the symlinks:

```json
{ "permission": { "skill": { "principle-*": "deny" } } }
```

## Subagent policy

engineering-mode's Subagents section sets Claude-specific defaults (`subagent_type: "engineering-agent"`, `run_in_background: true`). On OpenCode:

- There is no `engineering-agent` subagent type. Route an ad-hoc subagent through engineering-mode's style by dispatching a `task` whose instructions tell it to read the `engineering-mode` skill in full first.
- There is no `comment-sicko` subagent type either. The **no-comments** skill spawns it on Claude Code; on OpenCode dispatch a `task` whose instructions tell it to read `agents/comment-sicko.md` in full first.
- OpenCode runs every subagent on this machine, so the **swarm** skill's workers and the fan-out playbooks (`orchestrate`, `autopilot-full`, `autopilot-stack`) isolate writers with worktrees. The same holds here.
- Keep the rest of the policy unchanged. Pass file pointers not inlined context, give each worker its own worktree or branch when they write, review every subagent's diff yourself.

## Models and providers

`/setup-engineering-toolkit` writes provider-qualified values such as `claude:fable@max`, `codex:gpt-6-sol@max`, `grok:grok-4.7@xhigh`, and `cursor:grok-4.7@high`. On an OpenCode parent, `inherit-parent` and `auto` stay native. Every other provider-qualified route runs through the external runner via `bash` against that provider's authenticated CLI, exactly as `provider-dispatch.md` specifies. An `opencode:*` descriptor instead dispatches natively through the generated lane subagent `pstack-<model>-<effort>` that setup wrote under `~/.config/opencode/agents/`. Never collapse a multi-provider panel into sequential single-model passes; start native and external lanes in the same fan-out phase.

## Claude built-in skills these skills reference

Some triggers name skills that ship with Claude Code, not this plugin. They do not exist on OpenCode. Substitute the behavior:

| Claude built-in named in these skills | On OpenCode |
|---------------------------------------|-------------|
| `run` (drive a CLI/TUI to see a change work) | Run the app yourself via `bash` and observe the real output. |
| `verify` (drive a UI to confirm a fix) | Drive the UI with whatever automation you have, or hand the user a concrete manual check. Do not claim done without observing the artifact. |
| `plugin-dev:skill-development` (Claude's SKILL.md authoring guidance) | Follow the OpenCode skill docs; keep `name` + `description` frontmatter and progressive disclosure. |
| `loop` (recurring/self-paced re-invocation, used by `babysit`) | Re-run the step yourself on a cadence, or use a scheduled task if available. |

## Vendored scripts

`skills/engineering-mode/scripts/` ships the `watch-pr` PR watcher, the `orch` store CLI, `worktree-audit.sh`, and `runner/pstack-runner`. They are plain bun and bash, so they run the same on OpenCode; invoke them through `bash`. The external runner additionally needs the assigned `claude`, `codex`, `cursor-agent`, or `grok` executable already authenticated. The other scripts need `bun`, `gh`, (for stack work) `gt`, and (for `worktree-audit.sh`) `jq` and `rg`. `worktree-audit.sh` reads Claude Code transcripts under `~/.claude/projects/`; point it at your runtime's transcript directory instead when you run it elsewhere.

## Instructions file

Where a skill says "your instructions file", on OpenCode that is `AGENTS.md`.
