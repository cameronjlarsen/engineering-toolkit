---
name: setup-engineering-toolkit
description: Configure Engineering Toolkit's typed model routes per role and a reasoning budget. Discovers apps, probes selected routes, and writes the parent sheet. Use for /setup-engineering-toolkit, "configure Engineering Toolkit models", "engineering toolkit budget", "pstack budget", or changing model choices.
---

# Setup Engineering Toolkit

Configure one model sheet for the current parent harness. Read [`provider-dispatch.md`](../engineering-mode/references/provider-dispatch.md) before probing or writing anything. Its model matrix, grammar 2 wire format, and Route contract are authoritative. Discover apps, but discovery does not enable them. Do not add a second configuration file, a setup binary, or a weaker-model fallback.

There is no setup binary. This agent procedure discovers, probes, and writes
the parent sheet after confirmation.

Claude Code writes `~/.claude/engineering-toolkit-models.md` and loads it from `~/.claude/CLAUDE.md` with:

```text
@~/.claude/engineering-toolkit-models.md
```

Codex writes `~/.codex/engineering-toolkit-models.md`. Codex has no `@` include, so mirror the sheet's exact bytes inside one bounded block in `~/.codex/AGENTS.md` and retain the sheet as the editable source of truth:

```text
<!-- engineering-toolkit:models:begin -->
<exact contents of ~/.codex/engineering-toolkit-models.md>
<!-- engineering-toolkit:models:end -->
```

Cursor writes `~/.cursor/rules/engineering-toolkit-models.mdc`. YAML frontmatter is harness wiring (`alwaysApply: true`). The body after the closing `---` is the same grammar 2 sheet. There is no companion `.md` file and no Task-slug grammar. If that path already holds an upstream Task-slug rule, stop as inconsistent state instead of rewriting it silently.

## Steps

### 1. Establish the parent

Use the harness and tool surface running this skill: Claude Code, Codex, or Cursor. Environment markers may corroborate that top-level answer, but do not launch a child and ask it to detect where it came from. Record the parent because an omitted app means the current host. Task without `spawn_agent` is Cursor. `Agent` without Task is Claude Code. `spawn_agent` is Codex. Two strong matches is ambiguous. Write nothing until the parent is known.

### 2. Load current state

Read the current parent-specific sheet when it exists. It is grammar 2. The
old `claude:fable@max` form is accepted as inbound migration to named
`claude-code`; new writes never emit it. Normalize rolling aliases
`claude-fable-*` and `claude-opus-*` in memory, preserving app, effort, role,
and lane order. Record migrations for confirmation. Also read a `# budget:`
line when the sheet has one, and name that current budget later when asking.
A missing line means no recorded budget yet. If the current sheet is
missing, read the previous `pstack-models` path for that parent as inbound
migration. If that is also missing, use the complete first-run role map below.

Discover the catalog's apps and classify each as installed, launch-ready, or
unknown. Discovery does not enable apps. A duplicate or unknown role row is
inconsistent state; report it before probing.

### 3. Parse selected routes

Read the model matrix as capability metadata: which app serves each model,
selectable efforts, native stems, and the displayed family defaults. Parse
Route wire values as `model`, `app/model`, or either with `@effort`.
`inherit-parent` and `auto` carry no Route. Do not infer an app from a vendor.
An unmatched app/model, out-of-domain effort, duplicate role, or unknown role
is inconsistent state. Stop and show the conflicting rows. Do not probe or
write while any inconsistency is unresolved.

### 4. Ask for a budget, then apply it

**(a) Ask for a budget.** Prefer AskQuestion. On Claude Code that tool is AskUserQuestion. Offer these four options with these exact labels, and name the current budget when the sheet recorded one.

- `unlimited, keep max`
- `large, xhigh reasoning`
- `medium, high reasoning`
- `small, medium reasoning`

**(b) Apply it.** Every run, build the working table from the skill defaults in step 7 first. On a re-run, keep any role the operator already changed by family, list, or alias (`inherit-parent`, `auto`). Then apply the budget. `unlimited` leaves every effort as in that table. The other three set the `@effort` of every real Route, panel lanes included, to `xhigh`, `high`, or `medium`. `inherit-parent` and `auto` do not change. If the target effort is not selectable for that model family per provider-dispatch.md, use that family's highest selectable effort at or below the target, else mark the role as needing a choice. For example, `small` turns `fable@max` into `fable@medium` and `grok/grok-4.6@xhigh` into `grok/grok-4.6@medium`.

**(c) Confirm stays in steps 6 and 7.** Do not repeat the role-confirm questions here.

### 5. Probe selected routes

Probe only selected routes used by the sheet, after the step 4 budget remap, not the pre-budget efforts. Do not blindly probe four
families when the sheet does not use them. If first-run still proposes the
four matrix families, probe those selected rows only. Distinguish installed,
launch-ready, and unknown. A failed probe writes nothing: report the failing
route and keep the active sheet plus parent integration bytes unchanged. A
failed first run creates neither artifact.

| Family | Pair source | Claude parent | Codex parent | Cursor parent | Availability proof |
|---|---|---|---|---|---|
| Fable | Fable matrix row + selected effort | native Agent `pstack-fable-<effort>` | Claude CLI | native Task `pstack-fable-<effort>` | native one-turn probe or `claude auth status --json` plus one-turn probe |
| Sol | Sol matrix row + selected effort | `codex exec` | native `spawn_agent` | Codex CLI | `codex login status` plus one-turn probe or native one-turn probe |
| Grok | Grok matrix row + selected effort | Grok CLI | Grok CLI | native Task host-spawn | native one-turn probe or `grok models` plus one-turn probe |
| Opus | Opus matrix row + selected effort | native Agent `pstack-opus-<effort>` | Claude CLI | native Task `pstack-opus-<effort>` | native one-turn probe or `claude auth status --json` plus one-turn probe |

Use a tiny read-only probe that returns a unique marker. A login-status
command alone proves credentials, not that the selected model and effort run.
Record native and external results separately. Never call the external
launcher for a same-host route. Cursor cannot be launched as a child.

Receipts and native transcripts prove the requested effort and route. They do
not prove hidden applied reasoning depth. There is no implicit timeout,
weaker-model fallback, same-host external fallback, or second mutable
configuration source.

### 6. Render, preserving role families

Build the new sheet in memory. Do not write it yet.

- First run: start from the complete role assignments in step 7.
- Rerun: start from the normalized complete role map from step 2, preserving
  each loaded row's lane order and Route app/model per lane.

After route selection, ask whether to keep those role assignments or change
named roles. Keeping them is the default. Apply only named changes. A changed
role may use a selected Route, `inherit-parent`, or `auto`. Keep every
documented role key.

### 7. Confirm and commit

Show app discovery, readiness, rolling-alias migrations, the chosen budget
label and target effort, the route table for this parent, and every rendered
role and Route wire value. Ask for confirmation before writing.

Every selected route must have passed step 5. Why and Reflect require the
parent's live MCP surface. Keep their roles on `inherit-parent` or `auto`;
external override is a typed reject. `inherit-parent` and `auto` always
validate, but say when they reduce a panel's provider diversity. For panel
roles, one lane runs per entry. The list length is the fan-out count.

After the operator confirms, write the in-memory render from step 6, including a `# budget:` line with the chosen label and target effort. Never paste the example below as the result. It is only the complete first-run role map used to seed step 2; selected efforts and explicit role changes always replace its example values before writing.

```markdown
# Engineering Toolkit model configuration

Descriptor grammar: 2

Route choices. First-run omits the app when the live parent already serves
that model, and names the unique CLI home otherwise. The example below is
the Claude Code render. On Cursor, Fable, Opus, and Grok omit the app. On
Codex, Sol omits the app and Fable and Opus name `claude-code`. Omit effort
for the destination default. Every documented role remains present.
`inherit-parent` and `auto` use the parent model natively and still count as
one panel lane.

# budget: unlimited (max)
feature, refactoring: grok/grok-4.6@xhigh
bug-fix: codex/gpt-5.6-sol@max
perf-issue: codex/gpt-5.6-sol@max
hillclimb: codex/gpt-5.6-sol@max
judgment and prose: fable@max
hardest tasks: fable@max
how explorer: grok/grok-4.6@xhigh
how explainer: fable@max
why investigators, synthesizer: inherit-parent
reflect tooling, judgment, divergent, synthesizer: inherit-parent
arena runners: fable@max, codex/gpt-5.6-sol@max, grok/grok-4.6@xhigh, opus@xhigh
arena cross-judge pool: fable@max, codex/gpt-5.6-sol@max, grok/grok-4.6@xhigh, opus@xhigh
swarm workers: grok/grok-4.6@xhigh
architect runners: fable@max, codex/gpt-5.6-sol@max, grok/grok-4.6@xhigh, opus@xhigh
interrogate reviewers: fable@max, codex/gpt-5.6-sol@max, grok/grok-4.6@xhigh, opus@xhigh
```

### 8. Wire it in

Render the parent integration in memory before either write. On Claude, the integration is the single `@~/.claude/engineering-toolkit-models.md` include in `~/.claude/CLAUDE.md`. On Codex, it is the exact sheet bytes between one `<!-- engineering-toolkit:models:begin -->` and `<!-- engineering-toolkit:models:end -->` pair in `~/.codex/AGENTS.md`. Replace that whole bounded block on a rerun. Insert one block at the end on first run. If either marker is missing, duplicated, or reversed, stop and report inconsistent state instead of guessing a boundary. On Cursor, the `.mdc` is both the sheet and the load hook. Wrap `printRoleMap` in the canonical always-apply frontmatter. Read back the grammar 2 body, not the YAML wrapper.

After a confirmed write and readback, delete the previous `pstack-models` sheet for this parent. On Claude, replace `@~/.claude/pstack-models.md` with the new include. On Codex, replace a `pstack:models` marker pair with the new markers in the same write. Do not leave both sheets.

Snapshot every target's current bytes. Write the sheet and parent integration
only after all selected probes pass and the operator confirms. Read both
targets back and compare them with the in-memory render. If either write or
readback fails, restore every snapshot and report the failure.

Do not copy the model sheet between harnesses without rerunning the parent-specific probes; route availability can differ even on the same host.

### 9. Behavioral smoke

Before declaring setup complete, run one small read-only mixed panel from this
parent using selected routes, distinct output/receipt paths, and an
independent cross-judge. Launch native agents and external processes in the
background with retained handles, then drain them. Verify transcripts and
receipts. A structural config check or unit test is not a substitute.

Report the sheet path, parent route table, requested-effort probe results, smoke results, and external elapsed/token/cost receipts. Re-running this skill re-probes and updates the same sheet. Do not claim the provider exposed hidden applied-effort observability.
