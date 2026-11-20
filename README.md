# Futari Labs Engineering

Reusable engineering workflows for **[futari-labs/engineering](https://github.com/futari-labs/engineering)**, packaged as a Claude Code plugin marketplace.

| Command | Purpose |
| --- | --- |
| `/futari:bootstrap` | Discuss the product, architecture, evaluations, and task plan; prepare a concrete package for human approval. |
| `/futari:execute` | Verify the approved contract and execute its tasks through the installed pstack workflows. |

The Futari plugin depends on **[Michael Denyer's pstack](https://github.com/michael-denyer/pstack-claude)**. pstack remains independently maintained. This repository contains Futari's skills, templates, approval checks, and execution handoff.

## Populate this repository

Create an empty GitHub repository named **engineering** under **futari-labs**. Choose the visibility you want. For this first upload, leave the GitHub README, license, and gitignore initialization options unchecked.

Download `futari-labs-engineering.zip`, then run these commands in your regular terminal. They assume the ZIP is in Downloads and that you have not already cloned the new repository:

```bash
mkdir -p ~/Documents/Projects
cd ~/Documents/Projects
git clone https://github.com/futari-labs/engineering.git
cd engineering
unzip ~/Downloads/futari-labs-engineering.zip -d .
node tools/validate.mjs
git add .
git commit -m "Add Futari Labs engineering plugin"
git branch -M main
git push -u origin main
```

If you already have a local clone, extract the ZIP directly into that clone and review the changes before committing. Do not nest another `engineering` or `FutariLabs-Engineering-Plugin` folder inside the repository.

**The ZIP contains repository-root paths.** `.claude-plugin/marketplace.json`, `.github/`, `plugins/`, `tools/`, and this README must all be at the repository root. `git add .` includes the hidden configuration folders. In macOS Finder, press **Command + Shift + .** to show hidden files if copying them manually.

The archive contains source files only; it does not contain a `.git` directory, installed plugin caches, account settings, or an application project's approved plan. Publishing the files is a separate action performed by the commands above.

## Install after the repository is published

Use a current Claude Code version that supports plugin dependencies. The project initializer and supplied validation scripts require **Node.js 22 or later**.

In your regular terminal, register both marketplaces and install Futari:

```bash
claude plugin marketplace add michael-denyer/pstack-claude
claude plugin marketplace add futari-labs/engineering
claude plugin install futari@futarilabs
claude plugin list
```

Skip a marketplace-add command when that marketplace is already registered. If you previously registered `futarilabs` from a local directory, inspect the entry in `/plugin` and replace its source with this GitHub repository before adding another entry with the same marketplace name.

The plugin declares `pstack@pstack-claude` as a dependency and the marketplace permits that cross-marketplace dependency. Claude Code can resolve missing dependencies when the upstream marketplace is registered and permitted. If pstack is already enabled in the relevant scope, reuse it. Any organization-level plugin policy still applies.

For installation inside Claude Code instead of the shell, the equivalent commands are:

```text
/plugin marketplace add michael-denyer/pstack-claude
/plugin marketplace add futari-labs/engineering
/plugin install futari@futarilabs
```

Private repositories require Git credentials with access to `futari-labs/engineering`.

## Use in a product repository

Open Claude Code in the product repository you want to build:

```bash
cd /path/to/your/product-repository
claude
```

Begin with:

```text
/futari:bootstrap
```

Describe the product and work through requirements, architecture, evaluation cases, risks, and task dependencies. The skill creates the planning artifacts in that product repository. Review the final package and follow the human-operated approval commands that the skill provides.

After approval, start implementation or resume an approved run with:

```text
/futari:execute
```

The execution workflow verifies the frozen contract, inspects the actual installed pstack capabilities, reconciles existing issues and PRs, and starts the approved work. A first end-to-end vertical slice precedes wider parallel implementation. Merge policy, external spending, and other operational boundaries come from the approved plan.

The shared `engineering` repository distributes the plugin. Each product repository owns its own requirements, approval record, execution state, and evidence.

## Validate and develop locally

From this engineering repository:

```bash
node tools/validate.mjs
node --check plugins/futari/skills/bootstrap/scripts/init-project.mjs
claude plugin validate ./plugins/futari
claude plugin validate .
```

The first two commands check the packaged structure and JavaScript syntax. The `claude plugin validate` commands use Claude Code's native validators on your machine.

To load the local plugin for a development session:

```bash
claude --plugin-dir ~/Documents/Projects/engineering/plugins/futari
```

The pstack dependency must be available to that session. Do not claim a live pstack execution succeeded solely because the package's structural checks passed.

## Repository contents

| Path | Purpose |
| --- | --- |
| `.claude-plugin/marketplace.json` | Marketplace catalog named `futarilabs`. |
| `plugins/futari/.claude-plugin/plugin.json` | Plugin manifest named `futari`, with its pstack dependency. |
| `plugins/futari/skills/bootstrap/` | Interactive skill, references, initializer, and repository templates. |
| `plugins/futari/skills/execute/SKILL.md` | Approved-plan verification and pstack execution handoff. |
| `tools/validate.mjs` | Structural validation for the plugin package. |
| `.github/workflows/validate.yml` | Repository CI for structural and syntax validation. |
| `.gitignore` and `.gitattributes` | Local-file exclusions and consistent text line endings. |

The `repo-template.json` asset contains the product-repository plan gate, CI inspector, pstack project playbook, planning documents, worker briefs, and evidence templates. These files are created in the product repository by bootstrap.

## Updates and existing installations

Keep the marketplace entry and plugin manifest versions in sync when publishing a new plugin release. This repository package is **1.0.1**.

After pushing an update:

```bash
claude plugin marketplace update futarilabs
claude plugin update futari@futarilabs
```

The repository slug `futari-labs/engineering`, marketplace ID `futarilabs`, and plugin ID `futari` have different roles. They intentionally differ; the installed command namespace remains `/futari:...`.

Earlier personal skills named `/futari-bootstrap` and `/futari-execute` are separate copies. After confirming that the plugin commands work, archive those old copies if you want to maintain only the plugin version. The plugin package does not remove them.

## Verification and limits

This repository package was checked for valid JSON, expected plugin layout, JavaScript syntax, complete archive contents, and preservation of the existing skill/template payload. A live Claude Code installation, dependency resolution, and GitHub CI run must still be verified in your environment.

The product-repository guards detect changes to approved files, missing traceability, stale evidence, and out-of-scope changes. Meaningful evaluations and independent review remain necessary for product correctness. Required branch checks and repository permissions provide the merge controls. A human-managed contract amendment is separate from an ordinary implementation PR.

## Primary documentation

- [Claude Code plugin manifest](https://code.claude.com/docs/en/plugins-reference)
- [Claude Code plugin dependencies](https://code.claude.com/docs/en/plugins/dependencies)
- [Claude Code marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [pstack Claude Code port](https://github.com/michael-denyer/pstack-claude)
