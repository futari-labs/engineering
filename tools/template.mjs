#!/usr/bin/env node
// Edit the bootstrap template as plain files.
//   node tools/template.mjs unpack <dir>   write every template file (and CLAUDE_BLOCK.md) under <dir>
//   node tools/template.mjs pack <dir>     rebuild repo-template.json from <dir>, keeping key order and \u escapes
//   node tools/template.mjs check <dir>    exit 1 unless packing <dir> reproduces repo-template.json byte for byte
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../plugins/futari/skills/bootstrap/assets/repo-template.json');
const BLOCK = 'CLAUDE_BLOCK.md';
const [command, dir] = process.argv.slice(2);
if (!['unpack', 'pack', 'check'].includes(command) || !dir) {
  console.error('usage: node tools/template.mjs unpack|pack|check <dir>');
  process.exit(2);
}

const current = fs.readFileSync(TEMPLATE, 'utf8');
const template = JSON.parse(current);

if (command === 'unpack') {
  for (const [name, content] of Object.entries(template.files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
  fs.writeFileSync(path.join(dir, BLOCK), template.claudeBlock);
  console.log(`unpacked ${Object.keys(template.files).length} files to ${dir}`);
  process.exit(0);
}

function walk(root, prefix = '') {
  return fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? walk(root, name) : [name];
  });
}

// Existing keys keep their order; new files are appended in sorted order; deleted files drop out.
const present = new Set(walk(dir).filter(name => name !== BLOCK && !name.endsWith('.DS_Store')));
const files = {};
for (const name of Object.keys(template.files)) if (present.has(name)) files[name] = null;
for (const name of [...present].sort()) files[name] = fs.readFileSync(path.join(dir, name), 'utf8');
const packed = `${JSON.stringify({ files, claudeBlock: fs.readFileSync(path.join(dir, BLOCK), 'utf8') }, null, 2)
  .replace(/[\u007f-￿]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)}\n`;

if (command === 'check') {
  console.log(packed === current ? 'template matches' : 'template differs from packed files');
  process.exit(packed === current ? 0 : 1);
}
fs.writeFileSync(TEMPLATE, packed);
console.log(`packed ${Object.keys(files).length} files into ${path.relative(process.cwd(), TEMPLATE)}`);
