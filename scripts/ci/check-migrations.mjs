// The migration checks of split plan §4.2 (WP-0.4). The runner
// (server/migrations/run-migrations.js) applies files in filename order and
// remembers them by filename, so a renamed file runs a second time and a low
// number runs out of order on a database that is already ahead. These close
// both before merge:
//
//   node scripts/ci/check-migrations.mjs pr <main-ref>
//     Every migration the pull request adds has a number higher than every
//     one on main, used once, and named NNN_words.sql; every file on main is
//     still there, unchanged.
//   node scripts/ci/check-migrations.mjs main
//     The backstop on every push to main: numbers unique, and added in
//     increasing order along main's history. It should never fail. If it
//     does, a rule was broken: stop and ask Jack, don't rename anything.
//   node scripts/ci/check-migrations.mjs upgrade <main-ref>
//     Migrates a fresh database with main's migrations, then with this
//     checkout's, and fails unless the second run applies exactly the files
//     the pull request adds. Needs ADMIN_DATABASE_URL (a superuser, to make
//     the database) and DATABASE_URL (the app role, which runs migrations).
//
// Each fails on an empty read, so pointing it at the wrong place can't pass.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppDatabase, dropDatabase } from '../dev/new-db.mjs';

const DIR = 'server/migrations';
const NAME = /^(\d{3})_[a-z0-9_]+\.sql$/;
const numberOf = (file) => Number(file.slice(0, 3));

// base and head: Map of filename -> contents.
export function checkPullRequest(base, head) {
  if (base.size === 0) return ['Read no migrations on main: wrong ref or folder?'];
  const problems = [];
  for (const [file, sql] of base) {
    if (!head.has(file)) problems.push(`${file} is on main and was renamed or deleted. Names on main are frozen; a fix is a new migration.`);
    else if (head.get(file) !== sql) problems.push(`${file} is on main and was edited. Files on main are frozen; a fix is a new migration.`);
  }
  const highest = Math.max(...[...base.keys()].filter((f) => NAME.test(f)).map(numberOf));
  const added = [...head.keys()].filter((f) => !base.has(f));
  const seen = new Map();
  for (const file of added) {
    if (!NAME.test(file)) {
      problems.push(`${file} must be named with a three-digit number, then words: NNN_what_it_does.sql.`);
      continue;
    }
    const n = numberOf(file);
    if (n <= highest) problems.push(`${file} must be numbered higher than ${String(highest).padStart(3, '0')}, the highest on main. Take the next free number.`);
    if (seen.has(n)) problems.push(`${String(n).padStart(3, '0')} is used more than once: ${seen.get(n)} and ${file}.`);
    seen.set(n, file);
  }
  return problems;
}

// Migration filenames in the order they were added to main.
export function checkMainOrder(order) {
  if (order.length === 0) return ['Read no migrations on main: wrong ref or folder?'];
  const problems = [];
  let last = null;
  for (const file of order) {
    if (!NAME.test(file)) { problems.push(`${file} is not named NNN_words.sql.`); continue; }
    if (last !== null && numberOf(file) <= numberOf(last)) problems.push(`${file} was added after ${last.slice(0, 3)} (${last}): numbers must be unique and increasing.`);
    if (last === null || numberOf(file) > numberOf(last)) last = file;
  }
  return problems;
}

export function appliedFiles(output) {
  return [...output.matchAll(/^Applied migration: (\S+)$/gm)].map((m) => m[1]);
}

const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

export function readMigrationsAt(repo, ref) {
  const names = git(repo, 'ls-tree', '--name-only', `${ref}:${DIR}`).split('\n').filter((f) => f.endsWith('.sql'));
  return new Map(names.map((f) => [f, git(repo, 'show', `${ref}:${DIR}/${f}`)]));
}

// --first-parent: on main, a file merged from a branch counts as added by
// the merge, in the order the merges happened.
export function readAddOrder(repo, ref) {
  // --no-renames: git notices renames by default, and a file renamed on main
  // would show as a rename, not an addition, so its new number would never be
  // checked (#161).
  const out = git(repo, 'log', ref, '--first-parent', '--no-renames', '--diff-filter=A', '--name-only', '--format=', '--reverse', '--', `${DIR}/*.sql`);
  return out.split('\n').filter(Boolean).map((f) => path.basename(f));
}

function report(problems, okMessage) {
  if (problems.length) {
    for (const p of problems) console.error(`::error::${p}`);
    process.exit(1);
  }
  console.log(okMessage);
}

export async function upgrade(repo, mainRef, env = process.env) {
  const admin = env.ADMIN_DATABASE_URL;
  const app = env.DATABASE_URL;
  if (!admin || !app) throw new Error('upgrade needs ADMIN_DATABASE_URL and DATABASE_URL');
  const dbName = `epos_upgrade_${process.pid}`;
  const url = new URL(app);
  url.pathname = `/${dbName}`;
  const migrate = (root) => execFileSync('node', [path.join(root, DIR, 'run-migrations.js')], {
    encoding: 'utf8', env: { ...env, DATABASE_URL: url.href }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  // The real path: run-migrations.js only runs when its own resolved URL is
  // the script named, and a temp folder can sit behind a symlink (macOS).
  const tree = realpathSync(mkdtempSync(path.join(tmpdir(), 'main-migrations-')));
  try {
    await createAppDatabase(admin, dbName, decodeURIComponent(url.username));
    git(repo, 'worktree', 'add', '--detach', tree, mainRef);
    if (existsSync(path.join(repo, 'node_modules'))) symlinkSync(path.join(repo, 'node_modules'), path.join(tree, 'node_modules'));
    const atMain = appliedFiles(migrate(tree));
    if (atMain.length === 0) return ['Migrating at main applied nothing: wrong ref or database?'];
    // A rename whose SQL happens to run cleanly a second time looks like a new
    // file here; the pr check is what catches it, by naming the missing original.
    const added = [...readMigrationsAt(repo, 'HEAD').keys()].filter((f) => !atMain.includes(f));
    let again;
    try {
      again = appliedFiles(migrate(repo));
    } catch (err) {
      const reason = String(err.stderr || err.message).match(/Migration \S+ failed: .*/)?.[0] ?? String(err.stderr || err.message).trim();
      return [`Upgrading from main failed: ${reason}. A file on main renamed, or a migration that can't run on main's schema?`];
    }
    const want = added.join(', ') || 'nothing';
    const got = again.join(', ') || 'nothing';
    return want === got ? [] : [`Upgrading from main applied ${got}; expected this pull request's new files only: ${want}.`];
  } finally {
    try { git(repo, 'worktree', 'remove', '--force', tree); } catch { rmSync(tree, { recursive: true, force: true }); }
    await dropDatabase(admin, dbName).catch(() => { /* the runner's own error matters more */ });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, ref] = process.argv.slice(2);
  const repo = process.cwd();
  if (mode === 'pr' && ref) {
    report(checkPullRequest(readMigrationsAt(repo, ref), readMigrationsAt(repo, 'HEAD')), `Migrations OK against ${ref}.`);
  } else if (mode === 'main') {
    report(checkMainOrder(readAddOrder(repo, 'HEAD')), 'Migration numbers on main are unique and in merge order.');
  } else if (mode === 'upgrade' && ref) {
    report(await upgrade(repo, ref), `Upgrading from ${ref} applied only this pull request's new migrations.`);
  } else {
    console.error('usage: check-migrations.mjs pr <main-ref> | main | upgrade <main-ref>');
    process.exit(2);
  }
}
