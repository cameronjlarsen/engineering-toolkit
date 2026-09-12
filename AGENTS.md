# Engineering Toolkit

This repository is a fork of Open Pstack (`ericlitman/open-pstack`). The intended GitHub remote is `cameronjlarsen/engineering-toolkit`. Track durable work in this repository's GitHub Issues after that remote is published. Do not open issues on Open Pstack for this fork's work. Do not create a parallel Linear queue. Read `UPSTREAM.md` before changing content derived from Cursor pstack or Open Pstack.

Cursor's `cursor/plugins/pstack` tree is the original plugin. Open Pstack adapted it for Claude Code and Codex. This fork keeps one shared skill tree for Cursor, Claude Code, and Codex, and aims to parent on other coding agents the same way. Adapt harness primitives at the existing mapping boundaries instead of forking skills or adding compatibility layers. The parent harness resolves provider routing once. Children do not detect or reroute themselves.

Before opening a pull request, run the Bun tests, strict typecheck, static invariants, and plugin validation.

Nothing merges, tags, releases, or rolls out until the exact candidate is installed and the changed behavior passes a live test from the real user surface in every affected parent. Unit tests, validators, source inspection, and self-reports do not satisfy this gate. Record the installed version, surface, action, and observed result in the pull request template. A pull request without that evidence remains a draft.

Do not add an implicit runtime timeout or a weaker-model fallback.
