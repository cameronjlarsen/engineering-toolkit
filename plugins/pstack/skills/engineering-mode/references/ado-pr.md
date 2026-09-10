# Azure DevOps pull requests

Agent-facing recipes for the `azure-devops` forge arm in `playbooks/opening-a-pr.md`. Read live `user-azure-devops` tool schemas before calling. Fall back to Azure CLI when MCP is unavailable.

## Defaults

Override org, project, target branch, or repository only when the user specifies.

| Setting | Default |
|---------|---------|
| Organization | `https://absinc.visualstudio.com` |
| Project | `Net` |
| Target branch | `dev` (`refs/heads/dev`) |
| Source branch | `WI{number}` (`refs/heads/WI{number}`) |
| PR title | `WI{number}: {System.Title}` |
| Work item link | Required on create |

## Work item fields (Net)

| UI label | Reference name | Notes |
|----------|----------------|-------|
| Work Item Type | `System.WorkItemType` | Fetch before create; drives required fields on state change |
| Title | `System.Title` | PR title source |
| State | `System.State` | Target `Code Review` after create |
| Story Points (planned) | `Microsoft.VSTS.Scheduling.StoryPoints` | Often unset on Dev Task |
| Story Points Actual | `Custom.StoryPointsActual` | User Story and Dev Task |
| Test Notes for QA | `Custom.TestNotesforQA` | Preserve if populated |
| Feature Flag In Use | `Custom.FeatureFlagInUse` | String `Yes` or `No` only. Boolean rejected. |

Set Feature Flag from the change. `Yes` if behind a flag, else `No`. Always string.

### Code Review by type

| Type | Notes |
|------|-------|
| User Story | Planned points usually present; still set Feature Flag In Use |
| Dev Task | Planned points often absent; Feature Flag In Use required with State to Code Review |

## Work item ID resolution

Parse from the current branch with regex `WI(\d+)` (case-insensitive).

| Input | Numeric ID | Branch prefix |
|-------|------------|---------------|
| Branch `WI18954` | `18954` | `WI18954` |
| User says `18954` | `18954` | `WI18954` |
| User says `WI18954` | `18954` | `WI18954` |

If the branch does not match and the user did not supply an ID, ask before continuing.

## PR description

Reviewer-first body. Cap at 4000 characters. Skip a Changes table when the diff already shows files. Do not use GitHub `## Why` or `## Scope` sections.

```markdown
## TL;DR
{2–4 sentences. What changed, why, and the main constraint. Must match the diff.}

## Review
- Start here: {1–3 core files or areas and why they matter}
- Lower priority: {mechanical, generated, wiring, or none}
- Risk: {behavior change, flag/rollout, migration, empty-set, SQL, etc., or low}

## Test plan
- [ ] {scenario that would catch the main risk}
- [ ] {flag-off / rollback / parity if applicable}
- [ ] {tests already run, if any}
```

Lead with outcome and constraint. Name concrete entry-point files. Tie Test plan items to Risk. Do not paste the work item description verbatim.

## Story Points Actual rubric

Start from planned story points when present. If absent, show planned as `unset` and estimate from git signals alone.

| Signal | Use |
|--------|-----|
| Planned points | Baseline when present |
| `git diff --stat` lines/files | Complexity proxy |
| Commit count | Scope indicator |
| Test additions / integration surface | Upward adjustment |
| Scope reduction / mostly config or wiring | Downward adjustment |

Rules. Whole numbers only. Match planned when straightforward. +1 to +3 when more complex (cap 13). -1 to -2 when smaller (floor 1). Always show planned vs proposed actual with 2–3 bullet rationale.

If `Custom.StoryPointsActual` is already set, report the value and skip the story-points gate unless the user asks to update.

## MCP and CLI recipes

Org `https://absinc.visualstudio.com`. Project `Net`. Read live schemas before calling.

### Fetch work item

**MCP** `wit_work_item` action `get`. Fields: `System.Title`, `System.State`, `System.WorkItemType`, `Microsoft.VSTS.Scheduling.StoryPoints`, `Custom.StoryPointsActual`, `Custom.TestNotesforQA`, `Custom.FeatureFlagInUse`.

**CLI fallback:**

```bash
az boards work-item show --id {numeric_id} --organization https://absinc.visualstudio.com --output json
```

### List active PRs on source branch

**MCP** `repo_pull_request` action `list`. Pass both `project` and `repositoryId`. Filter `sourceRefName` `refs/heads/WI{number}`, `status` `Active`.

**CLI fallback:**

```bash
az repos pr list --organization https://absinc.visualstudio.com --project Net --repository {repo-name} --source-branch WI{number} --status active --output json
```

If an active PR exists, return its URL and ID. Do not create a duplicate. Work item updates may still run when the user asks.

### Create PR

**MCP** `repo_pull_request_write` action `create`. Link the work item in `workItems`. Multiple work items use space-separated IDs.

If the work item link is missing after create, recover with project **ID** and repository **GUID** via `wit_work_item_link_write` action `link_to_pull_request`. Resolve repo GUID with `repo_repository` action `get`, or `az repos show --repository {repo-name} --query id -o tsv`.

**CLI fallback.** Prerequisites: `az extension add --name azure-devops --yes` if needed. Set `AZURE_DEVOPS_EXT_PAT` with Code (Read & Write) and Work Items (Read & Write). Extension picks up PAT. No `az login` required.

```bash
az repos pr create \
  --organization https://absinc.visualstudio.com \
  --project Net \
  --repository {repo-name} \
  --source-branch WI{number} \
  --target-branch dev \
  --title "WI{number}: {ticket title}" \
  --description "$(cat <<'EOF'
## TL;DR
...
EOF
)" \
  --work-items {numeric_id} \
  --output json
```

### Verify PR

**MCP** `repo_pull_request` action `get` with `includeWorkItemRefs: true`.

**CLI:** `az repos pr show --id {id} --organization https://absinc.visualstudio.com --project Net --repository {repo-name}`

If work item refs are empty, run WI-link recovery above.

## Watch, disarm, and complete

Shipping on `azure-devops` uses these recipes. Read live `user-azure-devops` schemas before calling.

**MCP `update` cannot complete with expected-head.** `repo_pull_request_write` action `update` can set `autoComplete`, retarget, and other fields, but cannot set `status` `completed` or send `lastMergeSourceCommit`. Immediate land uses REST PATCH below.

### Get PR (watch / preflight)

**MCP** `repo_pull_request` action `get`. Read: `status`, `sourceRefName`, `targetRefName`, `lastMergeSourceCommit.commitId`, `lastMergeTargetCommit.commitId`, `mergeStatus`, `completionOptions.autoComplete`, `completionOptions.mergeStrategy`.

**CLI:** `az repos pr show --id {id} --organization {org} --project {project} --repository {repo-name}`

Map `lastMergeSourceCommit.commitId` to Shipping `<landing-sha>`. Map `targetRefName` to `<trunk>` / `targetBranch` (strip `refs/heads/` when comparing).

### Disable / enable autocomplete

Autocomplete is Azure's merge-when-ready. Disable before verification, rebase, retarget, or immediate complete.

**MCP** `repo_pull_request_write` action `update`, `autoComplete: false`. Re-get and confirm `completionOptions.autoComplete` is false.

**CLI:**

```bash
az repos pr update --id {id} --organization {org} --project {project} --repository {repo-name} --auto-complete false
```

Enable only when the user asked merge-when-ready:

**MCP** `repo_pull_request_write` action `update`, `autoComplete: true`, `mergeStrategy: Squash`, `deleteSourceBranch: false`, `transitionWorkItems: false` unless the user asked otherwise.

### List policies

**CLI:**

```bash
az repos pr policy list --id {id} --organization {org} --project {project} --repository {repo-name} --output json
```

Use policy evaluation status to distinguish pending checks from terminal failures during watch.

### Threads

Babysit uses these recipes. Read live `user-azure-devops` schemas before calling. Never interpolate comment bodies into shell commands — pass `content` as a tool argument.

**List threads**

**MCP** `repo_pull_request_thread` action `list`. Pass `repositoryId`, `pullRequestId`, and `project` when the repository is named. Optional filters: `status`, `authorEmail`, `authorDisplayName`. Use `list_comments` with `threadId` to read a single thread's comments.

**CLI fallback** (when available):

```bash
az repos pr thread list --id {id} --organization {org} --project {project} --repository {repo-name} --output json
```

If the CLI is weak or unavailable, MCP-only is fine.

**Reply**

**MCP** `repo_pull_request_thread_write` action `reply`. Required: `repositoryId`, `pullRequestId`, `threadId`, `content`.

**Update thread status**

**MCP** `repo_pull_request_thread_write` action `update_status`. Required: `repositoryId`, `pullRequestId`, `threadId`, `status` (`Fixed`, `WontFix`, `Active`, `Closed`, `ByDesign`, `Pending`, etc.).

Use `Fixed` when the babysitter addressed the thread. Use `WontFix` or `ByDesign` only with a concrete disproof on the thread.

### Complete with lastMergeSourceCommit

Immediate land requires REST PATCH. Preflight get first; require `lastMergeSourceCommit.commitId` equals `<landing-sha>` and target branch equals trunk.

Resolve repository GUID with `repo_repository` action `get` when needed.

**REST PATCH** (`.visualstudio.com` form). Replace org host, project, repo GUID, PR id, and landing SHA from the forge record:

```bash
curl -sS -u ":$AZURE_DEVOPS_EXT_PAT" -X PATCH \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "lastMergeSourceCommit": { "commitId": "{landing-sha}" },
    "completionOptions": {
      "mergeStrategy": "squash",
      "deleteSourceBranch": false,
      "transitionWorkItems": false
    }
  }' \
  "https://{org-host}/{project}/_apis/git/repositories/{repo-guid}/pullRequests/{id}?api-version=7.1"
```

**`dev.azure.com` form:**

```bash
curl -sS -u ":$AZURE_DEVOPS_EXT_PAT" -X PATCH \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "lastMergeSourceCommit": { "commitId": "{landing-sha}" },
    "completionOptions": {
      "mergeStrategy": "squash",
      "deleteSourceBranch": false,
      "transitionWorkItems": false
    }
  }' \
  "https://dev.azure.com/{organization}/{project}/_apis/git/repositories/{repo-guid}/pullRequests/{id}?api-version=7.1"
```

Use `completionOptions.mergeStrategy` `squash` to match GitHub squash land unless existing `completionOptions` or branch policy already names a strategy — match that strategy instead. If complete is rejected for strategy mismatch, stop and report; do not silently retry another strategy. Never set `bypassPolicy` unless the user explicitly asked.

If PATCH fails because `lastMergeSourceCommit` is stale, return through Shipping step 4 to step 3. Do not complete without that commit.

### Retarget

**MCP** `repo_pull_request_write` action `update`, `targetRefName: refs/heads/{trunk}`.

**CLI:**

```bash
az repos pr update --id {id} --organization {org} --project {project} --repository {repo-name} --target-branch {trunk}
```

### Code Review, Test Notes, Feature Flag

Draft Test Notes from the PR test plan, commands run, and manual QA steps. Reference the PR number. Use `N/A` only when there is truly no QA impact. Do not overwrite `Custom.TestNotesforQA` unless the user requests it.

**MCP** `wit_work_item_write` action `update`. Use `op: "replace"` for each field. Omit `System.State` if already `Code Review`. Omit Test Notes if already populated. Still set Feature Flag when unset.

```text
System.State → Code Review
Custom.TestNotesforQA → PR #{id}. ...
Custom.FeatureFlagInUse → Yes   # or No. String only.
```

**CLI:**

```bash
az boards work-item update \
  --id {numeric_id} \
  --organization https://absinc.visualstudio.com \
  --fields "System.State=Code Review" "Custom.TestNotesforQA=PR #{id}. ..." "Custom.FeatureFlagInUse=Yes"
```

### Update Story Points Actual

Use the user's number if they gave a different value (for example `actual: 3`).

**MCP** `wit_work_item_write` action `update`, path `/fields/Custom.StoryPointsActual`.

**CLI:**

```bash
az boards work-item update \
  --id {numeric_id} \
  --organization https://absinc.visualstudio.com \
  --fields "Custom.StoryPointsActual={proposed}"
```

Re-fetch to confirm `Custom.StoryPointsActual` and `System.State`.

## Mirror dev reviewers (opt-in)

Only when the caller asks. Non-`dev` targets only. No separate approval. Runs under the PR approval gate after create.

Skip when mirroring was not requested, target is `dev` (branch policy adds reviewers), or no enabled Required reviewers policies exist.

**Discovery** (during PR proposal when mirroring is requested). Needs repo GUID first.

```bash
az repos policy list \
  --organization https://absinc.visualstudio.com \
  --project Net \
  --repository-id {repo-guid} \
  --branch dev \
  --output json \
| jq '[.[]
       | select(.type.id=="fd2167ab-b0be-447a-8ec8-39368250530e")
       | select(.isEnabled==true)
       | select(.settings.filenamePatterns==null)
       | {isBlocking, ids: .settings.requiredReviewerIds}]'
```

Iterate every enabled Required reviewers policy. Exclude disabled and path-scoped policies. Build the set. Required when `isBlocking == true`. Optional when false. Dedupe. Required wins. Drop PR author id.

**Apply** (REST PUT, primary). Once per reviewer.

```bash
curl -sS -u ":$AZURE_DEVOPS_EXT_PAT" -X PUT \
  -H "Content-Type: application/json" \
  -d '{"isRequired": true}' \
  "https://absinc.visualstudio.com/Net/_apis/git/repositories/$REPO_ID/pullRequests/$PR_ID/reviewers/$REVIEWER_ID?api-version=7.1"
```

Use `"isRequired": false` for optional reviewers.

**MCP fallback** `repo_pull_request_write` action `update_reviewers` with `reviewerAction` `add`. That path cannot set `isRequired`. Warn when required flags cannot be set because `AZURE_DEVOPS_EXT_PAT` is unavailable.

Report "Attached N required, M optional reviewers" after apply.

## Hard rules

| Rule | Detail |
|------|--------|
| Two approval gates | PR approval before push/create; story points approval before `Custom.StoryPointsActual` |
| Work item link | Always associate on create; recover if missing |
| PR title | `WI{number}: {System.Title}`. Not Conventional Commits. |
| Commit messages | Conventional Commits on the branch |
| No duplicate PRs | Report existing active PR instead of creating another |
| No git config | Never run `git config` |
| No force-push to protected | Never force-push `dev` or `main` |
| Preserve Test Notes | Do not overwrite `Custom.TestNotesforQA` unless the user requests |
| Skip story points if set | Report existing actual unless the user asks to update |
| Mirror reviewers | Only when caller asks; never onto target `dev` |
| Feature Flag In Use | String `Yes` or `No`. Never boolean |
| Immediate complete | REST PATCH with `lastMergeSourceCommit` equal to `<landing-sha>`. MCP `update` cannot complete. |
| No GitHub tools on Azure | Never `gh`, GitHub GraphQL, or `watch-pr` |
| Land does not close work items | `transitionWorkItems` false and no WI field writes unless the user asked |

If the user edits title or description, re-present the PR proposal before proceeding.
