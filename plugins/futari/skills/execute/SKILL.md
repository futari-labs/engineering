---
name: execute
description: Execute or resume an approved FutariLabs engineering contract through the installed pstack project playbook, with task traceability, frozen acceptance criteria, and verification evidence.
disable-model-invocation: true
argument-hint: "[resume or task ID]"
---

# Execute the approved FutariLabs contract

The user has explicitly invoked this execution command. Treat `$ARGUMENTS` as a scope hint within the approved contract, never as permission to enlarge it. Work in the main conversation and delegate independent work through supported pstack workflows.

## Entry gate

1. Locate the Git root. Read `CLAUDE.md`, relevant `AGENTS.md`, `.futari/plan.json`, `.futari/approval.json`, all approved `docs/futari/` documents, and `.agents/playbooks/futari-approved-plan.md`.
2. Run `node .futari/plan-gate.mjs verify`. If approval is absent, invalid, or stale, report the precise failure and return to a concrete design/change review. Do not run `approve`, edit hashes, weaken the checker, or reconstruct approval from an assistant's memory.
3. Confirm the approval record is committed, the observed GitHub remote matches the contract, and the default branch contains that approved baseline. Inspect branch/worktree state, open and closed matching issues, PRs, required checks, and `docs/futari/PROGRESS.md` before mutation. Preserve unrelated user changes and other live workers. Run `node .futari/worktrees.mjs sweep` before starting workers, and resume an interrupted task with `acquire`, which recovers its existing worktree.
4. Locate the actually installed pstack root and inspect its manifest/version, `poteto-mode`, and intended playbooks. Run its `skills/poteto-mode/scripts/check-playbooks.mjs` from this repository root. If the installed version differs from the approved one, do read-only compatibility review first and propose a recorded amendment; never silently upgrade the workflow mid-run. If pstack is unavailable or incompatible, report that exact blocker. Do not substitute a homemade imitation and call it pstack.
5. Confirm `gh` authentication, selected models, required tooling, live-test credentials/budgets, and branch rules match the contract. Do not print secret values. A missing tool may be repaired within approved scope; permission failures, missing required reviewers, or unapproved external charges remain blockers. If a new repository needs its first CI run before a required check can be selected, create the first authorized task PR but hold merging until the human has established the agreed rules. Do not change those settings yourself.

## Invoke the real workflow

Invoke the installed `pstack:poteto-mode` skill through Claude's Skill tool with this task, substituting the approved identifiers:

> Execute or resume plan `<planId>` using `.agents/playbooks/futari-approved-plan.md`. The human-approved framing, architecture, eval criteria, task graph, and operational permissions are in `.futari/plan.json`, `.futari/approval.json`, and `docs/futari/`. Verify their digest, load the repository playbook, and copy its steps into the task list before any implementation. Follow the existing task IDs and dependencies. Begin with the approved vertical slice and progress through the agreed completion condition. Carry the exact plan, task, evaluation, scope, and permission references into every worker brief and PR. Use the installed pstack skills for execution and review. Do not redesign or weaken the contract without a reviewed amendment.

Show the actual loaded pstack skill/playbook and plan digest once, then proceed. Reading a file or announcing that pstack is active is not proof that a skill was invoked. If the installed runtime requires the user to invoke pstack directly, provide its real discovered command with the same handoff and pause at that invocation boundary; do not invent a command.

## Continue within the contract

- Treat the repository playbook as the run's outer process. If pstack uses `figure-it-out`, its framing and settled design are supplied by the approved artifacts. Its remaining work is scoped execution and verification.
- Before each task, verify the frozen contract and current dependency state. Reuse issues carrying the exact `Futari-Plan:` and `Futari-Task:` markers. Do not create duplicate issues on resume. Do not infer issue numbers from task IDs.
- Build and independently review one thin vertical slice before increasing parallelism. Any stop or repair limit in the approved contract applies. Continue routine repair without asking again when the existing authority covers it.
- `maxParallelTasks` caps every subagent running at once, counting implementation workers and reviewers or adversaries. It is a ceiling, not a target. If more eligible work waits than the cap allows, tell the user. Never raise the cap yourself: a cap from 6 to 8 is the user's choice, recorded with `parallelismRationale` in a reviewed plan amendment.
- `.futari/worktrees.mjs` owns the worktree lifecycle; only you, the coordinator, run it. Create every worker, reviewer, and adversary worktree with `acquire`. Release each one with `release --lease <lease from the latest acquire>` as soon as its PR is merged or pushed and merge-ready, or its verdict is committed in the evidence file. Use `acquire --adopt` only when the user confirms the session holding a worktree has ended. The helper removes it in that call only when every safety check passes. Never remove a worktree it retained by any other means.
- Issue and PR titles start with the task ID, as in `P-001: Implement authentication`. GitHub issue numbers are not task IDs.
- Give each worker the full task brief from `docs/futari/templates/task-brief.md`, including pstack's installed worker rules when supported. Parent context is not assumed to propagate. Separate implementation and independent review ownership.
- Use the approved eval definitions, fixtures, thresholds, and commands. Record actual outputs/links and code revision. A missing live dependency or an inconclusive result does not pass.
- Each PR uses `docs/futari/templates/pr-body.md`, one task ID, the plan ID, requirement/eval references, and `.futari/evidence/<TASK>.md`. Preserve its exact marker fields, including `Tested-Commit:` and `Verdict:`. Commit code before checks, then add an evidence-only commit. Only that task's evidence and PROGRESS.md may differ since the tested revision; rerun checks when any other inputs change.
- Branch pushes, PR creation, merging, deployments, external charges, and repository settings obey the approved permissions. `mergePolicy: manual` stops at verified merge-ready PRs and identifies dependent work waiting for merge. `after-required-checks` permits merging only after required CI and independent review pass on the actual merge candidate. Do not enable admin bypass, disable required checks, or change branch protection.
- Update `PROGRESS.md` with task-to-issue-to-PR mappings, statuses, tested revisions, blockers, and the next eligible task. Use PR/CI/Git evidence as the authority when the ledger is stale.
- For a material contradiction, new scope, eval weakening, protected-file change, or a missing permission, write a concise change request with impact and recommendation; continue only unrelated approved work. Never regenerate the approval to get through CI.

## Completion and resumption

Do not stop just because an agent says it finished. Reconcile the approved requirement list with shipped/merge-ready changes, required evals, live integration evidence, independent review, and the agreed merge/deployment boundary. Report each task as verified, not verified, blocked, or inconclusive with evidence and next action.

Before every final report, including a pause, run `node .futari/worktrees.mjs sweep`, then pstack's `worktree-audit.mjs` as a read-only cross-check. Report the worktrees removed and each retained worktree with its reason code.

Report completion only when the contract's completion condition is met. If waiting on manual merge or unavailable credentials, state the exact remaining human action and preserve a resume point. A fresh session resumes with `/futari:execute`; re-run the entry gate and reconcile existing work before creating anything.
