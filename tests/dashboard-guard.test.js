// The dashboard-builder agent may only touch its own folder. Its guard is a
// Claude Code PreToolUse hook: exit 0 lets the tool call run, exit 2 blocks it.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const GUARD = path.join(here, '..', '.claude', 'hooks', 'dashboard-guard.mjs');
const PROJECT = '/projects/wheelhouse';

function run(tool_name, tool_input) {
  const r = spawnSync(process.execPath, [GUARD], {
    input: JSON.stringify({ tool_name, tool_input, cwd: PROJECT }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: PROJECT },
    encoding: 'utf8',
  });
  return r.status;
}
const file = (p) => ({ file_path: path.join(PROJECT, p) });

test('writes inside .dashboard/ are allowed', () => {
  assert.strictEqual(run('Write', file('.dashboard/index.html')), 0);
  assert.strictEqual(run('Edit', file('.dashboard/index.html')), 0);
});

test('its saved style sits in .dashboard/, so writing there is allowed', () => {
  assert.strictEqual(run('Write', file('.dashboard/style.md')), 0);
  assert.strictEqual(run('Write', file('.claude/agent-memory-local/dashboard-builder/MEMORY.md')), 2);
});

test('writes anywhere else are blocked', () => {
  assert.strictEqual(run('Write', file('server/server.js')), 2);
  assert.strictEqual(run('Edit', file('CLAUDE.md')), 2);
  assert.strictEqual(run('Write', { file_path: '/etc/hosts' }), 2);
});

test('escapes that start inside the folder are blocked', () => {
  assert.strictEqual(run('Write', file('.dashboard/../server/server.js')), 2);
  assert.strictEqual(run('Write', file('.dashboard-other/index.html')), 2);
  assert.strictEqual(run('Write', { file_path: '.dashboard/../CLAUDE.md' }), 2);
});

test('relative paths inside .dashboard/ resolve against the project', () => {
  assert.strictEqual(run('Write', { file_path: '.dashboard/index.html' }), 0);
});

test('the impeccable skill can be read but not written', () => {
  assert.strictEqual(run('Read', file('.claude/skills/impeccable/reference/layout.md')), 0);
  assert.strictEqual(run('Write', file('.claude/skills/impeccable/SKILL.md')), 2);
});

test('reads elsewhere are blocked', () => {
  assert.strictEqual(run('Read', file('.env')), 2);
});

test('Bash may only read the clock', () => {
  assert.strictEqual(run('Bash', { command: 'date' }), 0);
  assert.strictEqual(run('Bash', { command: "date '+%H:%M:%S'" }), 0);
  assert.strictEqual(run('Bash', { command: 'date; rm -rf server' }), 2);
  assert.strictEqual(run('Bash', { command: 'date && cat .env' }), 2);
  assert.strictEqual(run('Bash', { command: 'date $(cat .env)' }), 2);
  assert.strictEqual(run('Bash', { command: 'ls' }), 2);
});

test('any other tool is blocked', () => {
  assert.strictEqual(run('Glob', { pattern: '**/*' }), 2);
  assert.strictEqual(run('WebFetch', { url: 'https://example.com' }), 2);
});

test('a guard that cannot read its input blocks rather than allows', () => {
  const r = spawnSync(process.execPath, [GUARD], { input: 'not json', encoding: 'utf8' });
  assert.strictEqual(r.status, 2);
  assert.strictEqual(run('Write', undefined), 2);
  assert.strictEqual(run('Write', { file_path: 123 }), 2);
});

test('the agent may find the main checkout, and nothing more with git', () => {
  assert.strictEqual(run('Bash', { command: 'git rev-parse --path-format=absolute --git-common-dir' }), 0);
  assert.strictEqual(run('Bash', { command: 'git log' }), 2);
  assert.strictEqual(run('Bash', { command: 'git rev-parse --git-common-dir; cat .env' }), 2);
});

test('from a worktree, the one dashboard is the main checkout\'s', () => {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'guard-')));
  const main = path.join(tmp, 'main');
  const wt = path.join(tmp, 'wt');
  const git = (...a) => spawnSync('git', a, { cwd: main, encoding: 'utf8' });
  fs.mkdirSync(main);
  git('init', '-q');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x');
  git('worktree', 'add', '-q', wt);
  const inWt = (p) => spawnSync(process.execPath, [GUARD], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: p }, cwd: wt }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: wt },
    encoding: 'utf8',
  }).status;
  try {
    assert.strictEqual(inWt(path.join(main, '.dashboard/index.html')), 0);
    assert.strictEqual(inWt(path.join(wt, '.dashboard/index.html')), 2);
    assert.strictEqual(inWt(path.join(main, 'CLAUDE.md')), 2);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
