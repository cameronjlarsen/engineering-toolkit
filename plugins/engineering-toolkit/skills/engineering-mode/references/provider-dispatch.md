# Provider dispatch

Engineering Toolkit model choices are typed `Route` values written as
provider-qualified descriptors:

```text
<provider>:<model>@<effort>
```

A role is `inherit-parent`, `auto`, or a `Route`. A `Route` names a provider,
a model, and an effort. All three are required. The providers are `claude`,
`codex`, `cursor`, and `grok`. The model is a family name such as `opus`,
`fable`, `gpt-6-sol`, or `grok-4.7`, not an app-specific slug. `claude:opus`
and `cursor:opus` name the same model on two apps. The catalog
(`scripts/routing/catalog.ts`) turns a family into each app's CLI slug and
lists the efforts each app accepts for it. The model vendor never selects the
provider. Every role is written inline; there are no named or shared routes.

## Model matrix

| Family | Upstream pstack choice | Provider | Model | Default effort | Selectable efforts | Plugin-agent stem |
|---|---|---|---|---|---|---|
| fable | fable | claude | fable | max | low medium high xhigh max | fable |
| sol | gpt-5.6-sol-max | codex | gpt-6-sol | max | low medium high xhigh max | - |
| grok | grok-4.7-xhigh-fast | grok | grok-4.7 | xhigh | low medium high xhigh max | - |
| opus | opus | claude | opus | xhigh | low medium high xhigh max | opus |

The allowed effort universe is exactly `low`, `medium`, `high`, `xhigh`, `max`. First-run requested efforts are the Default effort cell of each row. A plugin-agent stem of `-` means the family has no plugin-agent. Otherwise the shipped agent name is `pstack-<stem>-<effort>`.

`fable` and `opus` are Claude Code's rolling aliases. Claude resolves each
alias to the latest available family revision. A runner receipt keeps the
requested alias in `model` and the concrete provider-reported revision in
`reportedModel`; verification accepts only a numeric `claude-fable-*` or
`claude-opus-*` revision from the matching family.

The matrix names each family's blank-sheet default. A cli-auth app also accepts
any slug in the refreshed CLI model list for that session. `codex debug models`
is that list for Codex. `--bundled` is not. `cursor-agent models` is Cursor's
list. A Cursor family is a listed slug minus its effort suffix, such as
`grok-4.7` from `grok-4.7-high`, and its efforts are the suffixes listed for it.
`-fast` variants add no efforts. Dispatch does not rewrite a sheet
slug onto the matrix default.

The effort must be one the catalog lists for that model on that provider.
Cursor serves `grok-4.7` at `low` through `xhigh` only, so
`cursor:grok-4.7@max` is rejected before launch. Cursor puts the effort in the
slug: `cursor:grok-4.7@high` runs `grok-4.7-high`, `cursor:opus@medium` runs
`claude-opus-5-5-medium`, and `cursor:fable@max` runs `claude-fable-5-1-max`.

## Read-time normalization

Normalize configured descriptors before choosing a route. If an old
provider-qualified Claude model starts with `claude-fable-` or
`claude-opus-` and its remaining revision contains only digits and hyphens,
replace the model component in memory with `fable` or `opus`. Preserve provider,
effort, role, and lane order. Use only the normalized value for dispatch or
runner argv. Never pass the versioned predecessor to Claude.

This read-time rule makes an older installed sheet use the latest family
revision immediately without writing user files. Once per parent run, report
that the persisted sheet is stale and that `/setup-engineering-toolkit` will rewrite it
after its normal probes and confirmation. Unknown versioned Claude models
remain invalid. The external runner rejects a missed Fable or Opus version pin
instead of silently executing it. Sol and Grok pins have no read-time alias. A
model the catalog does not serve fails dispatch as `app-does-not-serve-model`
until setup accepts a stale-pin proposal.

`fast` is part of Cursor's Grok selector, not a Grok Build CLI model or effort flag. The portable Grok route pins the current CLI model `grok-4.7`. The first-run Grok effort is `xhigh`. Cursor also serves `grok-4.7`. `cursor:grok-4.7` is native host-spawn on a Cursor parent and runs through the Cursor CLI from any other parent. `grok:grok-4.7` is always the Grok CLI.

## The parent owns the route

`planLane` is the parent-owned entry point. The top-level harness resolves a
binding once. A route runs natively only when its provider is the parent. Any
other route runs through that provider's CLI via `pstack-runner`. Children
receive an assigned plan. They never choose a route, detect or reroute the
harness, or spawn another model.

| Parent | `claude:` | `codex:` | `cursor:` | `grok:` |
|---|---|---|---|---|
| Claude Code | native | Codex CLI | Cursor CLI | Grok CLI |
| Codex | Claude Code CLI | native | Cursor CLI | Grok CLI |
| Cursor | Claude Code CLI | Codex CLI | native | Grok CLI |

Internally the `claude` provider is the `claude-code` app id, which is also the
value of `--parent` and `--app` for Claude Code.

`inherit-parent` and `auto` remain parent-native bindings. Why and Reflect
remain `inherit-parent` or `auto` because they require the parent's MCP
surface. An external override for either role is a typed reject, not a rewrite
to `inherit-parent`.

## Native lanes

Native dispatch avoids a second CLI startup and its base context.

- Claude Code: match the route's `(provider, model)` to one model-matrix row, then
  dispatch it through `pstack-<stem>-<effort>` using that row's plugin-agent
  stem and resolved effort. Pass the complete task, grounding paths,
  access mode, and unique output location in the `Agent` prompt.
- Codex: call `spawn_agent` with the route's model and `reasoning_effort`,
  the complete task, grounding paths, access mode, and unique output location.
  Use an isolated worktree for a writer.
- Cursor: match the route's `(provider, model)` to one model-matrix row. A row with
  a plugin-agent stem dispatches through `pstack-<stem>-<effort>`. Set `Task` `model` to a live Cursor selector from this session's Task model list that matches that row's family and effort. Do not pass `opus` or `fable`. Do not omit `model`. An omitted selector inherits the parent. A row with stem `-`
  dispatches through host-spawn: `Task` with `model` set to a live Cursor
  selector for that model and effort. Pass the complete task, grounding paths,
  access mode, and unique output location in the `Task` prompt.
  `inherit-parent` uses `engineering-agent`.

Do not send a same-host route to the external runner. It is rejected with exit
64 and no receipt; use the parent's native primitive.

## External lanes

The launcher lives at `skills/engineering-mode/scripts/runner/pstack-runner` under the installed plugin. The parent writes the complete candidate prompt to a unique file, creates a unique output directory or worktree, and invokes the launcher directly. Do not put another agent in front of it.

```text
pstack-runner \
  --parent <claude-code|codex|cursor> \
  --app <claude-code|codex|cursor|grok> \
  --model <family or real CLI model> \
  --effort <low|medium|high|xhigh|max> \
  --mode <read-only|isolated-write> \
  --prompt <unique prompt file> \
  --cwd <repository or dedicated worktree> \
  --output <unique final-response file> \
  --receipt <unique receipt file> \
  [--timeout <seconds>]
```

Pass arguments as an argv array or quote every path. Never interpolate prompt
text into a shell command. The launcher preflights the selected app and
authentication, invokes the model exactly once, and records app/model/effort.
External lanes do not receive the parent's MCP surface. The launcher never
falls back.

For `--app cursor`, pass the family name and effort from the route, for example
`--app cursor --model grok-4.7 --effort high`. The launcher looks the family up
in the catalog, rejects an effort the entry does not list with exit 64 and no
receipt, and runs `cursor-agent -p --output-format json --model <slug>` with
the prompt on stdin. Its preflight is `cursor-agent status`. On Windows the CLI
is `%LOCALAPPDATA%\cursor-agent\cursor-agent.cmd`; that directory must be on
`PATH`.

Grok authentication preflight has one bounded retry. If the first `grok models` result would be classified as unauthenticated, the runner waits five seconds and tries the same preflight once more. A second failure is terminal. The delay and second attempt share the runner's absolute deadline and cancellation latch, and the receipt keeps evidence from both attempts. Model execution is never retried.

The parent tool sandbox still governs whether a subscribed child CLI can reach its credentials and network. Run setup's live probe from the actual parent profile. A blocked external CLI is a loud dropout, not a reason to elevate permissions or substitute a model silently.

The parent invocation must itself be resumable background work:

- Claude Code: call the launcher through a Bash tool invocation with `run_in_background: true` and retain its task ID. A foreground Bash tool call has an automatic ten-minute ceiling even when the runner's own timeout is longer. Shelling out with `&` and losing the task handle is not equivalent.
- Codex: run the launcher in a persistent exec session that returns a session ID, then wait or poll that handle. Do not hold one foreground tool call open for the model's full runtime.
- Cursor: call the launcher through a Shell tool invocation in the background and retain its handle. Do not lose the process by backgrounding it without a task id.

Start the background process, continue launching the other lanes, then drain their handles. Native and external lanes belong in the same fan-out phase.

The runner and its preflight have no implicit timeout. Pass `--timeout` only
when a real user, service, or task deadline supplies one. No weaker-model
fallback is allowed.

Read-only mode maps to Claude plan mode with project-only settings and an explicit tool list, Codex's read-only sandbox, Grok plan mode plus its `read-only` sandbox and read-oriented tool list, and Cursor `--mode plan --trust`. Cursor print mode refuses an untrusted workspace, so a read-only lane trusts its assigned cwd. Grok's built-in read-only profile deliberately keeps its own state and system temporary directories writable, so point a read-only Grok lane at the actual checkout rather than a worktree under `/tmp`, `/var/tmp`, or the host's temporary directory. `isolated-write` maps to Claude `acceptEdits` with project-only settings, Codex `workspace-write`, Grok `acceptEdits` plus its `workspace` sandbox and write-capable tool list, and Cursor `--force`. The Cursor CLI has no flag that disables its subagents or tool families, so its lane relies on the prompt and the assigned cwd. Give every writer only a dedicated worktree or output directory. Never route a writer into the primary checkout.

Every concurrent external lane needs distinct prompt, output, and receipt paths. The launcher reserves output and receipt paths exclusively and refuses to overwrite them.

## Completion and dropouts

Success requires all of these:

1. Exit status `0`.
2. Receipt status `complete`.
3. Either `modelVerified: true` with `modelEvidence: "provider-report"`, or a Codex or Cursor receipt with `reportedModel: null`, `modelVerified: false`, and `modelEvidence: "pinned-argv"`. For Claude's `fable` and `opus` aliases, the concrete provider report must belong to the requested family. Codex 0.149.0 accepts the exact `--model` argument but does not report the served model in its JSONL stream. The `cursor-agent` JSON result has no model field either.
4. A non-empty output file.

The receipt also carries elapsed time, token usage when the CLI exposes it, and cost when available. Keep it with the arena or review artifacts so parent-harness comparisons are evidence-based.

Any missing CLI, failed login, unavailable model, explicit timeout,
cancellation, non-zero child exit, malformed result, or model mismatch is a
receipt-bearing dropout. Unknown readiness remains unknown and rejects the
selected route; it is not unavailable or verified. Never substitute the parent
model, retry another app, or reinterpret an external route as native.

Start native and external lanes in the same fan-out phase, then wait for all of them before judging. A judge must not read candidate paths while their owners are still writing.

## Wire examples

The sheet header is `Descriptor grammar: 3`. These are wire values:

```text
claude:fable@max
codex:gpt-6-sol@high
cursor:grok-4.7@high
grok:grok-4.7@xhigh
inherit-parent
auto
```

A sheet line counts only when the text before its first `:` is a documented
role. Every other line is prose and is ignored.

Older sheets migrate in memory when they are read:

- Grammar 2 (`Descriptor grammar: 2`) wrote `app/model@effort`. The app id
  `claude-code` becomes the provider `claude`. A route with no app gets the
  current parent's provider. A route with no effort is an error; setup asks
  for the effort.
- Grammar 1 (no header) wrote `provider:model@effort` with providers `claude`,
  `codex`, and `grok` only.

New writes are always grammar 3.
