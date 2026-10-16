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
  for (const f of ['setup.sh', 'remote-install.sh', 'cloud-init.yaml', 'compose.yml', 'Caddyfile']) {
    assert.ok(existsSync(path.join(DIR, f)), `scripts/hosting/${f} is missing`);
  }
});

test('the shell scripts are valid bash and stop on the first error', () => {
  for (const f of ['setup.sh', 'remote-install.sh']) {
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
  writeFileSync(path.join(dir, 'id_ed25519.pub'), 'ssh-ed25519 AAAA test\n');

  const run = spawnSync('bash', [path.join(DIR, 'setup.sh')], {
    input: 'yes\n', encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, SSH_KEY_FILE: path.join(dir, 'id_ed25519') },
  });
  assert.equal(run.status, 0, `setup.sh stopped:\n${run.stdout}\n${run.stderr}`);
  const sent = readFileSync(path.join(caught, 'remote-input'), 'utf8');
  assert.match(sent, /DB_ADMIN_PASSWORD=admin-secret /);
  assert.match(sent, /APP_DB_PASSWORD=app-secret /);
  assert.match(sent, /DB_HOST=db\.example\.test DB_PORT=25060 /);
  const ca = readdirSync(caught).find((f) => f.startsWith('scp-tmp') || (f.startsWith('scp-') && !f.endsWith('.yml') && f !== 'scp-Caddyfile'));
  assert.ok(ca, 'the certificate was not copied to the server');
  assert.equal(readFileSync(path.join(caught, ca), 'utf8'), 'THE-CA');
});
