# Engineering Toolkit technical reference

This page contains the full skill, dependency, runtime, and porting reference. For the plain-English introduction and quick start, see the [main README](../README.md).

This repository is a fork of [Open Pstack](https://github.com/ericlitman/open-pstack). Open Pstack adapted [Poteto](https://x.com/poteto)'s [pstack](https://github.com/cursor/plugins/tree/main/pstack) for Claude Code and Codex. This fork uses that port as a base. One skill tree can parent on Cursor, Claude Code, and Codex, and later other coding agents. Grok remains a model-provider lane. Version 1.4.1 is the Open Pstack sync this checkout started from. It tracks Cursor pstack v0.15.1 at `f8abeddd1862dc73704e3d719dd73df0d51b8c71`. See [UPSTREAM.md](../UPSTREAM.md) for the tracked sources.

Original by Lauren Tan. This distribution builds on Michael Denyer's [pstack-claude](https://github.com/michael-denyer/pstack-claude) port and retains its history and MIT attribution. It imports seven MIT-licensed skills from [cursor-team-kit](https://github.com/cursor/plugins/tree/main/cursor-team-kit): `deslop`, `thermo-nuclear-code-quality-review`, `make-pr-easy-to-review`, `fix-ci`, `fix-merge-conflicts`, `get-pr-comments`, `what-did-i-get-done`. It also imports one MIT-licensed skill from [Gentle AI](https://github.com/Gentleman-Programming/gentle-ai): `work-unit-commits`.

> if you want to go fast, go deep first. Engineering Toolkit helps you write less, but higher quality code. rigorous agent workflows you can parallelize with confidence.

This is not a verbatim copy of Cursor pstack. Open Pstack edited skill bodies so Cursor-specific primitives resolve in Claude Code and Codex. See [Differences from upstream](#differences-from-upstream). This fork keeps that shared tree and adds Cursor as a parent and a provider with grammar 3 model sheets. The exhaustive per-skill audit lives in [CHANGES.md](../CHANGES.md). License attribution lives in [NOTICE.md](../NOTICE.md). The Cursor pstack README is preserved verbatim at [README-UPSTREAM.md](../README-UPSTREAM.md).

## Install

The skill tree stays at `plugins/engineering-toolkit`. Do not install `ericlitman/open-pstack` or Lauren's original pstack as a stand-in for this fork.

### Cursor

This repository ships as a Cursor marketplace containing one plugin (`et`). Add it from the GitHub URL:

```text
/add-plugin https://github.com/cameronjlarsen/engineering-toolkit
```

Install `et` from the marketplace panel. Run `/setup-engineering-toolkit`. The root `.cursor-plugin/marketplace.json` lists that plugin at `./plugins/engineering-toolkit`. For local plugin development, clone the repository and point Cursor at `plugins/engineering-toolkit`.

### Claude Code

This repository ships as a Claude Code marketplace containing one plugin (`et`).

```text
/plugin marketplace add cameronjlarsen/engineering-toolkit
/plugin install et@engineering-toolkit
/reload-plugins
```

The plugin auto-fires through a `SessionStart` hook on startup, `/clear`, and post-compact. The hook injects a small mandate that routes non-trivial engineering work into `engineering-mode`. The full skill loads only when invoked. Dispatched subagents ignore the mandate, and explicit user instructions take precedence. To opt out, delete `hooks/hooks.json` from the installed copy. A plugin update restores it.

### Codex

The same plugin carries a `.codex-plugin/plugin.json` manifest and a root `.agents/plugins/marketplace.json`. Install it through the Codex marketplace:

```shell
codex plugin marketplace add cameronjlarsen/engineering-toolkit --ref main
codex plugin add et@engineering-toolkit
```

Codex discovers the plugin skills under the `et` namespace, so they list as `et:engineering-mode`, `et:tdd`, and so on. The namespace comes from `plugins/engineering-toolkit/.codex-plugin/plugin.json`. To enable the multi-model and parallel-subagent skills (`interrogate`, `arena`, `how`, `why`, `reflect`, `architect`), turn on subagents in `~/.codex/config.toml`:

```toml
[features]
multi_agent = true
```

For local plugin development, you can clone the repository and link its skills directly:

```shell
git clone https://github.com/cameronjlarsen/engineering-toolkit.git
cd engineering-toolkit
for s in plugins/engineering-toolkit/skills/*/; do ln -s "$PWD/$s" ~/.agents/skills/"$(basename "$s")"; done
```

The marketplace install is the normal user path. Direct links are only for testing a checkout. Remove the linked skill directories when the test is over.

## Layout

```text
.
├── .claude-plugin/marketplace.json   # Claude Code marketplace manifest (repo root)
├── .agents/plugins/marketplace.json  # Codex marketplace manifest (repo root)
├── .cursor-plugin/marketplace.json   # Cursor marketplace manifest (repo root)
├── plugins/engineering-toolkit/                   # the plugin itself
│   ├── .claude-plugin/plugin.json    # Claude Code manifest
│   ├── .codex-plugin/plugin.json     # Codex manifest (skills: ./skills/)
│   ├── .cursor-plugin/plugin.json    # Cursor manifest (skills and agents)
│   ├── skills/                       # shared skills for Cursor, Claude Code, and Codex
│   │   ├── engineering-mode/references/{codex-tools,cursor-tools,t3-tools,provider-dispatch}.md  # tool + provider routing
│   │   └── engineering-mode/scripts/      # bun/bash/node tooling: watch-pr, orch, check-plan.mjs, worktree-audit.sh
│   ├── hooks/                        # SessionStart auto-fire: injects the engineering-mode mandate (Claude Code only)
│   └── agents/                       # Claude subagents, including the shared `pstack-lane` native lane
├── tests/skill-collision-repro.sh    # native-skill package invariants and Claude invocation checks
├── LICENSE                           # pstack upstream MIT
├── LICENSE-cursor-team-kit           # cursor-team-kit upstream MIT
├── LICENSE-gentle-ai                 # Gentle AI upstream MIT (work-unit-commits)
├── LICENSE-superpowers               # superpowers upstream MIT (hook runner)
├── NOTICE.md                         # attribution table
├── UPSTREAM.md                       # Cursor pstack sync record and Open Pstack fork point
├── CHANGES.md                        # per-skill substitution audit
├── README.md                         # plain-English introduction and quick start
└── docs/reference.md                 # this technical reference
```

Plugin-internal `skills/<name>/` path references in the docs below are relative to `plugins/engineering-toolkit/`.

## Running on Codex

The Codex build shares one `skills/` tree with the Claude Code build. Nothing is forked or generated. Two narrow references keep runtime translation separate: `codex-tools.md` maps harness primitives and `provider-dispatch.md` maps model providers. Engineering Toolkit otherwise keeps the upstream Claude-native prose and adds a one-line Platform note to each skill that names a Claude primitive, so the port stays in lockstep with upstream sync.

- **Skill invocation.** Codex loads `SKILL.md` natively. There is no `Skill` tool. You invoke a skill by name (ask for it, or pick `et:engineering-mode` from the list).
- **Package surface.** The native `skills/` tree is the only workflow source. The plugin ships no `commands/` layer and does not link prompts into `~/.codex/prompts/`. Codex would migrate such files into duplicate source-command skills while loading the native skill tree. Every `principle-*` leaf declares `user-invocable: false`. Claude keeps them out of its user picker; Codex 0.149.0 currently shows them despite that metadata ([#8](https://github.com/ericlitman/open-pstack/issues/8)).
- **Tool and built-in mapping.** Claude tool names and built-in skills resolve through [`codex-tools.md`](../plugins/engineering-toolkit/skills/engineering-mode/references/codex-tools.md). Model execution resolves separately through [`provider-dispatch.md`](../plugins/engineering-toolkit/skills/engineering-mode/references/provider-dispatch.md), so Codex can keep Sol native while invoking Claude and Grok externally.
- **Subagents.** The `Agent` tool maps to Codex `spawn_agent` / `wait_agent`, enabled by `multi_agent = true`. Parallel fan-out is multiple `spawn_agent` calls in one turn. If the native Codex lane is unavailable, record that lane as a dropout; external Claude and Grok lanes still run, and no provider is silently substituted. There is no `engineering-agent` subagent type on Codex; route ad-hoc subagents by dispatching a `spawn_agent` told to read `engineering-mode` first.
- **Auto-fire.** The `hooks/` SessionStart injection is Claude Code-only; Codex has no plugin hook runtime. Enter `et:engineering-mode` by name, or add a standing instruction to `~/.codex/AGENTS.md` if you want the same always-on routing.
- **Models.** `/setup-engineering-toolkit` reads what the session can run and writes one model sheet of `[provider:]model@effort` Routes, plus a requested effort per role. The first run proposes only the families the session serves natively and leaves every other role on `inherit-parent`. Old versioned Fable and Opus entries read as the rolling aliases. In a session that is not a delegate host, only the parent's provider is native; every other Route is a named dropout with no substitution. A delegate host follows [`t3-tools.md`](../plugins/engineering-toolkit/skills/engineering-mode/references/t3-tools.md) for its model sheet and Routes, and any provider instance it lists can appear in a Route. Children never detect the parent or reroute themselves.

Verified in fresh installed Claude Code and Codex sessions: the user-facing skills are discovered and namespaced under `et`; both parents fan out configured lanes through the documented native/external or delegation route table, retain long-running handles without a default timeout, and cross-judge only after every candidate is terminal. The `principle-*` leaves remain available for `engineering-mode` to read by path. Claude honors their `user-invocable: false` metadata; Codex 0.149.0 does not ([#8](https://github.com/ericlitman/open-pstack/issues/8)).

## Dependencies

Nothing is declared in `plugin.json`. Install the one companion plugin yourself:

- **`plugin-dev`** (from the `claude-plugins-official` marketplace) — the rewiring routes skill-authoring tasks (in `automate-me`, `reflect`, `engineering-mode`) to the `plugin-dev:skill-development` skill:

  ```shell
  /plugin marketplace add anthropics/claude-plugins-official
  /plugin install plugin-dev@claude-plugins-official
  ```

  Until 0.9.2 this was a `dependencies` entry in `plugin.json`. The desktop app's `--plugin-dir` load mode can never resolve cross-marketplace dependencies and hard-disables the whole plugin, so 0.9.3 removed the declaration. The loader disables the plugin with `dependency-unsatisfied`, and `optional: true` is not honored (see Maintenance in [UPSTREAM.md](../UPSTREAM.md)). Without `plugin-dev` installed, only the skill-authoring routes degrade; everything else works.

Not declared as deps, but referenced in skill bodies:

- **`run`, `verify`, `loop`** — Claude Code CLI built-ins (ship with the binary, always available).
- **`gh` (GitHub CLI).** This is the default forge for every stack playbook and a system-level requirement of the standalone `babysit` skill. Install it with [`brew install gh`](https://cli.github.com) and authenticate with `gh auth login`. If Origin's `origin` CLI is installed and can resolve the repository, the stack playbooks use it instead. No playbook requires Graphite (`gt`); `orch frontier set --forge gh|origin` selects the forge.
- **`bun`** — runs the vendored `skills/engineering-mode/scripts/` tooling (`watch-pr`, `orch`). Install via [`brew install oven-sh/bun/bun`](https://bun.sh). `bootstrap.ts` installs dependencies for `watch-pr` and `orch`.
- **`node`** — runs `skills/engineering-mode/scripts/check-plan.mjs`. The checker uses only Node built-ins and does not need Bun.
- **`jq` and `rg` (ripgrep)** — only for `scripts/worktree-audit.sh` (the Worktree cleanup playbook). Without them the audit still runs but blanks its PR and LAST_CHAT columns, so it warns on stderr rather than returning a table that looks complete.

No third-party plugins. The harsher-critique escape hatch lives in the bundled `thermo-nuclear-code-quality-review` skill (imported from cursor-team-kit), not in an external plugin.

## Skills

The table uses the short upstream names. Claude Code exposes each native skill with a `/et:` prefix, such as `/et:engineering-mode`. In Codex, ask for the namespaced skill, such as `et:engineering-mode`.

| skill | use it when |
| --- | --- |
| `/engineering-mode` | default entry point for any non-trivial task |
| `/how` | walk through how a subsystem works |
| `/why` | investigate why something was built this way (parallel multi-MCP evidence) |
| `/architect` | settle types and module shape before writing code that crosses a function boundary |
| `/arena` | run N parallel attempts at the same task and pick the best parts |
| `/interrogate` | have four different models try to break a diff |
| `/automate-me` | draft your own personal -mode skill from recent transcripts |
| `/reflect` | capture a long task's lessons as a skill edit |
| `/tdd` | fix a bug by writing the failing test first, then the fix |
| `/typescript-best-practices` | ground type-system discipline in TypeScript syntax |
| `/teach` | understand a change or subsystem for real: `how` + `why` woven into one plain explanation |
| `/swarm` | fan out N parallel workers across slices or races, then one aggregated report |
| `/technical-writing` | write docs, RFCs, readmes, PR descriptions, and commit messages to one layered standard |
| `/bro` | restate the last message in plain human language, no jargon |
| `/figure-it-out` | design a rigorous, auditable playbook for a task no bundled playbook fits |
| `/show-me-your-work` | log decisions to a reviewable tsv decision trail |
| `/blast-radius` | find what a change could break beyond the diff and prove safety by running code |
| `/recall` | catch up on recent working context from chat history, live state, and the shared record |
| `/setup-engineering-toolkit` | configure Engineering Toolkit per-role model choices and per-family requested effort |
| `/unslop` | clean up writing by removing AI tells |
| `/no-comments` | strip comments before review via the `comment-sicko` subagent, then fix what it finds |
| `/create-verification-skill` | generate a project-local verification skill and feature map |
| `/maintain-verification-skill` | re-sync a drifted verification skill and its feature map |
| `/create-formal-verification-skill` | formally verify a race, invariant, or other property that tests rarely reach, and leave a project-local skill that rechecks it |
| `/deslop` | deslop a diff before commit |
| `/babysit` | monitor an open PR, fix CI/comments, keep it merge-ready |
| `/thermo-nuclear-code-quality-review` | extremely strict maintainability audit |
| `/make-pr-easy-to-review` | clean noisy history and improve PR description before review |
| `/fix-ci` | find failing PR checks, inspect logs, apply focused fixes |
| `/fix-merge-conflicts` | non-interactively resolve merge conflicts, validate, finalize |
| `/get-pr-comments` | fetch and summarize review comments from the active PR |
| `/what-did-i-get-done` | summarize authored commits over a user-chosen period |
| `/work-unit-commits` | plan commits as reviewable work units before opening or splitting PRs |

## Subagents

`engineering-agent` is the engineering-mode wrapper. Spawn with `subagent_type: "engineering-agent"`.

`comment-sicko` is the read-only comment reviewer the `no-comments` skill spawns. Upstream names it `Comment Sicko`; the port renames it to `comment-sicko` so the name is a valid `subagent_type`. Invoke it through `/no-comments`, not directly.

`pstack-lane` is the one native lane for every Claude-served route. It pins no model and no effort: the parent passes `model` (`sonnet`, `opus`, `haiku`, or `fable`) and `effort` on each `Agent` call. It runs in the background and denies nested Agent/Task dispatch. Engineering Toolkit dispatches it from the Routes in the model sheet; it is not a user-facing workflow.

## Differences from upstream

The port is editorial, not mechanical. Anywhere upstream pstack assumed Cursor-specific primitives, this port substitutes the Claude Code equivalent so refs actually resolve. Two prior ports ([v1truv1us/ai-eng-system](https://github.com/v1truv1us/ai-eng-system), [Evan-Kim2028/agent-fleet](https://github.com/Evan-Kim2028/agent-fleet)) stop at namespacing — they vendor pstack under `pstack/` and leave the Cursor refs intact. This port does the content surgery.

### What's added

- **`skills/babysit/`** — Claude Code analog of Cursor's closed-source `/babysit` built-in. Wraps `gh pr view` / `gh pr checks` / `gh run view --log-failed` plus the `loop` skill for pacing. Independently authored; workflow informed by Cursor's public `/babysit` behavior — not a copy of Cursor's implementation. Since the v0.14.2 sync, engineering-mode routes PR-status requests to the ported `playbooks/babysit.md` instead, and this skill is the standalone `/babysit` entry point.
- **`skills/deslop/`** — imported verbatim from `cursor-team-kit`. Cleans AI tells out of diffs before commit.
- **`skills/thermo-nuclear-code-quality-review/`** — imported verbatim from `cursor-team-kit`.
- **`skills/make-pr-easy-to-review/`** — imported verbatim from `cursor-team-kit`. Composes with `opening-a-pr` and `babysit`.
- **`skills/fix-ci/`** — imported verbatim from `cursor-team-kit`. Narrower CI-fix primitive that `babysit` can route to.
- **`skills/fix-merge-conflicts/`** — imported verbatim from `cursor-team-kit`. Pairs with `babysit` step 5.
- **`skills/get-pr-comments/`** — imported verbatim from `cursor-team-kit`. Primitive for `babysit` step 4 and `reflect`.
- **`skills/what-did-i-get-done/`** — imported verbatim from `cursor-team-kit`. Commit summary over a chosen period.
- **`skills/work-unit-commits/`** — imported from Gentle AI with SDD sections removed. Commit-shaping complement to `principle-sequence-verifiable-units`.

### What's substituted in skill bodies

| Upstream (Cursor) | This port (Claude Code) |
| --- | --- |
| `Task` tool, `subagent_type: generalPurpose`, `readonly: false/true` | `Agent` tool with model selection, requested effort, and `disallowedTools`; access mode is assigned by the parent, with writers isolated in worktrees |
| `AskQuestion` tool | `AskUserQuestion` tool |
| Cursor's built-in `/loop` | Claude Code's built-in `loop` skill |
| Cursor's built-in `/babysit` | `babysit` skill bundled in this plugin. From v0.14.0 upstream routes PR-status requests inside engineering-mode to `playbooks/babysit.md` instead; the port does the same, and `/babysit` stays the standalone entry point |
| Cursor's built-in `/create-skill` | `plugin-dev:skill-development` skill |
| `cursor-team-kit` `control-cli` (CLI/TUI driver) | Claude Code's `run` skill |
| `cursor-team-kit` `control-ui` (browser/Electron driver) | Claude Code's `verify` skill |
| Transcripts at `~/.cursor/projects/*/` or `agent-transcripts/` | `~/.claude/projects/<encoded-cwd>/*.jsonl` (where `<encoded-cwd>` is the workspace cwd with `/` → `-`) |
| Skill paths `.cursor/skills/`, `~/.cursor/plugins/` | `.claude/skills/`, `~/.claude/plugins/` |
| MCP discovery via Cursor's `mcps/` directory | Tool list at top of system prompt (`mcp__<server>__<name>` entries), or `.mcp.json`, or `claude mcp list` |
| Cursor cloud agents (`environment: "cloud"`, `cloud_base_branch`) | Local background subagents (`run_in_background: true`), isolated by git worktree |
| Cursor's `/goal` (standing objective across turns) | The program objective written into the run's standing orders and restated in the todolist |
| The Cursor agent store (path in the system prompt) | `~/.claude/orchestrate/<project-slug>/`, which survives the session restarts a multi-day program expects |
| Model rule `~/.cursor/rules/engineering-toolkit-models.mdc` | This fork keeps the model sheet in that `.mdc` (always-apply wrapper). Claude Code writes `~/.claude/engineering-toolkit-models.md`, included from `CLAUDE.md`. A delegate host uses the sheet that `t3-tools.md` names instead. Upstream Task slugs are not a second grammar. |
| Multi-model panels (arena, architect, interrogate) | With no model sheet, each skill runs on `inherit-parent` (the parent model). `/setup-engineering-toolkit` proposes one lane per family the session serves natively. On a session that is not a delegate host, every entry not on the parent's provider is a named dropout. On a delegate host, `t3-tools.md` resolves Routes. |

### Cross-vendor dispatch

This fork no longer launches another provider's CLI. A cross-provider panel needs a delegate host, a session with `delegate_task` and `orchestrator_capabilities` such as T3. There the parent resolves each Route against the live capability list, and any provider instance that list reports can appear in a Route. Elsewhere the parent runs its own provider's models natively and reports a named dropout for every other Route. The top-level parent chooses every route, so there is no supervising model invocation and no child-side harness detection. Release v1.4.7 shipped a bundled runner that started the Codex, Cursor, and Grok CLIs from Claude Code.

### What's deliberately kept

- `run_in_background: true` on Agent calls (Claude Code supports it).
- `/loop`, `/deslop`, `/babysit` slash references in skill bodies — they all resolve in Claude Code now.
- The principle/playbook structure and upstream principle prose, except the local correctness edits in `principle-attack-the-premise` and `principle-test-behavior-not-implementation`.

### What's deliberately not ported

- **`automations/benny/`** (upstream `0452e08`, the only pstack change between `e46364b` and v0.10.0) — a dormant Slack issue-triage and reproduce-and-fix automation pack built on Cursor's event-triggered automations. It registers no slash skills even upstream, so excluding it changes nothing about the ported plugin's behavior. Porting it would require Cursor's event-trigger runtime, Slack, and tracker plumbing that Open Pstack does not provide.
- **`docs/guide/`** (upstream `02c03a9`, `0b7ef5b`, `424829e`) — the ten-chapter usage tutorial and its six screenshots (2.3 MB). It teaches pstack through Cursor's UI, sticky mode, and cloud agents, so a faithful port would be a rewrite rather than a sync, and none of it ships as skill content. Read it upstream at [cursor/plugins/pstack/docs/guide](https://github.com/cursor/plugins/tree/main/pstack/docs/guide); the concepts map through the substitution table above.
- **`make-bot-ui`** (upstream `799151d`, relocated by `6fecddb`) uses Cursor routines, webhook events, hosted bot state, and Cursor UI primitives that have no shared Claude Code and Codex mapping. A provider-specific rewrite would be a separate feature, not an upstream sync.
- **Fable solo code defaults** (upstream `23a56e2`) move `bug-fix`, `perf-issue`, and `hillclimb` from GPT-5.6 Sol to Fable. Open Pstack keeps these frequent delegated code roles on the Sol matrix row because Fable costs much more per task.
- **Sticky mode** (upstream `#144`) — Cursor-only `mode`/`icon`/`color`/`reminder` frontmatter with no Claude Code equivalent. The port's 0.9.5 SessionStart hook is the analog and already carries the non-trivial / trivial / opt-out logic.
- **`is_background: true` on `engineering-agent`** (upstream `99559f2`) — Cursor names this key differently. Claude-native frontier definitions use `background: true`; ad-hoc `engineering-agent` calls remain background dispatches at the call site.
- **`cursor-team-kit` beyond the seven imported skills** — the rest either duplicate Claude Code built-ins (`verify-this` → the `verify` skill and built-in verification discipline; `check-compiler-errors` → LSP diagnostics; `control-cli`/`control-ui` → `run`/`verify`, already the substitution targets) or overlap skills this port ships (`loop-on-ci`, `review-and-ship`, `weekly-review` vs `babysit`, `fix-ci`, `make-pr-easy-to-review`, `what-did-i-get-done`). `pr-review-canvas` is Cursor-UI-specific.

### Forking note

Editing skill bodies forks this from upstream. Re-syncing to a future pstack release means re-applying the substitution table. The full re-port recipe is in [CHANGES.md](../CHANGES.md).

## License

MIT. Four upstream LICENSE files are preserved:

- [LICENSE](../LICENSE) — pstack (Lauren Tan)
- [LICENSE-cursor-team-kit](../LICENSE-cursor-team-kit) — Cursor (covers the seven cursor-team-kit skills)
- [LICENSE-gentle-ai](../LICENSE-gentle-ai) — Gentle AI, Gentleman Programming (covers `work-unit-commits`)
- [LICENSE-superpowers](../LICENSE-superpowers) — superpowers, Jesse Vincent (covers the vendored `hooks/run-hook.cmd`)
