// The overnight runner's safety rules (scripts/overnight/run.py): the agent has no
// way to push, nothing with a secret in it leaves the machine, and a red branch is
// never built on. The rules are tested in Python, next to the runner.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const python = spawnSync('python3', ['--version']);
// Skipping is fine on a machine without Python, never in CI: a skip reads as a pass.
if (process.env.CI && python.status !== 0) throw new Error('python3 is needed to test the overnight runner');

test('the overnight runner\'s own tests pass', { skip: python.status !== 0 && 'python3 is not installed' }, () => {
  const run = spawnSync('python3', ['-m', 'unittest', 'scripts/overnight/test_run.py'], { encoding: 'utf8', cwd: new URL('..', import.meta.url).pathname });
  assert.equal(run.status, 0, run.stderr);
});
