# Tracked sources

This fork tracks two sources.

1. [Cursor's pstack](https://github.com/cursor/plugins/tree/main/pstack) is Lauren Tan's original plugin.
2. [Open Pstack](https://github.com/ericlitman/open-pstack) is the Claude Code and Codex port that this checkout started from.

Do not open issues on Open Pstack for work that belongs in this fork. Keep one shared `plugins/engineering-toolkit/skills/` tree. Put harness translation in `codex-tools.md`, `cursor-tools.md`, and `provider-dispatch.md`. Do not fork a skill per parent app.

## Current Cursor pstack sync point

| Source | Value |
| --- | --- |
| Repository | `https://github.com/cursor/plugins.git` |
| Path | `pstack/` |
| Commit | `99743e9c151c8537cbbf1f98bb38f34ef3368453` |
| Cursor pstack version | `0.15.25` |
| Open Pstack version at fork | `1.4.1` |
| Engineering Toolkit version | `1.4.6` |

The table above is the current Cursor pstack sync point. At the fresh fetch for this sync, `cursor/main` was `ac4e25a` (#690), not the earlier research snapshot `2284d64`. Since `99743e9`, two commits touch `pstack/`. `182f2ce` (#637) adds a generated Claude Code tree and is excluded. `0317eb8` (#700) changes the branded-type wording in `typescript-best-practices`, and its skill text is applied. The commit row above stays `99743e9`; the reference-file catch-up in `CHANGES.md` takes fourteen files from `0317eb8`. This checkout started from Open Pstack 1.4.1, which imported Cursor pstack 0.15.1. `README-UPSTREAM.md` preserves the current Cursor pstack README verbatim. `CHANGES.md` and `NOTICE.md` describe the adaptations and provenance.

## Open Pstack remote

The maintainer checkout names Open Pstack as `upstream`:

```shell
git remote add upstream https://github.com/ericlitman/open-pstack.git
```

Fetch Open Pstack `main` and inspect commits after the recorded Open Pstack version before you merge them here.

This sync reviewed Open Pstack through `9368993` (v1.15.0), using its adapted sync commits `29f224e`, `63eedbf`, `d462f0a`, and `d8eeb4d` as references. The fork point remains v1.4.1.

## Cursor pstack exclusions

- Commits `799151d` and `6fecddb` add and relocate `make-bot-ui`. It depends on Cursor routines, webhook events, and UI primitives that are not part of the shared skill tree. Do not add `make-bot-ui` or a link to it from `engineering-help`.
- Four `disable-model-invocation: true` lines from `73f8be4` are not applied to `how`, `why`, `unslop`, or `typescript-best-practices`. engineering-mode invokes those skills by name, and the flag blocks that route on Claude Code.
- Do not add `disable-model-invocation: true` to newly imported skills. The principle leaves remain `user-invocable: false`, so engineering-mode can still invoke them by name.
- Keep explicit `principle-*` names in the engineering-mode index.
- The `23a56e2` default-model hunks for `bug-fix`, `perf-issue`, and `hillclimb` are not applied. Those frequent code-writing roles stay on the Sol matrix row for cost.
- The `889ec4b` default-model hunks for `bug-fix`, `perf-issue`, and `hillclimb` are not applied. Those roles stay on the Sol matrix row for cost, same reason as `23a56e2`.
- The `70b2dc8` default-model hunks that move `bug-fix`, `perf-issue`, and `hillclimb` off Sol are not applied. Those roles stay on `codex:gpt-6-sol`.
- The `70b2dc8` hunks that shrink arena, architect, and interrogate from four runners to three are not applied. Those panels stay four runners.
- Cursor `df58112` / #511 is not applied: keep the Sol defaults, four-runner panels, and current model budgets. Do not take `setup-pstack`'s default budget change; this fork keeps operator overrides and Opus routes at `@medium`.
- Do not take the `b93e811` `~/.cursor/plugins/` search in `poteto-agent`, the Built-in PR tool paragraph, Cursor manifests, `docs/guide`, or the Agent Plugins v1 root manifest.
- Keep this fork's removal of native `pstack-*` plugin agents.
- The Claude manifest does not take the logo field from `efa2a53` because Claude Code has no schema for it. The shared asset is exposed through the Codex manifest instead.
- Do not replace `plugins/engineering-toolkit/assets/logo.png` with Cursor pstack or Open Pstack bytes. This fork owns that catalog mark. Keep the file under 512 KiB.

## Open Pstack comparison

The Windows SessionStart fix from v1.8.0 is imported. The model registry and generated catalog, extra providers (DeepSeek Harness, Antigravity, OpenCode, Amp, Cursor CLI, Devin), release tooling, and comment sweep are not imported.

## Check Cursor pstack for changes

The repository can name Cursor's repository as the `cursor` remote:

```shell
git remote add cursor https://github.com/cursor/plugins.git
```

Fetch and inspect only commits that touched pstack after the recorded sync point:

```shell
git fetch cursor main
git log --oneline 99743e9c151c8537cbbf1f98bb38f34ef3368453..cursor/main -- pstack
git diff --stat 99743e9c151c8537cbbf1f98bb38f34ef3368453..cursor/main -- pstack
```

No output means the tracked pstack tree has not changed. This comparison does not need a polling service or generated mirror branch.

## Renames applied on every sync

Incoming Cursor pstack text uses Cursor's names. Rewrite them as follows. Apply the rows from the top, because the package row must run before the general `poteto-mode` row.

| Cursor pstack | This fork |
| --- | --- |
| `pstack/skills/`, `pstack/agents/`, `pstack/assets/` | `plugins/engineering-toolkit/skills/`, `plugins/engineering-toolkit/agents/`, `plugins/engineering-toolkit/assets/` |
| `@cursor-skill/poteto-mode-tools` | `@engineering-toolkit/engineering-mode-tools` |
| `.poteto-mode-tools-install-key` | `.engineering-mode-tools-install-key` |
| `skills/poteto-mode` (any path prefix) | `skills/engineering-mode` |
| `/poteto-mode` | `/engineering-mode` |
| `Poteto mode` | `Engineering mode` |
| `poteto-mode` | `engineering-mode` |
| `poteto-agent` (file `agents/poteto-agent.md`, `subagent_type`) | `engineering-agent` |
| `poteto-help` (skill directory, `/poteto-help`) | `engineering-help` |
| `setup-pstack` | `setup-engineering-toolkit` |
| `pstack-models.mdc` | `engineering-toolkit-models.mdc` |

Cursor's `README.md` becomes `README-UPSTREAM.md` and stays verbatim. Never rewrite `README-UPSTREAM.md`, `LICENSE`, `LICENSE-cursor-team-kit`, or `LICENSE-superpowers`. After a sync, grep the changed files for `poteto`. A hit outside `README-UPSTREAM.md` means a row was missed. Capitalized `Poteto-mode` with a hyphen is not covered by the rows above. Rewrite it by hand.

## Incorporate a change

1. Track the work in this fork. Do not file it on `ericlitman/open-pstack`.
2. Read each incoming commit in order. Bring over its intent and content. Then apply the renames above and the substitutions documented in `CHANGES.md`, plus this fork's Cursor-parent mapping.
3. Keep one shared `plugins/engineering-toolkit/skills/` tree.
4. Update the commit and version in this file, the affected provenance rows in `NOTICE.md`, and `README-UPSTREAM.md` when Cursor pstack changes it.
5. Run CI-equivalent checks locally. Then run the installed Cursor, Claude Code, and Codex behavioral lanes required by the changed surface. Unit tests alone are not a release gate.
6. Merge the reviewed change before tagging a release of this fork.

Cursor pstack, Open Pstack, and this fork keep independent version numbers. Cursor's version identifies the imported plugin content. Open Pstack's version identifies the Claude Code and Codex port. This fork's version identifies the checkout you are in.
