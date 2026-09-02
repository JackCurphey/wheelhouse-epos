// Files attached to a workshop job - an e-bike diagnostic report, a photo of
// a cracked frame.
//
// Task DS-9. Attachments are the one part of the workshop that writes to disk
// as well as the database, so they can go wrong in a way rows alone cannot:
// a row deleted while its file stays behind forever, or a file reachable by
// someone who cannot see its row.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { existsSync } from 'node:fs';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { deleteTestShop } from './helpers/testShop.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { seedWorkshopJob, purgeAttachmentFiles, UPLOADS_DIR } from './helpers/workshopFixtures.js';

let server;

before(async () => {
  server = await startLiveServer();
});

after(async () => {
  if (server) await server.stop();
  await pool.end();
});

async function shopWithJob() {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const mechanicId = await seedMechanic(shop.id);
  const { jobId } = await seedWorkshopJob({
    shopId: shop.id, customerId: null, mechanicId, jobDate: '2026-09-07',
  });
  return { cookie, shop, jobId };
}

async function cleanup(shopId) {
  await purgeAttachmentFiles(shopId);
  await deleteTestShop(shopId);
}

function upload(cookie, jobId, body) {
  return staffRequest(server.baseUrl, cookie, `/api/workshop-jobs/${jobId}/attachments`, {
    method: 'POST',
    body,
  });
}

test('an uploaded file is listed and comes back byte for byte', async () => {
  const { cookie, shop, jobId } = await shopWithJob();
  try {
    const contents = Buffer.from('%PDF-1.4 diagnostic report\n\x00\x01\x02 binary tail');
    const created = await upload(cookie, jobId, {
      filename: 'report.pdf',
      contentType: 'application/pdf',
      dataBase64: contents.toString('base64'),
    });

    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.originalName, 'report.pdf');
    assert.equal(created.body.sizeBytes, contents.length);

    const listed = await staffRequest(server.baseUrl, cookie, `/api/workshop-jobs/${jobId}/attachments`);
    assert.equal(listed.body.length, 1);
    assert.equal(listed.body[0].id, created.body.id);

    const download = await fetch(
      `${server.baseUrl}/api/workshop-jobs/${jobId}/attachments/${created.body.id}`,
      { headers: { cookie } }
    );
    assert.equal(download.status, 200);
    const got = Buffer.from(await download.arrayBuffer());
    assert.ok(got.equals(contents), 'downloaded bytes did not match what was uploaded');
  } finally {
    await cleanup(shop.id);
  }
});

test('a download names the file, including one the header cannot spell', async () => {
  const { cookie, shop, jobId } = await shopWithJob();
  try {
    const created = await upload(cookie, jobId, {
      filename: 'wheelbuild café ünïcode.pdf',
      contentType: 'application/pdf',
      dataBase64: Buffer.from('x').toString('base64'),
    });
    assert.equal(created.status, 201);

    const download = await fetch(
      `${server.baseUrl}/api/workshop-jobs/${jobId}/attachments/${created.body.id}`,
      { headers: { cookie } }
    );
    await download.arrayBuffer();
    const disposition = download.headers.get('content-disposition');

    // The plain filename= is ASCII-only for old clients; filename* carries
    // the real name. Both have to be there, or one class of browser gets a
    // mangled name and the other gets none.
    assert.match(disposition, /filename="wheelbuild caf_ _n_code\.pdf"/);
    assert.match(disposition, /filename\*=UTF-8''/);
    assert.match(disposition, /caf%C3%A9/);
    assert.equal(download.headers.get('cache-control'), 'no-store');
  } finally {
    await cleanup(shop.id);
  }
});

// These two guards cover for each other, so both tests assert the message and
// not just the 400. Base64 of an empty file is the empty string, which trips
// the missing-data check before the empty-file check is ever reached; and with
// the missing-data check gone, a missing field still 400s through the decode
// handler. Asserting the status alone, both tests passed with either guard
// deleted - which mutation testing caught and is the reason they read like
// this.
test('an empty file is refused as empty', async () => {
  const { cookie, shop, jobId } = await shopWithJob();
  try {
    // Non-empty base64 that decodes to nothing, so the missing-data check
    // upstream does not fire first.
    const res = await upload(cookie, jobId, { filename: 'nothing.pdf', dataBase64: '=' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'That file is empty');
  } finally {
    await cleanup(shop.id);
  }
});

test('an upload with no file data at all is refused as missing', async () => {
  const { cookie, shop, jobId } = await shopWithJob();
  try {
    const res = await upload(cookie, jobId, { filename: 'nothing.pdf' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'No file data received');
  } finally {
    await cleanup(shop.id);
  }
});

test('a file over the 15MB limit is refused', async () => {
  const { cookie, shop, jobId } = await shopWithJob();
  try {
    // Over the 15MB decoded cap, but still under the ~21MB request-body cap,
    // so this exercises the decoded-size check rather than the outer one.
    const oversized = Buffer.alloc(15 * 1024 * 1024 + 1024, 0x41);
    const res = await upload(cookie, jobId, {
      filename: 'huge.pdf', dataBase64: oversized.toString('base64'),
    });
    assert.equal(res.status, 400, 'an oversized file was accepted');

    const listed = await staffRequest(server.baseUrl, cookie, `/api/workshop-jobs/${jobId}/attachments`);
    assert.equal(listed.body.length, 0, 'a rejected upload still created a row');
  } finally {
    await cleanup(shop.id);
  }
});

test('another shop can neither list, download nor delete the attachment', async () => {
  const owner = await shopWithJob();
  const intruder = await staffSignup(server.baseUrl);
  try {
    const created = await upload(owner.cookie, owner.jobId, {
      filename: 'private.pdf', dataBase64: Buffer.from('confidential').toString('base64'),
    });
    assert.equal(created.status, 201);
    const url = `/api/workshop-jobs/${owner.jobId}/attachments/${created.body.id}`;

    const list = await staffRequest(server.baseUrl, intruder.cookie, `/api/workshop-jobs/${owner.jobId}/attachments`);
    assert.equal(list.status, 404, "another shop listed this job's attachments");

    const download = await fetch(`${server.baseUrl}${url}`, { headers: { cookie: intruder.cookie } });
    assert.equal(download.status, 404, "another shop downloaded this shop's file");

    const removed = await staffRequest(server.baseUrl, intruder.cookie, url, { method: 'DELETE' });
    assert.equal(removed.status, 404, "another shop deleted this shop's attachment");

    // And it is still there for its owner afterwards.
    const stillThere = await staffRequest(server.baseUrl, owner.cookie, `/api/workshop-jobs/${owner.jobId}/attachments`);
    assert.equal(stillThere.body.length, 1);
  } finally {
    await cleanup(owner.shop.id);
    await deleteTestShop(intruder.shop.id);
  }
});

test('deleting an attachment removes the row and the file on disk', async () => {
  const { cookie, shop, jobId } = await shopWithJob();
  try {
    const created = await upload(cookie, jobId, {
      filename: 'temp.pdf', dataBase64: Buffer.from('delete me').toString('base64'),
    });
    assert.equal(created.status, 201);

    const [{ storage_key: storageKey }] = await runWithShop(shop.id, () =>
      prepare('SELECT storage_key FROM workshop_job_attachments WHERE id = ?').all(created.body.id)
    );
    const filePath = path.join(UPLOADS_DIR, storageKey);
    assert.ok(existsSync(filePath), 'the upload never reached disk');

    const removed = await staffRequest(
      server.baseUrl, cookie, `/api/workshop-jobs/${jobId}/attachments/${created.body.id}`,
      { method: 'DELETE' }
    );
    assert.equal(removed.status, 200);

    const listed = await staffRequest(server.baseUrl, cookie, `/api/workshop-jobs/${jobId}/attachments`);
    assert.equal(listed.body.length, 0);
    assert.ok(!existsSync(filePath), 'the row went but the file was left on disk');
  } finally {
    await cleanup(shop.id);
  }
});
