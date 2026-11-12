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
import { mkdtempSync, existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, utimesSync } from 'node:fs';
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
function start(args, { lock, steps, pollMs = 100, graceMs } = {}) {
  const env = { ...process.env, WHEELHOUSE_FULL_CHECK_LOCK: lock, WHEELHOUSE_FULL_CHECK_POLL_MS: String(pollMs) };
  if (graceMs) env.WHEELHOUSE_FULL_CHECK_GRACE_MS = String(graceMs);
  delete env.NODE_TEST_CONTEXT;
  if (steps) env.WHEELHOUSE_FULL_CHECK_STEPS = JSON.stringify(steps);
  const child = spawn(process.execPath, [SCRIPT, ...args], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  const done = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal, out })));
  const exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
  return { child, done, exited, output: () => out };
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

// Before the script, sessions queued by hand on the same folder, writing a plain
// `owner` file: "<pid> <worktree> <branch> <date>" (11 Nov). The script honours
// those too, rather than calling them stale a minute in.
test('a hand-made lock with a plain owner file is waited for while its process lives, and taken over once it has gone', async () => {
  const s = scratch();
  let run;
  try {
    mkdirSync(s.lock);
    utimesSync(s.lock, new Date(Date.now() - 5 * 60_000), new Date(Date.now() - 5 * 60_000));
    writeFileSync(path.join(s.lock, 'owner'), `${process.pid} /elsewhere/worktree claude/by-hand ${new Date().toString()}\n`);
    run = start(['--lock-only', '--', process.execPath, '-e', `require('fs').appendFileSync(${JSON.stringify(s.log)}, 'ran\\n')`], { lock: s.lock });
    await until(() => /holds the full-run lock/.test(run.output()), 'the run to say it is waiting');
    assert.match(run.output(), new RegExp(`claude/by-hand in /elsewhere/worktree \\(pid ${process.pid}`));
    await new Promise((r) => setTimeout(r, 500));
    assert.deepEqual(logLines(s.log), [], 'the run took a live hand-made lock');
    const gone = spawn(process.execPath, ['-e', '0']);
    await new Promise((r) => gone.on('close', r));
    writeFileSync(path.join(s.lock, 'owner'), `${gone.pid} /elsewhere/worktree claude/by-hand ${new Date().toString()}\n`);
    const out = await run.done;
    assert.equal(out.code, 0, out.out);
    assert.deepEqual(logLines(s.log), ['ran']);
    assert.ok(!existsSync(s.lock), 'the lock was left behind');
  } finally {
    run?.child.kill('SIGKILL');
    rmSync(s.dir, { recursive: true, force: true });
  }
});

// Several runs waiting when a holder dies must still go one at a time. The first
// version let two in about one time in five: one waiter moved aside the lock
// another had just made, before its owner file was written (review, 11 Nov).
test('several runs waiting on a stale lock still go one at a time', async () => {
  for (let round = 0; round < 8; round++) {
    const s = scratch();
    const runs = [];
    try {
      const gone = spawn(process.execPath, ['-e', '0']);
      await new Promise((r) => gone.on('close', r));
      mkdirSync(s.lock);
      writeFileSync(path.join(s.lock, 'owner.json'), JSON.stringify({ pid: gone.pid, started: new Date().toISOString() }));
      const cmd = `const f = require('fs'); f.appendFileSync(${JSON.stringify(s.log)}, 'in\\n'); setTimeout(() => { f.appendFileSync(${JSON.stringify(s.log)}, 'out\\n'); process.exit(0) }, 300); setTimeout(() => process.exit(9), 30000)`;
      for (let i = 0; i < 3; i++) runs.push(start(['--lock-only', '--', process.execPath, '-e', cmd], { lock: s.lock, pollMs: 20 }));
      const outs = await Promise.all(runs.map((r) => r.done));
      for (const o of outs) assert.equal(o.code, 0, o.out);
      assert.deepEqual(logLines(s.log), ['in', 'out', 'in', 'out', 'in', 'out'], `round ${round}: two runs held the lock at once`);
      assert.ok(!existsSync(s.lock), 'the lock was left behind');
    } finally {
      for (const r of runs) r.child.kill('SIGKILL');
      rmSync(s.dir, { recursive: true, force: true });
    }
  }
});

// A dead holder's process number can be handed to a new process later. A lock
// whose "holder" started after the lock was taken is stale, not held.
test('a lock whose process number now belongs to a newer process is taken over', async () => {
  const s = scratch();
  let run;
  try {
    mkdirSync(s.lock);
    writeFileSync(path.join(s.lock, 'owner.json'), JSON.stringify({ pid: process.pid, branch: 'old', started: new Date(Date.now() - 24 * 3600_000).toISOString() }));
    run = start(['--lock-only', '--', process.execPath, '-e', `require('fs').appendFileSync(${JSON.stringify(s.log)}, 'ran\\n')`], { lock: s.lock });
    const out = await run.done;
    assert.equal(out.code, 0, out.out);
    assert.deepEqual(logLines(s.log), ['ran']);
    assert.match(out.out, /stale/);
  } finally {
    run?.child.kill('SIGKILL');
    rmSync(s.dir, { recursive: true, force: true });
  }
});

// First come, first served (Front desk, 12 Nov): with every waiter checking
// every 30 s, whoever checked first after the lock went got it, and one session
// took it several times running while others waited over an hour. Each waiter
// now takes a ticket in a queue folder beside the lock, and only the oldest
// waiting may go.
const holdFor = (s, word, ms) => ['--lock-only', '--', process.execPath, '-e',
  `const f = require('fs'); f.appendFileSync(${JSON.stringify(s.log)}, '${word} in\\n'); setTimeout(() => { f.appendFileSync(${JSON.stringify(s.log)}, '${word} out\\n'); process.exit(0) }, ${ms}); setTimeout(() => process.exit(9), 30000)`];
const queueOf = (s) => `${s.lock}.queue`;
const tickets = (s) => (existsSync(queueOf(s)) ? readdirSync(queueOf(s)) : []);

test('waiting runs go in the order they came, not whoever checks first', async () => {
  const s = scratch();
  const runs = [];
  try {
    runs.push(start(holdFor(s, 'first', 1500), { lock: s.lock }));
    await until(() => logLines(s.log).includes('first in'), 'the first run to start');
    // Each later run checks more often than the one before it, so without a
    // queue the last to come would get in first.
    for (const [word, pollMs] of [['a', 900], ['b', 300], ['c', 50]]) {
      const run = start(holdFor(s, word, 100), { lock: s.lock, pollMs });
      runs.push(run);
      await until(() => /holds the full-run lock/.test(run.output()), `${word} to say it is waiting`);
    }
    const outs = await Promise.all(runs.map((r) => r.done));
    for (const o of outs) assert.equal(o.code, 0, o.out);
    assert.deepEqual(logLines(s.log), ['first in', 'first out', 'a in', 'a out', 'b in', 'b out', 'c in', 'c out']);
    assert.match(runs[3].output(), /2 runs ahead of this one/);
    assert.deepEqual(tickets(s), [], 'a ticket was left behind');
  } finally {
    for (const r of runs) r.child.kill('SIGKILL');
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test('a ticket left by a waiter that has gone holds no one up, and is cleared', async () => {
  const s = scratch();
  let run;
  try {
    const gone = spawn(process.execPath, ['-e', '0']);
    await new Promise((r) => gone.on('close', r));
    mkdirSync(queueOf(s));
    const old = new Date(Date.now() - 60_000);
    writeFileSync(path.join(queueOf(s), `${String(old.getTime()).padStart(15, '0')}-${gone.pid}.json`), JSON.stringify({ pid: gone.pid, branch: 'gone', started: old.toISOString() }));
    run = start(['--lock-only', '--', process.execPath, '-e', `require('fs').appendFileSync(${JSON.stringify(s.log)}, 'ran\\n')`], { lock: s.lock });
    const out = await run.done;
    assert.equal(out.code, 0, out.out);
    assert.deepEqual(logLines(s.log), ['ran']);
    assert.deepEqual(tickets(s), [], 'the dead waiter\'s ticket was left');
  } finally {
    run?.child.kill('SIGKILL');
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test('a run stopped while it waits gives up its place in the queue', async () => {
  const s = scratch();
  const runs = [];
  try {
    runs.push(start(holdFor(s, 'first', 1500), { lock: s.lock }));
    await until(() => logLines(s.log).includes('first in'), 'the first run to start');
    const quitter = start(holdFor(s, 'quitter', 100), { lock: s.lock });
    runs.push(quitter);
    await until(() => /holds the full-run lock/.test(quitter.output()), 'the quitter to say it is waiting');
    const next = start(holdFor(s, 'next', 100), { lock: s.lock });
    runs.push(next);
    await until(() => /holds the full-run lock/.test(next.output()), 'the next run to say it is waiting');
    assert.equal(tickets(s).length, 2);
    quitter.child.kill('SIGTERM');
    assert.equal(await quitter.exited, 143, quitter.output());
    assert.equal(tickets(s).length, 1, 'the stopped run kept its ticket');
    const outs = await Promise.all([runs[0].done, next.done]);
    for (const o of outs) assert.equal(o.code, 0, o.out);
    assert.deepEqual(logLines(s.log), ['first in', 'first out', 'next in', 'next out']);
  } finally {
    for (const r of runs) r.child.kill('SIGKILL');
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test('a step that ignores the stop signal is killed after the grace time, before the lock goes', async () => {
  const s = scratch();
  let run;
  try {
    run = start(['--lock-only', '--', process.execPath, '-e',
      `process.on('SIGTERM', () => {}); process.on('SIGINT', () => {}); require('fs').appendFileSync(${JSON.stringify(s.log)}, process.pid + '\\n'); setTimeout(() => process.exit(9), 30000)`], { lock: s.lock, graceMs: 500 });
    await until(() => logLines(s.log).length === 1, 'the command to start');
    const commandPid = Number(logLines(s.log)[0]);
    const stopped = Date.now();
    run.child.kill('SIGTERM');
    assert.equal(await run.exited, 143, run.output());
    assert.ok(Date.now() - stopped < 5000, `took ${Date.now() - stopped} ms to stop`);
    assert.ok(!existsSync(s.lock), 'the lock was left behind');
    assert.throws(() => process.kill(commandPid, 0), 'the step was still running after the lock went');
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
