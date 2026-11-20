# Contract authoring reference

## Contents

1. Sources of truth
2. Contract fields
3. Evaluation definitions
4. Scope and milestones
5. Frozen files and approval
6. Completion evidence

## Sources of truth

`.futari/plan.json` is the machine-readable index and scope contract. Product documents explain the agreed behavior and architecture. They must agree. `.futari/approval.json` is written by the human-operated approval command and is not itself a protected input (it would create a hash cycle). `PROGRESS.md` and per-task evidence are mutable observations, not changes to the requirements.

## Contract fields

Use `schemaVersion: 1`; a stable project-specific `planId` (for example `customer-search-v1`); `projectName`; and `repository` in `OWNER/REPO` form. Set `pstack` to the observed plugin ID/version, `.agents/playbooks/futari-approved-plan.md`, and a compatibility result actually obtained from the installed checker. List all frozen files in `protectedFiles`.

Create `requirements` entries with `id`, `description`, and nonempty `acceptanceCriteria`. Create `evaluations` entries with `id`, `requirementIds`, `description`, `kind`, `passRule`, and `command`. Create `tasks` entries with `id`, `title`, `requirementIds`, `evalIds`, `dependsOn`, `allowedPaths`, `acceptanceCriteria`, `verificationCommands`, and `milestone`. `verticalSliceTaskIds` names the thin first milestone and may not depend on later work. All requirement/evaluation/task references must resolve. Dependencies must form an acyclic graph.

Leave `blockingQuestions` empty only after consequential uncertainties are resolved or explicitly accepted with a documented mitigation. Use `permissions` for `createIssues`, `pushBranches`, `openPullRequests`, `mergePolicy` (`manual` or `after-required-checks`), and `deploy` (false in this development starter). Require a concrete `completionCondition`, `maxParallelTasks` from 1 to 8, `maxRepairAttemptsPerTask` from 1 to 10, and `liveEvaluationBudget` with a three-letter uppercase currency and nonnegative `maxSpend`. A budget of zero authorizes no external evaluation spending. Record service scopes and final acceptance behavior in the handoff. Defaults are proposals until the human approves the whole package.

The checker deliberately rejects placeholder IDs/text and incomplete maps. It does not execute test commands or decide whether the architecture is sound. Add no custom parser exemptions to pass an unfinished plan.

## Evaluation definitions

For a deterministic feature, write a test that would fail if the required behavior were missing or wrong. For AI quality, preserve input, provenance, expected evidence/rubric, scoring function/judge settings, sample count, repeated trials, and threshold. Define missing-result and evaluator-error handling. Use distributions/confidence where useful; avoid pretending a tiny set proves a universal percentage guarantee.

Example of the desired specificity, to adapt rather than copy as a product requirement:

- Requirement: every returned quote has a retrievable source and a supporting passage.
- Deterministic checks: required schema fields exist; referenced result IDs came from the actual tool response; fabricated IDs fail.
- Quality check: on an approved labeled set, score whether the passage supports the answer using an agreed rubric and human calibration.
- Failure checks: tool timeout, no results, conflicting sources, and stale source data produce the agreed fallback.

Approve actual numbers and datasets with the user. Keep provisional synthetic examples labeled. A passing schema check does not prove groundedness, and a fixture run does not prove a live integration.

## Scope and milestones

`allowedPaths` entries are either exact repository-relative file paths (`package.json`) or subtree prefixes ending `/` (`src/search/`). Do not use arbitrary glob expressions. Keep scopes narrow enough to detect unrelated work. Include test paths and any necessary shared lockfile explicitly; serialize tasks that need the same shared file.

The CI gate allows the task's own `.futari/evidence/<TASK>.md` and `docs/futari/PROGRESS.md` as operational metadata in addition to its explicit scope. Protected contract files remain immutable even if a task lists them in its scope.

One PR represents one task. Use a separate task for shared foundations before parallel work. A vertical slice can consist of several sequential tasks, but later expansion waits for all of their required checks and integration evidence. Avoid making all tasks depend on every other task; use actual dependencies and interface contracts.

## Frozen files and approval

The supplied gate freezes the plan index, seven design/handoff documents, root `CLAUDE.md`, project model/routing sheet, project playbook, gate and CI scripts, and contract CI workflow. Include the actual eval definitions, golden fixtures, scoring/threshold files, and any additional critical test configuration in `protectedFiles` before approval. Do not freeze volatile run logs or product source that must change during implementation.

The human approval command checks that every protected input matches its committed HEAD bytes, then records a SHA-256 digest and commit. Commit the resulting approval record separately and put this baseline on the default branch before implementation PRs. A changed protected file needs a deliberate new revision and approval, never a worker's automatic hash refresh.

CI compares PR content with the base branch's approved snapshot using the base branch's checker. This prevents an ordinary product PR from approving its own contract changes. Contract amendments therefore require a separately reviewed maintainer workflow. Finish or pause affected work, explain the changed requirements/evals and affected tasks, review the amendment, and establish a new approved baseline through the repository's authorized governance process. Do not turn off checks or use admin bypass to disguise a plan amendment as implementation.

## Completion evidence

Each task records issue/PR, exact tested code revision, eval IDs, commands, results, live integration evidence or blockers, independent reviewer verdict, and remaining risks. Its evidence file must contain single `Futari-Plan:`, `Futari-Task:`, `Tested-Commit:`, and `Verdict:` lines. Commit code, run its checks, then record the result in an evidence-only commit. CI checks that only that evidence file and PROGRESS.md differ since the tested revision. Additional source/config/test changes require fresh checks and a new tested revision. At final acceptance, build a requirement-to-task-to-eval-to-evidence table. Check behavior across the integrated product, not only isolated task tests.

Approval hashes show integrity relative to a recorded snapshot; they do not authenticate a person's identity or prove semantic correctness. External branch rules, permissions, and honest review are still necessary.
