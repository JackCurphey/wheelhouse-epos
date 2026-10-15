// A script started through a symlinked path must still run (#151 follow-up,
// Jack, 7 Oct). The "run directly?" check compared path.resolve(argv[1]) with
// the module's own path, which Node resolves through symlinks, so a worktree
// under macOS's /tmp (itself a symlink) ran nothing and exited 0. Compared as
// real paths, as scripts/ci/assert-screen-trace.mjs already does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function runThroughSymlink(script, args) {
  const dir = mkdtempSync(path.join(tmpdir(), 'wh-symlink-'));
  try {
    const link = path.join(dir, 'repo');
    symlinkSync(ROOT, link, 'dir');
    return spawnSync(process.execPath, [path.join(link, script), ...args], { cwd: ROOT, encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('check-migrations.mjs still runs when started through a symlink', () => {
  const run = runThroughSymlink('scripts/ci/check-migrations.mjs', ['bogus']);
  assert.equal(run.status, 2, `expected the usage error, got exit ${run.status}: ${run.stderr}`);
  assert.match(run.stderr, /usage: check-migrations\.mjs/);
});

test('new-db.mjs still runs when started through a symlink', () => {
  const run = runThroughSymlink('scripts/dev/new-db.mjs', []);
  assert.equal(run.status, 1, `expected the usage error, got exit ${run.status}: ${run.stderr}`);
  assert.match(run.stderr, /usage: scripts\/new-db\.sh/);
});
