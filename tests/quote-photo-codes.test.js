// Use my phone: a code that adds one photo to one draft quote line from a
// phone, with no sign-in, for 15 minutes (openspec/changes/use-my-phone;
// Jack, 3 Oct, walk-through 8 decision 6; drawings approved 23 Oct,
// docs/decisions/2026-10-23-use-my-phone.md). The server's clock is pinned
// to 1 Sep 2026 06:00 UTC, so a code made now runs out at 06:15.
// Public calls in this file stay under the limiter's 30 for its server.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { tinyJpeg, LOCATION_SIGNS } from './helpers/pictures.js';

let server;
let owner;
let other;
let maya;
let bike;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Other Cycles' });
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  bike = (await staff(`/api/customers/${maya.id}/bikes`, { method: 'POST', body: { make: 'Trek', model: 'Domane AL 3' } })).body;
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

function staff(path, options, who = owner) {
  return staffRequest(server.baseUrl, who.cookie, path, options);
}
const FIT = { kind: 'labour', description: 'Fit & adjust brakes', unitAmount: 18, need: 'needed', reason: 'Goes together with the new pads' };
const PADS = { kind: 'part', description: 'Shimano brake pads', unitAmount: 28, need: 'needed', reason: 'Rear pads worn — replacing' };

let jobDay = 5;
// A job for Maya's Trek with a draft quote: Fit & adjust brakes, then the pads (place 1).
async function draftJob() {
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: `2026-10-${String(jobDay++).padStart(2, '0')}`, customerId: maya.id, bikeId: bike.id } })).body;
  const quote = await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [FIT, PADS] } });
  assert.equal(quote.status, 201, JSON.stringify(quote.body));
  return { job, quoteId: quote.body.id };
}
const makeCode = (jobId, body, who = owner) => staff(`/api/workshop-jobs/${jobId}/quote-photo-codes`, { method: 'POST', body }, who);
const statusOf = (jobId, codeId) => staff(`/api/workshop-jobs/${jobId}/quote-photo-codes/${codeId}`);
const codeIn = (path) => path.split('/photo/')[1];
const phoneGet = (code, base = server.baseUrl, slug = owner.shop.slug) => fetch(`${base}/api/portal/${slug}/photo-codes/${code}`).then(async (r) => ({ status: r.status, body: await r.json() }));
const phonePost = (code, bytes, base = server.baseUrl, slug = owner.shop.slug) => fetch(`${base}/api/portal/${slug}/photo-codes/${code}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dataBase64: bytes.toString('base64') }),
}).then(async (r) => ({ status: r.status, body: await r.json() }));
const GONE = 'This code has expired or has already been used';
const linePhoto = async (quoteId, at) => (await staff(`/api/quotes/${quoteId}`)).body.lines[at].photoId ?? null;

test('staff make a code for a draft line: its address and when it runs out', async () => {
  const { job, quoteId } = await draftJob();
  const res = await makeCode(job.id, { quoteId, linePosition: 1 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.match(res.body.path, new RegExp(`^/book/${owner.shop.slug}/photo/[0-9a-f]{64}$`));
  assert.equal(res.body.expiresAt, '2026-09-01T06:15:00.000Z');
  assert.ok(Number.isInteger(res.body.codeId));
  assert.deepEqual((await statusOf(job.id, res.body.codeId)).body, { state: 'waiting' });
});

test('the phone sees only the shop, the job, the bike and the line: nothing about Maya', async () => {
  const { job, quoteId } = await draftJob();
  const made = (await makeCode(job.id, { quoteId, linePosition: 1 })).body;
  const seen = await phoneGet(codeIn(made.path));
  assert.equal(seen.status, 200, JSON.stringify(seen.body));
  assert.deepEqual(seen.body, { shopName: owner.shop.name, reference: job.reference, bike: 'Trek Domane AL 3', line: 'Shimano brake pads', reason: 'Rear pads worn — replacing' });
  assert.doesNotMatch(JSON.stringify(seen.body), /Maya|07700|Patel/);
});

test('a photo from the phone lands on the line and among the job\'s files, without its location, and the code is spent', async () => {
  const { job, quoteId } = await draftJob();
  const made = (await makeCode(job.id, { quoteId, linePosition: 1 })).body;
  const code = codeIn(made.path);
  const sent = await phonePost(code, tinyJpeg('worn pads', 16, { withLocation: true }));
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  assert.deepEqual(sent.body, { reference: job.reference, line: 'Shimano brake pads' });
  const photoId = await linePhoto(quoteId, 1);
  assert.ok(photoId, 'the line has no photo');
  assert.equal(await linePhoto(quoteId, 0), null, 'the photo went on the wrong line');
  const files = (await staff(`/api/workshop-jobs/${job.id}/attachments`)).body;
  assert.deepEqual(files.map((f) => f.id), [photoId]);
  const file = Buffer.from(await (await fetch(`${server.baseUrl}/api/workshop-jobs/${job.id}/attachments/${photoId}`, { headers: { cookie: owner.cookie } })).arrayBuffer());
  for (const sign of LOCATION_SIGNS) assert.ok(!file.includes(Buffer.from(sign, 'latin1')), `"${sign}" was saved`);
  assert.deepEqual((await statusOf(job.id, made.codeId)).body, { state: 'added', attachmentId: photoId });
  // Spent: a second photo, or opening it again, gets the same answer as any bad code.
  assert.deepEqual(await phonePost(code, tinyJpeg('again')), { status: 410, body: { error: GONE } });
  assert.deepEqual(await phoneGet(code), { status: 410, body: { error: GONE } });
});

test('two photos sent with one code at the same moment: one is added, the other is told the code is spent', async () => {
  const { job, quoteId } = await draftJob();
  const code = codeIn((await makeCode(job.id, { quoteId, linePosition: 1 })).body.path);
  const both = await Promise.all([phonePost(code, tinyJpeg('first')), phonePost(code, tinyJpeg('second'))]);
  assert.deepEqual(both.map((r) => r.status).sort(), [201, 410]);
  assert.equal((await staff(`/api/workshop-jobs/${job.id}/attachments`)).body.length, 1, 'both photos were saved');
});

test('an unknown, a malformed and another shop\'s code all get the same answer', async () => {
  const { job, quoteId } = await draftJob();
  const made = (await makeCode(job.id, { quoteId, linePosition: 1 })).body;
  assert.deepEqual(await phoneGet(randomBytes(32).toString('hex')), { status: 410, body: { error: GONE } });
  assert.deepEqual(await phoneGet('abc'), { status: 410, body: { error: GONE } });
  assert.deepEqual(await phoneGet(codeIn(made.path), server.baseUrl, other.shop.slug), { status: 410, body: { error: GONE } });
  assert.deepEqual(await phonePost(codeIn(made.path), tinyJpeg('x'), server.baseUrl, other.shop.slug), { status: 410, body: { error: GONE } });
  assert.equal(await linePhoto(quoteId, 1), null);
});

test('a file that isn\'t a photo is refused and the code still works', async () => {
  const { job, quoteId } = await draftJob();
  const code = codeIn((await makeCode(job.id, { quoteId, linePosition: 1 })).body.path);
  const res = await phonePost(code, Buffer.from('not a photo'));
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Only photos can be added (JPEG, PNG or WebP)');
  assert.equal((await phonePost(code, tinyJpeg('then a photo'))).status, 201);
});

test('a code whose quote was sent, or whose line changed or went, is spent and changes nothing', async () => {
  const sentJob = await draftJob();
  const sentMade = (await makeCode(sentJob.job.id, { quoteId: sentJob.quoteId, linePosition: 1 })).body;
  const sentCode = codeIn(sentMade.path);
  assert.ok((await staff(`/api/quotes/${sentJob.quoteId}/send`, { method: 'POST', body: {} })).status < 300);
  // The computer's pop-up is told too, rather than waiting for a photo that can't come.
  assert.deepEqual((await statusOf(sentJob.job.id, sentMade.codeId)).body, { state: 'expired' });
  assert.deepEqual(await phonePost(sentCode, tinyJpeg('late')), { status: 410, body: { error: GONE } });

  const edited = await draftJob();
  const editedCode = codeIn((await makeCode(edited.job.id, { quoteId: edited.quoteId, linePosition: 1 })).body.path);
  await staff(`/api/workshop-jobs/${edited.job.id}/quotes`, { method: 'POST', body: { lines: [FIT, { ...PADS, description: 'Replace gear cable' }] } });
  assert.deepEqual(await phonePost(editedCode, tinyJpeg('wrong line')), { status: 410, body: { error: GONE } });
  assert.equal(await linePhoto(edited.quoteId, 1), null);

  const shortened = await draftJob();
  const shortCode = codeIn((await makeCode(shortened.job.id, { quoteId: shortened.quoteId, linePosition: 1 })).body.path);
  await staff(`/api/workshop-jobs/${shortened.job.id}/quotes`, { method: 'POST', body: { lines: [FIT] } });
  assert.deepEqual(await phonePost(shortCode, tinyJpeg('gone line')), { status: 410, body: { error: GONE } });
});

test('staff can only make a code for a line of the job\'s draft quote', async () => {
  const { job, quoteId } = await draftJob();
  const otherJob = await draftJob();
  assert.equal((await makeCode(job.id, { quoteId, linePosition: 2 })).status, 400);
  assert.equal((await makeCode(job.id, { quoteId, linePosition: -1 })).status, 400);
  assert.equal((await makeCode(job.id, { quoteId: otherJob.quoteId, linePosition: 1 })).status, 404);
  assert.ok((await staff(`/api/quotes/${quoteId}/send`, { method: 'POST', body: {} })).status < 300);
  const sent = await makeCode(job.id, { quoteId, linePosition: 1 });
  assert.equal(sent.status, 409, JSON.stringify(sent.body));
  assert.equal(sent.body.error, 'A photo can only be added while the quote is a draft');
  assert.equal((await makeCode(job.id, { quoteId, linePosition: 1 }, other)).status, 404);
  const garbled = await fetch(`${server.baseUrl}/api/workshop-jobs/${job.id}/quote-photo-codes`, { method: 'POST', headers: { cookie: owner.cookie, 'content-type': 'application/json' }, body: '{not json' });
  assert.equal(garbled.status, 400);
  assert.equal((await garbled.json()).error, 'Invalid request body');
});

// A server whose clock reads 06:16, a minute after a code made at 06:00 runs out.
test('after 15 minutes the code has run out: the phone is told, and the computer too', async () => {
  const { job, quoteId } = await draftJob();
  const made = (await makeCode(job.id, { quoteId, linePosition: 1 })).body;
  const late = await startLiveServer({ env: { WHEELHOUSE_TEST_CLOCK: '2026-09-01T06:16:00.000Z' } });
  try {
    assert.deepEqual(await phoneGet(codeIn(made.path), late.baseUrl), { status: 410, body: { error: GONE } });
    assert.deepEqual(await phonePost(codeIn(made.path), tinyJpeg('late'), late.baseUrl), { status: 410, body: { error: GONE } });
    const status = await staffRequest(late.baseUrl, owner.cookie, `/api/workshop-jobs/${job.id}/quote-photo-codes/${made.codeId}`);
    assert.deepEqual(status.body, { state: 'expired' });
    assert.equal(await linePhoto(quoteId, 1), null);
  } finally {
    await late.stop();
  }
});

// Its own server, so the limiter's count starts at nothing.
test('a run of guesses is stopped by the limiter', async () => {
  const fresh = await startLiveServer();
  try {
    let last;
    for (let i = 0; i < 31; i++) last = await phoneGet(randomBytes(32).toString('hex'), fresh.baseUrl);
    assert.equal(last.status, 429);
  } finally {
    await fresh.stop();
  }
});
