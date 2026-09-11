### Opening a PR

Invoked at the end of every other playbook.

**Worktree.** Work from a git worktree off main. Subagents inherit it. Multiple `Agent` calls on the same branch each get their own worktree. To reuse one branch across worktrees, resolve and validate `<head-url>` through Shipping step 1, capture it as `head_url`, then run `git fetch -- "$head_url" "refs/heads/$branch" && git reset --hard FETCH_HEAD` between them. Dirty branch with unrelated work: patch out, fresh worktree, apply. Snarled worktree: reset from main, redo minimally.

**Commits.** Commit liberally. Rebase into small, ordered commits before opening PRs. Each commit is a future PR: landable, ordered to tell the story. Amend when the fix belongs in a just-made commit. New commit when separable. On every forge, commit messages use Conventional Commits. Commit splits follow **work-unit-commits** (the split) and **sequence-verifiable-units** (the why). PR titles follow the active forge (GitHub Conventional Commits vs Azure `WI{n}: {System.Title}`).

**PRs.** Run `/deslop` over the diff before commit. Run `/no-comments` before review. Write every PR title, PR description, and commit body with `/technical-writing`, then apply `/unslop`. Apply every technical-writing layer except Diátaxis. Use one word for each action, keep articles, and avoid `-ing` when a plain verb works.

**Forge.** Resolve the forge once before the first PR operation. Keep that tagged choice for create, edit, and view. Model vendor never selects the forge.

Record the intended PR base remote URL from `git remote -v` and the configured upstream for the current branch. Do not infer the base from the checkout's default remote name alone.

Resolve in this order:

1. **Origin.** If `command -v origin` succeeds and Origin can resolve the repository, set `forge = origin { ...existing Origin fields }`.
2. **Azure DevOps.** Else if the intended PR base remote hostname is `dev.azure.com` or ends with `.visualstudio.com`, set `forge = azure-devops { organization, project, repository, targetBranch, sourceBranch, workItemId? }`. Parse organization, project, and repository from the remote URL or user override. Default organization `https://absinc.visualstudio.com`, project `Net`, target branch `dev`, source branch `WI{number}` unless the user specifies otherwise.
3. **GitHub.** Else if the intended PR base remote is GitHub (`github.com`, including `git@github.com:` and `ssh://git@github.com/`), set `forge = github { baseRepo, ...existing gh fields }`. Capture canonical `<base-repo>` and pass `--repo "$base_repo"` to every `gh pr` command. When the head repository is a fork, validate its identity and record `<fork-owner>` and `<head-name>`.
4. **Fail closed.** If the remote URL is empty or is not Origin, Azure DevOps, or GitHub, stop. Do not guess. Do not fall back to another forge.

Dry check. Run `git remote -v`. A GitHub remote such as `https://github.com/cameronjlarsen/open-pstack.git` resolves to `github` when Origin is absent or cannot resolve the repository. An Azure remote such as `https://absinc.visualstudio.com/Net/_git/MyRepo` resolves to `azure-devops` when Origin is absent or cannot resolve the repository. A GitLab, Bitbucket, or other host fails closed.

**Watch and merge.** Watch, land, and merge on `github`, `origin`, and `azure-devops` follow `playbooks/shipping.md`. Never silently use `gh`, GitHub GraphQL, or `skills/engineering-mode/scripts/watch-pr/watch-pr` for an Azure DevOps repository.

---

## GitHub and Origin

Applies when `forge` is `github` or `origin`.

**Titles.** Use Conventional Commits in the form `type(scope): subject`. Use `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, or `perf` as the type. Use the changed area, such as `pstack` or `engineering-mode`, as the scope. Keep the subject short and imperative. Name a real symbol when one carries the change. For example, `fix(pstack): retarget opening-a-pr babysit trigger`. Do not add a trailing period.

**Descriptions.** The PR body is a briefing, not the lab notebook. A reviewer who has the diff should learn why the change exists, what is out of scope, and how you proved the change works. The squash commit body is the PR body.

Use these sections in order. Drop a section when it has nothing to say.

- `## Why`. State the intent and approach in one or two short paragraphs. Do not list SHAs or rebase genealogy. Do not add a "based on main" preamble.
- `## Scope`. Use bullets to list real symbols and paths. Name both sides of a rename or retarget. State what is in and out only when the boundary matters. Do not write a file-by-file essay.
- `## Tradeoffs`. Name only rejected alternatives that a reviewer would otherwise ask about. Skip this section when there was no real choice.
- `## Blast Radius`. In one to three sentences, name who or what the change touches and why the change is safe or risky. State the continuing cost if main stays red without the fix.
- `## Verification`. Name each real run path and its outcome. For a performance change, report one primary number with its unit in `before → after` form. Link the arena or swarm directory for the remaining evidence. Do not include sample-size methodology, swarm recitals, or metric tables.

After these sections, attach videos or screenshots when they prove a claim. Do not paste full SHAs, swarm or arena lane recitals, lever-correction essays, file-by-file checklists, or "CLEAN" verdicts. Put these details in a linked artifact. Do not use `## Summary` or `## Test plan` boilerplate. A commit body does not restate its subject.

**Size and stacks.** Prefer five narrow PRs to one large PR. Rebase each child branch onto its parent's exact tip and freeze the bottom-to-top order. When the head and base repositories are the same, make a base-branch chain. The root PR targets trunk and each child PR targets the parent branch. Create a same-repository child with `origin pr create --status open --base "$parent_branch"` or `gh pr create --base "$parent_branch" --repo "$base_repo"` according to the resolved forge. When the head repository is a fork, every PR targets trunk in the base repository while stacked local branches retain parent ancestry. Create every fork PR with the resolved Origin command. With GitHub, capture the approved PR title and body as `<title>` and `<body>`, then run `gh api --method POST "repos/$base_repo/pulls" -f "title=$title" -f "body=$body" -f "head=$fork_owner:$branch" -f "head_repo=$head_name" -f "base=$trunk" --jq .html_url`; add `-F draft=true` only when the readiness rule requires a draft. A fork-only parent branch cannot be a PR base. Before rebasing, force-pushing, or retargeting an existing child, apply Shipping step 4's disarm-and-confirm rule to that child and every descendant. Retarget a same-repository child with `origin pr edit "$pr" --base "$parent_branch"` or `gh pr edit "$pr" --base "$parent_branch" --repo "$base_repo"`. Retarget a fork child with the resolved Origin command or `gh pr edit "$pr" --base "$trunk" --repo "$base_repo"`. Branch from trunk only for independent work. Rebase on trunk before substantial stack work.

**Readiness.** Open each PR ready by default. With Origin, pass `--status open`. With the GitHub CLI create command, omit `--draft` and pass `--repo "$base_repo"`. With the GitHub fork API above, omit the `draft` field. If repository instructions require a draft until named evidence exists, keep the early PR draft and mark it ready only after recording that evidence. On GitHub, pass `--draft` to the CLI create command or `-F draft=true` to the fork API, then later run `gh pr ready "$pr" --repo "$base_repo"`. Use Origin's documented draft and ready operations when Origin is active. If no draft rule applies and a tool still opens the PR as a draft, run `origin pr ready "$pr"` or `gh pr ready "$pr" --repo "$base_repo"` according to the resolved forge. Run `origin pr view "$pr"` or `gh pr view "$pr" --repo "$base_repo"` before you refer to PR status.

---

## Azure DevOps

Applies when `forge` is `azure-devops`. Recipes live in [`references/ado-pr.md`](../references/ado-pr.md). Read live `user-azure-devops` schemas before calling.

**Titles.** PR title is `WI{number}: {System.Title}`. Not Conventional Commits. Branch commits still use Conventional Commits.

**Descriptions.** Reviewer-first body with `## TL;DR`, `## Review`, and `## Test plan`. Cap at 4000 characters. Skip a Changes table when the diff already shows files. Do not use GitHub `## Why`, `## Scope`, `## Tradeoffs`, `## Blast Radius`, or `## Verification` sections. Full rules in `references/ado-pr.md`.

**Work item ID.** Parse `WI(\d+)` from the branch name (case-insensitive). If the branch does not match and the user did not supply an ID, ask before continuing.

**Duplicate PR.** List active PRs on the source branch before create. If one exists, return its URL and ID. Do not create a duplicate. Work item updates may still run when the user asks.

**Gate 1. Propose PR and stop.** Fetch the work item. Build a change summary in parallel against the forge record, not a hardcoded remote name. `git status`, `git branch -vv`, fetch `refs/heads/$targetBranch` through the intended PR base remote URL, then `git log` and `git diff --stat` from that fetched tip to `HEAD`. Draft title, description, branches, and linked work item. If mirroring is requested and target is not `dev`, run reviewer policy discovery per `references/ado-pr.md` and cache the set. Present the proposal. Do not push. Do not create the PR. Do not transition work item state. Wait for explicit approval. If the user edits title or description, re-present and wait again.

**After Gate 1 approval.** Push the source branch through the intended head remote if needed. Never run `git config`. Never force-push `dev` or `main`. Create the PR with MCP first, CLI fallback. Always associate the work item on create. Recover the link if missing. Verify the PR and capture URL and ID. Mirror reviewers only when requested and target is not `dev`. Apply the cached reviewer set.

**Post-create work item update.** Transition to Code Review when needed. Set Test Notes for QA when empty. Set Feature Flag In Use when unset. Use string `Yes` or `No`, never boolean. Preserve existing Test Notes unless the user asks to overwrite. Details in `references/ado-pr.md`.

**Gate 2. Propose Story Points Actual and stop.** Estimate from the rubric in `references/ado-pr.md`. Present planned vs proposed actual with rationale. If `Custom.StoryPointsActual` is already set, report the value and skip this gate unless the user asks to update. Do not write the field. Wait for explicit approval.

**After Gate 2 approval.** Update `Custom.StoryPointsActual` only. Re-fetch to confirm.

**Output.** Return PR URL and ID, linked work item, type, branches, work item state, Feature Flag In Use, Test Notes summary, Story Points Actual (planned to actual; planned may be unset), and reviewers attached if mirrored.

---

**Babysit.** Opening a PR does not start a babysit. Post the URL and keep building. Finish the phase or stack first. Run a separate babysit pass only when the user asks for one after the whole stack exists, per `babysit.md`. A babysit for each new PR stalls the build and spends checks on commits that later waves restart. Push back when feedback drifts from intent.

A subagent that opens a PR runs `interrogate`, `/deslop`, and `/no-comments`. It returns the URL and does not babysit. Return to the parent.
