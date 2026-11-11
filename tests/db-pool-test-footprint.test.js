// Under test, a pool hands an idle connection back to Postgres within a
// second, instead of holding it for pg's default 10 seconds.
//
// Why: every test file runs its own pool and usually starts a server with
// another, and the local Postgres allows 100 connections. One full run sat
// close to that; two at once (several sessions testing on one Mac) went past
// it, and Postgres refused new connections with "remaining connection slots
// are reserved for roles with the SUPERUSER attribute". Test servers then
// failed their start-up checks ("server exited early") and dozens of tests
// failed that pass alone (10 Nov). Most of the connections held were idle.
//
// A real server keeps pg's default, so a busy shop isn't reconnecting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB = path.join(ROOT, 'server', 'db.js');

// The pool's idle time in a fresh process with this environment.
function idleTimeoutWith(env) {
  const out = spawnSync(process.execPath, ['--input-type=module', '-e',
    `const { pool } = await import(${JSON.stringify(DB)}); process.stdout.write(String(pool.options.idleTimeoutMillis)); await pool.end();`], {
    cwd: ROOT, env, encoding: 'utf8',
  });
  assert.equal(out.status, 0, out.stderr);
  return Number(out.stdout);
}

const withoutTestMarks = () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_ENV;
  return env;
};

test('in a test process, an idle connection goes back within a second', async () => {
  const { pool } = await import('../server/db.js');
  try {
    assert.ok(pool.options.idleTimeoutMillis > 0 && pool.options.idleTimeoutMillis <= 1000, `was ${pool.options.idleTimeoutMillis}`);
  } finally {
    await pool.end();
  }
});

test('a test server (NODE_ENV=test, as tests/helpers/liveServer.js starts it) does the same', () => {
  const ms = idleTimeoutWith({ ...withoutTestMarks(), NODE_ENV: 'test' });
  assert.ok(ms > 0 && ms <= 1000, `was ${ms}`);
});

test('a real server keeps pg’s 10 seconds', () => {
  assert.equal(idleTimeoutWith(withoutTestMarks()), 10000);
});

// Under test, a wait for a lock gives up after a minute instead of never.
//
// Why: test runs from several sessions share one database, some tests change a
// shared table's shape mid-run (a trigger, a constraint), and nothing limited a
// lock wait. Full runs hung for hours (11 Nov) with no failure to say where. The
// longest wait a test means to cause is seconds; a minute is far past it, and a
// test that meets it now fails, naming the statement. A real server waits as before.
function lockTimeoutWith(env) {
  const out = spawnSync(process.execPath, ['--input-type=module', '-e',
    `const { pool } = await import(${JSON.stringify(DB)}); const { rows } = await pool.query('SHOW lock_timeout'); process.stdout.write(rows[0].lock_timeout); await pool.end();`], {
    cwd: ROOT, env, encoding: 'utf8',
  });
  assert.equal(out.status, 0, out.stderr);
  return out.stdout;
}

test('in a test process or a test server, a lock wait gives up after a minute', () => {
  assert.equal(lockTimeoutWith({ ...withoutTestMarks(), NODE_TEST_CONTEXT: 'child' }), '1min');
  assert.equal(lockTimeoutWith({ ...withoutTestMarks(), NODE_ENV: 'test' }), '1min');
});

test('a real server’s lock waits are left as they were', () => {
  assert.equal(lockTimeoutWith(withoutTestMarks()), '0');
});

// Under test, a statement stops after 90 seconds.
//
// Why: a test stopped at npm test's five-minute limit leaves its statement running,
// because Postgres only notices the process has gone when it next writes to it. On
// 11 Nov one such statement (an UPDATE of move_rows) ran on for 20 minutes holding its
// locks, and two other files then failed waiting for them. A statement that runs 90
// seconds now fails, naming itself, before the test's own limit; one left behind ends
// within 90 seconds instead of running on. A real server: unchanged.
function settingWith(env, name) {
  const out = spawnSync(process.execPath, ['--input-type=module', '-e',
    `const { pool } = await import(${JSON.stringify(DB)}); const { rows } = await pool.query('SELECT current_setting($1) AS v', [${JSON.stringify(name)}]); process.stdout.write(rows[0].v); await pool.end();`], {
    cwd: ROOT, env, encoding: 'utf8',
  });
  assert.equal(out.status, 0, out.stderr);
  return out.stdout;
}

test('under test, a statement stops after 90 seconds', () => {
  for (const env of [{ ...withoutTestMarks(), NODE_TEST_CONTEXT: 'child' }, { ...withoutTestMarks(), NODE_ENV: 'test' }]) {
    assert.equal(settingWith(env, 'statement_timeout'), '90s');
  }
});

test('a real server’s statements run as long as they did', () => {
  assert.equal(settingWith(withoutTestMarks(), 'statement_timeout'), '0');
});
