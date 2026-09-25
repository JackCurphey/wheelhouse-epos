// Migration 025: the contact and consent columns the booking request needs.
// Spec: docs/superpowers/specs/2026-09-25-book-server-3-booking-request-design.md
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

test('customers.update_channel is a nullable text column', async () => {
  const c = await column('customers', 'update_channel');
  assert.ok(c, 'column missing');
  assert.equal(c.data_type, 'text');
  assert.equal(c.is_nullable, 'YES');
});

test('customers.marketing_permission is a boolean that defaults to false', async () => {
  const c = await column('customers', 'marketing_permission');
  assert.ok(c, 'column missing');
  assert.equal(c.data_type, 'boolean');
  assert.equal(c.is_nullable, 'NO');
  assert.match(c.column_default, /false/);
});

test('workshop_jobs.terms_accepted_at is a nullable timestamp', async () => {
  const c = await column('workshop_jobs', 'terms_accepted_at');
  assert.ok(c, 'column missing');
  assert.equal(c.data_type, 'timestamp with time zone');
  assert.equal(c.is_nullable, 'YES');
});

test('update_channel refuses a channel we do not send on', async () => {
  await assert.rejects(
    runWithShop(owner.shop.id, () => prepare(
      "INSERT INTO customers (name, update_channel) VALUES ('x', 'fax')"
    ).run()),
    /check constraint/i
  );
});
