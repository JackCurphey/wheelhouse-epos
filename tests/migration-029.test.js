// Migration 029: customer photos are staff attachments marked from the customer.
// Spec: docs/superpowers/specs/2026-09-25-book-server-6-customer-photos-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { seedWorkshopJob, purgeAttachmentFiles } from './helpers/workshopFixtures.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
});

after(async () => {
  if (owner) {
    await purgeAttachmentFiles(owner.shop.id);
    await deleteTestShop(owner.shop.id);
  }
  if (server) await server.stop();
  await pool.end();
});

test('workshop_job_attachments.from_customer is boolean, not null, default false', async () => {
  const c = (await pool.query(
    "SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'workshop_job_attachments' AND column_name = 'from_customer'"
  )).rows[0];
  assert.ok(c, 'column missing');
  assert.equal(c.data_type, 'boolean');
  assert.equal(c.is_nullable, 'NO');
  assert.equal(c.column_default, 'false');
});

test('a staff upload is not from the customer, and the list says so', async () => {
  const mechanicId = await seedMechanic(owner.shop.id);
  const { jobId } = await seedWorkshopJob({ shopId: owner.shop.id, customerId: null, mechanicId, jobDate: '2026-09-07' });
  const up = await staffRequest(server.baseUrl, owner.cookie, `/api/workshop-jobs/${jobId}/attachments`, {
    method: 'POST',
    body: { filename: 'report.pdf', contentType: 'application/pdf', dataBase64: Buffer.from('x').toString('base64') },
  });
  assert.equal(up.status, 201, JSON.stringify(up.body));
  assert.equal(up.body.fromCustomer, false);
  const list = await staffRequest(server.baseUrl, owner.cookie, `/api/workshop-jobs/${jobId}/attachments`);
  assert.equal(list.body[0].fromCustomer, false);
  const row = await runWithShop(owner.shop.id, () => prepare('SELECT from_customer FROM workshop_job_attachments WHERE workshop_job_id = ?').get(jobId));
  assert.equal(row.from_customer, false);
});
