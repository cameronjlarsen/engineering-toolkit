# Engineering Toolkit

This repository is `cameronjlarsen/engineering-toolkit`. It started from Open Pstack 1.4.1 and no longer tracks it. It tracks one source: Cursor's pstack (`cursor/plugins`, path `pstack/`). Track durable work in this repository's GitHub Issues. Do not open issues on Open Pstack or on Cursor's repository. Do not create a parallel Linear queue. Read `UPSTREAM.md` before changing content derived from Cursor pstack.

This fork keeps one shared `plugins/engineering-toolkit/skills/` tree for every host. Claude Code, Codex, and Cursor are mapped hosts. A delegate host (T3 Code today) adds spawn and wait. A new host gets a mapping file and nothing else. Keep harness differences at the existing mapping files (`codex-tools.md`, `cursor-tools.md`, `t3-tools.md`, `provider-dispatch.md`). Do not fork a skill per harness, do not add routing code, and do not add compatibility layers. The parent harness resolves provider routing once. Children do not detect or reroute themselves.

- **Core skills and playbooks.** They say what to do. They track Cursor pstack, and `UPSTREAM.md` lists the renames and exclusions. They keep Claude Code tool names.
- **Mapping files.** `codex-tools.md`, `cursor-tools.md`, and `t3-tools.md` each say how their host starts and waits for subagents. `t3-tools.md` is also the Delegation host contract, and it alone defines which model sheet is active in a session. `provider-dispatch.md` holds the model sheet format, the Route format, and the dropout policy.
- **Model sheets.** Nothing parses a sheet and nothing launches another provider's CLI. The parent reads the sheet as text, and a Route for another provider runs only on a delegate host. `/setup-engineering-toolkit` writes the active sheet. A role set to `inherit-parent` or `auto` runs on the parent's own model.
- **Owned by this repository.** The Azure DevOps and Origin review flow, the `engineering-agent`, `comment-sicko`, and `pstack-lane` agents, and playbook fixes. `pstack-lane` pins no model or effort, so the parent must pass both on every call.

The typed routing layer and the external launcher are deleted. The last release that has them is v1.4.7. Later releases have neither.

Before opening a pull request, run what `.github/workflows/ci.yml` runs. It is the source of the commands: the Bun tests, the strict typecheck, the manifest JSON check, and the static invariants in `tests/skill-collision-repro.sh`. A version bump moves every manifest version and the version row in `UPSTREAM.md` together.

Nothing merges, tags, releases, or rolls out until the exact candidate is installed and the changed behavior passes a live test from the real user surface. Unit tests, validators, source inspection, and self-reports do not satisfy this gate. What to test depends on what the pull request changes:

- A mapping file, anything under `engineering-mode/scripts/`, a hook, an agent definition under `agents/`, a manifest, or a version field: test every harness it affects.
- Skill text: if it names no harness-specific tool, path, or model, test on one harness and say which. Otherwise test every harness it names.
- Documentation, provenance, tests, or CI only: no live test. Say so in the pull request.

If a pull request fits more than one rule, the stricter one applies.

Record the installed version, harness, surface, action, and observed result in the pull request template. A pull request that needs a live test and has no evidence remains a draft.

Do not add an implicit runtime timeout or a weaker-model fallback.
