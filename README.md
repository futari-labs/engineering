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

The skill verifies the frozen plan and pstack compatibility, reconciles existing issues/PRs/worktrees, and invokes the actual pstack skills and repository-specific playbook. It begins with an integrated vertical slice before running independent tasks in parallel, at most 5 concurrent agents (workers and reviewers) by default, or up to 8 when the human chose more during bootstrap. Each task carries requirement, evaluation, scope, and verification identifiers into its issue, worker brief, PR, and evidence.

Resume a later session with the same `/futari:execute` command. The executor must not regenerate approval or silently weaken the contract to make checks pass.

### Identifiers

Requirements are `REQ-001`, evaluations `EV-001`, and implementation tasks `P-001` (a prefix plus three or more digits). The plan gate rejects any other form, including legacy `JM-` task IDs. GitHub issue and PR titles start with the task ID, as in `P-001: Implement authentication`, and the generated contract CI rejects a PR whose title does not. A GitHub issue number is never a task ID.

### Worktree lifecycle

`/futari:execute` manages worktrees itself; there is no cleanup command to run. Every bootstrapped project gets `.futari/worktrees.mjs`, a frozen helper that is the only way Futari creates or removes a worktree:

- `acquire` creates a worker worktree on branch `futari/P-001`, or a detached reviewer or adversary worktree, under `.futari/worktrees/`. It writes an ownership record (plan, task, role, owner, branch, session, state) into the worktree's own Git admin directory, so the record goes away when the worktree does. On resume, `acquire` recovers the task's existing worktree instead of creating a duplicate.
- `release` marks a worktree done as soon as its PR is merged, its branch is pushed and merge-ready under manual merge, or its review verdict is committed, and removes it in the same call when it is safe. Each `acquire` returns a lease number; a `release` carrying an older lease is refused, so a late release cannot remove a worktree that was just acquired again.
- `sweep` runs before workers start and before every report or pause. It removes released worktrees, and active ones whose session has ended, then reports every worktree it kept with a reason code.

A session is identified by its Claude Code session ID together with its process ID and start time, so a second live process resuming the same session ID cannot take over a task. An acquire records its intent before creating the worktree, so a crash in between is recovered rather than leaving the task stuck.

Removal happens only when every check passes. The remote is queried before the repository-wide lock is taken, and the local checks run again under the lock immediately before a plain `git worktree remove`, which also requires that HEAD has not moved. The worktree must have a valid Futari ownership record for the current plan and task. It must not be the primary worktree, locked, in use (active record of a live session, a process working in it, or a Claude Code chat started in it), or carrying staged, modified, untracked, or valuable ignored files (anything that is not itself a build or cache directory, such as `.env`, even inside a tracked `build/`). Edits hidden by assume-unchanged, skip-worktree, or a stale fsmonitor also block removal. It must have no initialized submodules or nested repositories, and no commits that only it reaches (its HEAD, its HEAD reflog, or per-worktree refs). Its HEAD must be confirmed on the live remote branch or PR head ref with `git ls-remote`, not inferred from local remote-tracking refs. A task worktree must also contain its committed evidence file. The checks follow pstack's `worktree-cleanup` playbook; pstack's `worktree-audit.mjs` runs afterwards as a read-only cross-check, and its suggestions never authorize a deletion. If a worktree's directory has disappeared, its metadata is cleared only when its index holds nothing staged and its HEAD is on the live remote; a moved directory with staged work is reported as `missing` so `git worktree repair` still works. The helper never uses `--force`, `rm -rf`, stash, branch deletion, or `git worktree prune`.

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
tools/worktrees.test.mjs
tools/template.mjs
.github/workflows/validate.yml
```

The bootstrap initializer copies the files stored in `repo-template.json` into the project and appends the Futari block to `CLAUDE.md`. To edit those files, run `node tools/template.mjs unpack <dir>`, edit them, then `node tools/template.mjs pack <dir>`. Projects bootstrapped by older versions are not migrated.

## Local validation

From this engineering repository:

```bash
node tools/validate.mjs
node --test tools/worktrees.test.mjs
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

This is plugin version **1.1.0**. After merging changes to the GitHub repository, existing users can run:

```bash
claude plugin marketplace update futarilabs
claude plugin update futari@futarilabs
```

Restart Claude Code if your running session still shows a cached skill.

This GitHub repository is a usable Claude Code marketplace as soon as it is accessible. Publishing through Anthropic's **official** plugin directory requires a separate submission at https://claude.ai/directory/manage.

## Security and limitations

The plan gate validates approved file digests and task references, not whether the resulting product is correct. Actual evaluation runs, independent reviews, branch checks, and source-of-truth CI evidence are still required. Use GitHub branch rules to prevent bypassing checks. Keep credentials out of committed fixtures and logs. The execution workflow respects the approved merge policy and does not deploy by default.

Worktree cleanup is deliberately conservative, so some worktrees are kept and reported rather than removed:

- Liveness is checked with process IDs on this machine. A worktree held by a session on another host, or by a runtime that sets no `CLAUDE_PID`, stays in use until the user confirms that session ended and the coordinator runs `acquire --adopt`.
- Worktrees with initialized submodules are always kept, because Git refuses to remove them without `--force`.
- An ignored build or cache directory (`node_modules/`, `dist/`, and so on) is treated as rebuildable as a whole, as in pstack. A nested repository with local-only commits inside one would be deleted with it.
- The "chat started here" check covers Claude Code transcripts only. A pinned chat that runs in a Futari worktree without a live process, and was started elsewhere, is not detected.
- An acquire interrupted during checkout leaves its worktree locked; Futari reports it and never unlocks it.
- The helper needs `ps`, or `/proc` on Linux, to read process start times; without either, it changes nothing and exits.
- There is a millisecond window between the last local check and `git worktree remove`. Git's own refusal to remove modified or untracked trees covers part of that window, but not new ignored files.
