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
