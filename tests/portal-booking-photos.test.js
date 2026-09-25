// Customer photos sent with a booking.
// Spec: docs/superpowers/specs/2026-09-25-book-server-6-customer-photos-design.md
// Successful bookings are signed in; guest bookings are rate-limited per IP and
// refused guest bookings stop before the limiter. Keep the private-link photo
// test here, not in portal-booking-link.test.js (which must stay under 30 lookups).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate, UPLOADS_DIR, purgeAttachmentFiles } from './helpers/workshopFixtures.js';
import { BOOKING_CONTACT } from './helpers/bookable.js';
import { MAX_BOOKING_BODY_BYTES } from '../server/booking-photos.js';

let server;
let owner;
let sam;
let customer;
let svc;

const staff = (p, options) => staffRequest(server.baseUrl, owner.cookie, p, options);

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  svc = (await staff('/api/workshop-services', {
    method: 'POST', body: { name: 'Brake check', price: 20, minutes: 60, bookableOnline: true, questions: [] },
  })).body;
});

after(async () => {
  if (owner) {
    await purgeAttachmentFiles(owner.shop.id);
    await deleteTestShop(owner.shop.id);
  }
  if (server) await server.stop();
});

let day = 0;
const nextDate = () => {
  const n = day++;
  const d = new Date(`${futureDate(1 + (n % 5))}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * Math.floor(n / 5));
  return d.toISOString().slice(0, 10);
};
const GUEST = { guestName: 'Gina Guestname', guestPhone: '07700 900123', email: 'gina@example.com' };
const book = (body, { guest = false } = {}) => portalRequest(server.baseUrl, guest ? null : customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
  method: 'POST',
  body: {
    mechanicId: sam, jobDate: nextDate(), startTime: '10:00', description: 'Brakes rub',
    newBike: { make: 'Dawes', model: 'Galaxy' }, serviceId: svc.id,
    ...BOOKING_CONTACT, ...(guest ? GUEST : {}), ...body,
  },
});
const counts = () => runWithShop(owner.shop.id, () => prepare(
  'SELECT (SELECT count(*)::int FROM workshop_jobs) AS jobs, (SELECT count(*)::int FROM customers) AS customers'
).get());

const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
// A photo whose bytes carry a unique marker, so a stray file can be found in the shared uploads folder.
const photoOf = (marker, head = JPEG_HEAD, size = 64) => ({
  dataBase64: Buffer.concat([head, Buffer.from(marker), Buffer.alloc(size)]).toString('base64'),
});
const filesNow = async () => new Set(await readdir(UPLOADS_DIR));
// Files that appeared since `before` and contain `marker` (other test files write to the same folder in parallel).
async function newFilesWith(before, marker) {
  const found = [];
  for (const name of await readdir(UPLOADS_DIR)) {
    if (before.has(name)) continue;
    const bytes = await readFile(path.join(UPLOADS_DIR, name)).catch(() => null);
    if (bytes && bytes.includes(marker)) found.push(name);
  }
  return found;
}

test('a request over the size cap gets a 400, not a dropped connection or a 500', async () => {
  const marker = `cap-${randomBytes(6).toString('hex')}`;
  const before = await filesNow();
  const c = await counts();
  const big = Buffer.concat([JPEG_HEAD, Buffer.from(marker)]).toString('base64').replace(/=+$/, '').padEnd(MAX_BOOKING_BODY_BYTES + 1_000_000, 'A');
  const res = await book({ photos: [{ dataBase64: big }], marker }, { guest: true });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(res.body.error, 'Those photos are too large to send — please add fewer or smaller photos');
  assert.deepEqual(await counts(), c);
  assert.deepEqual(await newFilesWith(before, marker), []);
});

test('a body that is not JSON gets a 400, not a 500', async () => {
  const res = await fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}/bookings`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not json',
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Invalid request body');
});

const storedPhotos = (jobId) => runWithShop(owner.shop.id, () => prepare(
  'SELECT storage_key, original_name, content_type, size_bytes, from_customer FROM workshop_job_attachments WHERE workshop_job_id = ? ORDER BY id'
).all(jobId));

test('photos are stored as from-customer attachments, named by us, typed by their bytes', async () => {
  const marker = `ok-${randomBytes(6).toString('hex')}`;
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const res = await book({ photos: [photoOf(marker), photoOf(marker, png)] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const rows = await storedPhotos(res.body.id);
  assert.deepEqual(rows.map((r) => [r.original_name, r.content_type, r.from_customer]), [
    ['Customer photo 1.jpg', 'image/jpeg', true], ['Customer photo 2.png', 'image/png', true],
  ]);
  const onDisk = await readFile(path.join(UPLOADS_DIR, rows[0].storage_key));
  assert.deepEqual(onDisk, Buffer.concat([JPEG_HEAD, Buffer.from(marker), Buffer.alloc(64)]));
});

test('the customer\'s own file name and claimed type are never stored', async () => {
  const res = await book({ photos: [{ ...photoOf('names'), filename: '../../evil.exe', contentType: 'text/html' }] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const [row] = await storedPhotos(res.body.id);
  assert.equal(row.original_name, 'Customer photo 1.jpg');
  assert.equal(row.content_type, 'image/jpeg');
});

test('a booking with no photos works as before and has no attachments', async () => {
  for (const extra of [{}, { photos: null }, { photos: [] }]) {
    const res = await book(extra);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(await storedPhotos(res.body.id), []);
  }
});

test('a not-sure booking can carry photos', async () => {
  const res = await book({ notSure: true, serviceId: undefined, photos: [photoOf('notsure')] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal((await storedPhotos(res.body.id)).length, 1);
});

const bigJpeg = (m) => Buffer.concat([JPEG_HEAD, Buffer.from(m), Buffer.alloc(10 * 1024 * 1024)]).toString('base64');
for (const [label, makePhotos, message] of [
  ['too many photos', (m) => Array(6).fill(photoOf(m)), 'You can add up to 5 photos'],
  ['a photo that is too big', (m) => [{ dataBase64: bigJpeg(m) }], 'Each photo can be up to 10 MB'],
  ['not a photo', (m) => [{ dataBase64: Buffer.from(`just text ${m}`).toString('base64') }], 'Only photos can be added (JPEG, PNG or WebP)'],
]) {
  test(`a guest booking with ${label} is refused, leaving no job, customer or file`, async () => {
    const marker = `refuse-${randomBytes(6).toString('hex')}`;
    const before = await filesNow();
    const c = await counts();
    const res = await book({ photos: makePhotos(marker) }, { guest: true });
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(res.body.error, message);
    assert.deepEqual(await counts(), c);
    assert.deepEqual(await newFilesWith(before, marker), []);
  });
}

test('staff see the photos as from-customer attachments and can download them', async () => {
  const marker = `staff-${randomBytes(6).toString('hex')}`;
  const res = await book({ photos: [photoOf(marker)] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const list = await staff(`/api/workshop-jobs/${res.body.id}/attachments`);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].fromCustomer, true);
  assert.equal(list.body[0].originalName, 'Customer photo 1.jpg');
  const file = await fetch(`${server.baseUrl}/api/workshop-jobs/${res.body.id}/attachments/${list.body[0].id}`, { headers: { cookie: owner.cookie } });
  assert.equal(file.status, 200);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), Buffer.concat([JPEG_HEAD, Buffer.from(marker), Buffer.alloc(64)]));
});

test('the private link says how many photos were sent, and nothing else about them', async () => {
  const two = await book({ photos: [photoOf('link1'), photoOf('link2')] });
  const none = await book({});
  const att = await staff(`/api/workshop-jobs/${two.body.id}/attachments`, {
    method: 'POST', body: { filename: 'bench.jpg', contentType: 'image/jpeg', dataBase64: photoOf('staffpic').dataBase64 },
  });
  assert.ok(att.status < 300, JSON.stringify(att.body));
  const read = (res) => jsonRequest(server.baseUrl, null,
    `/api/portal/${owner.shop.slug}/booking-links/${res.body.privateLink.split('/').pop()}`);
  const a = await read(two);
  const b = await read(none);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(a.body.photoCount, 2);
  assert.equal(b.body.photoCount, 0);
  assert.doesNotMatch(JSON.stringify(a.body), /Customer photo|storage|attachment/i);
});
