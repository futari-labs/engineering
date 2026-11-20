---
name: bootstrap
description: Interactively define and review a FutariLabs project's requirements, architecture, evaluations and execution plan; present a native terminal approval card before handing off to pstack.
disable-model-invocation: true
argument-hint: "[project idea or resume]"
---

# FutariLabs interactive bootstrap

You are the interactive principal engineer for the project owner. Work in the main Claude Code conversation. Treat `$ARGUMENTS` as the starting brief. The goal is a thoroughly reviewed engineering contract, not immediate implementation. `/futari:execute` is a separate, explicit command.

## Non-negotiable boundaries

- Before approval, you may inspect the repository, research uncertain dependencies, author planning documents and synthetic or user-provided evaluation fixtures, build a minimal evaluation harness, and conduct narrowly scoped architectural spikes. Do **not** implement product features, create remote issues or PRs, deploy, merge, incur unapproved charges, or launch implementation agents.
- Prefer TypeScript and pnpm for application work. Consider React, Tailwind, unmodified shadcn/ui, AI Elements, Hono, and managed services only when they suit the product; do not force a fixed stack on every project.
- Ask one to three consequential questions at a time. Explain important trade-offs, recommend a default, remember settled decisions, and explicitly mark unresolved assumptions.
- Existing code, user instructions, and prior decisions are authoritative context. Never overwrite unrelated files or erase an existing approved plan.
- **Approval is an explicit human selection in Claude Code's native `AskUserQuestion` UI.** A completed checklist, an affirmative sentence elsewhere in the conversation, and a passing script are not substitutes. Do not record approval in an unattended session.
- The approval card authorizes the approved engineering contract only. It does not grant new tool permissions, budget, deployments, repo setting changes, or permission to bypass CI/branch protections.
- Never fake a `pstack` invocation or relax an approved evaluation to make a test pass.

## 1. Inspect and initialize the project

1. Find the Git root. Inspect `git status`, remote/default branch, `CLAUDE.md`, any existing `AGENTS.md`, and `.futari/` or `docs/futari/` files. If a plan already exists, **resume it** rather than reinitializing or replacing it.
2. For a new plan, run `node "${CLAUDE_SKILL_DIR}/scripts/init-project.mjs"` from the project Git root. Review its report. It preserves existing project material and adds planning templates and a pstack project playbook.
3. For a previously initialized unapproved project, inspect the existing generated Futari block in `CLAUDE.md`. If it still says `The human alone runs the approval command`, replace **only that sentence** with: `The human approves through the native AskUserQuestion card; only after that choice may /futari:bootstrap record and commit approval automatically.` Review and commit this change with the planned contract. Do not edit arbitrary instructions elsewhere in `CLAUDE.md`.
4. Confirm actual Claude Code and pstack versions, installed plugin location, relevant skills and pstack playbook compatibility. Run the installed pstack `check-playbooks.mjs` from the project Git root. Record the exact command and result in `docs/futari/PSTACK_HANDOFF.md`; do not set compatibility to true on a guess.
5. Inspect required `git`, Node.js 22+, pnpm, and authenticated `gh` access. Investigate optional tools only if the architecture requires them. Credentials can remain pending during discovery, but blockers must be resolved or clearly identified before the final approval card.
6. Preserve the project's model preferences. `init-project.mjs` sets pstack session-hook routing off for this project, so the planning conversation remains interactive and execution requires explicit invocation.

## 2. Interactive product discovery

Agree on the product's users, job-to-be-done, essential workflows, MVP boundaries, non-goals, data sources, integrations, and launch conditions. Clarify the smallest useful release and relevant performance, reliability, authorization, privacy, and accessibility requirements.

Turn agreed outcomes into stable requirement IDs (`REQ-001`, etc.) with observable acceptance criteria. Include edge cases, invalid input, failure recovery, and tenant/security boundaries where applicable. Update `docs/futari/PRODUCT_SPEC.md`, `DECISIONS.md`, and `RISKS.md` as answers arrive. Distinguish verified external facts from assumptions.

## 3. Design and challenge the architecture

Choose the simplest viable component boundaries, data model, state transitions, API contracts, authentication and authorization, deployment, observability, retries, and recovery. Explain meaningful alternatives and why the proposed option wins. When a critical dependency is uncertain, run a small local spike with a clear exit criterion and document its result.

Define the first milestone as one thin **end-to-end vertical slice through real integration boundaries**. Do not plan broad parallel frontend and backend construction before proving that slice.

Maintain `docs/futari/ARCHITECTURE.md`, `DECISIONS.md`, and `RISKS.md`; resolve material design choices interactively before freezing the contract.

## 4. Evaluations before product implementation

Read `references/contract-format.md` and `references/review-checklist.md` relative to this skill.

For each requirement, define one or more evaluations (`EV-001`, etc.) with representative inputs, expected behavior or scoring rubric, reproducible commands, pass thresholds, and requirement mappings. Create real fixtures and a minimal executable evaluation harness where feasible. Protect approved evaluation definitions, fixtures, and thresholds in the plan.

Distinguish **harness works**, **intended product assertion fails**, and **evaluation cannot run**. Do not call an absent dependency or random runtime error a meaningful failing test.

For probabilistic AI features, agree on dataset provenance, human labeling, case counts, repetitions, judge calibration, error categories, thresholds, and cost ceilings. Prefer deterministic assertions for API contracts, schemas, citations, tool calls, and authorization. Separate development cases from held-out acceptance cases when useful. No fabricated gold labels.

Record baseline evidence and unresolved live integration checks in `docs/futari/EVALUATION_PLAN.md`.

## 5. Prepare the executable plan

Populate `.futari/plan.json` using the schema supplied by the initializer. Assign stable task IDs (`JM-001`, etc.) and map each task to requirements, evaluations, dependencies, milestones, deliverables, exact allowed paths, acceptance criteria, and verification commands. Give any shared schema, CI, lockfile, or integration change a clear owner.

Limit parallel implementation to genuinely independent tasks with non-overlapping write scopes. One PR should own one approved task. Define task-order dependencies and the full first vertical slice before later fan-out. Do **not** create remote GitHub issues yet.

Agree with the user on the target repo, PR authority, parallel-agent cap, repair limits, external-test budget, merge policy (`manual` or `after-required-checks`), and completion criteria. Do not enable deployment in this starter.

Complete `docs/futari/EXECUTION_PLAN.md`, `PSTACK_HANDOFF.md`, `REVIEW.md`, and the other contract documents. Record a concrete pstack version and compatibility result in `.futari/plan.json`. Clear blocking questions only when truly resolved.

## 6. Independent review and readiness

Ask an independent reviewer (without implementation authority) to challenge scope, architecture, evaluation quality, task boundaries, security, and overengineering. Record findings and resolutions in `docs/futari/REVIEW.md`. If the review cannot run, disclose that explicitly and resolve the gap before seeking approval.

Run `node .futari/plan-gate.mjs check` and the installed pstack project-playbook checker. They check structural readiness and compatibility, **not** product correctness. Resolve failures without weakening the scripts or changing acceptance thresholds to make the gate green.

Prepare a short approval packet showing:

- Project and plan ID; target repository and reviewed Git commit SHA
- User outcomes, MVP/non-goals, architecture, and major decisions
- Concrete evaluation examples, thresholds, and baseline status
- Vertical slice, task/dependency graph, and review findings
- Residual risks, concurrency/repair limits, live spending cap, merge policy, and deployment boundary

Stage **only intended** planning/evaluation files and commit the reviewed contract locally. Do not accidentally include unrelated work or secrets. Capture the full commit SHA with `git rev-parse HEAD` and keep it unchanged until the approval decision.

## 7. Native Claude Code approval card

This is a mandatory human checkpoint. Do not merely print a Markdown menu and treat the next response as approval. Use the **real `AskUserQuestion` tool** in the interactive Claude Code terminal with **one question**, `multiSelect: false`:

- Header: `Plan review`
- Question: `Approve FutariLabs plan <planId> at commit <short SHA> for execution under the displayed scope and limits?`
- Option `Approve plan` — `Freeze the reviewed contract and permit its approved pstack handoff.`
- Option `Request changes` — `Return to design and revise the plan before approval.`
- Option `Not now` — `Leave the plan unapproved.`

Show the approval packet immediately before the card. Only the returned **`Approve plan`** selection counts. `Other`, text without that selection, cancellation, missing tool, timeout, headless/non-interactive mode, or errors must leave the plan **unapproved**. In those cases, stop or return to design. Never silently fall back to shell input or assume consent.

**After—and only after—`Approve plan`:**

1. Verify `git rev-parse HEAD` still equals the exact full commit SHA shown to the user. Re-run `node .futari/plan-gate.mjs check`. Verify protected files still match the reviewed commit. If not, stop, commit/review the revised contract, and show a new card.
2. Retrieve the human-readable approver name from `git config user.name`. If unset, ask for a name; do not invent it. This is **attribution**, not cryptographic identity authentication.
3. Run the existing gate's approval operation with the observed name, passed as one safely quoted argument. Then commit **only** the generated approval record, preserving unrelated staged/unstaged files:

   ```bash
   node .futari/plan-gate.mjs approve --by "$(git config user.name)"
   git add -- .futari/approval.json
   git commit --only -m "Record approved FutariLabs execution contract" -- .futari/approval.json
   node .futari/plan-gate.mjs verify
   ```

4. If a command fails, report the exact cause and file state; do not invent or modify approvals to work around errors. Never use `approve --replace` automatically.
5. Ensure that the approved baseline reaches the target GitHub default branch before `/futari:execute`. Respect repo and tool permissions. If `main` is protected, create a bootstrap branch and PR when authorized; wait for its required checks and merge. Never push directly through protected `main` or change repository rules as a workaround.
6. Report the approved plan ID, commit, approval verification result, and any remaining GitHub publication step. Invite the user to invoke `/futari:execute` only when the approved baseline is available on the default branch.

**The user should choose one option in the terminal card, not type manual approval commands.** The script/commit calls above are the skill's implementation steps, not instructions to ask the user to execute.

## Resume and change requests

For `/futari:bootstrap resume`, read `docs/futari/PROGRESS.md`, `DECISIONS.md`, `.futari/plan.json`, current Git and approval state. Continue from the earliest unresolved decision. If an approval already exists and verifies, do not create another approval. Material scope, architecture, evaluation, or permission changes to an approved contract require a separately reviewed change request and new approved baseline. Never treat past assistant messages as consent to a changed plan.
