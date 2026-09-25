// Migration 027: the private link's hash and the customer's own description.
// Spec: docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md
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

const column = async (name) => (await pool.query(
  "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name = 'workshop_jobs' AND column_name = $1",
  [name]
)).rows[0];

for (const name of ['link_token_hash', 'customer_description']) {
  test(`workshop_jobs.${name} is nullable text`, async () => {
    const c = await column(name);
    assert.ok(c, 'column missing');
    assert.equal(c.data_type, 'text');
    assert.equal(c.is_nullable, 'YES');
  });
}

test('two jobs cannot share a link hash', async () => {
  const insert = () => runWithShop(owner.shop.id, () => prepare(
    "INSERT INTO workshop_jobs (title, job_date, link_token_hash) VALUES ('x', '2030-01-01', 'same-hash')"
  ).run());
  await insert();
  await assert.rejects(insert(), /unique|duplicate/i);
});
