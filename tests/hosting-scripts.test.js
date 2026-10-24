// WP-0.5: the hosted copy's setup files (scripts/hosting/) keep the safety
// properties the hosted-copy spec depends on. These run without an account:
// they check the files, not DigitalOcean.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'scripts', 'hosting');
const read = (f) => readFileSync(path.join(DIR, f), 'utf8');

test('the setup files exist', () => {
  for (const f of ['setup.sh', 'remote-install.sh', 'deploy.sh', 'cloud-init.yaml', 'compose.yml', 'Caddyfile']) {
    assert.ok(existsSync(path.join(DIR, f)), `scripts/hosting/${f} is missing`);
  }
});

test('the shell scripts are valid bash and stop on the first error', () => {
  for (const f of ['setup.sh', 'remote-install.sh', 'deploy.sh']) {
    const check = spawnSync('bash', ['-n', path.join(DIR, f)], { encoding: 'utf8' });
    assert.equal(check.status, 0, `${f}: ${check.stderr}`);
    assert.match(read(f), /^set -euo pipefail$/m, `${f} must stop on the first error`);
  }
});

test('setup.sh asks before spending money, and works only in London', () => {
  const setup = read('setup.sh');
  assert.match(setup, /REGION=lon1/);
  assert.match(setup, /Type yes to continue/);
});

test('only Caddy is reachable from outside; the app publishes no port', () => {
  const compose = read('compose.yml');
  const app = compose.slice(compose.indexOf('\n  app:'), compose.indexOf('\n  caddy:'));
  assert.ok(app.length > 0, 'compose.yml has no app service before caddy');
  assert.doesNotMatch(app, /\n    ports:/, 'the app must not publish a port: TRUST_PROXY is only safe behind Caddy');
});

test('Caddy overwrites the client-address headers the app trusts', () => {
  const caddy = read('Caddyfile');
  assert.match(caddy, /header_up X-Forwarded-For \{remote_host\}/);
  assert.match(caddy, /header_up X-Forwarded-Proto \{scheme\}/);
});

test('the app trusts the database certificate and connects with SSL, with no texting keys', () => {
  const remote = read('remote-install.sh');
  assert.match(remote, /PGSSL=require/);
  assert.match(remote, /NODE_ENV=production/);
  assert.match(remote, /WHEELHOUSE_HOSTED_COPY=1/);
  assert.doesNotMatch(remote, /TWILIO_/);
  assert.match(read('compose.yml'), /NODE_EXTRA_CA_CERTS/);
});

// doctl 2.0 (Oct 2026) refuses --format on `databases create` and masks
// database passwords unless --show is passed. setup.sh is run end to end
// against a pretend doctl that behaves that way, with pretend ssh, scp and
// ssh-keygen, so nothing touches DigitalOcean. What it would send to the
// server must carry the real passwords and certificate.
test('setup.sh works with doctl 2.0: the database is created and real passwords reach the server', async (t) => {
  const { mkdtempSync, writeFileSync, chmodSync, rmSync, readdirSync } = await import('node:fs');
  const os = await import('node:os');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'setup-doctl2-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, 'bin');
  const caught = path.join(dir, 'caught');
  for (const d of [bin, caught]) (await import('node:fs')).mkdirSync(d);
  const tool = (name, body) => { writeFileSync(path.join(bin, name), body); chmodSync(path.join(bin, name), 0o755); };

  tool('doctl', `#!/usr/bin/env node
const a = process.argv.slice(2);
const has = (f) => a.includes(f);
const json = a.includes('-o') && a[a.indexOf('-o') + 1] === 'json' || a.includes('--output');
const secret = (s) => (has('--show') ? s : '********');
const out = (text, obj) => { process.stdout.write(json ? JSON.stringify(obj) : text + '\\n'); process.exit(0); };
const cmd = a.filter((x) => !x.startsWith('-')).slice(0, 3).join(' ');
if (cmd.startsWith('account get')) out('jack@example.test', [{ email: 'jack@example.test' }]);
if (cmd.startsWith('compute ssh-key list')) out('aa:bb', [{ fingerprint: 'aa:bb' }]);
if (cmd.startsWith('compute droplet list')) out('123 wheelhouse-test', [{ id: 123, name: 'wheelhouse-test' }]);
if (cmd.startsWith('compute droplet get')) out('203.0.113.5', [{ id: 123 }]);
if (cmd.startsWith('compute firewall list')) out('wheelhouse-test', [{ name: 'wheelhouse-test' }]);
if (cmd === 'databases list' || cmd.startsWith('databases list')) out('', []);
if (cmd.startsWith('databases create')) {
  if (has('--format')) { process.stderr.write('Error: unknown flag: --format\\n'); process.exit(1); }
  out('db-1 wheelhouse-test-db', [{ id: 'db-1', name: 'wheelhouse-test-db' }]);
}
if (cmd.startsWith('databases db list')) out('defaultdb', [{ name: 'defaultdb' }]);
if (cmd.startsWith('databases user list')) out('doadmin', [{ name: 'doadmin', role: 'primary' }]);
if (cmd.startsWith('databases firewalls list')) out('', []);
if (cmd.startsWith('databases connection')) out('db.example.test 25060 ' + secret('admin-secret'), [{ host: 'db.example.test', port: 25060, password: secret('admin-secret') }]);
if (cmd.startsWith('databases user get')) out('epos_app ' + secret('app-secret'), [{ name: 'epos_app', password: secret('app-secret') }]);
if (cmd.startsWith('databases get-ca')) out(Buffer.from('THE-CA').toString('base64'), [{ certificate: Buffer.from('THE-CA').toString('base64') }]);
process.exit(0);
`);
  tool('ssh', `#!/usr/bin/env bash
last="\${@: -1}"
if [ "$last" = "bash -s" ]; then cat > "${caught}/remote-input"; exit 0; fi
case "$last" in *ssh_host_ed25519_key.pub*) echo "ssh-ed25519 THE-HOST-KEY root@wheelhouse-test" ;; esac
case "$last" in *SIGNUP_CODE*) echo test-code ;; esac
exit 0
`);
  tool('scp', `#!/usr/bin/env bash
for f in "$@"; do [ -f "$f" ] && cp "$f" "${caught}/scp-$(basename "$f")"; done
exit 0
`);
  tool('ssh-keygen', `#!/usr/bin/env bash
case " $* " in *" -l "*) echo "256 MD5:aa:bb test (ED25519)" ;; esac
exit 0
`);
  // gh writes down what it was asked, and what it was given on stdin.
  tool('gh', `#!/usr/bin/env bash
case "$1 $2" in
  "auth status") exit 0 ;;
  "secret set") echo "$*" >> "${caught}/gh-calls"; cat > "${caught}/gh-secret-$3" ;;
  "variable set") echo "$*" >> "${caught}/gh-calls" ;;
  "api "*) echo '{"message":"Package not found."}'; exit 1 ;;
esac
exit 0
`);
  tool('curl', `#!/usr/bin/env bash
case "$*" in
  *ghcr.io/token*) echo '{"token":"anonymous"}' ;;
  *ghcr.io/v2/jackcurphey/wheelhouse-epos/tags/list*) [ -f "${dir}/package-public" ] || exit 22; echo '{"tags":[]}' ;;
  *) exit 7 ;;
esac
`);
  writeFileSync(path.join(dir, 'id_ed25519.pub'), 'ssh-ed25519 AAAA test\n');
  writeFileSync(path.join(dir, 'deploy-key'), 'THE-PRIVATE-DEPLOY-KEY\n');
  writeFileSync(path.join(dir, 'deploy-key.pub'), 'ssh-ed25519 DEPLOYPUB wheelhouse-deploy\n');

  const run = spawnSync('bash', [path.join(DIR, 'setup.sh')], {
    input: 'yes\n', encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, SSH_KEY_FILE: path.join(dir, 'id_ed25519'), DEPLOY_KEY_FILE: path.join(dir, 'deploy-key') },
  });
  assert.equal(run.status, 0, `setup.sh stopped:\n${run.stdout}\n${run.stderr}`);
  const sent = readFileSync(path.join(caught, 'remote-input'), 'utf8');
  assert.match(sent, /DB_ADMIN_PASSWORD=admin-secret /);
  assert.match(sent, /APP_DB_PASSWORD=app-secret /);
  assert.match(sent, /DB_HOST=db\.example\.test DB_PORT=25060 /);
  const ca = readdirSync(caught).find((f) => f.startsWith('scp-tmp') || (f.startsWith('scp-') && !f.endsWith('.yml') && f !== 'scp-Caddyfile' && f !== 'scp-deploy.sh'));
  assert.ok(ca, 'the certificate was not copied to the server');
  assert.equal(readFileSync(path.join(caught, ca), 'utf8'), 'THE-CA');
});

// Task 3.4: setup.sh also sets up automatic updates. Run end to end against
// the same pretend tools as above, it must put deploy.sh on the server, give
// the server the deploy key's public half, and give GitHub the private half,
// the address and the host key the server itself reported.
test('setup.sh sets up automatic updates: deploy.sh and the deploy key on the server, the rest on GitHub', async (t) => {
  const { mkdtempSync, writeFileSync, chmodSync, rmSync, mkdirSync } = await import('node:fs');
  const os = await import('node:os');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'setup-deploy-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, 'bin');
  const caught = path.join(dir, 'caught');
  mkdirSync(bin); mkdirSync(caught);
  const tool = (name, body) => { writeFileSync(path.join(bin, name), body); chmodSync(path.join(bin, name), 0o755); };
  tool('doctl', `#!/usr/bin/env node
const a = process.argv.slice(2);
const json = a.includes('-o') && a[a.indexOf('-o') + 1] === 'json';
const out = (text, obj) => { process.stdout.write(json ? JSON.stringify(obj) : text + '\\n'); process.exit(0); };
const cmd = a.filter((x) => !x.startsWith('-')).slice(0, 3).join(' ');
if (cmd.startsWith('account get')) out('jack@example.test', [{ email: 'jack@example.test' }]);
if (cmd.startsWith('compute ssh-key list')) out('aa:bb', []);
if (cmd.startsWith('compute droplet create')) out('123', []);
if (cmd.startsWith('compute droplet list')) out(require('node:fs').existsSync('${dir}/no-droplet') ? '' : '123 wheelhouse-test', []);
if (cmd.startsWith('compute droplet get')) out('203.0.113.5', []);
if (cmd.startsWith('compute firewall list')) out('wheelhouse-test', []);
if (cmd.startsWith('databases list')) out('', [{ id: 'db-1', name: 'wheelhouse-test-db' }]);
if (cmd.startsWith('databases db list')) out('', [{ name: 'epos' }]);
if (cmd.startsWith('databases user list')) out('', [{ name: 'epos_app' }]);
if (cmd.startsWith('databases firewalls list')) out('', [{ value: '123' }]);
if (cmd.startsWith('databases connection')) out('', [{ host: 'db.example.test', port: 25060, password: 'admin-secret' }]);
if (cmd.startsWith('databases user get')) out('', [{ password: 'app-secret' }]);
if (cmd.startsWith('databases get-ca')) out('', [{ certificate: Buffer.from('THE-CA').toString('base64') }]);
process.exit(0);
`);
  tool('ssh', `#!/usr/bin/env bash
last="\${@: -1}"
if [ "$last" = "bash -s" ]; then cat > "${caught}/remote-input"; exit 0; fi
case "$last" in *ssh_host_ed25519_key.pub*) echo "ssh-ed25519 THE-HOST-KEY root@wheelhouse-test" ;; *SIGNUP_CODE*) echo test-code ;; esac
exit 0
`);
  tool('scp', `#!/usr/bin/env bash
for f in "$@"; do [ -f "$f" ] && cp "$f" "${caught}/scp-$(basename "$f")"; done
exit 0
`);
  tool('ssh-keygen', `#!/usr/bin/env bash
case " $* " in *" -l "*) echo "256 MD5:aa:bb test (ED25519)" ;; *" -R "*) echo "$*" >> "${caught}/forgot-host" ;; esac
exit 0
`);
  tool('gh', `#!/usr/bin/env bash
case "$1 $2" in
  "auth status") exit 0 ;;
  "secret set") echo "$*" >> "${caught}/gh-calls"; cat > "${caught}/gh-secret-$3" ;;
  "variable set") echo "$*" >> "${caught}/gh-calls" ;;
  "api "*) echo '{"message":"Package not found."}'; exit 1 ;;
esac
exit 0
`);
  tool('curl', `#!/usr/bin/env bash
case "$*" in
  *ghcr.io/token*) echo '{"token":"anonymous"}' ;;
  *ghcr.io/v2/jackcurphey/wheelhouse-epos/tags/list*) [ -f "${dir}/package-public" ] || exit 22; echo '{"tags":[]}' ;;
  *) exit 7 ;;
esac
`);
  writeFileSync(path.join(dir, 'id_ed25519.pub'), 'ssh-ed25519 AAAA test\n');
  writeFileSync(path.join(dir, 'deploy-key'), 'THE-PRIVATE-DEPLOY-KEY\n');
  writeFileSync(path.join(dir, 'deploy-key.pub'), 'ssh-ed25519 DEPLOYPUB wheelhouse-deploy\n');

  const run = spawnSync('bash', [path.join(DIR, 'setup.sh')], {
    input: 'yes\n', encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, SSH_KEY_FILE: path.join(dir, 'id_ed25519'), DEPLOY_KEY_FILE: path.join(dir, 'deploy-key') },
  });
  assert.equal(run.status, 0, `setup.sh stopped:\n${run.stdout}\n${run.stderr}`);
  assert.ok(existsSync(path.join(caught, 'scp-deploy.sh')), 'deploy.sh was not copied to the server');
  assert.match(readFileSync(path.join(caught, 'remote-input'), 'utf8'), /DEPLOY_PUBLIC_KEY=ssh-ed25519\\ DEPLOYPUB\\ wheelhouse-deploy/);
  assert.equal(readFileSync(path.join(caught, 'gh-secret-HOSTED_COPY_SSH_KEY'), 'utf8'), 'THE-PRIVATE-DEPLOY-KEY\n');
  const calls = readFileSync(path.join(caught, 'gh-calls'), 'utf8');
  assert.match(calls, /variable set HOSTED_COPY_HOST --body 203\.0\.113\.5/);
  assert.match(calls, /variable set HOSTED_COPY_URL --body https:\/\/203-0-113-5\.sslip\.io/);
  assert.match(calls, /variable set HOSTED_COPY_KNOWN_HOSTS --body 203\.0\.113\.5 ssh-ed25519 THE-HOST-KEY/);
  assert.match(calls, /--repo JackCurphey\/wheelhouse-epos/);
  assert.match(run.stdout, /One more thing, once/, 'a private package needs Jack to make it public');

  // Once the package downloads without a password, there's nothing to ask,
  // however gh's own package lookup answers.
  writeFileSync(path.join(dir, 'package-public'), '');
  const again = spawnSync('bash', [path.join(DIR, 'setup.sh')], {
    input: 'yes\n', encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, SSH_KEY_FILE: path.join(dir, 'id_ed25519'), DEPLOY_KEY_FILE: path.join(dir, 'deploy-key') },
  });
  assert.equal(again.status, 0, `setup.sh stopped:\n${again.stdout}\n${again.stderr}`);
  assert.doesNotMatch(again.stdout, /One more thing, once/, 'it asked Jack to make a public package public');

  // The server already existed both times, so the host key this Mac trusts
  // for it was kept: a different key answering would be refused (fresh
  // review, 24 Oct). Only a newly made server, at an address DigitalOcean
  // may have used before, has its old key forgotten.
  assert.ok(!existsSync(path.join(caught, 'forgot-host')), 'setup.sh forgot the existing server\'s host key');
  writeFileSync(path.join(dir, 'no-droplet'), '');
  const fresh = spawnSync('bash', [path.join(DIR, 'setup.sh')], {
    input: 'yes\n', encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, SSH_KEY_FILE: path.join(dir, 'id_ed25519'), DEPLOY_KEY_FILE: path.join(dir, 'deploy-key') },
  });
  assert.equal(fresh.status, 0, `setup.sh stopped:\n${fresh.stdout}\n${fresh.stderr}`);
  assert.match(readFileSync(path.join(caught, 'forgot-host'), 'utf8'), /-R 203\.0\.113\.5/);
});

// The server half of the above, run against pretend tools in a scratch
// folder: the settings name the image and commit running, and the deploy key
// may run deploy.sh and nothing else.
test('remote-install.sh records the commit it built, and ties the deploy key to deploy.sh only', async (t) => {
  const { mkdtempSync, writeFileSync, chmodSync, rmSync, mkdirSync } = await import('node:fs');
  const os = await import('node:os');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'remote-install-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, 'bin');
  const opt = path.join(dir, 'opt');
  mkdirSync(bin); mkdirSync(opt); mkdirSync(path.join(opt, 'app', '.git'), { recursive: true });
  const tool = (name, body) => { writeFileSync(path.join(bin, name), body); chmodSync(path.join(bin, name), 0o755); };
  tool('cloud-init', '#!/usr/bin/env bash\nexit 0\n');
  tool('psql', '#!/usr/bin/env bash\ncase "$*" in *has_schema_privilege*) echo t ;; esac\nexit 0\n');
  tool('git', `#!/usr/bin/env bash\ncase "$*" in *"rev-parse HEAD"*) echo ${'c'.repeat(40)} ;; esac\nexit 0\n`);
  tool('docker', '#!/usr/bin/env bash\nexit 0\n');
  tool('curl', '#!/usr/bin/env bash\nexit 0\n');
  const keys = path.join(dir, 'authorized_keys');
  writeFileSync(keys, 'ssh-ed25519 JACKS-OWN jack@mac\nrestrict,command="/opt/wheelhouse/deploy.sh" ssh-ed25519 OLDDEPLOY wheelhouse-deploy\n');
  writeFileSync(path.join(opt, '.env'), 'SIGNUP_CODE=keep-me\nSHOPIFY_TOKEN_ENCRYPTION_KEY=keep-this-too\n');
  const vars = "export DB_HOST=db.example.test DB_PORT=25060 DB_ADMIN_PASSWORD=x APP_DB_PASSWORD=y SITE_ADDRESS=203-0-113-5.sslip.io DEPLOY_PUBLIC_KEY='ssh-ed25519 NEWDEPLOY wheelhouse-deploy'\n";
  const install = () => spawnSync('bash', ['-s'], {
    input: vars + read('remote-install.sh'), encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, WHEELHOUSE_DIR: opt, AUTHORIZED_KEYS: keys },
  });
  for (let i = 0; i < 2; i++) {
    const run = install();
    assert.equal(run.status, 0, `remote-install.sh stopped:\n${run.stdout}\n${run.stderr}`);
  }
  const env = readFileSync(path.join(opt, '.env'), 'utf8');
  assert.match(env, /^WHEELHOUSE_IMAGE=wheelhouse-app:current$/m);
  assert.match(env, new RegExp(`^WHEELHOUSE_COMMIT=${'c'.repeat(40)}$`, 'm'));
  assert.match(env, /^SIGNUP_CODE=keep-me$/m);
  assert.equal(readFileSync(keys, 'utf8'),
    'ssh-ed25519 JACKS-OWN jack@mac\nrestrict,command="/opt/wheelhouse/deploy.sh" ssh-ed25519 NEWDEPLOY wheelhouse-deploy\n',
    'the deploy key must replace the old one, once, and leave the other keys alone');
  // A key with options or a second line tucked in would get more than deploy.sh.
  for (const bad of ['command="bash" ssh-ed25519 AAAA x', 'ssh-ed25519 AAAA x\nssh-ed25519 BBBB evil', 'ssh-rsa AAAA x']) {
    const run = spawnSync('bash', ['-s'], {
      input: vars.replace(/DEPLOY_PUBLIC_KEY='[^']*'/, `DEPLOY_PUBLIC_KEY=${JSON.stringify(bad)}`) + read('remote-install.sh'), encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, WHEELHOUSE_DIR: opt, AUTHORIZED_KEYS: keys },
    });
    assert.notEqual(run.status, 0, `accepted ${JSON.stringify(bad)}`);
    assert.doesNotMatch(readFileSync(keys, 'utf8'), /evil|command="bash"|ssh-rsa/);
  }
});

// Running setup again replaces what's running with the image it builds. The
// version to go back to must then be what it replaced, if that can come back
// (a downloaded image, kept by its commit), or nothing: the image built on the
// server is rebuilt in place, so going back to it would run new code under an
// old commit (fresh review, 24 Oct).
test('setup run again: the version it replaced is the one to go back to, only when it can come back', async (t) => {
  const { mkdtempSync, writeFileSync, chmodSync, rmSync, mkdirSync } = await import('node:fs');
  const os = await import('node:os');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'remote-again-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, 'bin');
  const opt = path.join(dir, 'opt');
  mkdirSync(bin); mkdirSync(opt); mkdirSync(path.join(opt, 'app', '.git'), { recursive: true });
  const tool = (name, body) => { writeFileSync(path.join(bin, name), body); chmodSync(path.join(bin, name), 0o755); };
  tool('cloud-init', '#!/usr/bin/env bash\nexit 0\n');
  tool('psql', '#!/usr/bin/env bash\ncase "$*" in *has_schema_privilege*) echo t ;; esac\nexit 0\n');
  tool('git', `#!/usr/bin/env bash\ncase "$*" in *"rev-parse HEAD"*) echo ${'c'.repeat(40)} ;; esac\nexit 0\n`);
  tool('docker', '#!/usr/bin/env bash\nexit 0\n');
  tool('curl', '#!/usr/bin/env bash\nexit 0\n');
  const keys = path.join(dir, 'authorized_keys');
  writeFileSync(keys, '');
  const vars = "export DB_HOST=db.example.test DB_PORT=25060 DB_ADMIN_PASSWORD=x APP_DB_PASSWORD=y SITE_ADDRESS=203-0-113-5.sslip.io DEPLOY_PUBLIC_KEY='ssh-ed25519 NEWDEPLOY wheelhouse-deploy'\n";
  const install = () => spawnSync('bash', ['-s'], {
    input: vars + read('remote-install.sh'), encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, WHEELHOUSE_DIR: opt, AUTHORIZED_KEYS: keys },
  });
  const OLD = 'a'.repeat(40);
  const previous = path.join(opt, 'release.previous');
  const stale = 'WHEELHOUSE_IMAGE=ghcr.io/jackcurphey/wheelhouse-epos:' + 'e'.repeat(40) + '\nWHEELHOUSE_COMMIT=' + 'e'.repeat(40) + '\n';

  // Running a downloaded image: that one is the way back.
  writeFileSync(path.join(opt, '.env'), `SIGNUP_CODE=k\nWHEELHOUSE_IMAGE=ghcr.io/jackcurphey/wheelhouse-epos:${OLD}\nWHEELHOUSE_COMMIT=${OLD}\n`);
  writeFileSync(previous, stale);
  let run = install();
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.equal(readFileSync(previous, 'utf8'), `WHEELHOUSE_IMAGE=ghcr.io/jackcurphey/wheelhouse-epos:${OLD}\nWHEELHOUSE_COMMIT=${OLD}\n`);

  // Running the image built here: nothing to go back to, not a stale record.
  writeFileSync(path.join(opt, '.env'), `SIGNUP_CODE=k\nWHEELHOUSE_IMAGE=wheelhouse-app:current\nWHEELHOUSE_COMMIT=${OLD}\n`);
  writeFileSync(previous, stale);
  run = install();
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.ok(!existsSync(previous), 'a stale version to go back to was left');
});

test('compose.yml starts the image the settings name, or the one built on the server', () => {
  const compose = read('compose.yml');
  const app = compose.slice(compose.indexOf('\n  app:'), compose.indexOf('\n  caddy:'));
  assert.match(app, /\n    image: \$\{WHEELHOUSE_IMAGE:-wheelhouse-app:current\}\n/);
});

