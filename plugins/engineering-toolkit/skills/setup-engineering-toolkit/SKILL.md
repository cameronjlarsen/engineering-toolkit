---
name: setup-engineering-toolkit
description: Configure Engineering Toolkit's model routes per role and a reasoning budget. Reads what this session can run, probes the selected routes, and writes the active model sheet. Use for /setup-engineering-toolkit, "configure Engineering Toolkit models", "engineering toolkit budget", "pstack budget", or changing model choices.
---

# Setup Engineering Toolkit

Configure one model sheet for the current session. Read [`provider-dispatch.md`](../engineering-mode/references/provider-dispatch.md) before you probe or write anything. Its sheet format and Route format are the contract. Read the Active model sheet section of [`t3-tools.md`](../engineering-mode/references/t3-tools.md) for which sheet counts in this session. Do not add a weaker-model fallback.

There is no setup binary and no parser. This agent procedure reads the sheet as text, probes the selected routes, and writes the sheet after confirmation.

## Which sheet this run writes

| Session | Sheet | Wiring |
|---|---|---|
| Delegate host (`delegate_task` and `orchestrator_capabilities`) | `~/.agents/engineering-toolkit-models.md` | None. Create `~/.agents/` if needed. |
| Claude Code | `~/.claude/engineering-toolkit-models.md` | The single line `@~/.claude/engineering-toolkit-models.md` in `~/.claude/CLAUDE.md`. |
| Codex | `~/.codex/engineering-toolkit-models.md` | The exact sheet bytes between one `<!-- engineering-toolkit:models:begin -->` and `<!-- engineering-toolkit:models:end -->` pair in `~/.codex/AGENTS.md`. Replace the whole block on a rerun, or insert one at the end on first run. If a marker is missing, duplicated, or reversed, stop and report inconsistent state. |
| Cursor | `~/.cursor/rules/engineering-toolkit-models.mdc` | The `.mdc` is both sheet and hook. Put `alwaysApply: true` in its YAML frontmatter and the sheet after the closing `---`. If the path holds an upstream Task-slug rule, stop as inconsistent state. |
| Any other harness | Print the sheet. | Tell the operator where their harness injects instructions, and that a delegate host would read the neutral `~/.agents/` sheet. Write nothing. |

A per-app sheet carries this line under its title, so a reader of the always-loaded text knows when it applies:

```text
# Applies only without delegate_task. With delegate_task, use ~/.agents/engineering-toolkit-models.md and ignore this sheet.
```

The host sheet has no scope line, no YAML, and no markers. A delegate-host run leaves the per-app sheet and its wiring in place, because sessions that are not delegate hosts still use them.

## Steps

### 1. Establish the session

Use the tool surface running this skill. `delegate_task` plus `orchestrator_capabilities` is a delegate host. Otherwise `Task` without `spawn_agent` is Cursor, `Agent` without `Task` is Claude Code, and `spawn_agent` is Codex. Do not launch a child and ask it where it came from. Two strong matches is ambiguous. Write nothing until the session is known.

### 2. Read the current sheet

Read the active sheet as text. Keep every role line you can read. Drop a line whose role is not in the role table in `provider-dispatch.md`. Report a duplicate role before you go on. Read an old `claude-fable-<N>` or `claude-opus-<N>` as `fable` or `opus`, and record each such change for confirmation. A `Descriptor grammar:` header and a `# budget:` line are prose. Name the recorded budget when you ask in step 4.

If the host sheet is missing and the session is a delegate host, read the per-app sheet for this harness as a starting point. Show each carried-over role. A bare model in it becomes `<this harness's provider>:<model>`, because a host sheet needs a provider on every Route. If no sheet exists, use the first-run map in step 6.

### 3. Learn what this session can run

The host's own model list is the source of truth. There is no shipped catalog.

- **Delegate host.** Call `orchestrator_capabilities` once and keep the list. Each Route is checked as `t3-tools.md` resolves it: instance, model, effort. Show the instances that do serve a model that missed, and let the operator pick one or `inherit-parent`. Do not pick for them.
- **Claude Code.** `Agent` accepts the model aliases `sonnet`, `opus`, `haiku`, and `fable`, and the efforts `low`, `medium`, `high`, `xhigh`, and `max`. Map each Route's model to an alias as `provider-dispatch.md` says.
- **Codex.** Run `codex debug models` and read its stdout as the list. Never pass `--bundled`. A failed run is an unknown list: report it, and do not accept a model on faith.
- **Cursor.** Read this session's `Task` model list. A family and effort need an exact selector there.

On a session that is not a delegate host, a Route whose provider is not the parent's own is a named dropout, as `provider-dispatch.md` says. Keep it if the operator wants it, because a delegate host can still run it. Say that it drops out here. A model the list does not contain, or an effort it does not list, is inconsistent state. Stop and show the conflicting rows. Do not probe or write while any is unresolved.

### 4. Ask for a budget, then apply it

Prefer AskQuestion. On Claude Code that tool is AskUserQuestion. Offer these four options with these exact labels, and name the current budget when the sheet recorded one.

- `unlimited, keep max`
- `large, xhigh reasoning`
- `medium, high reasoning`
- `small, medium reasoning`

Every run, build the working table from step 6 first. On a rerun, keep any role the operator already changed. Then apply the budget. `unlimited` leaves every effort as in the table. The other three set the `@effort` of every real Route, panel lanes included, to `xhigh`, `high`, or `medium`. `inherit-parent` and `auto` do not change. A Route with no `@effort`, or an effort that is not on the `low`, `medium`, `high`, `xhigh`, `max` ladder, does not change. If the model does not list the target effort, use the highest listed ladder effort at or below it, else mark the role as needing a choice.

### 5. Probe the selected routes

Probe only the selected Routes, after the budget remap. Spawn one read-only child per Route, with the Route's model and effort, through this session's spawn primitive (`Agent` with `et:pstack-lane`, `spawn_agent`, `Task`, or `delegate_task`). It returns a unique marker and names its own model. A child that names the parent model, when the Route names another model, fails the probe. A login check alone proves credentials, not that the model and effort run.

On Cursor, a Route needs an exact selector for its family and effort in the session's `Task` list. Without one the Route is unknown, not ready. Do not guess a selector, and do not accept another revision. A named dropout on this session is not probed and does not block the write.

A failed probe writes nothing. Report the failing Route and keep the active sheet and its wiring unchanged. A failed first run creates neither file. There is no implicit timeout. Receipts and transcripts prove the requested route, not hidden applied reasoning depth.

### 6. Render

Build the new sheet in memory. Do not write it yet.

**Rerun.** Start from the roles step 2 read, in their order.

**First run.** Start from the upstream roles, one family each, and keep only the families this session serves natively. Write the model bare on a per-app sheet. On a host sheet, write `<provider>:<model>` using the instance that serves it, and ask when two do.

| Family | Roles that use it |
|---|---|
| Fable | `judgment and prose`, `hardest tasks`, `how explainer` |
| Sol | `bug-fix`, `perf-issue`, `hillclimb` |
| Grok | `feature, refactoring`, `how explorer`, `swarm workers` |
| Opus | none single; it is a panel lane only |

Each panel role (`arena runners`, `arena cross-judge pool`, `architect runners`, `interrogate reviewers`) gets one lane per served family: Fable, Sol, Grok, Opus. A role whose family this session does not serve is `inherit-parent`. If no family is served, a panel is the single entry `inherit-parent`, and the report says that a panel has no diversity until a second model is configured. The two parent-bound roles are always `inherit-parent`.

After route selection, ask whether to keep the role assignments or change named roles. Keeping them is the default. A changed role may use a selected Route, `inherit-parent`, or `auto`. Keep every role line in the file.

### 7. Confirm and write

Show the session kind, what the host serves, each carried-over change, the budget label and target effort, every rendered role line, and each line step 2 dropped. Say when `inherit-parent` or `auto` reduces a panel's diversity. Ask for confirmation before writing.

After the operator confirms, snapshot every target's current bytes. Write the sheet and its wiring, then read each target back and compare it with the render. If a write or readback fails, restore every snapshot and report the failure. Delete the previous `pstack-models` sheet for this parent after a confirmed readback, and replace its include or marker pair with the new one in the same write. Do not leave both sheets.

The sheet body is:

```markdown
# Engineering Toolkit model configuration
<the scope line, on a per-app sheet only>

# budget: <label> (<effort>)
feature, refactoring: <entry>
bug-fix: <entry>
perf-issue: <entry>
hillclimb: <entry>
judgment and prose: <entry>
hardest tasks: <entry>
how explorer: <entry>
how explainer: <entry>
why investigators, synthesizer: inherit-parent
reflect tooling, judgment, divergent, synthesizer: inherit-parent
arena runners: <entry>, <entry>
arena cross-judge pool: <entry>, <entry>
swarm workers: <entry>
architect runners: <entry>, <entry>
interrogate reviewers: <entry>, <entry>
```

Never write the example host sheet in `t3-tools.md` as the default. Do not copy a sheet between harnesses without rerunning step 5: availability differs even on the same host.

### 8. Smoke

Before you call setup complete, read the written sheet back and check that every role line from the render is present, once. Then run one small read-only mixed panel from this session using the selected routes, with distinct output paths and an independent cross-judge. Start the lanes in the background, then drain them. Verify each child's transcript names the assigned model. A file check is not a substitute.

Report the sheet path, the Route table for this session, the probe results, and the smoke results. Rerunning this skill re-probes and updates the same sheet.
