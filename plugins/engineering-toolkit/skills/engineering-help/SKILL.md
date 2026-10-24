---
name: engineering-help
description: Guides users through Engineering Toolkit setup, /engineering-mode, and picking the skill, playbook, or principle for a task. Use for /engineering-help or questions about Engineering Toolkit.
---

# Engineering help

Answer the user's question about Engineering Toolkit, hand them a prompt they can send, and link the file the answer came from. For a help question, don't start the work. The user asked how, and an Engineering Toolkit run spends real tokens, so let them send the prompt.

A message that asks for work, such as "use Engineering Toolkit to fix this bug", is not a help question. Read [`engineering-mode`](../engineering-mode/SKILL.md), do the work under it, and mention once that starting each task with `/engineering-mode` keeps it on.

This file maps questions to the skills that hold the answers. Those files own the details. Read the file you route to before you quote it, and trust it when it disagrees with this map. The skill links here point into the installed plugin, which the user may not be able to open, so give the user the file's public copy: `https://github.com/cameronjlarsen/engineering-toolkit/blob/main/plugins/engineering-toolkit/` followed by its path.

## Find out what they need

Infer the need from the message and the conversation. A named situation, such as "which skill reviews a PR?", goes straight to its section. If the need is still unclear, ask one multiple-choice question with these options, then answer only the section they pick:

- Get set up
- Start a task with `/engineering-mode`
- Pick a skill for a situation
- Fix a run that went wrong
- Make Engineering Toolkit my own

Check the state that changes the answer, and mention it only when it does:

- Check the active model sheet that the Active model sheet section of [`t3-tools.md`](../engineering-mode/references/t3-tools.md) names for this session. A missing sheet means roles without configuration use `inherit-parent`.
- No `verify-*` skill or other app harness in the project means agents have no scripted way to drive the app. Mention `/create-verification-skill` when the question is about proving a change works.
- No formal verification skill in the project means no property is checked past what tests reach. Mention `/create-formal-verification-skill` when the question is about a race, an invariant, or another case tests rarely hit. When one exists and the code it covers changed after the commit it records as last in sync, mention `/maintain-formal-verification-skill` if the question touches that code.

When the model rule is missing and it matters, ask whether the user wants to pick a model for each role and a requested effort now. It matters when the user is new, the question is about setup or cost, or the answer depends on which models run. Ask at most once per chat. If the need is also unclear, ask both questions together. Offer two choices:

- Now: give them `/setup-engineering-toolkit` to type, and answer their question too.
- Later: answer their question, and add one line saying every role keeps its default model until they run `/setup-engineering-toolkit`.

## Get set up

1. Install this fork. In Cursor Agent chat, run `/add-plugin https://github.com/cameronjlarsen/engineering-toolkit` and install `et` from the marketplace panel. In Claude Code, run `/plugin marketplace add cameronjlarsen/engineering-toolkit`, then `/plugin install et@engineering-toolkit`, then `/reload-plugins`. In Codex, run `codex plugin marketplace add cameronjlarsen/engineering-toolkit --ref main`, then `codex plugin add et@engineering-toolkit`. Set `[features]` with `multi_agent = true` in `~/.codex/config.toml` and start a new Codex task.
2. Run [`/setup-engineering-toolkit`](../setup-engineering-toolkit/SKILL.md). It maps a model to each role, asks one requested effort for each model family it assigns, probes those models, and writes a model sheet. The sheet applies to new sessions.
3. Start a real task with `/engineering-mode`, a goal, and a check that can pass or fail.

In Claude Code, a typed skill carries the plugin prefix, as in `/et:engineering-mode` and `/et:setup-engineering-toolkit`. In Codex, ask for a skill by name, as in "use et:engineering-mode" or "use et:setup-engineering-toolkit". In Cursor, type `/engineering-mode` or `/setup-engineering-toolkit`. The [README](https://github.com/cameronjlarsen/engineering-toolkit#readme) owns the installation steps. Offer to word their first prompt with them, per [`references/prompting.md`](references/prompting.md).

If cost is the worry, say where the tokens go and how to spend fewer. Engineering Toolkit spends extra tokens on subagents and review panels. Rerun `/setup-engineering-toolkit` and pick lower efforts or cheaper models. A role set to `auto` or `inherit-parent` runs on the session's model, which saves tokens when the session runs on a cheaper model. A shorter panel list runs fewer subagents, one for each entry. Save `/engineering-mode` for work that needs rigor.

Engineering Toolkit ships one shared skill tree for Cursor, Claude Code, and Codex. T3 Code is not a dedicated parent in this baseline. A T3 session using the Codex or Claude Code harness follows that harness's available skills and mapping; do not claim T3-specific setup or dispatch support. Workflow skills such as `/engineering-mode`, `/how`, `/why`, and `/teach` start subagents with per-role models. A model from the app you are using runs inside it, and other models run through their signed-in command-line tools. Codex has no `loop` skill and no `engineering-agent` type. [`codex-tools.md`](../engineering-mode/references/codex-tools.md) and [`cursor-tools.md`](../engineering-mode/references/cursor-tools.md) map the shared tool language to each parent.

## Start a task with `/engineering-mode`

`/engineering-mode` matches the task to a playbook, copies the playbook's steps into the todo list, and runs the other skills as the steps need them. A step it skips stays in the list as `skip: <reason>`. A good prompt states the goal and how to tell it's done. It doesn't list skills, because a hand-written sequence tends to drop or reorder steps the playbook would keep. Read [`references/prompting.md`](references/prompting.md) before you help word one.

Whether `/engineering-mode` stays on depends on the harness:

- In Claude Code, a small startup instruction routes non-trivial work into `/engineering-mode`. A typed `/et:engineering-mode` attaches the skill to that task, and it can fade as the session moves on.
- In Codex, ask for `et:engineering-mode` by name at the start of each task.
- In Cursor, start a task with `/engineering-mode`.
- In every parent, start each new task with `/engineering-mode` when it matters.

Mid-session, "new task" makes the mode match a fresh playbook. In Claude Code, `/engineering-mode` already uses `engineering-agent` for the subagents its playbook steps spawn. To get the same style from a subagent of your own, spawn it with `subagent_type: "engineering-agent"`. Codex has no `engineering-agent` type, so dispatch a `spawn_agent` whose instructions say to read the `engineering-mode` skill in full first.

## Pick a skill

The default answer is `/engineering-mode`, which runs most of the others when its steps need them. Name a skill directly when the user wants more or less of something than the playbook gives. Read the skill before you recommend it, and give one example prompt.

| The user wants to | Skill |
|---|---|
| Do any non-trivial task with rigor | [`/engineering-mode`](../engineering-mode/SKILL.md) |
| Check that the agent understood their goal and the problem before it starts | [`/in-your-own-words`](../in-your-own-words/SKILL.md) |
| Get a prompt rewritten deeper, not bigger, before sending it: what a top professional would add, their raw material and methods, and an outside check. It returns the prompt and doesn't do the task | [`/sharpen`](../sharpen/SKILL.md) |
| Know how code works now, or where new code should live | [`/how`](../how/SKILL.md) |
| Know why code is shaped this way, or where a number came from | [`/why`](../why/SKILL.md) |
| Understand a change or subsystem, explained plainly | [`/teach`](../teach/SKILL.md) |
| Catch up on their own recent work on a topic | [`/recall`](../recall/SKILL.md) |
| Catch up on what changed in this chat since their last message, in plain words and small visuals, with every item waiting on them listed and decidable from the reply alone | [`/ketchup`](../ketchup/SKILL.md) |
| Catch up like `/ketchup`, in a short silent video of slides, with the waiting calls as text under it | [`/ketchup-video`](../ketchup-video/SKILL.md) |
| Know what a small diff could break outside itself | [`/blast-radius`](../blast-radius/SKILL.md) |
| Settle types and module shape before code that crosses a function boundary | [`/architect`](../architect/SKILL.md) |
| Get several attempts at one brief, merged into the best one | [`/arena`](../arena/SKILL.md) |
| Run parallel checks over slices, or race workers, as background subagents | [`/swarm`](../swarm/SKILL.md) |
| Have several models review a diff and try to break it | [`/interrogate`](../interrogate/SKILL.md) |
| Fix a bug test-first when a cheap local test exists | [`/tdd`](../tdd/SKILL.md) |
| Apply TypeScript rules to `.ts` or `.tsx` work | [`/typescript-best-practices`](../typescript-best-practices/SKILL.md) |
| Strip comments before review, using a reviewer that didn't write them | [`/no-comments`](../no-comments/SKILL.md) |
| Clean AI tells out of prose | [`/unslop`](../unslop/SKILL.md) |
| Write docs, an RFC, a README, a PR description, or a commit message to a standard | [`/technical-writing`](../technical-writing/SKILL.md) |
| Hear the last reply again in plain words | [`/bro`](../bro/SKILL.md) |
| Give agents a scripted way to drive the app and prove behavior | [`/create-verification-skill`](../create-verification-skill/SKILL.md) |
| Bring a verification skill and its feature map back in line with the app | [`/maintain-verification-skill`](../maintain-verification-skill/SKILL.md) |
| Formally verify a race, invariant, or other property that tests rarely reach | [`/create-formal-verification-skill`](../create-formal-verification-skill/SKILL.md) |
| Bring a formal verification back in line after the code it covers changed, and learn whether a failure is drift or a bug | [`/maintain-formal-verification-skill`](../maintain-formal-verification-skill/SKILL.md) |
| Show a PM or designer what the user sees as a chart checked by a model, with each bug drawn as a numbered path, turn an agreed chart into a TLA+ skeleton, or audit the code against its TLA+ spec | [`/statechart`](../statechart/SKILL.md) |
| Vet a performance number before reporting or acting on it | [`/benchmark-checklist`](../benchmark-checklist/SKILL.md) |
| Run a large or cross-cutting change, or one to review after stepping away | [`/figure-it-out`](../figure-it-out/SKILL.md) |
| Keep a decision log during a run, and review it afterward | [`/show-me-your-work`](../show-me-your-work/SKILL.md) |
| Pick a model for each role and a requested effort for each model family | [`/setup-engineering-toolkit`](../setup-engineering-toolkit/SKILL.md) |
| Turn their own working habits into a personal mode skill | [`/automate-me`](../automate-me/SKILL.md) |
| Turn what a finished task taught into skill edits | [`/reflect`](../reflect/SKILL.md) |
| Stop agents from repeating the same mistakes in this repo | [`/correct`](../correct/SKILL.md) |
| Find their way around Engineering Toolkit | `/engineering-help` |

If a skill directory next to this one is missing from the table, read its frontmatter and route by its description. The `principle-*` directories are covered under principles below.

Close calls:

- `/how` explains what the code does. `/why` explains the reasons. `/teach` runs one or both and explains the result plainly.
- `/arena` gives every worker the same brief and merges the best parts. `/swarm` splits work into slices or a race and returns one report.
- `/architect` implements right after it settles the design. Add "with checkpoint" to review the design before it writes code.
- `/interrogate` reviews the diff. `/blast-radius` looks for breakage outside the diff and proves the one fact that makes the change safe.
- `/recall` rebuilds context across recent chats. `/ketchup` covers only this chat since the user's last message. Resuming one specific chat or branch is the Session pickup playbook.
- `/figure-it-out` designs one rigorous run. The Orchestrate playbook runs a program that spans days and many PRs. The Autonomous run playbook drives one task to a finish condition.

Not in Engineering Toolkit:

- `run` (CLIs and TUIs), `verify` (UIs), and `loop` are Claude Code built-ins. `plugin-dev:skill-development` ships in the separate `plugin-dev` plugin, which skill-authoring routes need. In Claude Code, install it with `/plugin marketplace add anthropics/claude-plugins-official`, then `/plugin install plugin-dev@claude-plugins-official`. [`codex-tools.md`](../engineering-mode/references/codex-tools.md) names the Codex equivalent of each.
- Engineering Toolkit has no `/orchestrate` skill. Orchestrate is an `/engineering-mode` playbook. If the slash menu shows `/orchestrate`, another plugin provides it.

## Playbooks and principles

Playbooks are step lists inside `/engineering-mode`, not skills, so they have no slash command. Inside `/engineering-mode`, describing the task picks one, and these phrases name one directly:

- "babysit this pr" or "check on pr 123" runs Babysit. It drives the PR to merge-ready and stops there. It doesn't merge unless the user asks to merge, land, or ship.
- "land the stack" runs Shipping.
- "take over this branch" runs Session pickup.
- "pause safely" runs Pause safely.
- "full autopilot on this queue" runs Autopilot-full. "stack them, don't ship" runs Autopilot-stack.
- "run the eval playbook" runs Eval.

Without `/engineering-mode`, a phrase such as "babysit this pr" can start the bundled `/babysit` skill for the same job instead. The Playbooks section of [`engineering-mode`](../engineering-mode/SKILL.md) lists every playbook and when it applies.

Engineering Toolkit has no planning skill. Claude Code's plan mode works alongside it. For work that spans phases or stacked PRs, asking `/engineering-mode` for a plan runs the [Multi-phase plan playbook](../engineering-mode/playbooks/multi-phase-plan.md), which writes the plan and doesn't implement it. For a design question, the Prototype playbook or `/architect` settles it in code first.

Principles are one-rule skills that `/engineering-mode` reads and cites in its replies. The user rarely invokes one. They steer with the names instead, as in "apply prove it works. show me the real output." Principles are hidden from the slash menu, but asking for one by name, such as `et:principle-prove-it-works`, still loads it on demand.

## Fix a run that went wrong

| Symptom | Fix |
|---|---|
| The mode stopped applying after a few turns | A typed skill fades as the session moves on. Start each task with `/engineering-mode`. |
| A question got treated as the next step of the last task | Say "new task", or say the turn doesn't need the mode. |
| A new model choice had no effect | The model sheet from `/setup-engineering-toolkit` applies to new sessions. Start one. |
| Runs cost more than expected | See the cost paragraph under Get set up. |
| A skill didn't load on its own | Ask for the skill by name, such as `et:ketchup`. Skills can load when the request matches their description or engineering-mode routes to them. It doesn't run every skill on every task. |
| Parallel agents overwrote each other | Give each agent its own worktree. |
| An overnight run moved but finished nothing | The [Autonomous run playbook](../engineering-mode/playbooks/autonomous-run.md) needs a check that can pass or fail, not a duration. |
| The reply claims success from a green build | Ask for the real command, flow, stored value, or profile. That's the prove-it-works principle. |

For a run that drifts, [`references/prompting.md`](references/prompting.md) has one-line steers.

## Make Engineering Toolkit my own

- [`/automate-me`](../automate-me/SKILL.md) drafts a personal mode skill from the user's own history, to use alongside `/engineering-mode`.
- [`/reflect`](../reflect/SKILL.md) after a session turns its lessons into skill edits the user approves.
- `/engineering-mode write a skill for <workflow>` runs the authoring playbook. The eval playbook tests a skill change blind.
- Fix a misbehaving skill in its own PR, not inside the feature work where it went wrong.

## Reply

Lead with the answer. Give at most one example prompt in a code block, adapted from [`references/recipes.md`](references/recipes.md) when one fits, then the link to that file. Keep it short unless the user asked for the whole map.
