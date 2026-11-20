---
name: bootstrap
description: Interactively define and review a new FutariLabs project's requirements, architecture, executable evaluations, and task plan before an approved pstack handoff. Use when the user invokes this command to bootstrap or resume design.
disable-model-invocation: true
argument-hint: "[project idea or resume]"
---

# FutariLabs interactive bootstrap

Work in the main conversation with the project owner. Treat `$ARGUMENTS` as the starting brief. Keep the conversation open until the engineering contract is concrete and reviewed. This command prepares the project; `/futari:execute` starts implementation later.

## Boundaries throughout this session

- Before approval, allow research, repository inspection, planning documents, synthetic or explicitly provided evaluation fixtures, a minimal evaluation harness, and local experiments needed to test a named architectural risk. Do not build product features, create remote issues/PRs, merge, deploy, spend money, or fan out implementation workers.
- Use TypeScript for application and evaluation code and pnpm as the proposed package manager. Consider React, Tailwind, official shadcn/ui or AI Elements, Hono, and managed infrastructure when relevant. Confirm fit; do not impose this entire stack on every product. The supplied `.mjs` files are dependency-free process tooling.
- Ask one to three consequential questions per turn, propose a recommendation, and record answers. Do not turn every routine decision into an approval request. Reuse settled answers. Label remaining assumptions.
- Read existing repository instructions before adding to them. Preserve unrelated files and decisions. Do not treat an empty template, passing syntax check, or agent-written claim as human approval.
- Keep implementation blocked until the human creates `.futari/approval.json` for the final committed plan. Never run the `approve` command, fabricate that record, or edit an approval on the human's behalf. The human then explicitly invokes `/futari:execute`.

## 1. Establish the workspace and inspect capabilities

1. Find the Git root and inspect status, remotes, existing instructions, and existing `docs/futari/` / `.futari/` files. If a plan exists, resume from it; do not reset it. If an approval exists, verify it and discuss the requested change instead of starting over.
2. For a new plan, run `node "${CLAUDE_SKILL_DIR}/scripts/init-project.mjs"` from the Git root. This adds the planning templates and project playbook without overwriting existing project material. Read its output; resolve any reported conflicts before proceeding.
3. Confirm installed Claude Code and pstack versions and locate the actual plugin root from installed-plugin metadata or the skill listing. Read its `poteto-mode`, `setup-pstack`, project-playbook checker, and any intended execution skill. Never guess cache paths or claim a skill was invoked because its source was read.
4. Verify pstack supports standalone `.agents/playbooks/` files. Run its actual `check-playbooks.mjs` from this repository root. Record version, path, command, and result in `docs/futari/PSTACK_HANDOFF.md`. Only set `pstack.compatibilityVerified` true after success.
5. The initializer preserves/copies model selections into the project's model sheet and sets `session hook: off`, so explicit invocation controls routing. Check that your installed pstack supports that setting. If not, use its documented setup workflow; do not edit installed plugin code. User instructions to remain in discovery apply even if a routing hint was already injected.
6. Inspect `git`, `node`, `pnpm`, and authenticated `gh` access without printing credentials. Record only prerequisites the chosen workflows actually require; inspect optional `bun`/model dependencies when selected. Missing execution credentials need not stop the design conversation, but must be resolved before approval or named as a blocking question.

## 2. Discover the product and its acceptance criteria

Start with the brief if one was supplied; otherwise ask what the user wants to build and for whom. Clarify the primary job, first user journey, value proposition, constraints, MVP/non-goals, launch environment, data sources, integrations, and nonfunctional expectations. For a UI, agree on key screens, states, and component policy before coding.

Turn outcomes into stable `REQ-001` identifiers with observable acceptance criteria. Cover happy paths, invalid inputs, failure recovery, relevant authorization/tenant boundaries, and an explicit completion condition. Separate evidence from guesses and distinguish user acceptance from engineering checks. Research uncertain third-party capabilities from primary documentation.

Maintain `PRODUCT_SPEC.md`, `DECISIONS.md`, and `RISKS.md` as answers arrive. Resolve only material ambiguities; record harmless implementation choices for the executor.

## 3. Design the architecture and reduce the largest risks

Propose the simplest viable shape. Document component ownership, data model, state transitions, API contracts, external services, deployment, security, reliability, observability, and recovery as relevant. Explain the few meaningful alternatives and what would make you choose differently.

Do not freeze a design whose critical external dependency has not been investigated. Use a small time-bounded local spike where uncertainty warrants it; identify its exit criterion and keep throwaway experiments separate from production. Preserve results and cleanup decisions.

Make the first implementation milestone one thin end-to-end vertical slice through the real boundaries. Later tasks may run in parallel only after this slice passes. Avoid building independent frontend/backend shells that have never integrated.

## 4. Create evaluations before product implementation

Read `references/contract-format.md` and `references/review-checklist.md` relative to this skill.

For every requirement, create one or more `EV-001` evaluation definitions with input/fixture, expected behavior or scoring rubric, executable command, pass rule, and requirement mapping. Write real test/evaluation fixture files and a minimal runnable harness where feasible. Add the approved definitions, fixtures, and scoring/threshold files to `protectedFiles`.

Distinguish three states explicitly: (a) fixture/harness validation passes; (b) product assertions fail for the intended missing behavior; (c) evaluation cannot run because a dependency or credential is missing. Do not call a missing executable or arbitrary runtime error a useful failing test. Do not claim product quality from a fixture-only run.

For probabilistic AI features, define the dataset and its origin, sample counts, repetitions, failure categories, model/judge configuration, score aggregation, uncertainty, cost ceiling, and thresholds with the user. Use deterministic checks for schemas, citations, authorization, and tool contracts where possible. Calibrate a judge on human-labeled examples before treating it as a gate. Separate development cases from held-out acceptance cases as appropriate; do not suggest fabricated gold labels are verified truth.

Use a small, disclosed, budgeted live smoke test for integration assumptions and deterministic tests for routine CI. Mark planned live checks honestly if they require later infrastructure. Protect regression inputs and pass criteria; product implementations may be added later without weakening them.

## 5. Prepare an executable contract

Populate `.futari/plan.json` using its exact schema. Create stable `JM-001` task IDs and map each to requirements, evals, prerequisites, deliverables, allowed files/directories, acceptance criteria, and exact verification commands. Separate shared schema/package-lock/CI work into owned tasks before independent workers edit dependent areas.

Use exact file names or directory prefixes ending `/` in `allowedPaths`. Avoid repository-wide ownership. Include all real output paths, including tests and necessary lockfiles. One implementation PR owns one task. Do not create GitHub issues yet.

Complete the seven documents in `docs/futari/` and the machine-readable contract without duplicating conflicting sources of truth. The JSON defines IDs, dependencies, scope, permissions, and check commands; the documents explain product behavior and decisions. Resolve all blocking questions before declaring readiness.

Agree once on operational authority: target repository/visibility, creating issues and PRs, branch pushes, maximum parallel tasks, repair/budget limits, merge policy, and deployment boundaries. For a fully unattended multi-task run, ask whether in-scope PRs may merge after the required checks and independent review; otherwise choose `manual` and explain the dependency pauses. Deployment stays off unless explicitly changed in the reviewed contract.

## 6. Review the whole package, then hand approval to the human

Use an independent reviewer with the actual artifacts to challenge requirement coverage, architectural seams, eval quality, task boundaries, and overengineering. Scale the number of reviews to project risk. The reviewer must not implement features. Record findings, resolutions, and residual risks in `docs/futari/REVIEW.md`. If an independent review cannot run, disclose it and leave approval readiness unresolved until the user decides how to handle it.

Run `node .futari/plan-gate.mjs check`. Fix real gaps; never change the checker just to make the plan pass. This validates structure and references, not architectural correctness or test results. Re-run the installed pstack project-playbook checker after any playbook change.

Present a short review packet: product/non-goals; architecture decisions; concrete eval examples and thresholds; vertical slice; task/dependency summary; risks; exact autonomy permissions; and evidence of the two compatibility/readiness checks.

Prepare a local commit containing the reviewed contract and its protected files. Stage only the intended bootstrap/evaluation files; do not scoop up unrelated work. Do not push or create remote issues at this stage. Show the commit and relevant diff for review. Any edit after this commit requires another reviewed commit before approval.

Ask the user to approve the concrete package by running these commands in a terminal at the repository root (replace <approver> with the human approver name):

```bash
node .futari/plan-gate.mjs approve --by "<approver>"
git add .futari/approval.json
git commit -m "Record approved FutariLabs execution contract"
```

Explain that the approval binds the current committed contract, and that `approve` records attribution rather than cryptographically authenticating it. Do not run these approval commands yourself. The approval record must reach the default branch before implementation PRs use the CI gate; help prepare the exact push or empty-repository creation command for the user, based on the observed remote and intended visibility.

End with the next command `/futari:execute`. It may run in a fresh Claude Code session in the same repository. It must re-read disk state and actual GitHub state before execution. Do not invoke this manual-only skill automatically.

## Resume

On a later `/futari:bootstrap resume`, read `PROGRESS.md`, `DECISIONS.md`, `.futari/plan.json`, and any approval before asking questions. Continue from the earliest unresolved design decision. Do not interpret previous assistant summaries as new approval. An approved-contract change needs an explicit revision and a newly reviewed baseline; record it in `docs/futari/CHANGE_REQUEST.md` first.
