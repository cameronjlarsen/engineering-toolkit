# Provider dispatch

The parent resolves every configured role once, before it spawns anything. Children receive an assigned plan. They never choose a route, detect or reroute the harness, or spawn another model. Nothing parses the sheet: this file is the contract, and the parent reads the sheet as text.

When the session has `delegate_task` and `orchestrator_capabilities`, read the Delegation host contract in [`t3-tools.md`](t3-tools.md) first. On a delegate host its active-sheet rule and Routes section replace the native lanes below.

## Model sheet

The active sheet is the text file that [`t3-tools.md`](t3-tools.md) names for this session. Each role is one line:

```text
<role>: <entry>[, <entry>...]
```

The role ends at the first `:`. Any line whose role is not in the list below is prose and is ignored. A role that appears twice, or is missing, is `inherit-parent`, and the parent says so once. Single roles take one entry. Panel roles take one entry per lane, so the list length is the fan-out count. `swarm workers` is single: its one entry is the descriptor every worker runs on, and the swarm skill sets the worker count.

| Kind | Roles |
|---|---|
| Single | `feature, refactoring`, `bug-fix`, `perf-issue`, `hillclimb`, `judgment and prose`, `hardest tasks`, `how explorer`, `how explainer`, `swarm workers` |
| Panel | `arena runners`, `arena cross-judge pool`, `architect runners`, `interrogate reviewers` |
| Parent-bound | `why investigators, synthesizer`, `reflect tooling, judgment, divergent, synthesizer` |

The parent-bound roles need the parent's live MCP surface. They run on `inherit-parent` or `auto`. If the sheet gives one a Route, ignore the Route and say so.

An entry is `inherit-parent`, `auto`, or a Route. `inherit-parent` and `auto` use the parent's own model and still count as one panel lane. Other lines in the file, such as `# budget:` and a `Descriptor grammar:` header from an older sheet, are prose.

## Route

```text
[<provider>:]<model>[@<effort>]
```

- **Provider.** The text before the next `:`. Any token is valid; the toolkit keeps no list of providers. It names a harness or provider instance. A bare model, with no provider, runs on the parent's own provider. On a delegate host the host sheet needs a provider on every Route, so a bare model there is a dropout ([`t3-tools.md`](t3-tools.md)).
- **Effort.** The text after the last `@`, written exactly as the host lists it. It is required when the host lists an effort option for that model, and omitted when it lists none. Do not map one effort to another.
- **Model.** Everything between. It can contain `/` and `.`, as in `opencode-go/glm-5.3`. It must equal a model the host lists. Do not strip a prefix, match a bare name, or choose a close match.

Wire examples:

```text
claude:opus@high
opencode:opencode-go/glm-5.3-flash@high
opencode:opencode-go/kimi-k2.7-code
claude-sonnet-5-5@medium
inherit-parent
```

A line the parent cannot read is a named dropout for that role. It does not invalidate the other lines.

## Who runs a Route

A Route runs natively when its provider is the parent's own. Each harness has one provider token: `claude` on Claude Code, `codex` on Codex, and `cursor` on Cursor. The parent harness cannot start another provider's CLI, so on every session that is not a delegate host a Route that names another provider is a named dropout: report the role, the Route, and `not a delegate host`. Do not run the lane on the parent, substitute a model, or start a launcher. On a delegate host, [`t3-tools.md`](t3-tools.md) resolves the Route against the live capability list.

`fable` and `opus` are Claude Code's rolling aliases. Read an old `claude-fable-<N>` or `claude-opus-<N>` model as `fable` or `opus`, so a stale sheet uses the latest revision. Any other versioned Claude id is a dropout unless the Claude Code lane below maps it to an alias (`claude-sonnet-5-5`, `claude-haiku-*`).

Choose the effort before each spawn. Start from the role's Route and adjust only its effort for this task when needed. Honor an operator-specified effort and do not rewrite the stored sheet. The child cannot change it.

Use a fresh child for each new task, fix, retry, follow-up, or second opinion. Reuse a live child only when continuing its current assignment preserves valuable state, such as a running server or an active browser session. The parent owns the decision trail and any playbook; the child receives one bounded assignment and the absolute skill path it needs.

## Native lanes

Pass the complete task, grounding paths, access mode, and unique output location in the spawn prompt. Give a writer a dedicated worktree or output directory, never the primary checkout.

- **Claude Code.** A Route with no provider or with `claude`. Call `Agent` with `subagent_type` `et:pstack-lane`, `model` set to the alias for the Route's model, and `effort` set to the resolved effort. `Agent` accepts only the aliases `sonnet`, `opus`, `haiku`, and `fable`, and an omitted `effort` inherits the parent's, so always pass both. Map `fable` and `claude-fable-*` to `fable`, `opus` and `claude-opus-*` to `opus`, `claude-sonnet-5-5` to `sonnet`, and `claude-haiku-*` to `haiku`. A Route whose model has no alias is a dropout, and so is an effort outside `low`, `medium`, `high`, `xhigh`, `max`.
- **Codex.** A Route with no provider or with `codex`. Call `spawn_agent` with the Route's model and `reasoning_effort`. A model or effort that `spawn_agent` does not list is a dropout. Use an isolated worktree for a writer.
- **Cursor.** A Route with no provider or with `cursor`. Follow [`cursor-tools.md`](cursor-tools.md): `Task` with a live selector for the Route's model and effort. An omitted or unmatched selector inherits the parent and is a dropout.
- **Any other harness.** It has no provider token, so a Route is a dropout. Only `inherit-parent` and `auto` run, on the parent's own subagent primitive.
- **`inherit-parent` and `auto`.** Use the parent's subagent primitive with no model override, or `engineering-agent`.

## Completion and dropouts

A lane counts when its child returned a non-empty result on the assigned model. A missing model, an unlisted effort, a failed login, a cancelled child, or a malformed result is a named dropout. Unknown readiness is a dropout, not a pass. Never substitute the parent model, retry on another provider, or move a lane to a different harness. A panel continues with the lanes that ran, names each dropout, and says how many providers ran. A required review with no completed reviewer stays blocked.

Start all lanes in one fan-out phase, then wait for all of them before judging. A judge must not read candidate paths while their owners are still writing.

There is no implicit timeout and no weaker-model fallback.
