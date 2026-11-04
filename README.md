# Engineering Toolkit

This repository is a fork of [Open Pstack](https://github.com/ericlitman/open-pstack). Open Pstack is the Claude Code and Codex port of [Lauren Tan's Cursor pstack plugin](https://github.com/cursor/plugins/tree/main/pstack). This checkout started from Open Pstack 1.4.1 and no longer tracks it. It tracks one source: Cursor's pstack (`cursor/plugins`, path `pstack/`).

One shared skill tree lives at `plugins/engineering-toolkit/skills/`. Claude Code, Codex, and Cursor are the mapped hosts. A delegate host adds spawn and wait. Today that host is a T3 Code session with `orchestrator_capabilities` and `delegate_task`. A new host gets a mapping file and nothing else. The GitHub repository is [cameronjlarsen/engineering-toolkit](https://github.com/cameronjlarsen/engineering-toolkit). Do not install Lauren's original pstack or `ericlitman/open-pstack` as a stand-in for this fork.

## What Engineering Toolkit does

Engineering Toolkit is a plugin for coding agents. The workflows came from pstack. It is not a new model or a hosted service. It gives the agent engineering rules, playbooks, skills, and the small local tools in `plugins/engineering-toolkit/skills/engineering-mode/scripts/`.

The entry point is `engineering-mode`. You give it a task in plain language. It matches a playbook. It learns how the current system works before changing it, compares designs when that choice matters, and checks real behavior on the matching surface.

For a feature, engineering-mode follows `playbooks/feature.md`. It runs `how` on the affected part, uses `architect` to explore the design, names the data shape before the delegate writes code, and delegates the implementation. It verifies on the matching surface. If the design is contested, it runs `interrogate` before shipping. Then it runs Opening a PR. The other skills are there when engineering-mode needs them, or when you call one directly.

Claude Code prefixes plugin skills with `/et:`, from the plugin name `et`. In Codex, ask for `et:engineering-mode`. In Cursor, run `/engineering-mode`. Claude's SessionStart hook tells the session to invoke `et:engineering-mode` before a non-trivial engineering task. Codex does not load that hook.

## Install

You need Cursor, Claude Code, or Codex. The plugin directory is `plugins/engineering-toolkit`. It holds the Cursor, Claude Code, and Codex manifests. Each manifest names the plugin `et`.

### Cursor

Run this command in Agent chat:

```text
/add-plugin https://github.com/cameronjlarsen/engineering-toolkit
```

Install `et` from the marketplace panel. Run `/setup-engineering-toolkit`.

### Claude Code

Run these commands inside Claude Code:

```text
/plugin marketplace add cameronjlarsen/engineering-toolkit
/plugin install et@engineering-toolkit
```

### Codex

Run these commands in your shell:

```shell
codex plugin marketplace add cameronjlarsen/engineering-toolkit --ref main
codex plugin add et@engineering-toolkit
```

Turn on Codex subagents in `~/.codex/config.toml`:

```toml
[features]
multi_agent = true
```

Without `multi_agent`, the native Codex lane is a named dropout.

## Get started

Lauren's original setup has two steps. This fork keeps that flow.

### 1. Set up the models

In Claude Code, run `/et:setup-engineering-toolkit`.

In Codex, ask: `Use et:setup-engineering-toolkit to configure Engineering Toolkit.`

In Cursor, run `/setup-engineering-toolkit`.

Setup reads the models this session can run, shows the route table, and asks before it writes. The first run keeps only the families this session serves. The families are Fable, Sol, Grok, and Opus. A role whose family this session does not serve is `inherit-parent`. The two parent-bound roles are always `inherit-parent`.

Setup asks for one budget for the whole sheet. The labels are `unlimited, keep max`, `large, xhigh reasoning`, `medium, high reasoning`, and `small, medium reasoning`. Large, medium, and small write one effort onto every real Route. On a first run, `unlimited` gives each Route the highest ladder effort its model lists.

An older sheet still loads. Versioned Fable and Opus ids read as the rolling aliases `fable` and `opus`. A `Descriptor grammar:` header is ignored.

The file setup writes depends on the session:

| Session | Sheet |
| --- | --- |
| Delegate host (`delegate_task` and `orchestrator_capabilities`) | `~/.agents/engineering-toolkit-models.md` |
| Claude Code | `~/.claude/engineering-toolkit-models.md` |
| Codex | `~/.codex/engineering-toolkit-models.md` |
| Cursor | `~/.cursor/rules/engineering-toolkit-models.mdc` |

A delegate-host run leaves the per-app sheet in place. If the Cursor path already holds an upstream Task-slug rule, setup stops. Upstream Task slugs are not a second grammar.

On a delegate host, every Route on the host sheet names its provider (`provider:model@effort`). A Route can name any provider that session's capability list reports. A miss is a named dropout.

### 2. Use engineering-mode

Start careful engineering work with `engineering-mode`.

In Claude Code:

```text
/et:engineering-mode Add saved filters to search. Keep the design simple, verify it in the real app, and open a pull request.
```

In Codex:

```text
Use et:engineering-mode. Add saved filters to search. Keep the design simple, verify it in the real app, and open a pull request.
```

In Cursor:

```text
/engineering-mode Add saved filters to search. Keep the design simple, verify it in the real app, and open a pull request.
```

The task in those examples is only an example. The prefixes are the real invocation.

## Models

Some workflows use one model. `architect`, `arena`, and `interrogate` are panel roles. A panel role takes one entry per lane, so the list length is the fan-out. Each panel gets one lane per served family.

A Route runs in the parent app when its provider is that app's token: `claude` on Claude Code, `codex` on Codex, and `cursor` on Cursor. Claude models on a Claude route stay in Claude Code. A Codex route stays in Codex. On Cursor, Fable matches `claude-fable-*` and Opus matches `claude-opus-*`, passed as a live `Task` selector.

On a session that is not a delegate host, a Route that names another provider is a named dropout. The parent does not start that provider's CLI, does not run the lane on the parent model, and does not substitute a model. A panel continues with the lanes that ran.

On a delegate host, `t3-tools.md` resolves `provider:model@effort` against the live capability list. A miss is a named dropout. A sheet may name a fallback provider. A seat cap retries that route once there with the same resolved model and the same effort.

Grok is a family in that set when the session serves it. The three plugin manifests are the parent apps. There is no Grok manifest.

There is no weaker-model fallback.

## Records

This repository also keeps:

- [the original README](README-UPSTREAM.md), verbatim;
- [the sync record](UPSTREAM.md) for Cursor pstack and the Open Pstack fork point;
- [the port substitution audit](CHANGES.md); and
- [the attribution record](NOTICE.md) for pstack, Cursor Team Kit, Gentle AI, and Superpowers.

## Tracked sources

This checkout is Engineering Toolkit 1.7.0. It tracks Cursor pstack 0.15.36 at commit [`c742dd61706fbacc1b95f1a20b7b988cf096ce6c`](https://github.com/cursor/plugins/commit/c742dd61706fbacc1b95f1a20b7b988cf096ce6c) and started from Open Pstack 1.4.1.

Cursor pstack's version and this fork's version stay independent. The Open Pstack version records the fork point only. Read `UPSTREAM.md` before changing content derived from Cursor pstack. Incoming pstack commits are read in order.

## Contributing

Search [GitHub Issues](https://github.com/cameronjlarsen/engineering-toolkit/issues) before opening a new issue. Do not open issues on [ericlitman/open-pstack](https://github.com/ericlitman/open-pstack) for work that belongs here.

Pull requests keep one shared `plugins/engineering-toolkit/skills/` tree for every host. Harness differences stay in `codex-tools.md`, `cursor-tools.md`, `t3-tools.md`, and `provider-dispatch.md`.

Pull requests pass what `.github/workflows/ci.yml` runs: the Bun tests, the strict typecheck, the manifest JSON check, and the static invariants in `tests/skill-collision-repro.sh`.

## License

MIT. pstack was created by Lauren Tan. Open Pstack builds on Michael Denyer's [pstack-claude](https://github.com/michael-denyer/pstack-claude) port. Engineering Toolkit builds on Open Pstack and includes attributed MIT-licensed work from Cursor Team Kit, Gentle AI (Gentleman Programming), and Superpowers. See [NOTICE.md](NOTICE.md), [LICENSE](LICENSE), [LICENSE-cursor-team-kit](LICENSE-cursor-team-kit), [LICENSE-gentle-ai](LICENSE-gentle-ai), and [LICENSE-superpowers](LICENSE-superpowers).
