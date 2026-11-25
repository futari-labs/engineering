#!/usr/bin/env node
// Add Futari planning files to the current Git repository. No network or installs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const payload = JSON.parse(fs.readFileSync(path.join(here, '../assets/repo-template.json'), 'utf8'));
const root = fs.realpathSync(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim());
if (root === path.parse(root).root || root === os.homedir()) {
  throw new Error('Use a dedicated project repository, not your home or filesystem root.');
}

function assertSafe(relative) {
  if (
    path.isAbsolute(relative) ||
    path.posix.normalize(relative) !== relative ||
    relative.includes('\\') ||
    relative.split('/').some(x => x === '..' || x === '.git')
  ) {
    throw new Error(`Unsafe template path: ${relative}`);
  }
  let cursor = root;
  for (const part of relative.split('/')) {
    cursor = path.join(cursor, part);
    let stat;
    try { stat = fs.lstatSync(cursor); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat?.isSymbolicLink()) throw new Error(`Refusing symlink target: ${relative}`);
  }
  return path.join(root, relative);
}

const planPath = assertSafe('.futari/plan.json');
if (fs.existsSync(planPath)) {
  console.log('Existing Futari plan found. No files changed. Resume /futari:bootstrap or verify the approved plan before /futari:execute.');
  process.exit(0);
}

// Preserve existing project material: compute every change before writing.
const pending = new Map();
for (const [relative, content] of Object.entries(payload.files)) {
  const full = assertSafe(relative);
  if (fs.existsSync(full)) {
    if (!fs.statSync(full).isFile() || fs.readFileSync(full, 'utf8') !== content) {
      throw new Error(`Existing file needs review before initialization: ${relative}. No changes made.`);
    }
  } else {
    pending.set(relative, content);
  }
}

const claudePath = assertSafe('CLAUDE.md');
const currentClaude = fs.existsSync(claudePath) ? fs.readFileSync(claudePath, 'utf8') : '';
if (currentClaude.includes('<!-- FUTARI_BOOTSTRAP_BEGIN -->')) {
  throw new Error('Existing Futari instruction block without a plan. Review partial initialization; no changes made.');
}

pending.set('CLAUDE.md', `${currentClaude}${currentClaude && !currentClaude.endsWith('\n') ? '\n' : ''}\n${payload.claudeBlock}\n`);

const sheetPath = assertSafe('.claude/pstack-models.md');
const configRoot = process.env.CLAUDE_CONFIG_DIR
  ? path.resolve(process.env.CLAUDE_CONFIG_DIR)
  : path.join(os.homedir(), '.claude');
const userSheet = path.join(configRoot, 'pstack-models.md');
let sheet = fs.existsSync(sheetPath)
  ? fs.readFileSync(sheetPath, 'utf8')
  : fs.existsSync(userSheet)
    ? fs.readFileSync(userSheet, 'utf8')
    : '# pstack model preferences\n';
sheet = sheet.replace(/^\s*(?:[-*]\s+)?session hook\s*:\s*.*$/gim, '').trimEnd();
const sheetNote = "This project's sheet. In this repository it replaces the user's pstack-models.md; ignore that sheet's lines.";
if (!sheet.includes(sheetNote)) sheet += `\n\n${sheetNote}`;
sheet += '\n\nsession hook: off\n';
pending.set('.claude/pstack-models.md', sheet);

for (const [relative, content] of pending) {
  const full = assertSafe(relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, { mode: 0o644 });
}
console.log(`Initialized ${pending.size} planning/control files in ${root}.`);
console.log('Existing CLAUDE.md and pstack model preferences preserved. Project routing is off; global settings unchanged.');
console.log('Plan status: DRAFT. Approval requires the native AskUserQuestion card after full review.');
console.log('No product code, remote issues, PRs, commits, or network actions created.');
