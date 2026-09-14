# Provider dispatch

Engineering Toolkit model choices are typed `Route` values. The sheet is only their wire
format; the domain does not contain a provider field.

A role is `inherit-parent`, `auto`, or a `Route`. A `Route` contains a model,
an optional app, and an optional effort. An omitted app means the current
host. The model vendor never selects the app. An omitted effort means the
destination's default; family defaults are not filled in. If the
destination does not publish a default, dispatch rejects the route.

## Model matrix

| Family | Upstream pstack choice | Provider | Model | Default effort | Selectable efforts | Plugin-agent stem |
|---|---|---|---|---|---|---|
| fable | fable | claude | fable | max | low medium high xhigh max | fable |
| sol | gpt-5.6-sol-max | codex | gpt-5.6-sol | max | low medium high xhigh max | - |
| grok | grok-4.6-fast-xhigh | grok | grok-4.6 | xhigh | low medium high xhigh max | - |
| opus | opus | claude | opus | xhigh | low medium high xhigh max | opus |

The allowed effort universe is exactly `low`, `medium`, `high`, `xhigh`, `max`. First-run requested efforts are the Default effort cell of each row. A plugin-agent stem of `-` means the family has no plugin-agent. Otherwise the shipped agent name is `pstack-<stem>-<effort>`.

`fable` and `opus` are Claude Code's rolling aliases. Claude resolves each
alias to the latest available family revision. A runner receipt keeps the
requested alias in `model` and the concrete provider-reported revision in
`reportedModel`; verification accepts only a numeric `claude-fable-*` or
`claude-opus-*` revision from the matching family.

## Read-time normalization

Normalize configured descriptors before choosing a route. If an old
provider-qualified Claude model starts with `claude-fable-` or
`claude-opus-` and its remaining revision contains only digits and hyphens,
replace the model component in memory with `fable` or `opus`. Preserve app,
effort, role, and lane order. Use only the normalized value for dispatch or
runner argv. Never pass the versioned predecessor to Claude.

This read-time rule makes an older installed sheet use the latest family
revision immediately without writing user files. Once per parent run, report
that the persisted sheet is stale and that `/setup-engineering-toolkit` will rewrite it
after its normal probes and confirmation. Unknown versioned Claude models
remain invalid. The external runner rejects a missed Fable or Opus version pin
instead of silently executing it.

`fast` is part of Cursor's Grok selector, not a Grok Build CLI model or effort flag. The portable Grok route pins the current CLI model `grok-4.6`. The first-run Grok effort is `xhigh`. Cursor also serves `grok-4.6` natively. An omitted-app Grok route is parent-native host-spawn. Named `grok/...` remains the Grok CLI and stays external.

## The parent owns the route

`planLane` is the parent-owned entry point. The top-level harness resolves a
binding once and derives native versus external from
`parent === resolved app`. Children receive an assigned plan. They never
choose a route, detect or reroute the harness, or spawn another model.

| Parent | `claude-code` | `codex` | `grok` | `cursor` |
|---|---|---|---|---|
| Claude Code | native | external | external | unlistable |
| Codex | external | native | external | unlistable |
| Cursor | external | external | external | native |

The `grok` column is the Grok CLI app. Cursor native Grok is the `cursor` app
serving `grok-4.6`, not a same-host reinterpretation of named `grok/...`.

`inherit-parent` and `auto` remain parent-native bindings. Why and Reflect
remain `inherit-parent` or `auto` because they require the parent's MCP
surface. An external override for either role is a typed reject, not a rewrite
to `inherit-parent`.

## Native lanes

Native dispatch avoids a second CLI startup and its base context.

- Claude Code: match the route's `(app, model)` to one model-matrix row, then
  dispatch it through `pstack-<stem>-<effort>` using that row's plugin-agent
  stem and resolved effort. Pass the complete task, grounding paths,
  access mode, and unique output location in the `Agent` prompt.
- Codex: call `spawn_agent` with the route's model and `reasoning_effort`,
  the complete task, grounding paths, access mode, and unique output location.
  Use an isolated worktree for a writer.
- Cursor: match the route's `(app, model)` to one model-matrix row. A row with
  a plugin-agent stem dispatches through `pstack-<stem>-<effort>`. Do not pass
  a Cursor host model slug onto a plugin-agent Task. A row with stem `-`
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
  --app <claude-code|codex|grok> \
  --model <real CLI model> \
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
External lanes do not receive the parent's MCP surface. Cursor cannot be
launched as a child. The launcher never falls back.

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

Read-only mode maps to Claude plan mode with project-only settings and an explicit tool list, Codex's read-only sandbox, and Grok plan mode plus its `read-only` sandbox and read-oriented tool list. Grok's built-in read-only profile deliberately keeps its own state and system temporary directories writable, so point a read-only Grok lane at the actual checkout rather than a worktree under `/tmp`, `/var/tmp`, or the host's temporary directory. `isolated-write` maps to Claude `acceptEdits` with project-only settings, Codex `workspace-write`, and Grok `acceptEdits` plus its `workspace` sandbox and write-capable tool list. Give every writer only a dedicated worktree or output directory. Never route a writer into the primary checkout.

Every concurrent external lane needs distinct prompt, output, and receipt paths. The launcher reserves output and receipt paths exclusively and refuses to overwrite them.

## Completion and dropouts

Success requires all of these:

1. Exit status `0`.
2. Receipt status `complete`.
3. Either `modelVerified: true` with `modelEvidence: "provider-report"`, or a Codex receipt with `reportedModel: null`, `modelVerified: false`, and `modelEvidence: "pinned-argv"`. For Claude's `fable` and `opus` aliases, the concrete provider report must belong to the requested family. Codex 0.149.0 accepts the exact `--model` argument but does not report the served model in its JSONL stream.
4. A non-empty output file.

The receipt also carries elapsed time, token usage when the CLI exposes it, and cost when available. Keep it with the arena or review artifacts so parent-harness comparisons are evidence-based.

Any missing CLI, failed login, unavailable model, explicit timeout,
cancellation, non-zero child exit, malformed result, or model mismatch is a
receipt-bearing dropout. Unknown readiness remains unknown and rejects the
selected route; it is not unavailable or verified. Never substitute the parent
model, retry another app, or reinterpret an external route as native.

Start native and external lanes in the same fan-out phase, then wait for all of them before judging. A judge must not read candidate paths while their owners are still writing.

## Wire examples

The sheet header is `Descriptor grammar: 2`. These are wire values:

```text
fable
fable@max
grok/grok-4.6
claude-code/fable@high
inherit-parent
auto
```

The old `claude:fable@max` form is accepted only for inbound migration and
becomes named app `claude-code`. New writes never emit the old form.
