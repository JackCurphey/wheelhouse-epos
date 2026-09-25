// Migration 028: a service's questions, and the frozen answers on a booking.
// Spec: docs/superpowers/specs/2026-09-25-book-server-5-service-questions-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const column = async (table, name) => (await pool.query(
  'SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
  [table, name]
)).rows[0];

test('workshop_services.questions is jsonb, not null, defaulting to an empty list', async () => {
  const c = await column('workshop_services', 'questions');
  assert.ok(c, 'column missing');
  assert.equal(c.data_type, 'jsonb');
  assert.equal(c.is_nullable, 'NO');
  assert.match(c.column_default, /'\[\]'::jsonb/);
});

test('workshop_jobs.question_answers is nullable jsonb', async () => {
  const c = await column('workshop_jobs', 'question_answers');
  assert.ok(c, 'column missing');
  assert.equal(c.data_type, 'jsonb');
  assert.equal(c.is_nullable, 'YES');
});

test('a service inserted without questions has an empty list', async () => {
  const row = await runWithShop(owner.shop.id, async () => {
    const { lastInsertRowid } = await prepare(
      "INSERT INTO workshop_services (name, price, updated_at) VALUES ('Plain', 10, now())"
    ).run();
    return prepare('SELECT questions FROM workshop_services WHERE id = ?').get(lastInsertRowid);
  });
  assert.deepEqual(row.questions, []);
});
