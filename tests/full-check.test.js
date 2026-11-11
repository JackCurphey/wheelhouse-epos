// One full test run on the Mac at a time (Jack, 11 Nov): `npm run full-check`
// (scripts/full-check.mjs) takes a Mac-wide lock, runs lint, npm test and the
// browser tests, and lets the lock go however it ends. Before it, the Front desk
// session handed out turns by hand, because two full runs at once overloaded the
// Mac and the shared Postgres and tests that pass alone failed.
//
// These runs use a lock in a temporary folder and fake step commands, never the
// real suites. Every child is killed in `finally`, so a failing test leaves
// nothing running.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_STEPS } from '../scripts/full-check.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'full-check.mjs');
const NODE = JSON.stringify(process.execPath);

function scratch() {
  const dir = mkdtempSync(path.join(tmpdir(), 'full-check-test-'));
  return { dir, lock: path.join(dir, 'run.lock'), log: path.join(dir, 'log.txt') };
}

// Starts the script; `done` resolves with its exit code, signal and output.
function start(args, { lock, steps } = {}) {
  const env = { ...process.env, WHEELHOUSE_FULL_CHECK_LOCK: lock, WHEELHOUSE_FULL_CHECK_POLL_MS: '100' };
  delete env.NODE_TEST_CONTEXT;
  if (steps) env.WHEELHOUSE_FULL_CHECK_STEPS = JSON.stringify(steps);
  const child = spawn(process.execPath, [SCRIPT, ...args], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  const done = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal, out })));
  return { child, done, output: () => out };
}

async function until(check, what, ms = 10_000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error(`gave up waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

// A step command: appends `word` to the log, then exits with `code`. It runs
// through a small script in the scratch folder, to keep the shell quoting plain.
function step(s, word, code = 0) {
  const file = path.join(s.dir, 'step.cjs');
  writeFileSync(file, "require('fs').appendFileSync(process.argv[2], process.argv[3] + '\\n'); process.exit(Number(process.argv[4]));");
  return `${NODE} ${JSON.stringify(file)} ${JSON.stringify(s.log)} ${word} ${code}`;
}

const logLines = (log) => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : []);

test('the default steps are lint, the server tests and the browser tests, in that order', () => {
  assert.deepEqual(DEFAULT_STEPS.map(([, cmd]) => cmd), ['npm run lint', 'npm test', 'npm run test:browser']);
});

test('package.json runs the queue as npm run full-check', () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['full-check'], 'node scripts/full-check.mjs');
});

test('the lock is exclusive: a second run waits, says who holds it, and goes after the first', async () => {
  const s = scratch();
  const runs = [];
  try {
    const first = start(['--lock-only', '--', process.execPath, '-e',
      `require('fs').appendFileSync(${JSON.stringify(s.log)}, 'first in\\n'); setTimeout(() => { require('fs').appendFileSync(${JSON.stringify(s.log)}, 'first out\\n'); process.exit(0) }, 1500); setTimeout(() => process.exit(9), 30000)`], { lock: s.lock });
    runs.push(first);
    await until(() => logLines(s.log).includes('first in'), 'the first run to start');
    const second = start(['--lock-only', '--', process.execPath, '-e',
      `require('fs').appendFileSync(${JSON.stringify(s.log)}, 'second in\\n')`], { lock: s.lock });
    runs.push(second);
    await until(() => /holds the full-run lock/.test(second.output()), 'the second run to say it is waiting');
    assert.match(second.output(), new RegExp(`pid ${first.child.pid}`));
    assert.ok(!logLines(s.log).includes('second in'), 'the second run went while the first held the lock');
    const [a, b] = await Promise.all([first.done, second.done]);
    assert.equal(a.code, 0, a.out);
    assert.equal(b.code, 0, b.out);
    assert.deepEqual(logLines(s.log), ['first in', 'first out', 'second in']);
    assert.ok(!existsSync(s.lock), 'the lock was left behind');
  } finally {
    for (const r of runs) r.child.kill('SIGKILL');
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test('a lock whose process has gone is taken over', async () => {
  const s = scratch();
  let run;
  try {
    const gone = spawn(process.execPath, ['-e', '0']);
    await new Promise((r) => gone.on('close', r));
    mkdirSync(s.lock);
    writeFileSync(path.join(s.lock, 'owner.json'), JSON.stringify({ pid: gone.pid, worktree: '/somewhere', branch: 'old', commit: 'abc1234', started: new Date().toISOString() }));
    run = start(['--lock-only', '--', process.execPath, '-e', `require('fs').appendFileSync(${JSON.stringify(s.log)}, 'ran\\n')`], { lock: s.lock });
    const out = await run.done;
    assert.equal(out.code, 0, out.out);
    assert.deepEqual(logLines(s.log), ['ran']);
    assert.match(out.out, /stale/);
    assert.ok(!existsSync(s.lock), 'the lock was left behind');
  } finally {
    run?.child.kill('SIGKILL');
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test('a held lock names its holder in the owner file while the command runs', async () => {
  const s = scratch();
  let run;
  try {
    run = start(['--lock-only', '--', process.execPath, '-e',
      `require('fs').appendFileSync(${JSON.stringify(s.log)}, 'in\\n'); setTimeout(() => process.exit(0), 1000)`], { lock: s.lock });
    await until(() => logLines(s.log).includes('in'), 'the command to start');
    const owner = JSON.parse(readFileSync(path.join(s.lock, 'owner.json'), 'utf8'));
    assert.equal(owner.pid, run.child.pid);
    assert.equal(owner.worktree, ROOT);
    for (const key of ['branch', 'commit', 'started']) assert.ok(owner[key], `owner.${key} is empty`);
    await run.done;
  } finally {
    run?.child.kill('SIGKILL');
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test('a failing command lets the lock go and passes on its exit code', async () => {
  const s = scratch();
  try {
    const out = await start(['--lock-only', '--', process.execPath, '-e', 'process.exit(3)'], { lock: s.lock }).done;
    assert.equal(out.code, 3, out.out);
    assert.ok(!existsSync(s.lock), 'the lock was left behind');
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});

for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  test(`${signal} (Ctrl-C or a stop) lets the lock go and stops the command`, async () => {
    const s = scratch();
    let run;
    try {
      run = start(['--lock-only', '--', process.execPath, '-e',
        `require('fs').appendFileSync(${JSON.stringify(s.log)}, process.pid + '\\n'); setTimeout(() => process.exit(9), 30000)`], { lock: s.lock });
      await until(() => logLines(s.log).length === 1, 'the command to start');
      assert.ok(existsSync(s.lock), 'the lock was not taken');
      const commandPid = Number(logLines(s.log)[0]);
      run.child.kill(signal);
      const out = await run.done;
      assert.equal(out.code, code, out.out);
      assert.ok(!existsSync(s.lock), 'the lock was left behind');
      await until(() => { try { process.kill(commandPid, 0); return false; } catch { return true; } }, 'the command to stop', 5000);
    } finally {
      run?.child.kill('SIGKILL');
      rmSync(s.dir, { recursive: true, force: true });
    }
  });
}

test('all three steps run when one fails, each gets a summary line, and the run fails', async () => {
  const s = scratch();
  try {
    const steps = [['lint', step(s, 'lint')], ['tests', step(s, 'tests', 1)], ['browser tests', step(s, 'browser')]];
    const out = await start([], { lock: s.lock, steps }).done;
    assert.equal(out.code, 1, out.out);
    assert.deepEqual(logLines(s.log), ['lint', 'tests', 'browser']);
    assert.match(out.out, /^full-check: lint\s+passed/m);
    assert.match(out.out, /^full-check: tests\s+FAILED \(exit 1\)/m);
    assert.match(out.out, /^full-check: browser tests\s+passed/m);
    assert.ok(!existsSync(s.lock), 'the lock was left behind');
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test('when every step passes the run passes', async () => {
  const s = scratch();
  try {
    const steps = [['lint', step(s, 'lint')], ['tests', step(s, 'tests')]];
    const out = await start([], { lock: s.lock, steps }).done;
    assert.equal(out.code, 0, out.out);
    assert.match(out.out, /all steps passed/);
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});
