# Engineering Toolkit

This repository is `cameronjlarsen/engineering-toolkit`. It started from Open Pstack 1.4.1 and no longer tracks it. It tracks one source: Cursor's pstack (`cursor/plugins`, path `pstack/`). Track durable work in this repository's GitHub Issues. Do not open issues on Open Pstack or on Cursor's repository. Do not create a parallel Linear queue. Read `UPSTREAM.md` before changing content derived from Cursor pstack.

This fork keeps one shared `plugins/engineering-toolkit/skills/` tree for Cursor, Claude Code, and Codex, and aims to run on other coding agents the same way. Keep harness differences at the existing mapping files (`codex-tools.md`, `cursor-tools.md`, `t3-tools.md`, `provider-dispatch.md`). Do not fork a skill per harness and do not add compatibility layers. The parent harness resolves provider routing once. Children do not detect or reroute themselves.

Before opening a pull request, run the Bun tests, strict typecheck, static invariants, and plugin validation.

Nothing merges, tags, releases, or rolls out until the exact candidate is installed and the changed behavior passes a live test from the real user surface. Unit tests, validators, source inspection, and self-reports do not satisfy this gate. What to test depends on what the pull request changes:

- A mapping file, anything under `engineering-mode/scripts/`, a hook, a manifest, or a version field: test every harness it affects.
- Skill text: if it names no harness-specific tool, path, or model, test on one harness and say which. Otherwise test every harness it names.
- Documentation, provenance, tests, or CI only: no live test. Say so in the pull request.

If a pull request fits more than one rule, the stricter one applies.

Record the installed version, harness, surface, action, and observed result in the pull request template. A pull request that needs a live test and has no evidence remains a draft.

Do not add an implicit runtime timeout or a weaker-model fallback.
