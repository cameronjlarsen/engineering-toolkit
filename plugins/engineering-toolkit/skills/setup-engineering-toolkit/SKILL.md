---
name: setup-engineering-toolkit
description: Configure Engineering Toolkit's typed model routes per role and a reasoning budget. Discovers apps, probes selected routes, and writes the parent sheet. Use for /setup-engineering-toolkit, "configure Engineering Toolkit models", "engineering toolkit budget", "pstack budget", or changing model choices.
---

# Setup Engineering Toolkit

Configure one model sheet for the current parent harness. Read [`provider-dispatch.md`](../engineering-mode/references/provider-dispatch.md) before probing or writing anything. Its model matrix, grammar 3 wire format, and Route contract are authoritative. Discover apps, but discovery does not enable them. Do not add a second configuration file, a setup binary, or a weaker-model fallback.

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

Cursor writes `~/.cursor/rules/engineering-toolkit-models.mdc`. YAML frontmatter is harness wiring (`alwaysApply: true`). The body after the closing `---` is the same grammar 3 sheet. There is no companion `.md` file and no Task-slug grammar. If that path already holds an upstream Task-slug rule, stop as inconsistent state instead of rewriting it silently.

## Steps

### 1. Establish the parent

Use the harness and tool surface running this skill: Claude Code, Codex, or Cursor. Environment markers may corroborate that top-level answer, but do not launch a child and ask it to detect where it came from. Record the parent: a route is native only when its provider is the parent, and grammar 2 migration gives an omitted app the parent's provider. Task without `spawn_agent` is Cursor. `Agent` without Task is Claude Code. `spawn_agent` is Codex. Two strong matches is ambiguous. Write nothing until the parent is known.

### 2. Load current state

Read the current parent-specific sheet when it exists and parse it with
`loadRoleMap(text, parent)`. New sheets are grammar 3. A grammar 2 or grammar 1
sheet migrates in memory as `provider-dispatch.md` describes; new writes never
emit either form. Normalize rolling aliases
`claude-fable-*` and `claude-opus-*` in memory, preserving provider, effort, role,
and lane order. Record migrations for confirmation. After the sheet is loaded,
refresh the Codex model list with `codex debug models`. Never pass `--bundled`.
Parse that stdout with `parseCodexDebugModels`. A failed refresh is an unknown
list (`probedModels` omitted), not an empty list: report it. Do not sole-map
slugs while the list is unknown. When the refresh succeeds, pass that list to
`proposeStalePinMigrations`. Refresh Cursor's list the same way with
`cursor-agent models` and parse that stdout with `parseCursorModels`. It
derives each family's in-slug template and efforts from slugs that end in an
effort; `-fast` variants add no efforts. Pass each list as that app's
`probedModels`. A slug on the list is not a proposal. A slug on
neither the shipped catalog nor the list stays unmatched for step 3. Do not
rewrite a route until the operator accepts a proposal. Unaccepted rows stay
inconsistent at step 3. Also read a `# budget:`
line when the sheet has one, and name that current budget later when asking.
A missing line means no recorded budget yet. If the current sheet is
missing, read the previous `pstack-models` path for that parent as inbound
migration. If that is also missing, use the complete first-run role map below.

Discover the catalog's apps and classify each as installed, launch-ready, or
unknown. Discovery does not enable apps. A duplicate role row is
inconsistent state; report it before probing. A line whose role is not in
the step 7 map, such as `how critics`, is from a retired role. Drop it. The
parser ignores every line that is not a role row, so prose stays readable.

### 3. Parse selected routes

The four-row model matrix names each family's blank-sheet default. It is not
the allowlist. A slug is consistent when the shipped catalog or this session's
refreshed Codex or Cursor model list for that provider contains it. Parse Route wire values as
`provider:model@effort`. The effort is required; a migrated grammar 2 route
without one is inconsistent until the operator names its effort.
`inherit-parent` and `auto` carry no Route. Do not infer a provider from a
vendor. An effort is inconsistent when the catalog does not list it for that
model on that provider, such as `cursor:grok-4.7@max`. An unmatched
provider/model means the slug is absent from both the shipped catalog and the
refreshed list. An unmatched provider/model, out-of-domain effort, or
duplicate role is inconsistent state. Stop and show the conflicting rows. Do not probe or
write while any inconsistency is unresolved. A sheet written before this
Cursor 0.15.5 Grok default pins the old default models. Delete those role
lines, or delete the file, then run `/setup-engineering-toolkit` again. A
rerun keeps any role whose model differs from the default.

### 4. Ask for a budget, then apply it

**(a) Ask for a budget.** Prefer AskQuestion. On Claude Code that tool is AskUserQuestion. Offer these four options with these exact labels, and name the current budget when the sheet recorded one.

- `unlimited, keep max`
- `large, xhigh reasoning`
- `medium, high reasoning`
- `small, medium reasoning`

**(b) Apply it.** Every run, build the working table from the skill defaults in step 7 first. On a re-run, keep any role the operator already changed by family, list, or alias (`inherit-parent`, `auto`). Then apply the budget. `unlimited` leaves every effort as in that table. The other three set the `@effort` of every real Route, panel lanes included, to `xhigh`, `high`, or `medium`. `inherit-parent` and `auto` do not change. If the catalog does not list the target effort for that model on that provider, use its highest listed effort at or below the target, else mark the role as needing a choice. For example, `small` turns `claude:fable@max` into `claude:fable@medium` and `grok:grok-4.7@xhigh` into `grok:grok-4.7@medium`, and `unlimited` leaves `cursor:grok-4.7@xhigh` at `xhigh` because Cursor lists no `max` for it.

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
| Fable | Fable matrix row + selected effort | native Agent `pstack-fable-<effort>` | Claude CLI | native Task `pstack-fable-<effort>` plus live family selector | native one-turn probe or `claude auth status --json` plus one-turn probe |
| Sol | Sol matrix row + selected effort | `codex exec` | native `spawn_agent` | Codex CLI | `codex debug models` without `--bundled` as the model list, plus `codex login status` plus one-turn probe or native one-turn probe |
| Grok | Grok matrix row + selected effort | Grok CLI | Grok CLI | native Task host-spawn | native one-turn probe or `grok models` plus one-turn probe |
| Opus | Opus matrix row + selected effort | native Agent `pstack-opus-<effort>` | Claude CLI | native Task `pstack-opus-<effort>` plus live family selector | native one-turn probe or `claude auth status --json` plus one-turn probe |

Use a tiny read-only probe that returns a unique marker. A login-status
command alone proves credentials, not that the selected model and effort run.
A Cursor plugin-agent probe must also prove the child is the requested family.
Ask the child which model it is. A reply that names the parent model, or that
matches `inherit`, fails the probe. Passing only the unique marker is not
enough. If this session's Task model list has no selector for that family and
effort, the route is unknown, not launch-ready.
A `cursor:` route from a Claude Code or Codex parent is external. Probe it
with `cursor-agent status` plus a one-turn `pstack-runner --app cursor`
probe. Record native and external results separately. Never call the external
launcher for a same-host route.

Receipts and native transcripts prove the requested effort and route. They do
not prove hidden applied reasoning depth. There is no implicit timeout,
weaker-model fallback, same-host external fallback, or second mutable
configuration source.

### 6. Render, preserving role families

Build the new sheet in memory. Do not write it yet.

- First run: start from the complete role assignments in step 7.
- Rerun: start from the normalized complete role map from step 2, preserving
  each loaded row's lane order and Route provider/model per lane.

After route selection, ask whether to keep those role assignments or change
named roles. Keeping them is the default. Apply only named changes. A changed
role may use a selected Route, `inherit-parent`, or `auto`. Keep every
documented role key.

### 7. Confirm and commit

Show app discovery, readiness, rolling-alias migrations, the chosen budget
label and target effort, the route table for this parent, every rendered
role and Route wire value, and each line step 2 dropped. Ask for confirmation before writing.

Every selected route must have passed step 5. Why and Reflect require the
parent's live MCP surface. Keep their roles on `inherit-parent` or `auto`;
external override is a typed reject. `inherit-parent` and `auto` always
validate, but say when they reduce a panel's provider diversity. For panel
roles, one lane runs per entry. The list length is the fan-out count.

After the operator confirms, write the in-memory render from step 6, including a `# budget:` line with the chosen label and target effort. Never paste the example below as the result. It is only the complete first-run role map used to seed step 2; selected efforts and explicit role changes always replace its example values before writing.

```markdown
# Engineering Toolkit model configuration

Descriptor grammar: 3

Route choices. Each route is provider:model@effort. First-run uses the
parent's provider when the live parent already serves that model, and the
family's CLI home otherwise. The example below is the Claude Code render. On
Cursor, Fable, Opus, and Grok use cursor. On Codex, Sol uses codex natively
and Fable and Opus use claude. Every documented role remains present.
`inherit-parent` and `auto` use the parent model natively and still count as
one panel lane.

# budget: unlimited (max)
feature, refactoring: grok:grok-4.7@xhigh
bug-fix: codex:gpt-6-sol@max
perf-issue: codex:gpt-6-sol@max
hillclimb: codex:gpt-6-sol@max
judgment and prose: claude:fable@max
hardest tasks: claude:fable@max
how explorer: grok:grok-4.7@xhigh
how explainer: claude:fable@max
why investigators, synthesizer: inherit-parent
reflect tooling, judgment, divergent, synthesizer: inherit-parent
arena runners: claude:fable@max, codex:gpt-6-sol@max, grok:grok-4.7@xhigh, claude:opus@xhigh
arena cross-judge pool: claude:fable@max, codex:gpt-6-sol@max, grok:grok-4.7@xhigh, claude:opus@xhigh
swarm workers: grok:grok-4.7@xhigh
architect runners: claude:fable@max, codex:gpt-6-sol@max, grok:grok-4.7@xhigh, claude:opus@xhigh
interrogate reviewers: claude:fable@max, codex:gpt-6-sol@max, grok:grok-4.7@xhigh, claude:opus@xhigh
```

### 8. Wire it in

Render the parent integration in memory before either write. On Claude, the integration is the single `@~/.claude/engineering-toolkit-models.md` include in `~/.claude/CLAUDE.md`. On Codex, it is the exact sheet bytes between one `<!-- engineering-toolkit:models:begin -->` and `<!-- engineering-toolkit:models:end -->` pair in `~/.codex/AGENTS.md`. Replace that whole bounded block on a rerun. Insert one block at the end on first run. If either marker is missing, duplicated, or reversed, stop and report inconsistent state instead of guessing a boundary. On Cursor, the `.mdc` is both the sheet and the load hook. Wrap `printRoleMap` in the canonical always-apply frontmatter. Read back the grammar 3 body, not the YAML wrapper.

After a confirmed write and readback, delete the previous `pstack-models` sheet for this parent. On Claude, replace `@~/.claude/pstack-models.md` with the new include. On Codex, replace a `pstack:models` marker pair with the new markers in the same write. Do not leave both sheets.

Snapshot every target's current bytes. Write the sheet and parent integration
only after all selected probes pass and the operator confirms. Read both
targets back and compare them with the in-memory render. If either write or
readback fails, restore every snapshot and report the failure.

Do not copy the model sheet between harnesses without rerunning the parent-specific probes; route availability can differ even on the same host.

### 9. Behavioral smoke

Before declaring setup complete, parse the written sheet body with
`loadRoleMap(body, parent)` and compare the result with the in-memory role map.
A parse error or mismatch fails setup; restore the snapshots. `<plugin root>`
is the installed plugin directory and `<parent>` is `claude-code`, `codex`, or
`cursor`. The command exits non-zero and prints the typed error on failure:

```shell
PLUGIN_ROOT=<plugin root> bun -e 'const [sheetPath, parent] = process.argv.slice(-2); const root = process.env.PLUGIN_ROOT; const { unwrapStoredSheet } = await import(`${root}/skills/engineering-mode/scripts/routing/parent.ts`); const { loadRoleMap } = await import(`${root}/skills/engineering-mode/scripts/routing/sheet.ts`); const body = unwrapStoredSheet(await Bun.file(sheetPath).text()); const parsed = body.ok ? loadRoleMap(body.value, parent) : body; console.log(JSON.stringify(parsed.ok ? "ok" : parsed.error)); process.exit(parsed.ok ? 0 : 1);' <sheet path> <parent>
```

Then run one
small read-only mixed panel from this parent using selected routes, distinct output/receipt paths, and an
independent cross-judge. Launch native agents and external processes in the
background with retained handles, then drain them. Verify transcripts and
receipts. A structural config check or unit test is not a substitute.

Report the sheet path, parent route table, requested-effort probe results, smoke results, and external elapsed/token/cost receipts. Re-running this skill re-probes and updates the same sheet. Do not claim the provider exposed hidden applied-effort observability.
