#!/usr/bin/env node
// One full test run on this Mac at a time (Jack, 11 Nov).
//
//   npm run full-check                          lint, npm test, the browser tests
//   npm run full-check -- --lock-only -- <cmd>  any other command, e.g. a stress run
//
// Several sessions build on one Mac, and two full runs at once overload it and
// the shared Postgres: tests that pass alone fail. So a run first takes a lock
// shared by every worktree, a folder made with mkdir (which only one process can
// do), holding owner.json: pid, worktree, branch, commit and start time. While
// another run holds it, this one says who and since when, and checks again every
// 30 seconds. A lock whose process has gone is stale and is taken over. The lock
// is let go on exit, on Ctrl-C or another stop signal, and on errors.
//
// The three steps all run, even after one fails, so one turn in the queue gives
// the whole picture; the run fails if any step did.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEFAULT_STEPS = [
  ['lint', 'npm run lint'],
  ['npm test', 'npm test'],
  ['browser tests', 'npm run test:browser'],
];

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// /tmp, not os.tmpdir(): on a Mac that is a folder per user, and the lock is the Mac's.
const LOCK = process.env.WHEELHOUSE_FULL_CHECK_LOCK || '/tmp/wheelhouse-full-run.lock';
const OWNER = path.join(LOCK, 'owner.json');
const POLL_MS = Number(process.env.WHEELHOUSE_FULL_CHECK_POLL_MS) || 30_000;
// A lock folder with no owner file yet is being taken right now, unless it is older than this.
const HALF_MADE_MS = 60_000;

const say = (line) => console.log(`full-check: ${line}`);

function git(...args) {
  const out = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return out.status === 0 ? out.stdout.trim() : '';
}

// owner.json, or the plain `owner` file sessions wrote when they queued by hand
// on the same folder before this script (11 Nov): "<pid> <worktree> <branch> <date>".
function readOwnerIn(dir) {
  try { return JSON.parse(readFileSync(path.join(dir, 'owner.json'), 'utf8')); } catch { /* try the plain one */ }
  try {
    const [pid, worktree, branch, ...date] = readFileSync(path.join(dir, 'owner'), 'utf8').trim().split(/\s+/);
    if (!/^\d+$/.test(pid)) return null;
    const started = new Date(date.join(' '));
    return { pid: Number(pid), worktree, branch, started: Number.isNaN(started.getTime()) ? null : started.toISOString() };
  } catch { return null; }
}
const readOwner = () => readOwnerIn(LOCK);

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (err) { return err.code === 'EPERM'; }
}

function lockAge() {
  try { return Date.now() - statSync(LOCK).mtimeMs; } catch { return 0; }
}

function describe(owner) {
  const since = owner.started ? new Date(owner.started) : null;
  const when = since
    ? `since ${since.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} (${Math.round((Date.now() - since.getTime()) / 60_000)} min)`
    : 'since [time]';
  return `${owner.branch || '[branch]'} in ${owner.worktree || '[worktree]'} (pid ${owner.pid}, commit ${owner.commit || '[commit]'}) holds the full-run lock, ${when}`;
}

let held = false;

function tryTake() {
  try {
    mkdirSync(LOCK);
  } catch (err) {
    if (err.code === 'EEXIST') return false;
    throw err;
  }
  held = true;
  writeFileSync(OWNER, JSON.stringify({
    pid: process.pid,
    worktree: ROOT,
    branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
    commit: git('rev-parse', '--short', 'HEAD'),
    started: new Date().toISOString(),
  }, null, 2));
  return true;
}

// Moves a stale lock aside (a rename only one waiter can win), then removes it.
// If the folder moved turns out to be a live run's (it took the lock between our
// look and the rename), it is put back.
function clearStale(stalePid) {
  const aside = `${LOCK}.stale-${process.pid}-${Date.now()}`;
  try { renameSync(LOCK, aside); } catch { return; }
  const moved = readOwnerIn(aside);
  if (moved && moved.pid !== stalePid && alive(moved.pid)) {
    try { renameSync(aside, LOCK); return; } catch { /* a third run has it now; the moved one's own release copes */ }
  }
  rmSync(aside, { recursive: true, force: true });
}

async function takeLock() {
  let lastSaid = '';
  for (;;) {
    if (tryTake()) return;
    const owner = readOwner();
    if (owner && !alive(owner.pid)) {
      say(`the lock held by pid ${owner.pid} (${owner.branch || '[branch]'}) is stale: that process has gone. Taking it over.`);
      clearStale(owner.pid);
      continue;
    }
    if (!owner && lockAge() > HALF_MADE_MS) {
      say('the lock has no owner file and is over a minute old, so it is stale. Taking it over.');
      clearStale(undefined);
      continue;
    }
    const line = owner ? describe(owner) : 'another run is taking the lock';
    if (line !== lastSaid) say(`${line}. Waiting; checking again every ${Math.round(POLL_MS / 1000)} s.`);
    lastSaid = line;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

function releaseLock() {
  if (!held) return;
  held = false;
  if (readOwner()?.pid === process.pid) rmSync(LOCK, { recursive: true, force: true });
}

let current = null;

function run(command, args) {
  return new Promise((resolve) => {
    current = args
      ? spawn(command, args, { cwd: process.cwd(), stdio: 'inherit' })
      : spawn(command, { cwd: ROOT, stdio: 'inherit', shell: true });
    current.on('error', (err) => { say(`could not start ${command}: ${err.message}`); resolve(127); });
    current.on('close', (code, signal) => { current = null; resolve(code ?? (signal ? 128 : 1)); });
  });
}

const SIGNALS = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 };

function main(argv) {
  process.on('exit', releaseLock);
  for (const [signal, code] of Object.entries(SIGNALS)) {
    // The running step is stopped too, and given up to 10 s to finish stopping,
    // so the next run in the queue doesn't start while it is still winding down.
    process.on(signal, () => {
      say(`stopped by ${signal}; letting the lock go.`);
      if (!current) process.exit(code);
      current.once('close', () => process.exit(code));
      current.kill(signal);
      setTimeout(() => process.exit(code), 10_000);
    });
  }
  process.on('uncaughtException', (err) => { console.error(err); process.exit(1); });
  process.on('unhandledRejection', (err) => { console.error(err); process.exit(1); });

  const lockOnly = argv[0] === '--lock-only';
  const command = lockOnly ? argv.slice(argv[1] === '--' ? 2 : 1) : [];
  if (lockOnly && command.length === 0) {
    console.error('usage: npm run full-check -- --lock-only -- <command> [args...]');
    process.exit(2);
  }
  if (!lockOnly && argv.length) {
    console.error(`full-check: unknown option ${argv[0]}. Use --lock-only -- <command>, or nothing.`);
    process.exit(2);
  }

  (async () => {
    await takeLock();
    say(`took the full-run lock (${LOCK}).`);
    if (lockOnly) {
      const code = await run(command[0], command.slice(1));
      say(`${command.join(' ')} exited with ${code}; letting the lock go.`);
      process.exit(code);
    }
    const steps = process.env.WHEELHOUSE_FULL_CHECK_STEPS ? JSON.parse(process.env.WHEELHOUSE_FULL_CHECK_STEPS) : DEFAULT_STEPS;
    const results = [];
    for (const [name, cmd] of steps) {
      say(`running ${name} (${cmd})`);
      const began = Date.now();
      const code = await run(cmd);
      results.push({ name, code, secs: Math.round((Date.now() - began) / 1000) });
    }
    const width = Math.max(...results.map((r) => r.name.length));
    console.log('');
    for (const r of results) {
      say(`${r.name.padEnd(width)}  ${r.code === 0 ? 'passed' : `FAILED (exit ${r.code})`}  ${r.secs} s`);
    }
    const failed = results.filter((r) => r.code !== 0).length;
    say(failed ? `${failed} of ${results.length} steps failed.` : 'all steps passed.');
    process.exit(failed ? 1 : 0);
  })();
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
