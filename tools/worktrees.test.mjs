// Behavioural regression tests for the `.futari/worktrees.mjs` contract.
//   node --test tools/worktrees.test.mjs
// The helper is read from repo-template.json, or from the file named by FUTARI_HELPER.
// Assertions look at disk (directories, `git worktree list`, refs, file contents) as well as the helper's JSON.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync, spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = path.join(REPO, 'plugins/futari/skills/bootstrap/assets/repo-template.json');

let cachedSource;
function helperSource() {
  if (cachedSource !== undefined) return cachedSource;
  if (process.env.FUTARI_HELPER) {
    cachedSource = fs.readFileSync(process.env.FUTARI_HELPER, 'utf8');
  } else {
    const source = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8')).files['.futari/worktrees.mjs'];
    if (typeof source !== 'string') throw new Error('repo-template.json has no .futari/worktrees.mjs');
    cachedSource = source;
  }
  return cachedSource;
}

const BASE_ENV = {
  PATH: `${process.env.PATH}:/usr/sbin:/sbin:/usr/bin:/bin`,
  LANG: 'C',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_TERMINAL_PROMPT: '0',
};

const codesOf = (reasons = []) => reasons.map((r) => r.code).sort();
const exists = (p) => fs.existsSync(p);
const real = (p) => (exists(p) ? fs.realpathSync(p) : p);
const sanitize = (p) => p.replace(/[^a-zA-Z0-9]/g, '-');

function sandbox(t, { projName = 'proj' } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'futari-wt-')));
  const bare = path.join(root, 'remote.git');
  const proj = path.join(root, projName);
  const cfg = path.join(root, 'claude-config');
  const home = path.join(root, 'home');
  for (const d of [cfg, home, proj]) fs.mkdirSync(d, { recursive: true });
  const children = [];
  const live = () => {
    const c = spawn('sleep', ['600'], { stdio: 'ignore' });
    children.push(c);
    return c.pid;
  };
  const sb = {
    root, bare, proj, cfg, home,
    A: { id: 'sess-a', pid: live() },
    B: { id: 'sess-b', pid: live() },
    lockTimeout: 15000,
    spawnLive: live,
  };
  t.after(async () => {
    for (const c of children) c.kill('SIGKILL');
    await Promise.all(children.map((c) => (c.exitCode === null && c.signalCode === null ? once(c, 'exit') : null)));
    fs.rmSync(root, { recursive: true, force: true });
  });

  sb.env = (session, extra = {}) => {
    const env = { ...BASE_ENV, HOME: home, CLAUDE_CONFIG_DIR: cfg, FUTARI_LOCK_TIMEOUT_MS: String(sb.lockTimeout), ...extra };
    if (session) {
      env.FUTARI_SESSION_ID = session.id;
      if (session.pid) env.FUTARI_SESSION_PID = String(session.pid);
    }
    return env;
  };
  sb.git = (cwd, ...args) =>
    execFileSync('git', args, { cwd, env: sb.env(null), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  sb.gitSafe = (cwd, ...args) => {
    const r = spawnSync('git', args, { cwd, env: sb.env(null), encoding: 'utf8' });
    return { status: r.status, out: (r.stdout || '').trim() };
  };
  const parse = (stdout) => {
    try { return JSON.parse(stdout.trim()); } catch { return undefined; }
  };
  sb.run = (args, { session = sb.A, cwd = proj, env = {} } = {}) => {
    const r = spawnSync(process.execPath, [path.join(proj, '.futari/worktrees.mjs'), ...args], {
      cwd, env: sb.env(session, env), encoding: 'utf8',
    });
    return { status: r.status, json: parse(r.stdout || ''), stdout: r.stdout, stderr: r.stderr };
  };
  sb.runAsync = (args, { session = sb.A, cwd = proj, env = {} } = {}) =>
    new Promise((resolve) => {
      execFile(process.execPath, [path.join(proj, '.futari/worktrees.mjs'), ...args],
        { cwd, env: sb.env(session, env), encoding: 'utf8' },
        (err, stdout, stderr) => resolve({ status: err ? err.code : 0, json: parse(stdout), stdout, stderr }));
    });
  sb.ok = (args, opts) => {
    const r = sb.run(args, opts);
    assert.equal(r.status, 0, `helper ${args.join(' ')} exited ${r.status}\n${r.stdout}\n${r.stderr}`);
    assert.ok(r.json, `no JSON on stdout for ${args.join(' ')}: ${r.stdout}`);
    return r.json;
  };

  // Remote and project repo.
  sb.git(root, 'init', '--bare', '-b', 'main', bare);
  sb.git(proj, 'init', '-b', 'main');
  sb.git(proj, 'remote', 'add', 'origin', bare);
  fs.writeFileSync(path.join(proj, 'README.md'), 'readme\n');
  fs.writeFileSync(path.join(proj, '.gitignore'), '.env\nnode_modules/\n');
  fs.mkdirSync(path.join(proj, '.futari'), { recursive: true });
  fs.writeFileSync(path.join(proj, '.futari/plan.json'),
    JSON.stringify({ planId: 'test-plan', tasks: [{ id: 'P-001' }, { id: 'P-002' }, { id: 'P-003' }] }, null, 2));
  fs.writeFileSync(path.join(proj, '.futari/worktrees.mjs'), helperSource());
  sb.commitMain = (msg = 'base') => {
    sb.git(proj, 'add', '-A');
    sb.git(proj, 'commit', '-m', msg);
    sb.git(proj, 'push', '-u', 'origin', 'main');
  };
  sb.commitMain();
  sb.headMain = () => sb.git(proj, 'rev-parse', 'HEAD');

  sb.listed = () =>
    sb.git(proj, 'worktree', 'list', '--porcelain').split('\n')
      .filter((l) => l.startsWith('worktree ')).map((l) => real(l.slice(9)));
  sb.branchExists = (b) => sb.gitSafe(proj, 'show-ref', '--verify', '--quiet', `refs/heads/${b}`).status === 0;

  // A worker that did its work: committed code plus evidence, pushed to origin.
  sb.work = (task = 'P-001', { session = sb.A, evidence = true, push = true } = {}) => {
    const out = sb.ok(['acquire', '--task', task, '--role', 'worker', '--owner', 'test'], { session });
    const wt = out.path;
    fs.writeFileSync(path.join(wt, `work-${task}.txt`), 'work\n');
    if (evidence) {
      fs.mkdirSync(path.join(wt, '.futari/evidence'), { recursive: true });
      fs.writeFileSync(path.join(wt, `.futari/evidence/${task}.md`), 'evidence\n');
    }
    sb.git(wt, 'add', '-A');
    sb.git(wt, 'commit', '-m', `work ${task}`);
    if (push) sb.git(wt, 'push', '-u', 'origin', `futari/${task}`);
    return { ...out, wt, head: sb.git(wt, 'rev-parse', 'HEAD') };
  };
  sb.release = (id, reason = 'merge-ready', extra = [], opts) =>
    sb.run(['release', '--id', id, '--reason', reason, ...extra], opts);
  sb.sweep = (extra = [], opts) => sb.ok(['sweep', ...extra], opts);
  sb.retained = (out, p) => out.retained.find((e) => real(e.path) === real(p));

  // Releases a worker while a process sits in its directory, so it stays on disk with state released.
  sb.releasedButBlocked = async (w) => {
    const child = spawn('sleep', ['600'], { cwd: w.wt, stdio: 'ignore' });
    await once(child, 'spawn');
    const r = sb.release(w.id, 'merge-ready');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(r.json.removed, false);
    assert.ok(exists(w.wt));
    return async () => {
      child.kill('SIGKILL');
      await once(child, 'exit');
    };
  };
  return sb;
}

function assertRetained(sb, out, wt, code) {
  const entry = sb.retained(out, wt);
  assert.ok(entry, `${wt} not in retained: ${JSON.stringify(out)}`);
  assert.ok(codesOf(entry.reasons).includes(code), `expected ${code}, got ${JSON.stringify(entry.reasons)}`);
  assert.ok(!out.removed.some((e) => real(e.path) === real(wt)), 'must not be reported removed');
  assert.ok(exists(wt), 'worktree directory must still exist');
  assert.ok(sb.listed().includes(real(wt)), 'git must still list the worktree');
}

function assertRemoved(sb, wt) {
  assert.ok(!exists(wt), 'worktree directory must be gone');
  assert.ok(!sb.listed().includes(wt), 'git must not list the worktree');
}

// Release, expect retention for `code`, then confirm a sweep agrees.
function expectRetained(sb, w, code) {
  const r = sb.release(w.id);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.json.removed, false);
  assert.ok(codesOf(r.json.reasons).includes(code), `release reasons ${JSON.stringify(r.json.reasons)}`);
  const out = sb.sweep();
  assertRetained(sb, out, w.wt, code);
  return out;
}

// 1
test('clean merged worker is removed and its branch ref survives', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  sb.git(w.wt, 'push', 'origin', 'futari/P-001:main');
  const r = sb.release(w.id, 'merged');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.json.removed, true);
  assertRemoved(sb, w.wt);
  assert.ok(sb.branchExists('futari/P-001'));
  assert.equal(sb.git(sb.proj, 'rev-parse', 'futari/P-001'), w.head);
});

// 2
test('clean pushed merge-ready worker is removed', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  const r = sb.release(w.id, 'merge-ready');
  assert.equal(r.status, 0);
  assert.equal(r.json.removed, true);
  assertRemoved(sb, w.wt);
  assert.ok(sb.branchExists('futari/P-001'));
  assert.deepEqual(sb.listed(), [sb.proj]);
});

// 3
test('staged change is retained as uncommitted', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  fs.writeFileSync(path.join(w.wt, 'staged.txt'), 'staged\n');
  sb.git(w.wt, 'add', 'staged.txt');
  expectRetained(sb, w, 'uncommitted');
  assert.equal(fs.readFileSync(path.join(w.wt, 'staged.txt'), 'utf8'), 'staged\n');
});

test('modified tracked file is retained as uncommitted', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  fs.writeFileSync(path.join(w.wt, 'README.md'), 'edited\n');
  expectRetained(sb, w, 'uncommitted');
  assert.equal(fs.readFileSync(path.join(w.wt, 'README.md'), 'utf8'), 'edited\n');
});

test('untracked file is retained as untracked', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  fs.writeFileSync(path.join(w.wt, 'notes.txt'), 'mine\n');
  expectRetained(sb, w, 'untracked');
  assert.equal(fs.readFileSync(path.join(w.wt, 'notes.txt'), 'utf8'), 'mine\n');
});

// 4
test('ignored .env is retained as valuable-ignored', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  fs.writeFileSync(path.join(w.wt, '.env'), 'SECRET=1\n');
  expectRetained(sb, w, 'valuable-ignored');
  assert.equal(fs.readFileSync(path.join(w.wt, '.env'), 'utf8'), 'SECRET=1\n');
});

test('ignored node_modules alone does not block removal', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  fs.mkdirSync(path.join(w.wt, 'node_modules'));
  fs.writeFileSync(path.join(w.wt, 'node_modules/x'), 'dep\n');
  const r = sb.release(w.id);
  assert.equal(r.json.removed, true, JSON.stringify(r.json));
  assertRemoved(sb, w.wt);
});

// 5
test('unpushed commit is retained as not-on-remote', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  fs.writeFileSync(path.join(w.wt, 'more.txt'), 'more\n');
  sb.git(w.wt, 'add', 'more.txt');
  sb.git(w.wt, 'commit', '-m', 'unpushed');
  expectRetained(sb, w, 'not-on-remote');
  assert.equal(fs.readFileSync(path.join(w.wt, 'more.txt'), 'utf8'), 'more\n');
});

// 6
test('commit reachable only from the HEAD reflog is retained as reflog-only', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  fs.writeFileSync(path.join(w.wt, 'lost.txt'), 'lost\n');
  sb.git(w.wt, 'checkout', '--detach');
  sb.git(w.wt, 'add', 'lost.txt');
  sb.git(w.wt, 'commit', '-m', 'to be orphaned');
  const orphan = sb.git(w.wt, 'rev-parse', 'HEAD');
  sb.git(w.wt, 'checkout', 'futari/P-001');
  assert.equal(sb.git(w.wt, 'rev-parse', 'HEAD'), w.head);
  expectRetained(sb, w, 'reflog-only');
  assert.equal(sb.git(w.wt, 'cat-file', '-t', orphan), 'commit');
});

test('reviewer with a commit on detached HEAD is retained; a clean reviewer at a pushed sha is removed', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  const rv = sb.ok(['acquire', '--task', 'P-001', '--role', 'reviewer', '--at', w.head, '--owner', 'rev'], { session: sb.B });
  assert.equal(rv.created, true);
  assert.equal(sb.gitSafe(rv.path, 'symbolic-ref', '-q', 'HEAD').status, 1, 'reviewer must be detached');
  assert.equal(sb.git(rv.path, 'rev-parse', 'HEAD'), w.head);
  fs.writeFileSync(path.join(rv.path, 'review-note.txt'), 'n\n');
  sb.git(rv.path, 'add', 'review-note.txt');
  sb.git(rv.path, 'commit', '-m', 'review commit');
  const r = sb.release(rv.id, 'verdict-recorded', [], { session: sb.B });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.json.removed, false);
  const entry = sb.retained(sb.sweep(), rv.path);
  assert.ok(entry && exists(rv.path));
  const rc = codesOf(entry.reasons);
  assert.ok(rc.includes('reflog-only') || rc.includes('not-on-remote'), JSON.stringify(entry.reasons));
  assert.equal(fs.readFileSync(path.join(rv.path, 'review-note.txt'), 'utf8'), 'n\n');

  const clean = sb.ok(['acquire', '--task', 'P-001', '--role', 'adversary', '--at', w.head], { session: sb.B });
  const r2 = sb.release(clean.id, 'verdict-recorded', [], { session: sb.B });
  assert.equal(r2.json.removed, true, JSON.stringify(r2.json));
  assertRemoved(sb, clean.path);
});

// 7
test('initialized submodule with a dirty file is retained as submodules', (t) => {
  const sb = sandbox(t);
  const subBare = path.join(sb.root, 'sub.git');
  const subWork = path.join(sb.root, 'sub-work');
  sb.git(sb.root, 'init', '--bare', '-b', 'main', subBare);
  sb.git(sb.root, 'init', '-b', 'main', subWork);
  fs.writeFileSync(path.join(subWork, 's.txt'), 's\n');
  sb.git(subWork, 'add', '-A');
  sb.git(subWork, 'commit', '-m', 'sub');
  sb.git(subWork, 'push', subBare, 'main');
  sb.git(sb.proj, '-c', 'protocol.file.allow=always', 'submodule', 'add', subBare, 'libs/sub');
  sb.commitMain('add submodule');
  const w = sb.work();
  sb.git(w.wt, '-c', 'protocol.file.allow=always', 'submodule', 'update', '--init');
  fs.writeFileSync(path.join(w.wt, 'libs/sub/s.txt'), 'dirty\n');
  expectRetained(sb, w, 'submodules');
  assert.equal(fs.readFileSync(path.join(w.wt, 'libs/sub/s.txt'), 'utf8'), 'dirty\n');
});

// 8
test('git-locked worktree is retained as locked', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  sb.git(sb.proj, 'worktree', 'lock', w.wt);
  expectRetained(sb, w, 'locked');
  assert.ok(sb.git(sb.proj, 'worktree', 'list', '--porcelain').includes('locked'));
});

// 9
test('active worker of a live session is retained as in-use', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  const out = sb.sweep([], { session: sb.B });
  assertRetained(sb, out, w.wt, 'in-use');
  assert.equal(sb.retained(out, w.wt).id, w.id);
  const r = sb.release(w.id, 'merge-ready', [], { session: sb.B });
  assert.equal(r.status, 3, r.stdout);
  assert.equal(r.json.error, 'in-use');
  assert.ok(exists(w.wt));
});

test('process with cwd inside a released worktree blocks removal until it exits', async (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  const child = spawn('sleep', ['600'], { cwd: path.join(w.wt, '.futari'), stdio: 'ignore' });
  await once(child, 'spawn');
  const r = sb.release(w.id);
  assert.equal(r.json.removed, false);
  assert.ok(codesOf(r.json.reasons).includes('process-cwd'), JSON.stringify(r.json));
  assertRetained(sb, sb.sweep(), w.wt, 'process-cwd');
  child.kill('SIGKILL');
  await once(child, 'exit');
  const out = sb.sweep();
  assert.ok(out.removed.some((e) => e.id === w.id), JSON.stringify(out));
  assertRemoved(sb, w.wt);
});

test('Claude project dir for the worktree path is retained as chat-started-here', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  const chat = path.join(sb.cfg, 'projects', sanitize(real(w.wt)));
  fs.mkdirSync(chat, { recursive: true });
  fs.writeFileSync(path.join(chat, 'session.jsonl'), '{}\n');
  expectRetained(sb, w, 'chat-started-here');
  assert.ok(exists(path.join(chat, 'session.jsonl')));
});

// 10
test('user-created worktree is retained as not-futari and untouched, even with a Futari-looking name', (t) => {
  const sb = sandbox(t);
  const mine = path.join(sb.proj, '.futari/worktrees/P-001-worker-abcdef');
  fs.mkdirSync(path.dirname(mine), { recursive: true });
  sb.git(sb.proj, 'worktree', 'add', '-b', 'user-branch', mine);
  fs.writeFileSync(path.join(mine, 'wip.txt'), 'wip\n');
  const plain = path.join(sb.root, 'plain-wt');
  sb.git(sb.proj, 'worktree', 'add', '-b', 'other-user', plain);
  const out = sb.sweep();
  assertRetained(sb, out, mine, 'not-futari');
  assertRetained(sb, out, plain, 'not-futari');
  assert.equal(fs.readFileSync(path.join(mine, 'wip.txt'), 'utf8'), 'wip\n');
  assert.ok(sb.branchExists('user-branch'));
});

// 11
function markReleased(sb, w, mutate) {
  const admin = sb.git(w.wt, 'rev-parse', '--absolute-git-dir');
  const file = path.join(admin, 'futari.json');
  const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
  rec.state = 'released';
  rec.releasedAt = new Date().toISOString();
  rec.releaseReason = 'merge-ready';
  mutate?.(rec);
  fs.writeFileSync(file, JSON.stringify(rec, null, 2));
}

test('record with an edited planId is ambiguous-ownership', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  markReleased(sb, w, (rec) => { rec.planId = 'some-other-plan'; });
  assertRetained(sb, sb.sweep(), w.wt, 'ambiguous-ownership');
});

test('worker worktree switched to another branch is ambiguous-ownership', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  sb.git(w.wt, 'checkout', '-b', 'something-else');
  markReleased(sb, w);
  assertRetained(sb, sb.sweep(), w.wt, 'ambiguous-ownership');
  assert.equal(sb.git(w.wt, 'rev-parse', '--abbrev-ref', 'HEAD'), 'something-else');
});

test('record with a task outside the plan is ambiguous-ownership', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  markReleased(sb, w, (rec) => { rec.task = 'P-077'; });
  assertRetained(sb, sb.sweep(), w.wt, 'ambiguous-ownership');
});

// 12
test('stale remote-tracking ref does not count as on the remote', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  sb.git(sb.bare, 'update-ref', '-d', 'refs/heads/futari/P-001');
  assert.equal(sb.git(sb.proj, 'rev-parse', 'refs/remotes/origin/futari/P-001'), w.head, 'precondition: stale tracking ref');
  expectRetained(sb, w, 'not-on-remote');
});

// 13
test('squash-merged branch deleted on the remote is verified through refs/pull/<n>/head', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  sb.git(sb.bare, 'update-ref', 'refs/pull/7/head', w.head);
  sb.git(sb.bare, 'update-ref', '-d', 'refs/heads/futari/P-001');
  const r = sb.release(w.id, 'merged', ['--pr', '7']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.json.removed, true, JSON.stringify(r.json));
  assertRemoved(sb, w.wt);
  assert.ok(sb.branchExists('futari/P-001'));
});

test('without a PR ref, a branch deleted on the remote is not-on-remote', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  sb.git(sb.bare, 'update-ref', '-d', 'refs/heads/futari/P-001');
  expectRetained(sb, w, 'not-on-remote');
});

// 14
test('unreachable origin retains everything as remote-unverified or check-failed', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  sb.git(sb.proj, 'remote', 'set-url', 'origin', path.join(sb.root, 'does-not-exist.git'));
  const r = sb.release(w.id);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.json.removed, false);
  const codes = codesOf(r.json.reasons);
  assert.ok(codes.includes('remote-unverified') || codes.includes('check-failed'), JSON.stringify(r.json));
  const out = sb.sweep();
  const entry = sb.retained(out, w.wt);
  assert.ok(entry);
  assert.deepEqual(out.removed, []);
  assert.ok(exists(path.join(w.wt, 'work-P-001.txt')));
});

// 15
test('primary worktree is retained as primary', (t) => {
  const sb = sandbox(t);
  const out = sb.sweep();
  assertRetained(sb, out, sb.proj, 'primary');
  assert.deepEqual(out.removed, []);
  assert.ok(exists(path.join(sb.proj, 'README.md')));
});

// 16
test('directory deleted out from under git is cleared with missing: true', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  markReleased(sb, w);
  fs.rmSync(w.wt, { recursive: true, force: true });
  assert.ok(sb.git(sb.proj, 'worktree', 'list', '--porcelain').includes('prunable'));
  const out = sb.sweep();
  const gone = out.removed.find((e) => e.id === w.id);
  assert.ok(gone, JSON.stringify(out));
  assert.equal(gone.missing, true);
  assert.ok(!sb.git(sb.proj, 'worktree', 'list', '--porcelain').includes(w.id));
  assert.ok(sb.branchExists('futari/P-001'));
});

test('release of an id with no live worktree is gone with exit 0', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  assert.equal(sb.release(w.id).json.removed, true);
  const again = sb.release(w.id);
  assert.equal(again.status, 0);
  assert.equal(again.json.state, 'gone');
  const never = sb.release('P-002-worker-ffffff');
  assert.equal(never.status, 0);
  assert.equal(never.json.state, 'gone');
});

// 17
test('repeated sweep is idempotent', async (t) => {
  const sb = sandbox(t);
  const dirty = sb.work('P-002');
  fs.writeFileSync(path.join(dirty.wt, 'keep.txt'), 'keep\n');
  const w = sb.work('P-001');
  const unblock = await sb.releasedButBlocked(w);
  await unblock();
  const first = sb.sweep();
  assert.ok(first.removed.some((e) => e.id === w.id));
  assertRemoved(sb, w.wt);
  const second = sb.run(['sweep']);
  assert.equal(second.status, 0);
  assert.deepEqual(second.json.removed, []);
  const shape = (o) => o.retained.map((e) => [real(e.path), e.id, codesOf(e.reasons)]).sort();
  assert.deepEqual(shape(second.json), shape(first));
  assert.ok(exists(path.join(dirty.wt, 'keep.txt')));
});

test('sweep --dry-run and status remove nothing', async (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  const unblock = await sb.releasedButBlocked(w);
  await unblock();
  const dry = sb.sweep(['--dry-run']);
  assert.ok(Array.isArray(dry.removed ?? dry.removable) && Array.isArray(dry.retained), JSON.stringify(dry)); // contract does not name the dry-run key
  assert.ok(exists(w.wt));
  const status = sb.ok(['status']);
  assert.ok(Array.isArray(status.removed ?? status.removable));
  assert.ok(exists(w.wt));
  assert.ok(sb.sweep().removed.some((e) => e.id === w.id));
  assertRemoved(sb, w.wt);
});

// 18
test('four concurrent sweeps remove a released worktree exactly once and leave no lock', async (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  const unblock = await sb.releasedButBlocked(w);
  await unblock();
  const results = await Promise.all([1, 2, 3, 4].map(() => sb.runAsync(['sweep'])));
  for (const r of results) assert.equal(r.status, 0, r.stdout + r.stderr);
  const reporting = results.filter((r) => r.json.removed.some((e) => e.id === w.id));
  assert.equal(reporting.length, 1);
  assertRemoved(sb, w.wt);
  assert.ok(!exists(path.join(sb.proj, '.git/futari/worktrees.lock')));
  assert.ok(sb.branchExists('futari/P-001'));
});

test('stale lock of a dead holder is broken; lock of a live holder makes sweep exit 1 and change nothing', async (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  const unblock = await sb.releasedButBlocked(w);
  await unblock();
  const lock = path.join(sb.proj, '.git/futari/worktrees.lock');
  const dead = spawnSync('true').pid;
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  fs.writeFileSync(lock, JSON.stringify({ pid: sb.B.pid, host: os.hostname(), started: spawnSync('ps', ['-o', 'lstart=', '-p', String(sb.B.pid)], { env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' }, encoding: 'utf8' }).stdout.trim(), token: 'live' }));
  const blocked = sb.run(['sweep'], { env: { FUTARI_LOCK_TIMEOUT_MS: '400' } });
  assert.equal(blocked.status, 1, blocked.stdout + blocked.stderr);
  assert.ok(exists(lock));
  assert.ok(exists(w.wt));
  fs.writeFileSync(lock, JSON.stringify({ pid: dead, host: os.hostname(), started: null, token: 'dead' }));
  const out = sb.sweep();
  assert.ok(out.removed.some((e) => e.id === w.id), JSON.stringify(out));
  assertRemoved(sb, w.wt);
  assert.ok(!exists(lock));
});

// 19
test('concurrent acquire of one task by two live sessions: one wins, the other exits 3 in-use', async (t) => {
  const sb = sandbox(t);
  const args = ['acquire', '--task', 'P-001', '--role', 'worker'];
  const [a, b] = await Promise.all([sb.runAsync(args, { session: sb.A }), sb.runAsync(args, { session: sb.B })]);
  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, [0, 3], `${a.stdout}\n${b.stdout}`);
  const loser = a.status === 3 ? a : b;
  const winner = a.status === 0 ? a : b;
  assert.equal(loser.json.error, 'in-use');
  assert.equal(loser.json.id, winner.json.id);
  assert.equal(sb.listed().length, 2);
  assert.ok(exists(winner.json.path));
});

test('same session acquiring again is idempotent', (t) => {
  const sb = sandbox(t);
  const first = sb.ok(['acquire', '--task', 'P-001', '--role', 'worker']);
  assert.equal(first.created, true);
  const second = sb.ok(['acquire', '--task', 'P-001', '--role', 'worker']);
  assert.equal(second.recovered, true);
  assert.equal(second.path, first.path);
  assert.equal(second.id, first.id);
  assert.equal(sb.listed().length, 2);
});

test('crashed session worker is recovered by a new session without a new worktree', (t) => {
  const sb = sandbox(t);
  const dead = { id: 'sess-dead', pid: spawnSync('true').pid };
  const first = sb.ok(['acquire', '--task', 'P-001', '--role', 'worker'], { session: dead });
  assert.equal(first.created, true);
  const out = sb.sweep([], { session: sb.A });
  assert.ok(sb.retained(out, first.path), 'a dead session worker still has no release: it needs a clean check');
  const second = sb.ok(['acquire', '--task', 'P-001', '--role', 'worker'], { session: sb.A });
  assert.equal(second.recovered, true);
  assert.equal(second.path, first.path);
  assert.equal(second.id, first.id);
  assert.equal(sb.listed().length, 2);
  // Now owned by a live session: another live session is refused.
  assert.equal(sb.run(['acquire', '--task', 'P-001', '--role', 'worker'], { session: sb.B }).status, 3);
});

test('acquire --adopt takes over a worker held by another live session', (t) => {
  const sb = sandbox(t);
  const first = sb.ok(['acquire', '--task', 'P-001', '--role', 'worker'], { session: sb.A });
  const adopted = sb.ok(['acquire', '--task', 'P-001', '--role', 'worker', '--adopt'], { session: sb.B });
  assert.equal(adopted.path, first.path);
  assert.equal(adopted.recovered, true);
  assert.equal(sb.listed().length, 2);
});

test('worker without evidence is retained as missing-evidence', (t) => {
  const sb = sandbox(t);
  const w = sb.work('P-001', { evidence: false });
  expectRetained(sb, w, 'missing-evidence');
});

// 20
test('after a merge-ready removal, acquire recreates the worktree on the pushed head', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  assert.equal(sb.release(w.id).json.removed, true);
  assertRemoved(sb, w.wt);
  const again = sb.ok(['acquire', '--task', 'P-001', '--role', 'worker']);
  assert.ok(exists(again.path));
  assert.equal(again.branch, 'futari/P-001');
  assert.equal(sb.git(again.path, 'rev-parse', 'HEAD'), w.head);
  assert.equal(sb.git(again.path, 'rev-parse', '--abbrev-ref', 'HEAD'), 'futari/P-001');
  assert.ok(exists(path.join(again.path, 'work-P-001.txt')));
  assert.equal(sb.listed().length, 2);
});

test('a released worker that was retained is revived by acquire', async (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  const unblock = await sb.releasedButBlocked(w);
  const again = sb.ok(['acquire', '--task', 'P-001', '--role', 'worker']);
  assert.equal(again.recovered, true);
  assert.equal(again.path, w.wt);
  await unblock();
  // Active again under a live session, so a sweep must keep it.
  assertRetained(sb, sb.sweep(), w.wt, 'in-use');
});

// 21
test('task ids and identity are validated', (t) => {
  const sb = sandbox(t);
  const ok = sb.run(['acquire', '--task', 'P-001', '--role', 'worker']);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const before = sb.listed().length;
  assert.equal(sb.run(['acquire', '--task', 'JM-001', '--role', 'worker']).status, 1);
  assert.equal(sb.run(['acquire', '--task', 'P-999', '--role', 'worker']).status, 1, 'task not in plan');
  assert.equal(sb.run(['acquire', '--task', 'P-002', '--role', 'worker'], { session: null }).status, 1, 'no session id');
  assert.equal(sb.run(['release', '--id', ok.json.id, '--reason', 'merged'], { session: null }).status, 1, 'no session id');
  assert.equal(sb.listed().length, before);
  assert.ok(!exists(path.join(sb.proj, '.futari/worktrees/P-002-worker')), 'nothing created for bad input');
});

test('acquire excludes .futari/worktrees/ once and puts worktrees under it', (t) => {
  const sb = sandbox(t);
  const a = sb.ok(['acquire', '--task', 'P-001', '--role', 'worker']);
  sb.ok(['acquire', '--task', 'P-002', '--role', 'worker']);
  sb.ok(['acquire', '--task', 'P-001', '--role', 'worker']);
  const exclude = fs.readFileSync(path.join(sb.proj, '.git/info/exclude'), 'utf8').split('\n');
  assert.equal(exclude.filter((l) => l === '/.futari/worktrees/').length, 1);
  assert.ok(real(a.path).startsWith(path.join(sb.proj, '.futari/worktrees') + path.sep));
  assert.match(path.basename(a.path), /^P-001-worker-[0-9a-f]{6}$/);
  assert.equal(sb.git(sb.proj, 'status', '--porcelain'), '');
});

test('acquire works from inside a linked worktree and still places worktrees under the primary', (t) => {
  const sb = sandbox(t);
  const a = sb.ok(['acquire', '--task', 'P-001', '--role', 'worker']);
  const b = sb.ok(['acquire', '--task', 'P-002', '--role', 'worker'], { cwd: a.path });
  assert.ok(real(b.path).startsWith(path.join(sb.proj, '.futari/worktrees') + path.sep), b.path);
  assert.equal(sb.listed().length, 3);
});

// Data-loss regressions found in review.
const ps = (pid, env) => spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], { env: { ...process.env, ...env }, encoding: 'utf8' }).stdout.trim();

// 1
test('assume-unchanged file with an edit is retained as hidden-changes', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  sb.git(w.wt, 'update-index', '--assume-unchanged', 'README.md');
  fs.writeFileSync(path.join(w.wt, 'README.md'), 'hidden edit\n');
  assert.equal(sb.git(w.wt, 'status', '--porcelain'), '', 'precondition: git hides the edit');
  expectRetained(sb, w, 'hidden-changes');
  assert.equal(fs.readFileSync(path.join(w.wt, 'README.md'), 'utf8'), 'hidden edit\n');
});

test('skip-worktree file with an edit is retained as hidden-changes', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  sb.git(w.wt, 'update-index', '--skip-worktree', 'README.md');
  fs.writeFileSync(path.join(w.wt, 'README.md'), 'hidden edit\n');
  assert.equal(sb.git(w.wt, 'status', '--porcelain'), '', 'precondition: git hides the edit');
  expectRetained(sb, w, 'hidden-changes');
  assert.equal(fs.readFileSync(path.join(w.wt, 'README.md'), 'utf8'), 'hidden edit\n');
});

test('a lying core.fsmonitor hook does not hide an edit', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  const hook = path.join(sb.root, 'fsmonitor-hook.sh');
  fs.writeFileSync(hook, "#!/bin/sh\nprintf 'token\\0'\n", { mode: 0o755 });
  sb.git(sb.proj, 'config', 'core.fsmonitor', hook);
  sb.git(w.wt, 'status', '--porcelain'); // primes the fsmonitor token in the index
  fs.writeFileSync(path.join(w.wt, 'README.md'), 'edit behind fsmonitor\n');
  expectRetained(sb, w, 'uncommitted');
  assert.equal(fs.readFileSync(path.join(w.wt, 'README.md'), 'utf8'), 'edit behind fsmonitor\n');
});

// 2
test('ignored .env inside a tracked packages/build/ dir is retained as valuable-ignored', (t) => {
  const sb = sandbox(t);
  fs.mkdirSync(path.join(sb.proj, 'packages/build'), { recursive: true });
  fs.writeFileSync(path.join(sb.proj, 'packages/build/index.js'), 'x\n');
  sb.commitMain('tracked packages/build');
  const w = sb.work();
  fs.writeFileSync(path.join(w.wt, 'packages/build/.env'), 'SECRET=1\n');
  expectRetained(sb, w, 'valuable-ignored');
  assert.equal(fs.readFileSync(path.join(w.wt, 'packages/build/.env'), 'utf8'), 'SECRET=1\n');
});

test('control: ignored top-level build/ and node_modules/ still allow removal', (t) => {
  const sb = sandbox(t);
  fs.appendFileSync(path.join(sb.proj, '.gitignore'), '/build/\n');
  sb.commitMain('ignore build');
  const w = sb.work();
  fs.mkdirSync(path.join(w.wt, 'build'));
  fs.writeFileSync(path.join(w.wt, 'build/out.js'), 'out\n');
  fs.mkdirSync(path.join(w.wt, 'node_modules'));
  fs.writeFileSync(path.join(w.wt, 'node_modules/x'), 'dep\n');
  const r = sb.release(w.id);
  assert.equal(r.json.removed, true, JSON.stringify(r.json));
  assertRemoved(sb, w.wt);
});

// 3
test('session started under fr_FR is still in-use when swept under LANG=C', (t) => {
  const sb = sandbox(t);
  const fr = { LANG: 'fr_FR.UTF-8' };
  if (ps(sb.A.pid, fr) === ps(sb.A.pid, { LANG: 'C' })) return t.skip('fr_FR.UTF-8 locale unavailable');
  const w = { ...sb.ok(['acquire', '--task', 'P-001', '--role', 'worker'], { env: fr }) };
  const out = sb.sweep([], { session: sb.B, env: { LANG: 'C' } });
  assertRetained(sb, out, w.path, 'in-use');
  const again = sb.sweep([], { session: sb.A, env: { LANG: 'C' } });
  assertRetained(sb, again, w.path, 'in-use');
});

test('session started under TZ=Asia/Tokyo is still in-use when swept under TZ=UTC', (t) => {
  const sb = sandbox(t);
  if (ps(sb.A.pid, { TZ: 'Asia/Tokyo' }) === ps(sb.A.pid, { TZ: 'UTC' })) return t.skip('TZ has no effect on ps');
  const w = sb.ok(['acquire', '--task', 'P-001', '--role', 'worker'], { env: { TZ: 'Asia/Tokyo' } });
  const out = sb.sweep([], { session: sb.B, env: { TZ: 'UTC' } });
  assertRetained(sb, out, w.path, 'in-use');
});

// 4
test('non-ASCII primary path: process cwd in a released worktree is still seen under LC_ALL=C', async (t) => {
  const sb = sandbox(t, { projName: 'café proj' });
  const w = sb.work();
  const child = spawn('sleep', ['600'], { cwd: w.wt, stdio: 'ignore' });
  await once(child, 'spawn');
  t.after(() => child.kill('SIGKILL'));
  const env = { LC_ALL: 'C' };
  const r = sb.release(w.id, 'merge-ready', [], { env });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.json.removed, false, JSON.stringify(r.json));
  assert.ok(codesOf(r.json.reasons).includes('process-cwd'), JSON.stringify(r.json));
  assertRetained(sb, sb.sweep([], { env }), w.wt, 'process-cwd');
});

// 5
test('unreadable worktrees parent never removes a worktree with an uncommitted edit', (t) => {
  if (process.getuid?.() === 0) return t.skip('root ignores chmod');
  const sb = sandbox(t);
  const w = sb.work();
  fs.writeFileSync(path.join(w.wt, 'README.md'), 'precious\n');
  const parent = path.dirname(w.wt);
  try {
    fs.chmodSync(parent, 0o000);
    const r = sb.release(w.id);
    assert.notEqual(r.json?.removed, true, r.stdout + r.stderr);
    const s = sb.run(['sweep']);
    assert.ok(!(s.json?.removed ?? []).some((e) => e.id === w.id), s.stdout + s.stderr);
  } finally {
    fs.chmodSync(parent, 0o755);
  }
  assert.ok(exists(w.wt));
  assert.equal(fs.readFileSync(path.join(w.wt, 'README.md'), 'utf8'), 'precious\n');
  assert.match(sb.git(w.wt, 'status', '--porcelain'), /README\.md/);
});

test('worker directory moved elsewhere with a staged file is retained as missing and can be repaired', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  fs.writeFileSync(path.join(w.wt, 'staged.txt'), 'staged\n');
  sb.git(w.wt, 'add', 'staged.txt');
  const admin = sb.git(w.wt, 'rev-parse', '--absolute-git-dir');
  const moved = path.join(sb.root, 'moved-wt');
  fs.renameSync(w.wt, moved);
  const r = sb.release(w.id);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.json.removed, false, JSON.stringify(r.json));
  const out = sb.sweep();
  const entry = sb.retained(out, w.wt);
  assert.ok(entry, JSON.stringify(out));
  assert.ok(codesOf(entry.reasons).includes('missing'), JSON.stringify(entry.reasons));
  assert.ok(!out.removed.some((e) => e.id === w.id));
  assert.ok(exists(admin), 'admin metadata must survive');
  assert.equal(sb.gitSafe(sb.proj, 'worktree', 'repair', moved).status, 0);
  assert.equal(sb.git(moved, 'status', '--porcelain'), 'A  staged.txt');
  assert.equal(fs.readFileSync(path.join(moved, 'staged.txt'), 'utf8'), 'staged\n');
});

// 6
test('with core.logAllRefUpdates=false a reviewer commit abandoned by checkout --detach is retained', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  sb.git(sb.proj, 'config', 'core.logAllRefUpdates', 'false');
  const rv = sb.ok(['acquire', '--task', 'P-001', '--role', 'reviewer', '--at', w.head, '--owner', 'rev'], { session: sb.B });
  fs.writeFileSync(path.join(rv.path, 'review-note.txt'), 'n\n');
  sb.git(rv.path, 'add', 'review-note.txt');
  sb.git(rv.path, 'commit', '-m', 'review commit');
  const orphan = sb.git(rv.path, 'rev-parse', 'HEAD');
  sb.git(rv.path, 'checkout', '--detach', sb.headMain());
  const r = sb.release(rv.id, 'verdict-recorded', [], { session: sb.B });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.json.removed, false, JSON.stringify(r.json));
  const entry = sb.retained(sb.sweep(), rv.path);
  assert.ok(entry && exists(rv.path), 'reviewer must be retained');
  const rc = codesOf(entry.reasons);
  assert.ok(rc.includes('check-failed') || rc.includes('reflog-only'), JSON.stringify(entry.reasons));
  assert.equal(sb.gitSafe(rv.path, 'cat-file', '-e', orphan).status, 0, 'orphan commit must survive');
});

// 7
test('commit held only by a per-worktree ref is retained as reflog-only', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  const c = sb.git(w.wt, 'commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'wip');
  sb.git(w.wt, 'update-ref', 'refs/worktree/wip', c);
  expectRetained(sb, w, 'reflog-only');
  assert.equal(sb.git(w.wt, 'rev-parse', 'refs/worktree/wip'), c);
});

// 9
test('embedded repo added without .gitmodules is retained as submodules', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  const lib = path.join(w.wt, 'vendor/lib');
  fs.mkdirSync(lib, { recursive: true });
  sb.git(lib, 'init', '-b', 'main');
  fs.writeFileSync(path.join(lib, 'lib.txt'), 'lib\n');
  sb.git(lib, 'add', '-A');
  sb.git(lib, 'commit', '-m', 'lib');
  sb.git(w.wt, 'add', 'vendor/lib');
  assert.ok(!exists(path.join(w.wt, '.gitmodules')));
  expectRetained(sb, w, 'submodules');
  assert.equal(fs.readFileSync(path.join(lib, 'lib.txt'), 'utf8'), 'lib\n');
});

// Concurrency review findings.
test('an acquire that died after git worktree add is adopted from its intent, not stuck as not-futari', (t) => {
  const sb = sandbox(t);
  // Simulate the crash window: the intent exists and git created the worktree, but no record was written.
  const id = 'P-001-worker-c0ffee';
  const target = path.join(real(path.join(sb.proj, '.futari')), 'worktrees', id);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const intent = { schemaVersion: 1, id, planId: 'test-plan', task: 'P-001', role: 'worker', owner: 'test', branch: 'futari/P-001',
    taskBranch: 'futari/P-001', path: target, createdAt: new Date().toISOString(), state: 'active', releasedAt: null,
    releaseReason: null, pr: null, lease: 1, session: { id: sb.A.id, pid: sb.A.pid, host: os.hostname(),
      started: spawnSync('ps', ['-o', 'lstart=', '-p', String(sb.A.pid)], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' } }).stdout.trim() } };
  fs.mkdirSync(path.join(sb.proj, '.git/futari/pending'), { recursive: true });
  fs.writeFileSync(path.join(sb.proj, `.git/futari/pending/${id}.json`), JSON.stringify(intent));
  sb.git(sb.proj, 'worktree', 'add', '-b', 'futari/P-001', target, 'HEAD');
  const again = sb.ok(['acquire', '--task', 'P-001', '--role', 'worker']);
  assert.equal(again.recovered, true);
  assert.equal(again.id, id);
  assert.equal(sb.listed().length, 2, 'no duplicate worktree');
  assert.ok(!exists(path.join(sb.proj, `.git/futari/pending/${id}.json`)), 'intent consumed');
});

test('a second live process resuming the same session ID is refused as in-use', (t) => {
  const sb = sandbox(t);
  const first = sb.ok(['acquire', '--task', 'P-001', '--role', 'worker'], { session: sb.A });
  const twin = { id: sb.A.id, pid: sb.spawnLive() };
  const r = sb.run(['acquire', '--task', 'P-001', '--role', 'worker'], { session: twin });
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.equal(r.json.error, 'in-use');
  assert.equal(sb.ok(['acquire', '--task', 'P-001', '--role', 'worker'], { session: sb.A }).id, first.id, 'the original process still owns it');
});

test('a release carrying a stale lease does not remove a worktree that was acquired again', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  assert.equal(w.lease, 1);
  const again = sb.ok(['acquire', '--task', 'P-001', '--role', 'worker']);
  assert.equal(again.lease, 2);
  const stale = sb.release(w.id, 'merge-ready', ['--lease', '1']);
  assert.equal(stale.status, 3, stale.stdout + stale.stderr);
  assert.equal(stale.json.error, 'reacquired');
  assert.ok(exists(w.wt));
  const current = sb.release(w.id, 'merge-ready', ['--lease', '2']);
  assert.equal(current.json.removed, true, current.stdout);
  assertRemoved(sb, w.wt);
});

test('the lock is not held while a sweep waits on a slow remote', async (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  const unblock = await sb.releasedButBlocked(w);
  await unblock();
  sb.git(sb.proj, 'config', 'remote.origin.uploadpack', 'sleep 3; git-upload-pack');
  const slow = sb.runAsync(['sweep']);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const t0 = Date.now();
  // Task P-002 has no remote branch; its own ls-remote is also slow but runs outside the lock.
  const other = sb.run(['acquire', '--task', 'P-002', '--role', 'worker'], { env: { FUTARI_LOCK_TIMEOUT_MS: '1500' } });
  assert.equal(other.status, 0, `acquire waited on the sweep's network call: ${other.stdout}${other.stderr}`);
  assert.ok(Date.now() - t0 < 6000);
  const swept = await slow;
  assert.equal(swept.status, 0, swept.stdout + swept.stderr);
  assert.ok(swept.json.removed.some((e) => e.id === w.id));
});

// Final verification findings.
test('acquire refuses a locked worktree instead of handing out a possibly half checked-out tree', (t) => {
  const sb = sandbox(t);
  const first = sb.ok(['acquire', '--task', 'P-001', '--role', 'worker']);
  sb.git(sb.proj, 'worktree', 'lock', '--reason', 'initializing', first.path);
  const r = sb.run(['acquire', '--task', 'P-001', '--role', 'worker']);
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.equal(r.json.error, 'locked');
});

test('a deleted worktree whose admin directory holds submodule repositories keeps its metadata', (t) => {
  const sb = sandbox(t);
  const w = sb.work();
  const admin = sb.git(w.wt, 'rev-parse', '--absolute-git-dir');
  fs.mkdirSync(path.join(admin, 'modules', 'sub'), { recursive: true });
  assert.equal(sb.release(w.id, 'merge-ready').json.removed, false, 'a live tree with modules is not removable either way');
  fs.rmSync(w.wt, { recursive: true, force: true });
  const out = sb.sweep();
  const entry = out.retained.find((e) => e.id === w.id);
  assert.ok(entry && codesOf(entry.reasons).includes('submodules'), JSON.stringify(out));
  assert.ok(exists(path.join(admin, 'modules', 'sub')));
});

test('a stale lock with a fresh break guard times out at the deadline instead of spinning', (t) => {
  const sb = sandbox(t);
  const lock = path.join(sb.proj, '.git/futari/worktrees.lock');
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  fs.writeFileSync(lock, JSON.stringify({ pid: spawnSync('true').pid, host: os.hostname(), started: null, token: 'dead' }));
  fs.writeFileSync(`${lock}.break`, '1');
  const t0 = Date.now();
  const r = sb.run(['sweep'], { env: { FUTARI_LOCK_TIMEOUT_MS: '1000' } });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.json.error, /Timed out/);
  assert.ok(Date.now() - t0 < 5000, `took ${Date.now() - t0}ms`);
});
