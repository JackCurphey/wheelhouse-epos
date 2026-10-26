#!/usr/bin/env python3
"""Unattended, time-boxed loop: one fresh Claude Code session per queue item.

Works in its own git worktree (your checkout's files are never touched, but the
worktree SHARES your checkout's .git: config, hooks and branches the agent writes
there outlive the run, so the runner fingerprints them and stops if they changed),
one stacked branch per item. The AGENT has no way to push or merge: it runs without any git
credentials (see agent_env) as well as with deny rules. The RUNNER, after each
item, runs `npm test` itself (a report never rests on the agent's word), scans
what the agent committed for secrets, and only then pushes that one
`overnight/...` branch and opens a DRAFT pull request. It never merges.

  python3 scripts/overnight/run.py --hours 8
  python3 scripts/overnight/run.py --dry-run        # print the plan, run nothing

The deny rules are a second line, not the first: they match the start of a
command, so a determined session can get round them. What actually stops a push
is that the session is started with nothing to push with, and that the runner
pushes from a throwaway clone the agent never touched, one commit it has just
scanned, to one branch name.

NOT contained, because this is not a sandbox: the agent runs as you, so it can
still read files you can read (~/.ssh, the keychain, ~/.config/gh, the real .env
in your checkout, the claude CLI's own login), reach the network by a program
other than curl, and change your real node_modules (the worktree links to it).
It is told not to and the common routes are denied, but nothing stops a session
that tries. Keep branch protection on `main`, and for a run you do not want to
watch, use a virtual machine or container with no home folder mounted.
"""
import argparse, datetime as dt, json, os, re, shutil, subprocess, sys, tempfile, time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
WORKTREE = REPO.parent / 'wheelhouse-overnight'
DENY = [
    'Bash(git push:*)', 'Bash(git merge:*)', 'Bash(git rebase:*)', 'Bash(git reset:*)',
    'Bash(git branch -D:*)', 'Bash(git branch -d:*)', 'Bash(git switch main:*)',
    'Bash(git checkout main:*)', 'Bash(git remote:*)', 'Bash(git worktree:*)',
    'Bash(git clean:*)', 'Bash(git stash:*)', 'Bash(git config:*)',
    'Bash(gh:*)', 'Bash(doctl:*)', 'Bash(docker rm:*)', 'Bash(docker system:*)',
    'Bash(docker compose down:*)', 'Bash(sudo:*)', 'Bash(rm -rf /:*)', 'Bash(rm -rf ~:*)',
    'Bash(curl:*)', 'Bash(wget:*)', 'Bash(ssh:*)', 'Bash(scp:*)', 'Bash(security:*)',
    'Read(**/.env)', 'Read(~/.ssh/**)', 'Read(~/.config/gh/**)', 'Read(~/.git-credentials)', 'Read(~/.netrc)',
    'Bash(npm install:*)', 'Bash(npm i:*)',
    'Bash(npm uninstall:*)', 'Bash(npm publish:*)', 'Bash(npx playwright install:*)',
    'Read(.env)', 'Edit(.env)', 'Write(.env)', 'Edit(.github/**)', 'Write(.github/**)',
    'Edit(package-lock.json)', 'Write(package-lock.json)',
]

# The worktree's own .env holds only what the tests need to boot; every other
# secret in the real .env stays out of the agent's reach.
ENV_ALLOW = ('DATABASE_URL', 'PAYMENTS_PROVIDER', 'STAFF_SIGNIN_PROVIDER', 'WHEELHOUSE_TEST_CLOCK')
SERVICE_PREFIXES = ('TWILIO', 'EMAIL_', 'WHATSAPP', 'DIGITALOCEAN', 'WORKOS', 'STRIPE', 'SHOPIFY')


def sh(cmd, cwd=None, check=True, timeout=None, env=None):
    r = subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str), capture_output=True,
                       text=True, timeout=timeout, env=env)
    if check and r.returncode:
        raise RuntimeError(f'{cmd} -> {r.returncode}\n{r.stdout[-2000:]}\n{r.stderr[-2000:]}')
    return r


# --- secrets: what never reaches the agent, and what never leaves the machine ---

def env_pairs(text):
    for line in text.splitlines():
        m = re.match(r'\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$', line)
        if m and not line.lstrip().startswith('#'):
            value = m[2]
            if value[:1] not in ('"', "'"):
                value = re.sub(r'\s+#.*$', '', value)  # KEY=value # a note
            yield m[1], value.strip('\'"')


def safe_env_text(text):
    """The part of a .env the worktree is given: only what the tests need."""
    return ''.join(f'{k}={v}\n' for k, v in env_pairs(text) if k in ENV_ALLOW)


def secret_values(text):
    """Every value in the real .env, to look for in what the agent commits."""
    return [v for _, v in env_pairs(text) if v]


TOKEN_SHAPES = [
    (re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----'), 'a private key'),
    (re.compile(r'\bgh[pousr]_[A-Za-z0-9]{30,}'), 'a GitHub token'),
    (re.compile(r'\bgithub_pat_\w{20,}'), 'a GitHub token'),
    (re.compile(r'\bsk_live_\w{16,}'), 'a live payment key'),
    (re.compile(r'\bAKIA[0-9A-Z]{16}\b'), 'a cloud access key'),
    (re.compile(r'\bxox[baprs]-[\w-]{10,}'), 'a chat token'),
    (re.compile(r'(?i)(secret|password|passwd|token|api[_-]?key|private[_-]?key)[A-Za-z0-9_]*\W{0,3}\s*[:=]\s*["\']?[A-Za-z0-9/+_\-.]{20,}'), 'a long value assigned to a secret-looking name'),
]


def scan_for_secrets(diff_text, secrets):
    """What looks like a secret in the lines a diff adds. Findings say what and where, never the value."""
    values = [v for v in secrets if len(v) >= 8]
    found = []
    for n, line in enumerate(diff_text.splitlines(), 1):
        if not line.startswith('+') or line.startswith('+++'):
            continue
        for v in values:
            if v in line:
                found.append(f'diff line {n}: a value from the real .env')
        for rx, what in TOKEN_SHAPES:
            if rx.search(line):
                found.append(f'diff line {n}: {what}')
    return found


BINARY_OK = ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.svg', '.pdf')


def binary_files_to_look_at(numstat):
    """Paths git calls binary ('-\t-\tpath') that aren't pictures or fonts: a scan can't read them, so a person must."""
    out = []
    for line in numstat.splitlines():
        parts = line.split('\t')
        if len(parts) == 3 and parts[0] == '-' and parts[1] == '-' and not parts[2].lower().endswith(BINARY_OK):
            out.append(parts[2])
    return out


def forbidden_file(path):
    name = Path(path).name
    if name.startswith('.env') and not name.endswith(('.example', '.sample')):
        return True
    return name in ('id_rsa', 'id_ed25519', 'id_ecdsa') or name.endswith(('.pem', '.key', '.p12', '.pfx', '.keystore'))


# --- the agent has nothing to push with ---------------------------------------

def agent_env(base, empty_gitconfig):
    """The environment the agent runs in: git can't authenticate anywhere, outside services have no keys."""
    env = dict(base)
    for k in [k for k in env if k.startswith(SERVICE_PREFIXES)]:
        env.pop(k)
    env.pop('SSH_AUTH_SOCK', None)
    hooks = [('remote.origin.pushurl', 'disabled://overnight-no-push'), ('credential.helper', ''),
             ('commit.gpgsign', 'false'), ('core.hooksPath', '/dev/null'),
             ('core.fsmonitor', 'false'), ('log.showSignature', 'false')]
    env.update(
        GIT_SSH_COMMAND='false', GIT_TERMINAL_PROMPT='0', GIT_ASKPASS='false',
        GIT_CONFIG_GLOBAL=str(empty_gitconfig), GIT_CONFIG_NOSYSTEM='1',
        GIT_CONFIG_COUNT=str(len(hooks)),
        GIT_AUTHOR_NAME='Overnight loop', GIT_AUTHOR_EMAIL='overnight@localhost',
        GIT_COMMITTER_NAME='Overnight loop', GIT_COMMITTER_EMAIL='overnight@localhost',
        GH_TOKEN='x', GITHUB_TOKEN='x', GH_CONFIG_DIR='/nonexistent',
    )
    for i, (k, v) in enumerate(hooks):
        env[f'GIT_CONFIG_KEY_{i}'] = k
        env[f'GIT_CONFIG_VALUE_{i}'] = v
    return env


def git_state_fingerprint(git_dir):
    """A hash of the shared .git's config and hooks. A session has no reason to change either, and a change
    would run in your own terminal long after the run ends."""
    import hashlib
    h = hashlib.sha256()
    git_dir = Path(git_dir)
    cfg = git_dir / 'config'
    h.update(cfg.read_bytes() if cfg.exists() else b'')
    hooks = git_dir / 'hooks'
    for f in sorted(hooks.iterdir()) if hooks.exists() else []:
        if f.is_file():
            h.update(f.name.encode() + b'\0' + f.read_bytes() + b'\0')
    return h.hexdigest()


def push_command(url, sha, branch):
    """Push one scanned commit to one overnight branch at the address recorded before the agent ran. No hooks."""
    if not re.fullmatch(r'overnight/[A-Za-z0-9._-]+', branch or '') or '..' in branch:
        raise ValueError(f'will only push an overnight/... branch, not {branch!r}')
    if not re.fullmatch(r'[0-9a-f]{40}', sha or ''):
        raise ValueError(f'will only push a full commit id, not {sha!r}')
    return ['git', 'push', '--no-verify', '-u', url, f'{sha}:refs/heads/{branch}']


def repo_slug(url):
    """owner/name from a GitHub address, for `gh --repo`."""
    m = re.search(r'github\.com[:/]([^/]+/[^/]+?)(?:\.git)?/?$', url)
    if not m:
        raise ValueError(f'not a GitHub address: {url}')
    return m[1]


def publish_env(base):
    """For the runner's own git and gh: your real login, none of the repository's settings."""
    return {k: v for k, v in base.items() if not k.startswith(('GIT_',) + SERVICE_PREFIXES)}


def push_from_clean_clone(source_repo, sha, branch, url, env):
    """Copy the scanned commit into a brand-new empty repository and push from there, so nothing the agent wrote
    into the shared .git (config, hooks, remotes) can act on the push. Returns the temp folder (for the pull request)."""
    tmp = tempfile.mkdtemp(prefix='overnight-push-')
    sh(['git', 'init', '--bare', '-q', tmp], env=env)
    sh(['git', '-C', tmp, 'fetch', '-q', '--no-tags', str(source_repo), f'refs/heads/{branch}:refs/heads/{branch}'], env=env, timeout=300)
    got = sh(['git', '-C', tmp, 'rev-parse', f'refs/heads/{branch}'], env=env).stdout.strip()
    if got != sha:
        raise RuntimeError(f'the branch is at {got[:10]}, not the scanned commit {sha[:10]}; not pushing')
    sh(push_command(url, sha, branch), cwd=tmp, env=env, timeout=300)
    return tmp


def branch_name(stamp, item_id):
    return f'overnight/{stamp}-{item_id}'


def next_bases(prev_commit, prev_pr_base, branch, commit, green, pushed):
    """Which COMMIT the next item is built on (an id, so a branch the agent moved changes nothing), and which
    branch the next pull request targets. Only a green commit is built on; only a pushed branch is a base."""
    return (commit if green else prev_commit, branch if (green and pushed) else prev_pr_base)


# --- the queue -----------------------------------------------------------------

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


def open_pr(origin_url, branch, sha, base, item, verdict, tests, last, commits, log):
    """Push the one scanned commit from a clean clone and open a DRAFT pull request against the branch before it.
    Never merges."""
    clean = publish_env(os.environ)
    try:
        tmp = push_from_clean_clone(WORKTREE, sha, branch, origin_url, clean)
    except Exception as e:
        log(f'- push failed: {str(e)[:300]}')
        return 'push failed'
    body = (f"Written unattended by the overnight loop (`scripts/overnight/`). **Draft: needs a human review before it merges.**\n\n"
            f"- Queue item: `{item['id']}` — {item['title']}\n- Agent said: {verdict}\n"
            f"- Runner's own `npm test`: **{tests}**\n- Stacked: targets `{base}`; merge in order.\n"
            f"- The runner scanned every commit for secrets before pushing and found none.\n\n"
            f"Commits:\n```\n{commits}\n```\n\nAgent's closing message:\n\n" + '\n'.join('> ' + l for l in last.strip().splitlines()[-12:]))
    r = sh(['gh', 'pr', 'create', '--repo', repo_slug(origin_url), '--draft', '--base', base, '--head', branch,
            '--title', f"[overnight] {item['title']}", '--body', body], cwd=tmp, env=clean, check=False, timeout=120)
    shutil.rmtree(tmp, ignore_errors=True)
    if r.returncode:
        log(f'- branch pushed; pull request not opened: {r.stderr.strip()[:300]}')
        return 'pushed'
    url = r.stdout.strip().splitlines()[-1]
    log(f'- pull request: {url}')
    return url


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--hours', type=float, default=8)
    ap.add_argument('--item-minutes', type=int, default=75, help='cap for one agent session')
    ap.add_argument('--attempts', type=int, default=2, help='sessions per item before giving up')
    ap.add_argument('--max-usd', type=float, default=500, help='total budget for the whole run')
    ap.add_argument('--max-usd-item', type=float, default=60, help='cap for one agent session')
    ap.add_argument('--base-branch', default='',
                    help='pushed branch the first pull request targets (default: the branch --base names, or the current one)')
    ap.add_argument('--no-push', action='store_true', help='keep everything local')
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

    def log(s):
        print(s, flush=True)
        with report.open('a') as f:
            f.write(s + '\n')

    empty_gitconfig = run / 'empty.gitconfig'
    empty_gitconfig.write_text('')
    env = agent_env(os.environ, empty_gitconfig)  # every git command the runner runs in the worktree uses it too

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

    # Recorded now, before any agent can change the shared git config.
    origin_url = sh(['git', 'remote', 'get-url', 'origin'], cwd=REPO).stdout.strip()
    base_branch = a.base_branch or (a.base if a.base != 'HEAD' else
                                    sh(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], cwd=REPO).stdout.strip())
    if not a.no_push and sh(['git', 'ls-remote', '--exit-code', '--heads', origin_url, base_branch], cwd=REPO, check=False).returncode:
        log(f'`{base_branch}` is not on the remote, so the first pull request would have no base. Pushing is turned off '
            f'for this run; push it, or pass --base-branch with a pushed branch.')
        a.no_push = True

    if not WORKTREE.exists():
        sh(['git', 'worktree', 'add', '--detach', str(WORKTREE), base_sha], cwd=REPO)
    elif sh(['git', 'status', '--porcelain'], cwd=WORKTREE, env=env).stdout.strip():
        sys.exit(f'{WORKTREE} has uncommitted files from an earlier run. Look at them, then clean it before running again.')
    excl = Path(sh(['git', 'rev-parse', '--git-path', 'info/exclude'], cwd=WORKTREE, env=env).stdout.strip())
    excl = excl if excl.is_absolute() else WORKTREE / excl
    excl.parent.mkdir(parents=True, exist_ok=True)
    lines = (excl.read_text() if excl.exists() else '').splitlines()
    missing = [x for x in ('node_modules', '.env') if x not in lines]
    if missing:  # a symlink escapes the .gitignore's `node_modules/`
        excl.open('a').write('\n' + '\n'.join(missing) + '\n')
    real_env = (REPO / '.env').read_text()
    (WORKTREE / '.env').write_text(safe_env_text(real_env))
    secrets = secret_values(real_env)
    if not (WORKTREE / 'node_modules').exists():
        os.symlink(REPO / 'node_modules', WORKTREE / 'node_modules')

    gitdir = Path(sh(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], cwd=REPO).stdout.strip())
    fingerprint = git_state_fingerprint(gitdir)

    prev_commit = base_sha
    prev_pr_base = base_branch
    spent = 0.0
    results = []
    while True:
        remaining = deadline - time.time()
        todo = [i for i in parse_queue(queue) if i['state'] == ' ']
        if not todo or remaining < 20 * 60 or a.max_usd - spent < 5:
            log('\nStopping: ' + ('queue empty' if not todo else 'under 20 minutes left'
                                   if remaining < 20 * 60 else f'budget used (${spent:.2f} of ${a.max_usd:.0f})'))
            break
        item = todo[0]
        branch = branch_name(stamp, item['id'])
        if sh(['git', 'rev-parse', '--verify', '--quiet', f'refs/heads/{branch}'], cwd=WORKTREE, env=env, check=False).returncode == 0:
            log(f'\n## {item["id"]}: branch {branch} already exists; not overwriting it. Stopping.')
            break
        if sh(['git', 'status', '--porcelain'], cwd=WORKTREE, env=env).stdout.strip():
            log(f'\n## {item["id"]}: the worktree has uncommitted files; stopping so they are not swept into a commit.')
            break
        sh(['git', 'switch', '-c', branch, prev_commit], cwd=WORKTREE, env=env)
        head0 = sh(['git', 'rev-parse', 'HEAD'], cwd=WORKTREE, env=env).stdout.strip()
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
            cap = min(a.max_usd_item, a.max_usd - spent)
            if cap < 5:
                break
            cmd += ['--max-budget-usd', f'{cap:.2f}']
            try:
                r = subprocess.run(cmd, cwd=WORKTREE, env=env, capture_output=True,
                                   text=True, timeout=budget)
                out = r.stdout
            except subprocess.TimeoutExpired as e:
                out = (e.stdout or b'').decode() if isinstance(e.stdout, bytes) else (e.stdout or '')
                out += '\nRESULT: partial\nSUMMARY: session timed out'
            (run / f"{item['id']}.attempt{attempt}.json").write_text(out)
            try:
                j = json.loads(out)
                last = j.get('result', '')
                spent += float(j.get('total_cost_usd', cap))
            except Exception:
                last = out[-3000:]
                spent += cap  # cost unknown (timeout or crash): charge the session's cap
            log(f"- attempt {attempt}: running spend ${spent:.2f} of ${a.max_usd:.0f}")
            (run / f"{item['id']}.attempt{attempt}.txt").write_text(last)
            m = re.search(r'^RESULT:\s*(done|partial|blocked)', last, re.M | re.I)
            verdict = m[1].lower() if m else 'partial'
            if verdict != 'partial':
                break

        # --- the runner's own check, not the agent's word ----------------------
        sh('git add -A && git diff --cached --quiet || git commit -qm "WIP: uncommitted work left by the overnight session"',
           cwd=WORKTREE, check=False, env=env)
        head1 = sh(['git', 'rev-parse', 'HEAD'], cwd=WORKTREE, env=env).stdout.strip()
        changed = head1 != head0
        moved = []
        tests = 'not run (no commits)'
        green = False
        if changed:
            try:
                sh('npm run pretest', cwd=WORKTREE, check=False, timeout=900, env=env)
                sh('npm run build', cwd=WORKTREE, check=False, timeout=900, env=env)  # page tests need the built screens
                t = sh('npm test', cwd=WORKTREE, check=False, timeout=2400, env=env)
                (run / f"{item['id']}.npm-test.txt").write_text(t.stdout[-20000:] + t.stderr[-5000:])
                pm = re.findall(r'^(?:# |ℹ )(pass|fail) (\d+)', t.stdout, re.M)
                tests = ('GREEN' if t.returncode == 0 else 'RED') + ' ' + ' '.join(f'{k}={v}' for k, v in pm)
                green = t.returncode == 0
            except subprocess.TimeoutExpired:
                tests = 'RED (npm test timed out)'
            # The tests run scripts the agent wrote. They must not have added commits or moved anything.
            if sh(['git', 'rev-parse', 'HEAD'], cwd=WORKTREE, env=env).stdout.strip() != head1 \
                    or sh(['git', 'status', '--porcelain'], cwd=WORKTREE, env=env).stdout.strip():
                moved.append('the tests changed the branch or left files behind')

        # --- nothing leaves the machine with a secret in it -------------------
        leaks = []
        stop_run = False
        if changed:
            # Every commit that will be pushed, not just the overall change: a file added and then deleted is still in history.
            names = sh(['git', 'log', '--name-only', '--pretty=format:', f'{head0}..{head1}'], cwd=WORKTREE, env=env).stdout.split()
            leaks += [f'{n}: a file that is never committed' for n in set(names) if forbidden_file(n)]
            numstat = sh(['git', 'log', '--numstat', '--pretty=format:', f'{head0}..{head1}'], cwd=WORKTREE, env=env).stdout
            leaks += [f'{n}: a binary file nobody can scan' for n in binary_files_to_look_at(numstat)]
            history = sh(['git', 'log', '-p', '--no-ext-diff', '--no-textconv', '--pretty=format:', f'{head0}..{head1}'], cwd=WORKTREE, env=env).stdout
            leaks += scan_for_secrets(history, secrets)
            leaks += moved
        if git_state_fingerprint(gitdir) != fingerprint:
            leaks.append('the shared .git config or hooks changed during the session (this runs in your own terminal later): stopping the run')
            stop_run = True
            if leaks:
                log('- **SECRET SCAN FAILED, nothing pushed:** ' + '; '.join(sorted(set(leaks))[:10]))
                green = False
                tests += ' (secret scan failed)'

        state = 'x' if (verdict == 'done' and green) or (verdict == 'done' and not changed) else '!'
        set_state(queue, item['id'], state, f'{verdict}; tests {tests}')
        commits = sh(['git', 'log', '--oneline', f'{head0}..{head1}'], cwd=WORKTREE, env=env).stdout.strip()
        log(f"- agent said: **{verdict}**; runner's `npm test`: **{tests}**\n"
            f"- commits:\n```\n{commits or '(none)'}\n```\n- agent's last message:\n\n"
            + '\n'.join('  > ' + l for l in last.strip().splitlines()[-12:]))
        pr = '-'
        pushed = False
        if changed and not a.no_push and not leaks:
            pr = open_pr(origin_url, branch, head1, prev_pr_base, item, verdict, tests, last, commits, log)
            pushed = pr.startswith('http') or pr == 'pushed'
        prev_commit, prev_pr_base = next_bases(prev_commit, prev_pr_base, branch, head1, green, pushed)
        results.append((item['id'], verdict, tests, branch if changed else '-', pr))
        if stop_run:
            log('\n**Stopped: the shared .git changed. Check .git/config and .git/hooks before using this checkout.**')
            break

    sh(['git', 'switch', '--detach', prev_commit], cwd=WORKTREE, check=False, env=env)
    log(f'\n## Summary (spent about ${spent:.2f} of ${a.max_usd:.0f})\n| item | agent | npm test | branch | pull request |\n|---|---|---|---|---|\n'
        + '\n'.join(f'| {i} | {v} | {t} | {b} | {p} |' for i, v, t, b, p in results))
    log('\nNothing was merged. Pull requests are stacked: each targets the branch before it, '
        'so merge them in order.')


if __name__ == '__main__':
    main()
