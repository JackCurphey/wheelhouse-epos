// WP-0.4's migration checks (split plan §4.2). The runner remembers what it
// has run by filename, so a renamed file runs twice and a low number runs out
// of order. These checks catch both in CI, before merge.
// The checker is itself checked, as tests/screen-trace.test.js does: a checker
// that passes on anything is a green light that means nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkPullRequest, checkMainOrder, appliedFiles, readMigrationsAt, readAddOrder,
} from '../scripts/ci/check-migrations.mjs';

const files = (obj) => new Map(Object.entries(obj));
const BASE = files({ '001_init.sql': 'a', '002_more.sql': 'b', '039_key.sql': 'c' });

test('a pull request that adds a higher number passes', () => {
  assert.deepEqual(checkPullRequest(BASE, files({ ...Object.fromEntries(BASE), '040_next.sql': 'd' })), []);
});

test('a new number equal to or lower than the highest on main fails', () => {
  const same = checkPullRequest(BASE, files({ ...Object.fromEntries(BASE), '039_clash.sql': 'd' }));
  assert.match(same.join('\n'), /039_clash\.sql.*higher than 039/);
  const low = checkPullRequest(BASE, files({ ...Object.fromEntries(BASE), '010_late.sql': 'd' }));
  assert.match(low.join('\n'), /010_late\.sql.*higher than 039/);
});

test('two new files with the same number fail', () => {
  const problems = checkPullRequest(BASE, files({ ...Object.fromEntries(BASE), '040_a.sql': 'd', '040_b.sql': 'e' }));
  assert.match(problems.join('\n'), /040.*more than once/);
});

test('a file on main that is renamed, deleted or edited fails', () => {
  const renamed = checkPullRequest(BASE, files({ '001_init.sql': 'a', '002_renamed.sql': 'b', '039_key.sql': 'c' }));
  assert.match(renamed.join('\n'), /002_more\.sql.*renamed or deleted/);
  const edited = checkPullRequest(BASE, files({ '001_init.sql': 'a', '002_more.sql': 'changed', '039_key.sql': 'c' }));
  assert.match(edited.join('\n'), /002_more\.sql.*edited/);
});

test('a new file not named NNN_words.sql fails', () => {
  const problems = checkPullRequest(BASE, files({ ...Object.fromEntries(BASE), '40_short.sql': 'd' }));
  assert.match(problems.join('\n'), /40_short\.sql.*three-digit/);
});

test('an empty read of main fails rather than passing', () => {
  assert.match(checkPullRequest(new Map(), files({ '040_x.sql': 'd' })).join('\n'), /no migrations on main/);
});

test('main\'s backstop: numbers unique and added in increasing order', () => {
  assert.deepEqual(checkMainOrder(['001_a.sql', '002_b.sql', '010_c.sql']), []);
  assert.match(checkMainOrder(['001_a.sql', '003_b.sql', '002_c.sql']).join('\n'), /002_c\.sql.*after 003/);
  assert.match(checkMainOrder(['001_a.sql', '002_b.sql', '002_c.sql']).join('\n'), /002_c\.sql.*after 002/);
  assert.match(checkMainOrder([]).join('\n'), /no migrations/);
});

test('the runner\'s output is read for the files it applied', () => {
  const out = 'Applied migration: 040_a.sql\nsomething else\nApplied migration: 041_b.sql\nMigrations up to date.\n';
  assert.deepEqual(appliedFiles(out), ['040_a.sql', '041_b.sql']);
});

// The git layer, on a throwaway repository: main with two migrations, then a
// branch that renames one and adds a low number.
test('read from git: a branch\'s rename and low number are both caught', () => {
  const repo = mkdtempSync(path.join(tmpdir(), 'mig-check-'));
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'T');
    const dir = path.join(repo, 'server', 'migrations');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, '001_init.sql'), 'a');
    git('add', '.'); git('commit', '-q', '-m', 'one');
    writeFileSync(path.join(dir, '002_more.sql'), 'b');
    git('add', '.'); git('commit', '-q', '-m', 'two');
    git('checkout', '-q', '-b', 'feature');
    renameSync(path.join(dir, '002_more.sql'), path.join(dir, '003_more.sql'));
    writeFileSync(path.join(dir, '002_late.sql'), 'c');
    git('add', '-A'); git('commit', '-q', '-m', 'bad');

    const base = readMigrationsAt(repo, 'main');
    assert.deepEqual([...base.keys()], ['001_init.sql', '002_more.sql']);
    const problems = checkPullRequest(base, readMigrationsAt(repo, 'HEAD')).join('\n');
    assert.match(problems, /002_more\.sql.*renamed or deleted/);
    assert.match(problems, /002_late\.sql.*higher than 002/);

    assert.deepEqual(readAddOrder(repo, 'main'), ['001_init.sql', '002_more.sql']);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

// Read at origin/main, not HEAD: on a branch that has merged main in (rule 3,
// renumbering), --first-parent counts main's files as added by that merge.
test('main passes its own backstop', (t) => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    execFileSync('git', ['-C', root, 'rev-parse', '--verify', '-q', 'origin/main'], { stdio: 'ignore' });
  } catch {
    t.skip('no origin/main in this checkout');
    return;
  }
  const order = readAddOrder(root, 'origin/main');
  assert.ok(order.length >= 39, `only ${order.length} migrations read`);
  assert.deepEqual(checkMainOrder(order), []);
});
