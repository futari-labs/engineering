#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const market = JSON.parse(read('.claude-plugin/marketplace.json'));
const manifest = JSON.parse(read('plugins/futari/.claude-plugin/plugin.json'));
assert.equal(market.name, 'futarilabs');
assert.equal(market.plugins[0].source, './plugins/futari');
assert.equal(manifest.name, 'futari');
assert.deepEqual(manifest.dependencies, ['pstack@pstack-claude']);
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
const init = read('plugins/futari/skills/bootstrap/scripts/init-project.mjs');
assert.ok(init.includes("'../assets/repo-template.json'"));
assert.ok(init.includes('Existing Futari plan found'));
console.log('Futari plugin package: structural checks passed');
