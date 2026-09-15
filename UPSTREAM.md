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
| Commit | `5bf2b1544db739998121a306340631963c2ff3de` |
| Cursor pstack version | `0.15.2` |
| Open Pstack version at fork | `1.4.1` |

The table above is the current Cursor sync point. This checkout started from Open Pstack 1.4.1, which imported that 0.15.1 sync. `README-UPSTREAM.md` preserves the Cursor pstack README verbatim. `CHANGES.md` and `NOTICE.md` describe the Open Pstack adaptations and provenance.

## Open Pstack remote

The maintainer checkout names Open Pstack as `upstream`:

```shell
git remote add upstream https://github.com/ericlitman/open-pstack.git
```

Fetch Open Pstack `main` and inspect commits after the recorded Open Pstack version before you merge them here.

## Cursor pstack exclusions

- Commits `799151d` and `6fecddb` add and relocate `make-bot-ui`. It depends on Cursor routines, webhook events, and UI primitives that are not part of the shared skill tree.
- Four `disable-model-invocation: true` lines from `73f8be4` are not applied to `how`, `why`, `unslop`, or `typescript-best-practices`. engineering-mode invokes those skills by name, and the flag blocks that route on Claude Code.
- The `23a56e2` default-model hunks for `bug-fix`, `perf-issue`, and `hillclimb` are not applied. Those frequent code-writing roles stay on `codex:gpt-5.6-sol@max` for cost.
- The `889ec4b` default-model hunks for `bug-fix`, `perf-issue`, and `hillclimb` are not applied. Those roles stay on `codex:gpt-5.6-sol@max` for cost, same reason as `23a56e2`.
- The Claude manifest does not take the logo field from `efa2a53` because Claude Code has no schema for it. The shared asset is exposed through the Codex manifest instead.
- Do not replace `plugins/engineering-toolkit/assets/logo.png` with Cursor pstack or Open Pstack bytes. This fork owns that catalog mark. Keep the file under 512 KiB.

## Check Cursor pstack for changes

The repository can name Cursor's repository as the `cursor` remote:

```shell
git remote add cursor https://github.com/cursor/plugins.git
```

Fetch and inspect only commits that touched pstack after the recorded sync point:

```shell
git fetch cursor main
git log --oneline 5bf2b1544db739998121a306340631963c2ff3de..cursor/main -- pstack
git diff --stat 5bf2b1544db739998121a306340631963c2ff3de..cursor/main -- pstack
```

No output means the tracked pstack tree has not changed. This comparison does not need a polling service or generated mirror branch.

## Incorporate a change

1. Track the work in this fork. Do not file it on `ericlitman/open-pstack`.
2. Read each incoming commit in order. Bring over its intent and content. Then apply only the substitutions documented in `CHANGES.md`, plus this fork's Cursor-parent mapping.
3. Keep one shared `plugins/engineering-toolkit/skills/` tree.
4. Update the commit and version in this file, the affected provenance rows in `NOTICE.md`, and `README-UPSTREAM.md` when Cursor pstack changes it.
5. Run CI-equivalent checks locally. Then run the installed Cursor, Claude Code, and Codex behavioral lanes required by the changed surface. Unit tests alone are not a release gate.
6. Merge the reviewed change before tagging a release of this fork.

Cursor pstack, Open Pstack, and this fork keep independent version numbers. Cursor's version identifies the imported plugin content. Open Pstack's version identifies the Claude Code and Codex port. This fork's version identifies the checkout you are in.
