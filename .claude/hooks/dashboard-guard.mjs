#!/usr/bin/env node
// PreToolUse hook for the dashboard-builder agent (.claude/agents/dashboard-builder.md).
// It keeps that agent inside its own folder: it may read and write only the main
// checkout's .dashboard/ (so a session in a worktree still updates the page Jack
// has open), read the impeccable design skill, run `date` for the real clock and
// ask git where the main checkout is. Exit 0 lets a tool call run; exit 2 blocks
// it. Any other exit lets the call through, so every failure here exits 2.
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const FIND_MAIN = 'git rev-parse --path-format=absolute --git-common-dir';
// `date` plus plain arguments: no ; | & $ ` < > or newlines.
const CLOCK = /^date( [A-Za-z0-9%:+\-'" ]*)?$/;

function block(reason) {
  process.stderr.write(`dashboard-builder may not do this: ${reason}\n`);
  process.exit(2);
}

function mainCheckout(project) {
  try {
    const common = execFileSync('git', FIND_MAIN.split(' ').slice(1), {
      cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return path.dirname(common);
  } catch {
    return project;
  }
}

try {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const { tool_name: tool, tool_input: args, cwd } = JSON.parse(raw);

  const project = process.env.CLAUDE_PROJECT_DIR || cwd;
  if (typeof project !== 'string' || !project) block('no project folder');
  const main = mainCheckout(project);
  const within = (p, dir) => {
    const rel = path.relative(dir, path.resolve(project, p));
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  };
  const WRITABLE = [path.join(main, '.dashboard')];
  const READABLE = [...WRITABLE, path.join(project, '.claude/skills/impeccable')];

  const file = args?.file_path;
  if (tool === 'Write' || tool === 'Edit') {
    if (typeof file !== 'string' || !WRITABLE.some((d) => within(file, d))) block(`write ${file}`);
  } else if (tool === 'Read') {
    if (typeof file !== 'string' || !READABLE.some((d) => within(file, d))) block(`read ${file}`);
  } else if (tool === 'Bash') {
    const cmd = String(args?.command ?? '').trim();
    if (!CLOCK.test(cmd) && cmd !== FIND_MAIN) block(`run ${cmd}`);
  } else {
    block(`use ${tool}`);
  }
} catch (err) {
  block(`the guard failed (${err.message})`);
}
process.exit(0);
