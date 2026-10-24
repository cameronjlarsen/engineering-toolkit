# Tracked sources

This fork tracks one source: [Cursor's pstack](https://github.com/cursor/plugins/tree/main/pstack), Lauren Tan's original plugin.

[Open Pstack](https://github.com/ericlitman/open-pstack) is the Claude Code and Codex port that this checkout started from. This fork no longer tracks it. See [Open Pstack (no longer tracked)](#open-pstack-no-longer-tracked).

Do not open issues on Open Pstack for work that belongs in this fork. Keep one shared `plugins/engineering-toolkit/skills/` tree. Put harness translation in `codex-tools.md`, `cursor-tools.md`, `t3-tools.md`, and `provider-dispatch.md`. Keep the file name `t3-tools.md`: it is the Delegation host contract, with T3 as one mapping. Do not fork a skill per parent app.

## Current Cursor pstack sync point

| Source | Value |
| --- | --- |
| Repository | `https://github.com/cursor/plugins.git` |
| Path | `pstack/` |
| Commit | `9580c23696ac8d7abed0c166f2f9918800afb819` |
| Cursor pstack version | `0.15.32` |
| Open Pstack version at fork | `1.4.1` |
| Engineering Toolkit version | `1.5.0` |

The table above is the current Cursor pstack sync point. At the fresh fetch for this sync, `cursor/main` was `9580c23` and `e73df47` (#807) was the last commit to touch `pstack/`. Twenty-four commits touch `pstack/` since `4382e68`. Applied: the final `sharpen` text from `75fabac` (#712) and `88d4751` (#729), without upstream's `disable-model-invocation: true`; `ketchup-video` (#797) and `maintain-formal-verification-skill` (#716), both without `disable-model-invocation: true`; `create-formal-verification-skill` (#721, #794); the `statechart` skill and its scripts (#741, #776, #779, #791), also without that flag; the `engineering-help` routing rows (#715) without the Claude Code adapter paragraph; the `reflect` plugin-cache rule (#800) with Claude Code and Cursor destinations; the `swarm` result-table wording (#807); the `engineering-mode/scripts/` fixes `fe096ef` (#802), `96dec8e` (#801), `3c596e7` (#804), `86c2448` (#803), and `f83fbe6` (#805); and the README refresh from #716, #729, #741, #797, and #806 in `README-UPSTREAM.md`. Already in the tree: the `swarm` Phase A numbering of #807, since the fork's step 3 already sets N. Excluded: the version bumps `0b8e952` (#710), `0148b78` (#713), `d4575673` (#724), `642289e` (#792), and `b1a1298` (#798), since the fork keeps its own version; the offer-a-formal-verification step that `f9be7aa` (#715) adds to `setup-pstack`, because the fork's setup has no verification-skill offer step to extend; and every `docs/guide` edit. Cursor's manifests read `0.15.32`, so the version row moves from `0.15.25`.

## Cursor pstack exclusions

- Commits `799151d` and `6fecddb` add and relocate `make-bot-ui`. It depends on Cursor routines, webhook events, and UI primitives that are not part of the shared skill tree. Do not add `make-bot-ui` or a link to it from `engineering-help`.
- Four `disable-model-invocation: true` lines from `73f8be4` are not applied to `how`, `why`, `unslop`, or `typescript-best-practices`. engineering-mode invokes those skills by name, and the flag blocks that route on Claude Code.
- Do not add `disable-model-invocation: true` to newly imported skills. The principle leaves remain `user-invocable: false`, so engineering-mode can still invoke them by name.
- Keep explicit `principle-*` names in the engineering-mode index.
- The `23a56e2` default-model hunks for `bug-fix`, `perf-issue`, and `hillclimb` are not applied. Those frequent code-writing roles stay on the Sol matrix row for cost.
- The `889ec4b` default-model hunks for `bug-fix`, `perf-issue`, and `hillclimb` are not applied. Those roles stay on the Sol matrix row for cost, same reason as `23a56e2`.
- The `70b2dc8` default-model hunks that move `bug-fix`, `perf-issue`, and `hillclimb` off Sol are not applied. Those roles stay on `codex:gpt-6-sol`.
- The `70b2dc8` hunks that shrink arena, architect, and interrogate from four runners to three are not applied. Those panels stay four runners.
- Setup proposes the upstream families (Fable, Sol, Grok, Opus) only where the session serves them natively, so the cross-provider quad is no longer seeded. The Sol-for-code and four-runner choices apply where those families exist. The skill and playbook bodies carry no provider-qualified default: with no sheet or role line they use `inherit-parent`, so a single-provider machine does not lose lanes to a default.
- Cursor `df58112` / #511 is not applied: keep the Sol defaults, four-runner panels, and current model budgets. Do not take `setup-pstack`'s default budget change; this fork keeps operator overrides and Opus routes at `@medium`.
- Do not take the `b93e811` `~/.cursor/plugins/` search in `poteto-agent`, the Built-in PR tool paragraph, Cursor manifests, `docs/guide`, or the Agent Plugins v1 root manifest.
- Do not take Cursor's generated Claude Code tree or adapter (`182f2ce` / #637, `1b80080` / #705): `harness/pstack/`, `pstack/docs/harness/claude-code.md`, the harness generator and plugin-validation scripts, and the `~/.claude/rules/pstack-models.md` model sheet path. The adapter maps a non-Claude model slug to the session model, which is a weaker-model fallback. Also do not take `scripts/check-pstack-docs.mjs` or the `docs/guide` edits from `019a6a2` / #704.
- Keep this fork's single `pstack-lane` plugin agent in place of Cursor's per-model native `pstack-*` agents. It pins no model or effort; the parent passes both on each call. Sonnet is pinned by the `sonnet` alias, because `Agent` rejects the fixed id `claude-sonnet-5-5`. Claude Code 2.1.302 resolved the alias to `claude-sonnet-5-5`, and a later Sonnet revision is picked up without a repo change. The parent must always pass `effort`, because a call that omits it inherits the parent's effort. Cursor's subagent frontmatter ignores `disallowedTools` and `background`, so on Cursor the `pstack-lane` prompt is the only guard against nested `Agent` and `Task`.
- `ketchup` keeps the fork's autopilot clause, its read-only paragraph, and harness-neutral chart wording in place of `/visualize`. Keep those through later `ketchup` syncs.
- Opening a PR omits upstream's "about 40 lines" squash-body cutoff. Keep the fork's required installed-version, user-action, and observed-result evidence sections.
- `principle-test-behavior-not-implementation` and `principle-attack-the-premise` carry narrow local corrections. The first warns conditionally about assertions that miss relevant behavior; `toBeDefined`, `toBeTruthy`, `toBeInstanceOf`, and `toBeGreaterThan(0)` do fail on `undefined`, and useful negative-path, prompt/configuration, and relational contract checks stay valid. The second limits the actor census and reassignment prescription to imbalance problems; an even census is evidence against an asymmetry hypothesis, not proof that a shared premise is correct. Take upstream's equivalent corrections if they land.
- A reference-file catch-up leaves every `SKILL.md` that holds a dispatch contract, the `reflect` references, and the playbooks on this fork's text.
- The Claude manifest does not take the logo field from `efa2a53` because Claude Code has no schema for it. The shared asset is exposed through the Codex manifest instead.
- Do not replace `plugins/engineering-toolkit/assets/logo.png` with Cursor pstack or Open Pstack bytes. This fork owns that catalog mark. Keep the file under 512 KiB.

## Open Pstack (no longer tracked)

The fork point is Open Pstack 1.4.1. The last sync reviewed Open Pstack through `9368993` (v1.15.0). This fork does not fetch, compare, or import from Open Pstack after that review. The Windows SessionStart fix from v1.8.0 is imported.

These parts of Open Pstack are not imported: the model registry and generated catalog, the extra providers (DeepSeek Harness, Antigravity, OpenCode, Amp, Cursor CLI, Devin), the release tooling, and the comment sweep. Do not add the `upstream` remote or merge Open Pstack commits. Take a change from Open Pstack only as a separate, deliberate decision, and record it in `NOTICE.md`.

## Check Cursor pstack for changes

The repository can name Cursor's repository as the `cursor` remote:

```shell
git remote add cursor https://github.com/cursor/plugins.git
```

Fetch and inspect only commits that touched pstack after the recorded sync point:

```shell
git fetch cursor main
git log --oneline 9580c23696ac8d7abed0c166f2f9918800afb819..cursor/main -- pstack
git diff --stat 9580c23696ac8d7abed0c166f2f9918800afb819..cursor/main -- pstack
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
| `poteto-agent` (file `agents/poteto-agent.md`, `subagent_type`) | `engineering-agent` (no `poteto-agent` alias) |
| `poteto-help` (skill directory, `/poteto-help`) | `engineering-help` |
| `setup-pstack` | `setup-engineering-toolkit` |
| `pstack-models.mdc` | `engineering-toolkit-models.mdc` |

Cursor's `README.md` becomes `README-UPSTREAM.md` and stays verbatim. Never rewrite `README-UPSTREAM.md`, `LICENSE`, `LICENSE-cursor-team-kit`, or `LICENSE-superpowers`. After a sync, grep the changed files for `poteto`. A hit outside `README-UPSTREAM.md` means a row was missed. Capitalized `Poteto-mode` with a hyphen is not covered by the rows above. Rewrite it by hand.

## Incorporate a change

1. Track the work in this fork. Do not file it on `ericlitman/open-pstack`.
2. Read each incoming commit in order. Bring over its intent and content. Then apply the renames above and the substitutions audited in `CHANGES.md`, plus this fork's Cursor-parent mapping.
3. Keep one shared `plugins/engineering-toolkit/skills/` tree.
4. Update the commit and version in this file, the affected provenance rows in `NOTICE.md`, and `README-UPSTREAM.md` when Cursor pstack changes it.
5. Run CI-equivalent checks locally. Then run the installed Cursor, Claude Code, and Codex behavioral lanes required by the changed surface. Unit tests alone are not a release gate.
6. Merge the reviewed change before tagging a release of this fork.

Cursor pstack and this fork keep independent version numbers. Cursor's version identifies the imported plugin content. This fork's version identifies the checkout you are in. The Open Pstack version in the table above records the fork point only.

## Maintenance

- The Engineering Toolkit version string lives in `plugins/engineering-toolkit/.claude-plugin/plugin.json`, `plugins/engineering-toolkit/.codex-plugin/plugin.json`, `plugins/engineering-toolkit/.cursor-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.cursor-plugin/marketplace.json`, and the Engineering Toolkit version row above. A catalog version bump updates all six. `tests/skill-collision-repro.sh` checks that they match. The Open Pstack row stays the version this checkout started from. `.agents/plugins/marketplace.json` carries no version field.
- The skill and playbook bodies carry no provider-qualified default, and `tests/skill-collision-repro.sh` checks that. It also checks that setup and `provider-dispatch.md` name the same roles, and that the removed routing layer is not named again.
- After a change to `skills/engineering-mode/scripts/`, run `bun install --frozen-lockfile`, `bun run test`, and `bun run typecheck` from that directory.
- `hooks/session-start-context.md` restates skill one-liners. Re-verify it whenever skill names or descriptions change.
- The package must not contain a `commands/` layer. Claude Code and Codex load the native `skills/` tree directly, and a command layer doubles the workflow inventory.
- Every `principle-*` leaf carries `user-invocable: false` to keep them out of the user picker while `engineering-mode` reads them by path. Claude honors the metadata. Codex 0.149.0 does not ([open-pstack#8](https://github.com/ericlitman/open-pstack/issues/8)). They must not carry `disable-model-invocation`, which makes them unreachable to the model.
- Re-run the behavioral mode of `tests/skill-collision-repro.sh` after Claude Code upgrades to check model-initiated and user-initiated native skill invocation.
- `plugin.json` declares no `dependencies`. The Claude Code desktop app loads plugins with `--plugin-dir`, which strips marketplace identity, so a cross-marketplace dependency never resolves and the loader disables the whole plugin with `dependency-unsatisfied`. `optional: true` passes `claude plugin validate` but the loader ignores it (tested on 2.1.197). `plugin-dev` is a manual install; see `docs/reference.md`.
