import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';

// The compose healthcheck is the only thing that tells an orchestrator this
// container is serving. Before this test it GET /, which the app answers off
// disk from index.html - so the container reported healthy with Postgres
// completely down, which is the single failure mode the check exists to
// catch. String-matching the path would pass the moment someone typed the
// right characters; instead this pulls the real command out of
// docker-compose.yml and runs it against a stub that behaves like the app
// with a dead database (200 on static, 503 on /healthz).

// Minimal indentation-aware read of one service's healthcheck command. No
// YAML parser: js-yaml is only in the tree transitively, and this file is
// the wrong place to acquire a dependency.
function healthcheckCommand(service) {
  const lines = readFileSync('docker-compose.yml', 'utf8').split('\n');
  const start = lines.findIndex((l) => l === `  ${service}:`);
  assert.notEqual(start, -1, `no ${service} service in docker-compose.yml`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^ {2}\S/.test(l));
  const block = end === -1 ? rest : rest.slice(0, end);

  const testLine = block.find((l) => /^ {6}test:/.test(l));
  assert.ok(testLine, `${service} has no healthcheck test`);
  const parsed = JSON.parse(testLine.slice(testLine.indexOf('[')));
  assert.deepEqual(parsed.slice(0, 3), ['CMD', 'node', '-e'], 'unexpected probe shape');
  return parsed[3];
}

// Stands in for the app container: static assets always answer 200 (they are
// served off disk and know nothing about Postgres), /healthz reports the
// database's real condition.
function stubApp(healthzStatus) {
  const server = createServer((req, res) => {
    const status = req.url === '/healthz' ? healthzStatus : 200;
    res.writeHead(status, { 'content-type': 'text/plain' });
    res.end(status === 200 ? 'ok' : 'Database unreachable');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function runProbe(script, port) {
  return new Promise((resolve) => {
    const targeted = script.replaceAll('localhost:4000', `127.0.0.1:${port}`);
    execFile('node', ['-e', targeted], (err) => resolve(err ? err.code ?? 1 : 0));
  });
}

test('the app healthcheck fails when the database is unreachable', async () => {
  const script = healthcheckCommand('app');
  const { server, port } = await stubApp(503);
  try {
    assert.notEqual(
      await runProbe(script, port),
      0,
      'probe reported healthy while /healthz reported the database unreachable',
    );
  } finally {
    server.close();
  }
});

test('the app healthcheck passes when the database is reachable', async () => {
  const script = healthcheckCommand('app');
  const { server, port } = await stubApp(200);
  try {
    assert.equal(await runProbe(script, port), 0);
  } finally {
    server.close();
  }
});

test('the app healthcheck probes /healthz, not a static route', () => {
  const script = healthcheckCommand('app');
  const url = script.match(/http:\/\/localhost:4000(\S*?)'/);
  assert.ok(url, 'probe does not GET a localhost:4000 URL');
  assert.equal(url[1], '/healthz');
});
