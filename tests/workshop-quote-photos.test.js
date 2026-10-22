// A photo on a quote line (Jack, 1 Oct, docs/decisions/2026-10-01-drop-off-and-quote-review.md;
// dq-quote-photo, dq-job-quote; openspec/changes/quote-line-photos).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let maya;

// The first bytes of a PNG are all the check reads; the rest is filler.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('pads photo')]);
const TEXT = Buffer.from('<html><script>alert(1)</script></html>');

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Photo Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Other Cycles' });
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

function staff(path, options, who = owner) {
  return staffRequest(server.baseUrl, who.cookie, path, options);
}
const raw = (path) => fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}${path}`);

let jobDay = 5;
async function newJob() {
  const job = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: `2026-10-${String(jobDay++).padStart(2, '0')}`, customerId: maya.id } });
  assert.equal(job.status, 201, JSON.stringify(job.body));
  return job.body;
}
async function upload(jobId, bytes, contentType = 'image/png', who = owner) {
  const res = await staff(`/api/workshop-jobs/${jobId}/attachments`, { method: 'POST', body: { filename: 'pads.png', contentType, dataBase64: bytes.toString('base64') } }, who);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.id;
}
const PADS = (over) => ({ kind: 'part', description: 'Shimano brake pads', unitAmount: 28, need: 'needed', reason: 'Rear pads are worn down to 1mm.', ...over });
const saveLines = (jobId, lines) => staff(`/api/workshop-jobs/${jobId}/quotes`, { method: 'POST', body: { lines } });
const readQuote = async (id) => (await staff(`/api/quotes/${id}`)).body;
const codeFor = async (jobId) => (await staff(`/api/workshop-jobs/${jobId}/private-link`, { method: 'POST', body: {} })).body.privateLink.split('/booking/')[1];

test('a quote line keeps a photo of its own job', async () => {
  const job = await newJob();
  const photoId = await upload(job.id, PNG);
  const saved = await saveLines(job.id, [PADS({ photoId }), PADS({ description: 'Fit and adjust brakes', kind: 'labour' })]);
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  const q = await readQuote(saved.body.id);
  assert.deepEqual(q.lines.map((l) => l.photoId), [photoId, null]);
});

test('a photo that isn’t a picture of this job is refused', async () => {
  const job = await newJob();
  const elsewhere = await newJob();
  const theirs = await upload(elsewhere.id, PNG);
  const notAPicture = await upload(job.id, TEXT, 'image/png');
  for (const [photoId, why] of [[theirs, 'another job’s file'], [notAPicture, 'not a picture, whatever it says'], [999999, 'no such file'], ['1', 'not a number']]) {
    const res = await saveLines(job.id, [PADS({ photoId })]);
    assert.equal(res.status, 409, `${why}: ${JSON.stringify(res.body)}`);
  }
});

test('the customer gets the photo of a line on the booking’s current quote, inline, as a picture', async () => {
  const job = await newJob();
  const photoId = await upload(job.id, PNG);
  const saved = await saveLines(job.id, [PADS({ photoId })]);
  const lineId = (await readQuote(saved.body.id)).lines[0].id;
  const code = await codeFor(job.id);
  // A draft is not the customer's to see.
  assert.equal((await raw(`/booking-links/${code}/quote/lines/${lineId}/photo`)).status, 404);
  assert.equal((await staff(`/api/quotes/${saved.body.id}/send`, { method: 'POST', body: {} })).status, 200);
  const res = await raw(`/booking-links/${code}/quote/lines/${lineId}/photo`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.match(res.headers.get('content-disposition') ?? '', /^inline/);
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), PNG);
});

test('the customer route serves nothing for another booking’s line, a line without a photo, or a wrong code', async () => {
  const job = await newJob();
  const photoId = await upload(job.id, PNG);
  const saved = await saveLines(job.id, [PADS({ photoId }), PADS({ description: 'Replace gear cable', kind: 'labour' })]);
  assert.equal((await staff(`/api/quotes/${saved.body.id}/send`, { method: 'POST', body: {} })).status, 200);
  const [withPhoto, without] = (await readQuote(saved.body.id)).lines;
  const otherJob = await newJob();
  const otherCode = await codeFor(otherJob.id);
  const code = await codeFor(job.id);
  assert.equal((await raw(`/booking-links/${otherCode}/quote/lines/${withPhoto.id}/photo`)).status, 404, 'another booking');
  assert.equal((await raw(`/booking-links/${code}/quote/lines/${without.id}/photo`)).status, 404, 'no photo');
  assert.equal((await raw(`/booking-links/${'c'.repeat(64)}/quote/lines/${withPhoto.id}/photo`)).status, 404, 'no such link');
});

test('removing the file from the job takes it off the line', async () => {
  const job = await newJob();
  const photoId = await upload(job.id, PNG);
  const saved = await saveLines(job.id, [PADS({ photoId })]);
  assert.equal((await staff(`/api/workshop-jobs/${job.id}/attachments/${photoId}`, { method: 'DELETE' })).status, 200);
  assert.equal((await readQuote(saved.body.id)).lines[0].photoId, null);
});

// From the fresh review.
test('a photo on an older revision isn’t served once the quote is revised', async () => {
  const job = await newJob();
  const photoId = await upload(job.id, PNG);
  const first = await saveLines(job.id, [PADS({ photoId })]);
  assert.equal((await staff(`/api/quotes/${first.body.id}/send`, { method: 'POST', body: {} })).status, 200);
  const oldLine = (await readQuote(first.body.id)).lines[0].id;
  const code = await codeFor(job.id);
  assert.equal((await raw(`/booking-links/${code}/quote/lines/${oldLine}/photo`)).status, 200);
  const second = await saveLines(job.id, [PADS({ photoId })]);
  assert.equal(second.status, 201, JSON.stringify(second.body));
  assert.notEqual(second.body.id, first.body.id);
  assert.equal((await staff(`/api/quotes/${second.body.id}/send`, { method: 'POST', body: {} })).status, 200);
  assert.equal((await raw(`/booking-links/${code}/quote/lines/${oldLine}/photo`)).status, 404, 'revision 1’s line');
});

test('another shop’s file can’t go on a line, and a link can’t be read under another shop', async () => {
  const theirJob = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Their job', jobDate: '2026-10-20' } }, other)).body;
  const theirs = await upload(theirJob.id, PNG, 'image/png', other);
  const job = await newJob();
  assert.equal((await saveLines(job.id, [PADS({ photoId: theirs })])).status, 409);
  const photoId = await upload(job.id, PNG);
  const saved = await saveLines(job.id, [PADS({ photoId })]);
  assert.equal((await staff(`/api/quotes/${saved.body.id}/send`, { method: 'POST', body: {} })).status, 200);
  const lineId = (await readQuote(saved.body.id)).lines[0].id;
  const code = await codeFor(job.id);
  const res = await fetch(`${server.baseUrl}/api/portal/${other.shop.slug}/booking-links/${code}/quote/lines/${lineId}/photo`);
  assert.equal(res.status, 404);
});

test('a photo id too big for the database is refused, not a crash', async () => {
  const job = await newJob();
  assert.equal((await saveLines(job.id, [PADS({ photoId: 3e9 })])).status, 409);
});

test('the customer’s photo may be kept by their browser for five minutes, so it isn’t fetched again on every view', async () => {
  const job = await newJob();
  const photoId = await upload(job.id, PNG);
  const saved = await saveLines(job.id, [PADS({ photoId })]);
  assert.equal((await staff(`/api/quotes/${saved.body.id}/send`, { method: 'POST', body: {} })).status, 200);
  const lineId = (await readQuote(saved.body.id)).lines[0].id;
  const res = await raw(`/booking-links/${await codeFor(job.id)}/quote/lines/${lineId}/photo`);
  assert.equal(res.headers.get('cache-control'), 'private, max-age=300');
});
