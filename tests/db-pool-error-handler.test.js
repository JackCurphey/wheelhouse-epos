// tests/db-pool-error-handler.test.js
//
// server/db.js's pool has no pool.on('error', ...) listener. pg-pool emits
// 'error' on the pool whenever an IDLE client's underlying connection dies -
// a Postgres restart, a failover, a load balancer resetting a TCP connection,
// a cloud provider recycling a connection. An 'error' event with no listener
// is not just logged by Node - EventEmitter throws it synchronously, and
// because the failure here originates from an async socket event (not from
// inside any of this test file's own try/catch), that throw surfaces at the
// top of the event loop as an uncaught exception. Node's own default
// behaviour for an uncaught exception is to print the stack and exit(1); this
// branch neither installs nor needs installCrashGuard() to observe that - the
// crash is pre-existing and happens with or without the guard from
// server/server.js. This is a real, ordinary operational event (not a bug
// anywhere else) that currently takes down the whole shared multi-tenant
// process over one connection that had nothing left to do at the moment it
// died.
//
// This is deliberately NOT "assert a listener is registered" - a test like
// that passes even if the registered listener itself does nothing (or does
// something wrong), which is exactly how three tests shipped earlier this
// workstream while the code they covered was broken. Instead this spawns a
// real child process, connects a real client through the real pool, hands it
// back to the pool (so it goes idle), then kills its live TCP socket with an
// error - the same shape of failure a Postgres restart or a recycled
// connection produces - and asserts on the only two things that matter:
// the process must still be alive afterwards, and the pool must still be
// usable for new work. Run without the fix, this fails exactly as pg-pool's
// own documentation says it will: an unhandled 'error' event crashing the
// process. See report-pool-error-handler.txt for the red/green/mutation
// output that proves this.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function runFixture() {
  return new Promise((resolve) => {
    const dbImportPath = path.join(ROOT, 'server', 'db.js').replace(/\\/g, '\\\\');
    const loadEnvImportPath = path.join(ROOT, 'server', 'load-env.js').replace(/\\/g, '\\\\');
    const source =
      `import ${JSON.stringify(loadEnvImportPath)};\n` +
      `import { pool } from ${JSON.stringify(dbImportPath)};\n` +
      // Check out a real client, then release it - it is now sitting IDLE in
      // the pool, exactly the state pg-pool's own docs describe as the one
      // that needs the handler: an idle client with nobody holding it.
      `const client = await pool.connect();\n` +
      `client.release();\n` +
      // Kill its live socket with an error, from OUTSIDE any try/catch of
      // this script's own - the same way a dropped TCP connection would
      // surface, not a synchronous throw this script could accidentally
      // swallow itself.
      `client.connection.stream.destroy(new Error('simulated connection loss'));\n` +
      `setTimeout(async () => {\n` +
      `  try {\n` +
      // Prove the pool - not just the process - is still usable: a fresh
      // client can still be checked out and can still run a real query.
      `    const client2 = await pool.connect();\n` +
      `    await client2.query('SELECT 1');\n` +
      `    client2.release();\n` +
      `    console.log('MARK still-usable');\n` +
      `    process.exit(0);\n` +
      `  } catch (err) {\n` +
      `    console.error('MARK pool-broken', err);\n` +
      `    process.exit(1);\n` +
      `  }\n` +
      `}, 500);\n`;

    const child = spawn(process.execPath, ['--input-type=module', '-e', source], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString('utf8')));
    child.stderr.on('data', (d) => (stderr += d.toString('utf8')));
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

test('an idle pooled client whose connection dies does not crash the process, and the pool stays usable', async () => {
  const { code, stdout, stderr } = await runFixture();
  assert.equal(
    code,
    0,
    `expected the process to survive an idle client's connection dying; stdout:\n${stdout}\nstderr:\n${stderr}`
  );
  assert.match(stdout, /MARK still-usable/, `expected the pool to still be usable afterwards; stderr:\n${stderr}`);
});
