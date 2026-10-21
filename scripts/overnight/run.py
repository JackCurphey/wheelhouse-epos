#!/usr/bin/env python3
"""Unattended, time-boxed loop: one fresh Claude Code session per queue item.

Works in its own git worktree (your checkout is never touched), one stacked
branch per item, never pushes or merges. After each item the RUNNER runs
`npm test` itself, so a report never rests on the agent's word.

  python3 scripts/overnight/run.py --hours 8
  python3 scripts/overnight/run.py --dry-run        # print the plan, run nothing
"""
import argparse, datetime as dt, json, os, re, shutil, subprocess, sys, time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
WORKTREE = REPO.parent / 'wheelhouse-overnight'
DENY = [
    'Bash(git push:*)', 'Bash(git merge:*)', 'Bash(git rebase:*)', 'Bash(git reset:*)',
    'Bash(git branch -D:*)', 'Bash(git branch -d:*)', 'Bash(git switch main:*)',
    'Bash(git checkout main:*)', 'Bash(git remote:*)', 'Bash(git worktree:*)',
    'Bash(git clean:*)', 'Bash(git stash:*)',
    'Bash(gh:*)', 'Bash(doctl:*)', 'Bash(docker rm:*)', 'Bash(docker system:*)',
    'Bash(docker compose down:*)', 'Bash(sudo:*)', 'Bash(rm -rf /:*)', 'Bash(rm -rf ~:*)',
    'Bash(curl:*)', 'Bash(wget:*)', 'Bash(npm install:*)', 'Bash(npm i:*)',
    'Bash(npm uninstall:*)', 'Bash(npm publish:*)', 'Bash(npx playwright install:*)',
    'Read(.env)', 'Edit(.env)', 'Write(.env)', 'Edit(.github/**)', 'Write(.github/**)',
    'Edit(package-lock.json)', 'Write(package-lock.json)',
]


def sh(cmd, cwd=None, check=True, timeout=None, env=None):
    r = subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str), capture_output=True,
                       text=True, timeout=timeout, env=env)
    if check and r.returncode:
        raise RuntimeError(f'{cmd} -> {r.returncode}\n{r.stdout[-2000:]}\n{r.stderr[-2000:]}')
    return r


def parse_queue(path):
    items = []
    for line in path.read_text().splitlines():
        m = re.match(r'- \[( |x|!)\] ([\w.\-]+) \| (.*?) \| (.*)$', line)
        if m:
            items.append(dict(state=m[1], id=m[2], title=m[3], body=m[4]))
    return items


def set_state(path, item_id, state, note=''):
    out = []
    for line in path.read_text().splitlines():
        m = re.match(r'- \[( |x|!)\] ' + re.escape(item_id) + r' \|', line)
        if m:
            line = '- [' + state + line[4:]
            if note:
                line += f'  <!-- {note} -->'
        out.append(line)
    path.write_text('\n'.join(out) + '\n')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--hours', type=float, default=8)
    ap.add_argument('--item-minutes', type=int, default=75, help='cap for one agent session')
    ap.add_argument('--attempts', type=int, default=2, help='sessions per item before giving up')
    ap.add_argument('--max-usd-item', type=float, default=0, help='0 = no per-session cap')
    ap.add_argument('--model', default='')
    ap.add_argument('--base', default='HEAD', help='commit/branch the first item stacks on')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    start = time.time()
    deadline = start + a.hours * 3600
    stamp = dt.datetime.now().strftime('%Y%m%d-%H%M')
    run = Path.home() / 'overnight-runs' / stamp
    run.mkdir(parents=True)
    queue = run / 'queue.md'
    shutil.copy(HERE / 'queue.md', queue)
    report = run / 'REPORT.md'
    log = lambda s: (print(s, flush=True), report.open('a').write(s + '\n'))

    items = parse_queue(queue)
    log(f'# Overnight run {stamp}\nDeadline {dt.datetime.fromtimestamp(deadline):%a %H:%M}. '
        f'Run dir: {run}\nItems: ' + ', '.join(i['id'] for i in items) + '\n')
    if a.dry_run:
        return

    # --- setup: database, worktree, env -------------------------------------
    sh('docker compose up -d postgres', cwd=REPO)
    for _ in range(30):
        if sh('docker compose exec -T postgres pg_isready', cwd=REPO, check=False).returncode == 0:
            break
        time.sleep(2)
    else:
        sys.exit('Postgres did not come up')
    base_sha = sh(['git', 'rev-parse', a.base], cwd=REPO).stdout.strip()
    if not WORKTREE.exists():
        sh(['git', 'worktree', 'add', '--detach', str(WORKTREE), base_sha], cwd=REPO)
    shutil.copy(REPO / '.env', WORKTREE / '.env')  # gitignored; the worktree needs its own
    if not (WORKTREE / 'node_modules').exists():
        os.symlink(REPO / 'node_modules', WORKTREE / 'node_modules')

    env = dict(os.environ,
               GIT_CONFIG_COUNT='1', GIT_CONFIG_KEY_0='remote.origin.pushurl',
               GIT_CONFIG_VALUE_0='disabled://overnight-no-push',
               GH_TOKEN='x', GITHUB_TOKEN='x', GH_CONFIG_DIR='/nonexistent')
    for k in [k for k in env if k.startswith(('TWILIO', 'EMAIL_', 'WHATSAPP', 'DIGITALOCEAN'))]:
        env.pop(k)

    prev_branch = base_sha
    results = []
    while True:
        remaining = deadline - time.time()
        todo = [i for i in parse_queue(queue) if i['state'] == ' ']
        if not todo or remaining < 20 * 60:
            log('\nStopping: ' + ('queue empty' if not todo else 'under 20 minutes left'))
            break
        item = todo[0]
        branch = f"overnight/{stamp[:8]}-{item['id']}"
        sh(['git', 'switch', '-C', branch, prev_branch], cwd=WORKTREE)
        head0 = sh(['git', 'rev-parse', 'HEAD'], cwd=WORKTREE).stdout.strip()
        log(f"\n## {item['id']} — {item['title']}  (branch {branch}, "
            f"{dt.datetime.now():%H:%M}, {remaining/3600:.1f} h left)")

        verdict, last = 'partial', ''
        for attempt in range(1, a.attempts + 1):
            budget = min(a.item_minutes * 60, deadline - time.time() - 600)
            if budget < 600:
                break
            prompt = ((HERE / 'brief.md').read_text()
                      + f"\n---\nRUN_DIR: {run}\nBRANCH: {branch} (attempt {attempt} of {a.attempts}"
                      + ('; earlier work is already committed here, continue it' if attempt > 1 else '')
                      + f")\n\nQUEUE ITEM `{item['id']}`: {item['title']}\n{item['body']}\n")
            cmd = ['claude', '-p', prompt, '--output-format', 'json',
                   '--permission-mode', 'bypassPermissions',
                   '--disallowedTools', *DENY, '--no-session-persistence']
            if a.model:
                cmd += ['--model', a.model]
            if a.max_usd_item:
                cmd += ['--max-budget-usd', str(a.max_usd_item)]
            try:
                r = subprocess.run(cmd, cwd=WORKTREE, env=env, capture_output=True,
                                   text=True, timeout=budget)
                out = r.stdout
            except subprocess.TimeoutExpired as e:
                out = (e.stdout or b'').decode() if isinstance(e.stdout, bytes) else (e.stdout or '')
                out += '\nRESULT: partial\nSUMMARY: session timed out'
            (run / f"{item['id']}.attempt{attempt}.json").write_text(out)
            try:
                last = json.loads(out).get('result', '')
            except Exception:
                last = out[-3000:]
            (run / f"{item['id']}.attempt{attempt}.txt").write_text(last)
            m = re.search(r'^RESULT:\s*(done|partial|blocked)', last, re.M | re.I)
            verdict = m[1].lower() if m else 'partial'
            if verdict != 'partial':
                break

        # --- the runner's own check, not the agent's word ----------------------
        sh('git add -A && git diff --cached --quiet || git commit -qm "WIP: uncommitted work left by the overnight session"',
           cwd=WORKTREE, check=False)
        head1 = sh(['git', 'rev-parse', 'HEAD'], cwd=WORKTREE).stdout.strip()
        changed = head1 != head0
        tests = 'not run (no commits)'
        green = False
        if changed:
            try:
                sh('npm run pretest', cwd=WORKTREE, check=False, timeout=900, env=env)
                t = sh('npm test', cwd=WORKTREE, check=False, timeout=2400, env=env)
                (run / f"{item['id']}.npm-test.txt").write_text(t.stdout[-20000:] + t.stderr[-5000:])
                pm = re.findall(r'^# (pass|fail) (\d+)', t.stdout, re.M)
                tests = ('GREEN' if t.returncode == 0 else 'RED') + ' ' + ' '.join(f'{k}={v}' for k, v in pm)
                green = t.returncode == 0
            except subprocess.TimeoutExpired:
                tests = 'RED (npm test timed out)'
        state = 'x' if (verdict == 'done' and green) or (verdict == 'done' and not changed) else '!'
        set_state(queue, item['id'], state, f'{verdict}; tests {tests}')
        if green:
            prev_branch = branch  # only a green branch is built on
        commits = sh(['git', 'log', '--oneline', f'{head0}..{head1}'], cwd=WORKTREE).stdout.strip()
        log(f"- agent said: **{verdict}**; runner's `npm test`: **{tests}**\n"
            f"- commits:\n```\n{commits or '(none)'}\n```\n- agent's last message:\n\n"
            + '\n'.join('  > ' + l for l in last.strip().splitlines()[-12:]))
        results.append((item['id'], verdict, tests, branch if changed else '-'))

    sh(['git', 'switch', '--detach', prev_branch], cwd=WORKTREE, check=False)
    log('\n## Summary\n| item | agent | npm test | branch |\n|---|---|---|---|\n'
        + '\n'.join(f'| {i} | {v} | {t} | {b} |' for i, v, t, b in results))
    log(f'\nNothing was pushed or merged. Branches are in {WORKTREE} (same repo): '
        '`git log --oneline --graph --branches="overnight/*"`.')


if __name__ == '__main__':
    main()
