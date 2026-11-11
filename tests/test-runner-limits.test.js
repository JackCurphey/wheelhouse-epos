// npm test can't hang for hours: a test, a hook or a file that never finishes
// fails at the limit, naming itself, and a file whose tests are done
// exits even if something it opened is still running.
//
// Why: on 11 Nov two full runs were found stuck, one for 12 hours, one for 6,
// on files that pass alone, and every session waiting for a quiet Mac waited
// with them. The runner had no limit (--test-timeout 0).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'runner');
const script = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts.test;
const flags = script.split(/\s+/).filter((w) => w.startsWith('--'));

test('npm test sets a per-test limit of a few minutes, and lets a finished file exit', () => {
  const limit = flags.find((f) => f.startsWith('--test-timeout='));
  assert.ok(limit, script);
  const ms = Number(limit.split('=')[1]);
  // The limit is each file's as well as each test's (Node gives it to the run, and
  // every file inherits it). The slowest file's tests took about 61 s on a Mac at load
  // 27 (11 Nov); 5 minutes is well past that and still minutes, not hours.
  assert.ok(ms >= 180_000 && ms <= 600_000, `--test-timeout ${ms}`);
  assert.ok(flags.includes('--test-force-exit'), script);
});

// The same flags, with the limit made short so this takes seconds. Run as its
// own top-level runner: inheriting NODE_TEST_CONTEXT makes it report to this one.
function runWithNpmTestFlags(file) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const started = Date.now();
  const out = spawnSync(process.execPath, ['--test', ...flags.filter((f) => !f.startsWith('--test-timeout=')), '--test-timeout=1500', '--test-reporter=tap', path.join(FIXTURES, file)], {
    cwd: ROOT, env, encoding: 'utf8', timeout: 30_000,
  });
  return { ...out, took: Date.now() - started };
}

test('a test that never finishes fails at the limit, by name', () => {
  const out = runWithNpmTestFlags('hangs-in-a-test.fixture.mjs');
  // Killed at spawnSync's 30 s, a run reports SIGTERM or (Node 26 on a Mac) status 7.
  assert.ok(out.signal !== 'SIGTERM' && out.took < 29_000, 'the run itself hung');
  assert.notEqual(out.status, 0);
  // One report style everywhere: CI's runner would otherwise pick another one.
  // The limit is the file's as well as each test's, so on a slow machine the file
  // can reach it first (CI, 11 Nov): either name says where the hang is.
  assert.match(out.stdout, /^not ok \d+ - (waits for something that never comes|\S*hangs-in-a-test\.fixture\.mjs)$/m);
  assert.match(out.stdout, /timed out after 1500ms/);
  assert.ok(out.took < 20_000, `took ${out.took} ms`);
});

test('a file whose tests are done exits, even with something still open', () => {
  const out = runWithNpmTestFlags('never-exits.fixture.mjs');
  // Killed at spawnSync's 30 s, a run reports SIGTERM or (Node 26 on a Mac) status 7.
  assert.ok(out.signal !== 'SIGTERM' && out.took < 29_000, 'the run itself hung');
  assert.equal(out.status, 0, out.stdout);
  assert.ok(out.took < 20_000, `took ${out.took} ms`);
});
