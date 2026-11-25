# Futari Labs Engineering

Reusable interactive engineering planning and approved pstack execution workflows for [futari-labs/engineering](https://github.com/futari-labs/engineering).

| Claude Code command | What it does |
| --- | --- |
| `/futari:bootstrap` | Interactive product discovery, architecture, executable evaluations, independent review, task design, and a **native terminal approval card**. |
| `/futari:execute` | Verifies the approved contract and passes eligible work to the actual installed pstack skills and project playbook. |

Futari is a companion to [Michael Denyer's pstack](https://github.com/michael-denyer/pstack-claude), not a copy of it. This release keeps the existing cross-marketplace dependency `pstack@pstack-claude`.

## Install once per developer

Requirements: Claude Code, Git, Node.js **22+**, and a supported Claude account/provider. GitHub CLI (`gh`) and pnpm are required for the planned workflows where used. Authenticate GitHub before executing issues and PRs (`gh auth login`).

Run in your normal terminal:

```bash
claude plugin marketplace add michael-denyer/pstack-claude
claude plugin marketplace add futari-labs/engineering
claude plugin install futari@futarilabs
claude plugin list
```

If a marketplace is already registered, skip its registration. The Futari plugin declares pstack as a dependency, so Claude Code can install pstack automatically when its marketplace is registered and dependency resolution is permitted. Verify both plugins are enabled; dependency installation has not been verified on every Claude Code version.

Expected plugin identities:

```text
futari@futarilabs
pstack@pstack-claude
```

## Start a product repository

```bash
mkdir my-new-project
cd my-new-project
git init -b main
claude
```

Inside Claude Code:

```text
/futari:bootstrap
```

Tell Claude what to build. Futari asks focused questions, captures requirements and measurable acceptance criteria, designs and reviews the architecture, prepares evaluations and a real first vertical slice, then builds an approved task graph.

For existing work:

```text
/futari:bootstrap resume
```

The planning artifacts are stored in each product repository, principally `docs/futari/`, `.futari/plan.json`, `.agents/playbooks/futari-approved-plan.md`, and evaluation files. A per-project `CLAUDE.md` explains the contract. Project instructions keep pstack's automatic session routing off during interactive discovery.

## Approve in the terminal — no manual approval commands

After the design documents and evaluations have been reviewed and the proposed contract committed locally, Futari runs its readiness checks and shows a concise summary of:

- The exact reviewed commit SHA and plan ID
- Product scope, architecture, and acceptance criteria
- Evaluation examples, thresholds, and baseline state
- The first end-to-end vertical slice and task dependencies
- Risk, parallelism, merge policy, and external spending limits

It then uses Claude Code's **native `AskUserQuestion` interface** to ask:

- **Approve plan** — record the reviewed contract and permit the approved pstack handoff
- **Request changes** — continue design; approve only after another reviewed commit
- **Not now** — leave the plan unapproved

Only an explicit **Approve plan** selection authorizes the skill to run the existing `.futari/plan-gate.mjs approve` operation, commit **only** `.futari/approval.json`, and verify the snapshot. A missing card, error, timeout, non-interactive run, or any other answer **cannot** approve the plan.

The card records a decision; it is not cryptographic identity verification. Claude Code still requires its normal permissions for tool actions. The approval does not authorize deployment, spending above budget, scope expansion, or bypassing required reviews and CI.

The approved baseline must be merged into the product repository's default branch before execution starts. For a protected branch, prepare a bootstrap PR and merge it through the normal checks and review policy. Do **not** bypass branch protection.

## Execute the approved plan

Inside the same product repository:

```text
/futari:execute
```

The skill verifies the frozen plan and pstack compatibility, reconciles existing issues/PRs/worktrees, and invokes the actual pstack skills and repository-specific playbook. It begins with an integrated vertical slice before running independent tasks in parallel, at most 5 concurrent agents (workers and reviewers) by default, or up to 8 when the human chose more during bootstrap. It removes each task's worktree once the work is merged or pushed and merge-ready, and sweeps leftover clean worktrees before reporting. Each task carries requirement, evaluation, scope, and verification identifiers into its issue, worker brief, PR, and evidence.

Resume a later session with the same `/futari:execute` command. The executor must not regenerate approval or silently weaken the contract to make checks pass.

## Plugin layout

```text
.claude-plugin/marketplace.json
plugins/futari/.claude-plugin/plugin.json
plugins/futari/skills/bootstrap/SKILL.md
plugins/futari/skills/bootstrap/scripts/init-project.mjs
plugins/futari/skills/bootstrap/assets/repo-template.json
plugins/futari/skills/bootstrap/references/
plugins/futari/skills/execute/SKILL.md
tools/validate.mjs
.github/workflows/validate.yml
```

The bootstrap initializer uses the existing `repo-template.json` unchanged. At initialization, it adjusts the generated project's `CLAUDE.md` to describe the native approval-card workflow. For projects initialized before v1.0.2, the bootstrap skill updates only the older Futari approval sentence as part of the reviewed contract.

## Local validation

From this engineering repository:

```bash
node tools/validate.mjs
node --check plugins/futari/skills/bootstrap/scripts/init-project.mjs
claude plugin validate ./plugins/futari
claude plugin validate .
```

To test against local source instead of installed plugin cache:

```bash
claude --plugin-dir ./plugins/futari
```

Try both **Request changes** (must not produce an approval file) and **Approve plan** (must record and verify only the reviewed contract). A passing structural CI workflow does not prove the terminal UI or pstack integration works.

## Publish updates

This is plugin version **1.0.2**. After merging changes to the GitHub repository, existing users can run:

```bash
claude plugin marketplace update futarilabs
claude plugin update futari@futarilabs
```

Restart Claude Code if your running session still shows a cached skill.

This GitHub repository is a usable Claude Code marketplace as soon as it is accessible. Publishing through Anthropic's **official** plugin directory requires a separate submission at https://claude.ai/directory/manage.

## Security and limitations

The plan gate validates approved file digests and task references, not whether the resulting product is correct. Actual evaluation runs, independent reviews, branch checks, and source-of-truth CI evidence are still required. Use GitHub branch rules to prevent bypassing checks. Keep credentials out of committed fixtures and logs. The execution workflow respects the approved merge policy and does not deploy by default.
