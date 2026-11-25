#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const market = JSON.parse(read('.claude-plugin/marketplace.json'));
const manifest = JSON.parse(read('plugins/futari/.claude-plugin/plugin.json'));
assert.equal(market.name, 'futarilabs');
assert.equal(market.plugins[0].source, './plugins/futari');
assert.equal(manifest.name, 'futari');
assert.deepEqual(manifest.dependencies, ['pstack@pstack-claude']);
assert.equal(market.plugins[0].version, manifest.version, 'marketplace and plugin versions must match');
assert.ok(market.allowCrossMarketplaceDependenciesOn.includes('pstack-claude'));
for (const name of ['bootstrap','execute']) {
  const skill = read(`plugins/futari/skills/${name}/SKILL.md`);
  assert.ok(skill.startsWith(`---\nname: ${name}\n`));
  assert.ok(skill.includes('disable-model-invocation: true'));
  assert.ok(!skill.includes('/futari-bootstrap') && !skill.includes('/futari-execute'));
}
const data = JSON.parse(read('plugins/futari/skills/bootstrap/assets/repo-template.json'));
assert.ok(data.files['.futari/plan-gate.mjs']);
assert.ok(data.files['.futari/ci-check.mjs']);
assert.ok(data.files['.agents/playbooks/futari-approved-plan.md']);
assert.ok(data.files['.github/workflows/futari-contract.yml']);
assert.ok(data.claudeBlock.includes('/futari:bootstrap'));
assert.ok(data.claudeBlock.includes('/futari:execute'));
assert.ok(data.claudeBlock.includes('native AskUserQuestion card') && !data.claudeBlock.includes('The human alone runs the approval command'));
const init = read('plugins/futari/skills/bootstrap/scripts/init-project.mjs');
assert.ok(init.includes("'../assets/repo-template.json'"));
assert.ok(init.includes('Existing Futari plan found'));
const playbook = data.files['.agents/playbooks/futari-approved-plan.md'];
// Cleanup behaviour itself is tested in tools/worktrees.test.mjs; this only checks the playbook routes through the helper.
assert.ok(data.files['.futari/worktrees.mjs'], 'template ships the worktree helper');
for (const command of ['worktrees.mjs sweep', 'worktrees.mjs acquire', 'worktrees.mjs release']) {
  assert.ok(playbook.includes(command), `playbook does not route worktrees through ${command}`);
}
console.log('Futari plugin package: structural checks passed');

// Gate behavior: bootstrap a scratch repo from the template, fill a ready plan, and exercise the parallelism rule.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'futari-validate-'));
try {
  const env = { ...process.env, CLAUDE_CONFIG_DIR: path.join(scratch, '.config') };
  const run = (cmd, args) => execFileSync(cmd, args, { cwd: scratch, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  run('git', ['init', '-q']);
  run('node', [path.join(root, 'plugins/futari/skills/bootstrap/scripts/init-project.mjs')]);
  for (const doc of fs.readdirSync(path.join(scratch, 'docs/futari')).filter(n => n.endsWith('.md'))) {
    fs.writeFileSync(path.join(scratch, 'docs/futari', doc), `# ${doc}\n\nValidation fixture.\n`);
  }
  const planPath = path.join(scratch, '.futari/plan.json');
  const template = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  assert.equal(template.maxParallelTasks, 5, 'template default for maxParallelTasks');
  const ready = {
    ...template, planId: 'validate-v1', projectName: 'Validate', repository: 'futari-labs/validate',
    completionCondition: 'Fixture plan passes the gate', blockingQuestions: [],
    pstack: { ...template.pstack, version: '0.0.0', compatibilityVerified: true },
    requirements: [{ id: 'REQ-001', description: 'Fixture outcome', acceptanceCriteria: ['Gate accepts it'] }],
    evaluations: [{ ...template.evaluations[0], description: 'Fixture eval', passRule: 'exit 0', command: 'true' }],
    tasks: [{ ...template.tasks[0], title: 'Fixture slice', acceptanceCriteria: ['Gate accepts it'], verificationCommands: ['true'] }],
  };
  const check = extra => {
    fs.writeFileSync(planPath, JSON.stringify({ ...ready, ...extra }, null, 2));
    try { return { ok: true, out: run('node', ['.futari/plan-gate.mjs', 'check']) }; }
    catch (error) { return { ok: false, out: String(error.stderr) }; }
  };
  const cases = [
    [{ maxParallelTasks: 5 }, true, 'PASS'],
    [{ maxParallelTasks: 6 }, false, 'parallelismRationale'],
    [{ maxParallelTasks: 8, parallelismRationale: 'Eight independent tasks with disjoint allowedPaths; the human chose 8' }, true, 'PASS'],
    [{ maxParallelTasks: 9, parallelismRationale: 'Too many' }, false, 'from 1 to 8'],
  ];
  for (const [extra, ok, expected] of cases) {
    const result = check(extra);
    assert.equal(result.ok, ok, `${JSON.stringify(extra)}: ${result.out}`);
    assert.ok(result.out.includes(expected), `${JSON.stringify(extra)}: expected "${expected}" in ${result.out}`);
  }
  console.log('Futari plan gate: parallelism cap checks passed');

  const idCases = [
    [{ tasks: [{ ...ready.tasks[0], id: 'P-002' }], verticalSliceTaskIds: ['P-002'] }, true, 'PASS'],
    [{ tasks: [{ ...ready.tasks[0], id: 'JM-001' }], verticalSliceTaskIds: ['JM-001'] }, false, 'tasks: JM-001 must use the P-001 form'],
    [{ requirements: [{ ...ready.requirements[0], id: 'R-1' }] }, false, 'requirements: R-1 must use the REQ-001 form'],
    [{ evaluations: [{ ...ready.evaluations[0], id: 'EVAL-001' }] }, false, 'evaluations: EVAL-001 must use the EV-001 form'],
  ];
  for (const [extra, ok, expected] of idCases) {
    const result = check(extra);
    assert.equal(result.ok, ok, `${expected}: ${result.out}`);
    assert.ok(result.out.includes(expected), `expected "${expected}" in ${result.out}`);
  }
  console.log('Futari plan gate: identifier convention checks passed');
  // ci-check.mjs title rule is not exercised: it needs a real PR history (base/head commits, evidence files).
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
