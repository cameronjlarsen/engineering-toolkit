---
name: setup-pstack
description: Configure pstack's typed model routes per role. Discovers apps, probes selected routes, and writes the parent sheet. Use for /setup-pstack, "configure pstack models", or changing pstack's model choices.
---

# Setup pstack

Configure one model sheet for the current parent harness. Read [`provider-dispatch.md`](../engineering-mode/references/provider-dispatch.md) before probing or writing anything. Its model matrix, grammar 2 wire format, and Route contract are authoritative. Discover apps, but discovery does not enable them. Do not add a second configuration file, a setup binary, or a weaker-model fallback.

There is no setup binary. This agent procedure discovers, probes, and writes
the parent sheet after confirmation.

Claude Code writes `~/.claude/pstack-models.md` and loads it from `~/.claude/CLAUDE.md` with:

```text
@~/.claude/pstack-models.md
```

Codex writes `~/.codex/pstack-models.md`. Codex has no `@` include, so mirror the sheet's exact bytes inside one bounded block in `~/.codex/AGENTS.md` and retain the sheet as the editable source of truth:

```text
<!-- pstack:models:begin -->
<exact contents of ~/.codex/pstack-models.md>
<!-- pstack:models:end -->
```

## Steps

### 1. Establish the parent

Use the harness and tool surface running this skill: Claude Code or Codex. Environment markers may corroborate that top-level answer, but do not launch a child and ask it to detect where it came from. Record the parent because an omitted app means the current host.

### 2. Load current state

Read the current parent-specific sheet when it exists. It is grammar 2. The
old `claude:fable@max` form is accepted as inbound migration to named
`claude-code`; new writes never emit it. Normalize rolling aliases
`claude-fable-*` and `claude-opus-*` in memory, preserving app, effort, role,
and lane order. Record migrations for confirmation. If the sheet is missing,
use the complete first-run role map below.

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

### 4. Collect requested efforts

Ask for efforts only for selected routes. If first-run still proposes the four
matrix families, ask once for those selected rows and use their capability
metadata. An omitted effort remains destination-default; do not fill it with a
pstack family default.

### 5. Probe selected routes

Probe only selected routes used by the sheet. Do not blindly probe four
families when the sheet does not use them. If first-run still proposes the
four matrix families, probe those selected rows only. Distinguish installed,
launch-ready, and unknown. A failed probe writes nothing: report the failing
route and keep the active sheet plus parent integration bytes unchanged. A
failed first run creates neither artifact.

| Family | Pair source | Claude parent route | Codex parent route | Availability proof |
|---|---|---|---|---|
| Fable | Fable matrix row + selected effort | native Agent `pstack-fable-<effort>` | Claude CLI | native one-turn probe or `claude auth status --json` plus one-turn probe |
| Sol | Sol matrix row + selected effort | `codex exec` | native `spawn_agent` | `codex login status` plus one-turn probe or native one-turn probe |
| Grok | Grok matrix row + selected effort | Grok CLI | Grok CLI | `grok models` must list the requested model; one-turn probe |
| Opus | Opus matrix row + selected effort | native Agent `pstack-opus-<effort>` | Claude CLI | native one-turn probe or `claude auth status --json` plus one-turn probe |

Use a tiny read-only probe that returns a unique marker. A login-status
command alone proves credentials, not that the selected model and effort run.
Record native and external results separately. Never call the external
launcher for a same-host route. Cursor has no launch interface.

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

Show app discovery, readiness, rolling-alias migrations, the route table for
this parent, and every rendered role and Route wire value. Ask for confirmation
before writing.

Every selected route must have passed step 5. Why and Reflect require the
parent's live MCP surface. Keep their roles on `inherit-parent` or `auto`;
external override is a typed reject. `inherit-parent` and `auto` always
validate, but say when they reduce a panel's provider diversity. For panel
roles, one lane runs per entry. The list length is the fan-out count.

After the operator confirms, write the in-memory render from step 6. Never paste the example below as the result. It is only the complete first-run role map used to seed step 2; selected efforts and explicit role changes always replace its example values before writing.

```markdown
# pstack model configuration

Descriptor grammar: 2

Route choices. First-run names the app so the same seed is native on Claude
Code and external on Codex. Omit effort for the destination default. Every
documented role remains present. `inherit-parent` and `auto` use the parent
model natively and still count as one panel lane.

feature, refactoring: grok/grok-4.6@xhigh
bug-fix: codex/gpt-5.6-sol@max
perf-issue: codex/gpt-5.6-sol@max
hillclimb: codex/gpt-5.6-sol@max
judgment and prose: claude-code/fable@max
hardest tasks: claude-code/fable@max
how explorer: grok/grok-4.6@xhigh
how explainer: claude-code/fable@max
why investigators, synthesizer: inherit-parent
reflect tooling, judgment, divergent, synthesizer: inherit-parent
arena runners: claude-code/fable@max, codex/gpt-5.6-sol@max, grok/grok-4.6@xhigh, claude-code/opus@xhigh
arena cross-judge pool: claude-code/fable@max, codex/gpt-5.6-sol@max, grok/grok-4.6@xhigh, claude-code/opus@xhigh
swarm workers: grok/grok-4.6@xhigh
architect runners: claude-code/fable@max, codex/gpt-5.6-sol@max, grok/grok-4.6@xhigh, claude-code/opus@xhigh
interrogate reviewers: claude-code/fable@max, codex/gpt-5.6-sol@max, grok/grok-4.6@xhigh, claude-code/opus@xhigh
```

### 8. Wire it in

Render the parent integration in memory before either write. On Claude, the integration is the single `@~/.claude/pstack-models.md` include in `~/.claude/CLAUDE.md`. On Codex, it is the exact sheet bytes between one `<!-- pstack:models:begin -->` and `<!-- pstack:models:end -->` pair in `~/.codex/AGENTS.md`. Replace that whole bounded block on a rerun. Insert one block at the end on first run. If either marker is missing, duplicated, or reversed, stop and report inconsistent state instead of guessing a boundary.

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
