// WP-0.5 task 3.4: every merge to main goes onto the hosted copy
// (openspec/changes/add-hosted-copy/design.md, Decision 3). The server half,
// scripts/hosting/deploy.sh, is run here against a pretend docker and git in
// a scratch folder, so nothing touches the real server. The GitHub half,
// .github/workflows/deploy-hosted-copy.yml, only runs on GitHub, so its
// safety properties are checked in the file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, chmodSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEPLOY = path.join(ROOT, 'scripts', 'hosting', 'deploy.sh');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'deploy-hosted-copy.yml');
const IMAGE = 'ghcr.io/jackcurphey/wheelhouse-epos';
const OLD = 'a'.repeat(40);
const NEW = 'b'.repeat(40);
const SETTINGS = 'NODE_ENV=production\nWHEELHOUSE_HOSTED_COPY=1\nSITE_ADDRESS=203-0-113-5.sslip.io\n';

// A scratch /opt/wheelhouse with its settings, and a pretend docker that
// writes down every call (and fails a pull when told to).
function server(t, { env = SETTINGS, previous, images = [] } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'deploy-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, 'bin');
  mkdirSync(bin);
  mkdirSync(path.join(dir, 'app'));
  writeFileSync(path.join(dir, '.env'), env);
  if (previous) writeFileSync(path.join(dir, 'release.previous'), previous);
  const tool = (name, body) => { writeFileSync(path.join(bin, name), body); chmodSync(path.join(bin, name), 0o755); };
  tool('docker', `#!/usr/bin/env bash
echo "$*" >> "${dir}/docker-calls"
if [ "$1" = pull ] && [ -f "${dir}/pull-fails" ]; then echo "denied" >&2; exit 1; fi
if [ "$1" = compose ] && [ -f "${dir}/up-fails" ]; then rm "${dir}/up-fails"; echo "won't start" >&2; exit 1; fi
if [ "$1" = image ] && [ "$2" = ls ]; then printf '%s\\n' ${images.map((i) => `'${i}'`).join(' ')}; fi
exit 0
`);
  tool('git', `#!/usr/bin/env bash
case "$*" in *"rev-parse HEAD"*) echo ${OLD} ;; esac
`);
  const run = (args, extra = {}) => spawnSync('bash', [DEPLOY, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, WHEELHOUSE_DIR: dir, ...extra },
  });
  const calls = () => (existsSync(path.join(dir, 'docker-calls')) ? readFileSync(path.join(dir, 'docker-calls'), 'utf8').trim().split('\n') : []);
  const file = (f) => readFileSync(path.join(dir, f), 'utf8');
  return { dir, run, calls, file };
}

test('deploy.sh is valid bash and stops on the first error', () => {
  const check = spawnSync('bash', ['-n', DEPLOY], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  assert.match(readFileSync(DEPLOY, 'utf8'), /^set -euo pipefail$/m);
});

test('the deploy key can only deploy a commit or roll back: anything else is refused before docker runs', (t) => {
  for (const asked of ['', 'deploy', 'deploy abc123', `deploy ${NEW.toUpperCase()}`, `deploy ${NEW}; reboot`, `deploy ${NEW} extra`, 'rm -rf /', 'bash', 'rollback now']) {
    const s = server(t);
    const r = s.run([], { SSH_ORIGINAL_COMMAND: asked });
    assert.notEqual(r.status, 0, `"${asked}" was accepted`);
    assert.deepEqual(s.calls(), [], `"${asked}" reached docker`);
    assert.equal(s.file('.env'), SETTINGS, `"${asked}" changed the settings`);
  }
});

test('a deploy pulls the commit\'s image, then starts it, keeping the settings and recording the one before', (t) => {
  const s = server(t, { env: `${SETTINGS}WHEELHOUSE_IMAGE=${IMAGE}:${OLD}\nWHEELHOUSE_COMMIT=${OLD}\n` });
  const r = s.run([], { SSH_ORIGINAL_COMMAND: `deploy ${NEW}` });
  assert.equal(r.status, 0, r.stderr);
  const calls = s.calls();
  assert.equal(calls[0], `pull ${IMAGE}:${NEW}`);
  assert.ok(calls.includes('compose up -d --no-build app'), calls.join('\n'));
  assert.ok(calls.indexOf(`pull ${IMAGE}:${NEW}`) < calls.indexOf('compose up -d --no-build app'), 'started before it was downloaded');
  const env = s.file('.env');
  assert.match(env, new RegExp(`^WHEELHOUSE_IMAGE=${IMAGE}:${NEW}$`, 'm'));
  assert.match(env, new RegExp(`^WHEELHOUSE_COMMIT=${NEW}$`, 'm'));
  assert.equal((env.match(/^WHEELHOUSE_COMMIT=/gm) || []).length, 1, 'the commit line is written twice');
  assert.ok(env.startsWith(SETTINGS), 'the other settings were lost');
  assert.equal(s.file('release.previous'), `WHEELHOUSE_IMAGE=${IMAGE}:${OLD}\nWHEELHOUSE_COMMIT=${OLD}\n`);
});

test('the time is written down before each deploy, with both commits, for a restore', (t) => {
  const s = server(t, { env: `${SETTINGS}WHEELHOUSE_IMAGE=${IMAGE}:${OLD}\nWHEELHOUSE_COMMIT=${OLD}\n` });
  assert.equal(s.run(['deploy', NEW]).status, 0);
  assert.match(s.file('deploys.log'), new RegExp(`^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\dZ deploy ${NEW} \\(was ${OLD}\\)$`, 'm'));
});

test('a download that fails changes nothing on the server', (t) => {
  const before = `${SETTINGS}WHEELHOUSE_IMAGE=${IMAGE}:${OLD}\nWHEELHOUSE_COMMIT=${OLD}\n`;
  const s = server(t, { env: before });
  writeFileSync(path.join(s.dir, 'pull-fails'), '');
  const r = s.run(['deploy', NEW]);
  assert.notEqual(r.status, 0);
  assert.equal(s.file('.env'), before);
  assert.ok(!s.calls().some((c) => c.startsWith('compose')), 'it restarted the app');
  assert.ok(!existsSync(path.join(s.dir, 'release.previous')));
});

test('a new version that won\'t start is swapped straight back for the one before, and the deploy fails', (t) => {
  const before = `${SETTINGS}WHEELHOUSE_IMAGE=${IMAGE}:${OLD}\nWHEELHOUSE_COMMIT=${OLD}\n`;
  const s = server(t, { env: before });
  writeFileSync(path.join(s.dir, 'up-fails'), '');
  const r = s.run(['deploy', NEW]);
  assert.notEqual(r.status, 0);
  assert.equal(s.file('.env'), before);
  assert.equal(s.calls().filter((c) => c === 'compose up -d --no-build app').length, 2, 'the version before wasn\'t started again');
});

test('the first deploy after a by-hand setup keeps the image built on the server as the one to go back to', (t) => {
  const s = server(t);
  assert.equal(s.run(['deploy', NEW]).status, 0);
  assert.equal(s.file('release.previous'), `WHEELHOUSE_IMAGE=wheelhouse-app:current\nWHEELHOUSE_COMMIT=${OLD}\n`);
});

test('the commit already running isn\'t deployed again', (t) => {
  const s = server(t, { env: `${SETTINGS}WHEELHOUSE_IMAGE=${IMAGE}:${NEW}\nWHEELHOUSE_COMMIT=${NEW}\n` });
  assert.equal(s.run(['deploy', NEW]).status, 0);
  assert.deepEqual(s.calls(), []);
});

test('rollback starts the version before again', (t) => {
  const s = server(t, {
    env: `${SETTINGS}WHEELHOUSE_IMAGE=${IMAGE}:${NEW}\nWHEELHOUSE_COMMIT=${NEW}\n`,
    previous: `WHEELHOUSE_IMAGE=${IMAGE}:${OLD}\nWHEELHOUSE_COMMIT=${OLD}\n`,
  });
  const r = s.run([], { SSH_ORIGINAL_COMMAND: 'rollback' });
  assert.equal(r.status, 0, r.stderr);
  const env = s.file('.env');
  assert.match(env, new RegExp(`^WHEELHOUSE_IMAGE=${IMAGE}:${OLD}$`, 'm'));
  assert.match(env, new RegExp(`^WHEELHOUSE_COMMIT=${OLD}$`, 'm'));
  assert.ok(s.calls().includes('compose up -d --no-build app'));
  assert.match(s.file('deploys.log'), new RegExp(`Z rollback ${OLD} \\(was ${NEW}\\)$`, 'm'));
});

test('rollback with nothing to go back to says so and changes nothing', (t) => {
  const s = server(t);
  const r = s.run(['rollback']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /nothing to go back to/i);
  assert.deepEqual(s.calls(), []);
});

test('only the running and previous images are kept, so the small disk doesn\'t fill', (t) => {
  const third = 'c'.repeat(40);
  const s = server(t, {
    env: `${SETTINGS}WHEELHOUSE_IMAGE=${IMAGE}:${OLD}\nWHEELHOUSE_COMMIT=${OLD}\n`,
    images: [`${IMAGE}:${third}`, `${IMAGE}:${OLD}`, `${IMAGE}:${NEW}`],
  });
  assert.equal(s.run(['deploy', NEW]).status, 0);
  const removed = s.calls().filter((c) => c.startsWith('rmi'));
  assert.deepEqual(removed, [`rmi ${IMAGE}:${third}`]);
});

// ---------- The GitHub half ----------

const workflow = () => readFileSync(WORKFLOW, 'utf8');
// The workflow without its comment lines, for what it does rather than says.
const steps = () => workflow().split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
// Its triggers: the top-level on: block.
const triggers = () => (workflow().match(/^on:\n((?: .*\n|\n)*)/m) || [])[1] ?? '';

// Jack, 25 Oct (option 3, docs/decisions/2026-10-25-ci-on-pull-requests-and-daily.md):
// Tests runs on each pull request, which must include the latest main before
// it merges, and once a day; not again after a merge. So the copy updates
// straight after each merge, with the commit the merge made.
test('it deploys on a push to this repository\'s main, and nothing else', () => {
  const t = triggers();
  assert.match(t, /^\s+push:\s*\n\s+branches: \[main\]\s*$/m);
  assert.doesNotMatch(t, /(workflow_run|pull_request|pull_request_target|schedule|workflow_dispatch):/, 'only a merge to main deploys');
  assert.match(steps(), /github\.repository == 'JackCurphey\/wheelhouse-epos'/, 'a fork\'s main never deploys');
});

test('it deploys the commit the merge made, through pick-deploy.sh, never an older one over a newer', () => {
  const w = steps();
  assert.doesNotMatch(w, /gh run list/, 'it no longer waits for a Tests run on main');
  assert.match(w, /scripts\/hosting\/pick-deploy\.sh "\$running" "\$GITHUB_SHA"/);
  assert.match(w, /git checkout --quiet --detach "\$COMMIT"/);
  assert.match(w, /tags: ghcr\.io\/jackcurphey\/wheelhouse-epos:\$\{\{ env\.COMMIT \}\}/);
  // build-push-action's default context is the latest main, not the checkout.
  assert.match(w, /^\s+context: \.$/m);
});

const TESTS_WORKFLOW = path.join(ROOT, '.github', 'workflows', 'test.yml');
// Once a day and by hand, not on each pull request (Jack, 28 Oct:
// docs/decisions/2026-10-28-ci-once-a-day.md).
test('Tests runs once a day and by hand, not on each pull request or after each merge', () => {
  const on = (readFileSync(TESTS_WORKFLOW, 'utf8').match(/^on:\n((?: .*\n|\n)*)/m) || [])[1] ?? '';
  assert.doesNotMatch(on, /^\s+pull_request:/m, 'not on each pull request');
  assert.match(on, /^\s+schedule:\s*\n\s+- cron: '0 3 \* \* \*'/m, 'once a day, at 03:00 UTC');
  assert.match(on, /^\s+workflow_dispatch:/m, 'and by hand');
  assert.doesNotMatch(on, /^\s+push:/m, 'not after each merge');
});

test('one deploy at a time, never cancelling one under way', () => {
  assert.match(workflow(), /concurrency:\s*\n\s*group: hosted-copy\s*\n\s*cancel-in-progress: false/);
});

// pick-deploy.sh against a real git history: A, then B, then C on main.
function history(t) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pick-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x' } }).stdout.trim();
  git('init', '-q');
  const sha = {};
  for (const name of ['A', 'B', 'C']) { git('commit', '-q', '--allow-empty', '-m', name); sha[name] = git('rev-parse', 'HEAD'); }
  const pick = (running, newest) => spawnSync('bash', [path.join(ROOT, 'scripts', 'hosting', 'pick-deploy.sh'), running, newest], { cwd: dir, encoding: 'utf8' });
  return { sha, pick };
}

test('pick-deploy: the newest tested commit goes on when it is newer than the one running', (t) => {
  const { sha, pick } = history(t);
  const r = pick(sha.A, sha.C);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), `deploy ${sha.C}`);
  assert.equal(pick('', sha.B).stdout.trim(), `deploy ${sha.B}`, 'nothing known running: deploy');
  assert.equal(pick('f'.repeat(40), sha.B).stdout.trim(), `deploy ${sha.B}`, 'a running commit git doesn\'t know: deploy');
});

test('pick-deploy: skipped when it is already running, or older than the one running', (t) => {
  const { sha, pick } = history(t);
  assert.equal(pick(sha.C, sha.C).stdout.trim(), 'skip');
  assert.equal(pick(sha.C, sha.B).stdout.trim(), 'skip');
});

test('pick-deploy: no tested commit found is an error, not a quiet skip', (t) => {
  const { sha, pick } = history(t);
  const r = pick(sha.A, '');
  assert.notEqual(r.status, 0);
  assert.equal(r.stdout.trim(), '');
});

// wait-healthy.sh against a pretend curl that answers from a list, one line a call.
function healthCheck(t, answers) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'wait-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(path.join(dir, 'bin'));
  writeFileSync(path.join(dir, 'answers'), answers.join('\n') + '\n');
  writeFileSync(path.join(dir, 'bin', 'curl'), `#!/usr/bin/env bash
n=$(cat "${dir}/count" 2>/dev/null || echo 0); n=$((n+1)); echo $n > "${dir}/count"
line=$(sed -n "\${n}p" "${dir}/answers")
[ -n "$line" ] || line=$(tail -n 1 "${dir}/answers")
[ "$line" = down ] && exit 7
echo "$line"
`);
  chmodSync(path.join(dir, 'bin', 'curl'), 0o755);
  return (seconds) => {
    const started = Date.now();
    const r = spawnSync('bash', [path.join(ROOT, 'scripts', 'hosting', 'wait-healthy.sh'), 'https://copy.example.test', NEW, String(seconds)], {
      encoding: 'utf8', env: { ...process.env, PATH: `${dir}/bin:${process.env.PATH}`, WAIT_INTERVAL: '0.2' },
    });
    const asked = Number(readFileSync(path.join(dir, 'count'), 'utf8'));
    return { ...r, took: (Date.now() - started) / 1000, asked };
  };
}

test('wait-healthy: done once /healthz answers ok with the new commit', (t) => {
  const wait = healthCheck(t, ['down', `{"status":"ok","commit":"${OLD}"}`, `{"status":"ok","commit":"${NEW}"}`]);
  const r = wait(10);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  // Not the old version answering ok: it waited for the new one.
  assert.equal(r.asked, 3);
  assert.match(r.stdout, new RegExp(`Deployed: .*${NEW}`));
});

test('wait-healthy: gives up when its time is up, by the clock, and fails', (t) => {
  const wait = healthCheck(t, [`{"status":"error","commit":"${NEW}"}`]);
  const r = wait(1);
  assert.notEqual(r.status, 0);
  assert.ok(r.took < 3, `it waited ${r.took}s for a 1s limit`);
  assert.match(r.stdout + r.stderr, /didn't answer ok/);
});

test('the workflow waits with wait-healthy for 5 minutes', () => {
  assert.match(steps(), /scripts\/hosting\/wait-healthy\.sh "\$SITE" "\$COMMIT" 300/);
});

test('it pushes the image deploy.sh pulls, and logs in to the server only against the stored host key', () => {
  const w = workflow();
  assert.ok(w.includes(`${IMAGE}:`), `the workflow doesn't push ${IMAGE}`);
  assert.ok(readFileSync(DEPLOY, 'utf8').includes(`IMAGE_REPO=${IMAGE}`), 'deploy.sh pulls a different image');
  assert.match(w, /StrictHostKeyChecking[ =]yes/);
  assert.match(w, /vars\.HOSTED_COPY_KNOWN_HOSTS/);
  assert.match(w, /secrets\.HOSTED_COPY_SSH_KEY/);
  assert.doesNotMatch(w, /StrictHostKeyChecking[ =](no|accept-new)/);
});

test('it starts the previous version if the new one failed, or the job was cancelled or timed out after it went on', () => {
  const w = workflow();
  // Only once the new version went on: after a failed download, the version
  // before is still running, and rolling back would replace a good one.
  assert.match(w, /if: \(failure\(\) \|\| cancelled\(\)\) && steps\.deploy\.outcome == 'success'/);
  assert.match(w, /ssh hosted-copy rollback/);
});

test('NODE_ENV never reaches the image build', () => {
  assert.doesNotMatch(steps(), /NODE_ENV/);
});
