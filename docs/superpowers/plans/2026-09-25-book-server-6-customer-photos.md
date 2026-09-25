# Book server piece 6: customer photos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A customer can send up to 5 photos with a booking request; staff see them as attachments marked "from the customer"; the private link shows only a count.

**Architecture:** One migration adds `from_customer` to the existing attachments table. A pure module checks the photos (count, size, real file type from the first bytes). A small store module writes the files and rows and cleans up its own files on failure. The booking route reads a larger body (answering 400, not dropping the connection, when it is too big), checks photos before any write, and saves them as the last write inside the booking lock so an error rolls the whole booking back.

**Tech Stack:** Node ESM, `node:test`, Postgres (compose, port 5433), raw `http` server in `server/server.js`.

**Spec:** `docs/superpowers/specs/2026-09-25-book-server-6-customer-photos-design.md` (read its "Checked against the code" section too).

## Global Constraints

- Photos only (JPEG, PNG, WebP); no video. Up to 5 photos, each up to 10 MB (10 × 1024 × 1024 bytes decoded).
- Type comes from the file's first bytes; the customer's file name and claimed type are never stored or trusted. Stored name is `Customer photo N.<ext>`, N from 1.
- A refused booking leaves no job, no customer row, no file.
- Only staff see photos; the private link gets `photoCount` only (no names, ids, photos).
- Plain-English customer-facing messages, exactly as listed in the spec.
- Tests first; watch each fail for the right reason. Branch `feat/book-server-6-customer-uploads`; never commit to main.
- `tests/portal-booking-link.test.js` stays under 30 lookups (14 today) — **do not add tests to it**; new tests go in `tests/portal-booking-photos.test.js`.
- Successful test bookings are signed in (guests are limited to 5 per hour per IP). Refused guest bookings must stop before the limiter.
- Refusal tests check for new files in `UPLOADS_DIR` by looking for the test's unique marker bytes in files that appeared (other test files write to the same folder in parallel, so a plain "folder unchanged" check would be flaky).
- Leave the untracked `.claude/launch.json` alone.
- Done-condition: `npm test` passes in full with compose Postgres up, and every new test was seen failing first.

Run one test file with: `node --test tests/<file>.test.js`.

---

### Task 1: Migration 029 and the staff `fromCustomer` flag

**Files:**
- Create: `server/migrations/029_customer_photos.sql`
- Create: `tests/migration-029.test.js`
- Modify: `server/server.js` (`serializeAttachment`, ~line 3157)
- Test: `tests/migration-029.test.js`

**Interfaces:**
- Produces: column `workshop_job_attachments.from_customer BOOLEAN NOT NULL DEFAULT false`; `serializeAttachment(row)` now also returns `fromCustomer: row.from_customer`.

- [ ] **Step 1: Write the failing test** — `tests/migration-029.test.js`, modelled on `tests/migration-028.test.js` (same imports, `before`/`after`, `column` helper):

```js
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
```

(Check `tests/workshop-attachments.test.js` for the exact `staffRequest` body/option shape for uploads and copy it if it differs.)

- [ ] **Step 2: Run to verify it fails**: `node --test tests/migration-029.test.js` → FAIL "column missing".

- [ ] **Step 3: Implement.** `server/migrations/029_customer_photos.sql`:

```sql
-- Customer photos (piece 6). A photo sent with a booking is a staff attachment
-- marked as coming from the customer. Existing rows are staff files, so false.
-- Spec: docs/superpowers/specs/2026-09-25-book-server-6-customer-photos-design.md
ALTER TABLE workshop_job_attachments
  ADD COLUMN from_customer BOOLEAN NOT NULL DEFAULT false;
```

In `serializeAttachment` add `fromCustomer: row.from_customer,` after `uploadedAt`.

- [ ] **Step 4: Run** `node --test tests/migration-029.test.js tests/workshop-attachments.test.js` → PASS. (If `workshop-attachments` asserts exact deep-equal on the attachment shape, add `fromCustomer: false` there.)
- [ ] **Step 5: Commit** — `git add server/migrations/029_customer_photos.sql server/server.js tests/migration-029.test.js && git commit -m "feat: migration 029 - attachments can be marked from the customer"`

---

### Task 2: `readBookingPhotos` — the pure photo check

**Files:**
- Create: `server/booking-photos.js`
- Test: `tests/booking-photos.test.js`

**Interfaces:**
- Produces (all exports of `server/booking-photos.js`):
  - `MAX_PHOTOS = 5`, `MAX_PHOTO_BYTES = 10 * 1024 * 1024`, `MAX_BOOKING_BODY_BYTES = Math.ceil(MAX_PHOTOS * MAX_PHOTO_BYTES * 1.4)`
  - `readBookingPhotos(input) → { value: Photo[] } | { error: string }`, `Photo = { buffer: Buffer, contentType: 'image/jpeg'|'image/png'|'image/webp', extension: 'jpg'|'png'|'webp' }`

- [ ] **Step 1: Write the failing test** — `tests/booking-photos.test.js`:

```js
// Customer photos on a booking, checked without a server or a disk.
// Spec: docs/superpowers/specs/2026-09-25-book-server-6-customer-photos-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { readBookingPhotos, MAX_PHOTO_BYTES } from '../server/booking-photos.js';

const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP_HEAD = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WEBP')]);
const photo = (head, size = 32) => ({ dataBase64: Buffer.concat([head, Buffer.alloc(size)]).toString('base64') });
const UNREADABLE = 'A photo could not be read — please try adding it again';

test('JPEG, PNG and WebP are each identified from their first bytes', () => {
  const r = readBookingPhotos([photo(JPEG_HEAD), photo(PNG_HEAD), photo(WEBP_HEAD)]);
  assert.deepEqual(r.value.map((p) => [p.contentType, p.extension]), [
    ['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'],
  ]);
  assert.ok(Buffer.isBuffer(r.value[0].buffer));
});

test('a text file is refused, whatever it is called', () => {
  const r = readBookingPhotos([{ dataBase64: Buffer.from('hello there').toString('base64'), filename: 'x.jpg', contentType: 'image/jpeg' }]);
  assert.equal(r.error, 'Only photos can be added (JPEG, PNG or WebP)');
});

test('a RIFF file that is not WebP is refused', () => {
  const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WAVE'), Buffer.alloc(8)]);
  assert.equal(readBookingPhotos([{ dataBase64: wav.toString('base64') }]).error, 'Only photos can be added (JPEG, PNG or WebP)');
});

test('5 photos are accepted, 6 are refused', () => {
  assert.equal(readBookingPhotos(Array(5).fill(photo(JPEG_HEAD))).value.length, 5);
  assert.equal(readBookingPhotos(Array(6).fill(photo(JPEG_HEAD))).error, 'You can add up to 5 photos');
});

test('exactly 10 MB is accepted, one byte more is refused', () => {
  const at = Buffer.concat([JPEG_HEAD, Buffer.alloc(MAX_PHOTO_BYTES - JPEG_HEAD.length)]);
  assert.equal(readBookingPhotos([{ dataBase64: at.toString('base64') }]).value.length, 1);
  const over = Buffer.concat([at, Buffer.alloc(1)]);
  assert.equal(readBookingPhotos([{ dataBase64: over.toString('base64') }]).error, 'Each photo can be up to 10 MB');
});

test('a non-list, empty data, non-string data and non-base64 text are each refused', () => {
  assert.equal(readBookingPhotos('nope').error, UNREADABLE);
  assert.equal(readBookingPhotos({}).error, UNREADABLE);
  assert.equal(readBookingPhotos([{ dataBase64: '' }]).error, UNREADABLE);
  assert.equal(readBookingPhotos([{ dataBase64: 12 }]).error, UNREADABLE);
  assert.equal(readBookingPhotos([{}]).error, UNREADABLE);
  assert.equal(readBookingPhotos([null]).error, UNREADABLE);
  assert.equal(readBookingPhotos([{ dataBase64: '!!! not base64 !!!' }]).error, UNREADABLE);
});

test('absent, null and an empty list all mean no photos', () => {
  for (const input of [undefined, null, []]) assert.deepEqual(readBookingPhotos(input), { value: [] });
});
```

- [ ] **Step 2: Run** `node --test tests/booking-photos.test.js` → FAIL (module not found).
- [ ] **Step 3: Implement** `server/booking-photos.js`:

```js
// Customer photos on a booking request: count, size and real file type checked
// before anything is written. Pure: no database, no disk.
// Spec: docs/superpowers/specs/2026-09-25-book-server-6-customer-photos-design.md
export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
// Base64 inflates bytes by ~1.37x; same headroom rule as MAX_ATTACHMENT_BODY_BYTES.
export const MAX_BOOKING_BODY_BYTES = Math.ceil(MAX_PHOTOS * MAX_PHOTO_BYTES * 1.4);

const UNREADABLE = 'A photo could not be read — please try adding it again';
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

// The type comes from the file's own first bytes, never from a name or type the browser claims.
function sniff(b) {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { contentType: 'image/jpeg', extension: 'jpg' };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { contentType: 'image/png', extension: 'png' };
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return { contentType: 'image/webp', extension: 'webp' };
  return null;
}

export function readBookingPhotos(input) {
  if (input === undefined || input === null) return { value: [] };
  if (!Array.isArray(input)) return { error: UNREADABLE };
  if (input.length > MAX_PHOTOS) return { error: 'You can add up to 5 photos' };
  const value = [];
  for (const item of input) {
    const data = item && typeof item === 'object' ? item.dataBase64 : undefined;
    if (typeof data !== 'string' || !BASE64.test(data)) return { error: UNREADABLE };
    const buffer = Buffer.from(data, 'base64');
    if (!buffer.length) return { error: UNREADABLE };
    if (buffer.length > MAX_PHOTO_BYTES) return { error: 'Each photo can be up to 10 MB' };
    const type = sniff(buffer);
    if (!type) return { error: 'Only photos can be added (JPEG, PNG or WebP)' };
    value.push({ buffer, ...type });
  }
  return { value };
}
```

- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Break it on purpose.** Change `>` to `>=` in the size check; confirm the 10 MB test fails; change `input.length > MAX_PHOTOS` to `>= `; confirm the 5-photo test fails; restore both and confirm PASS (check with `git diff` that the file is back to the written version).
- [ ] **Step 6: Commit** — `git add server/booking-photos.js tests/booking-photos.test.js && git commit -m "feat: readBookingPhotos - check customer photos without a server"`

---

### Task 3: `saveBookingPhotos` — write files and rows, clean up on failure

**Files:**
- Create: `server/booking-photo-store.js`
- Test: `tests/booking-photo-store.test.js`

(A second small module, added to the spec's one, so the disk-and-rows part stays out of the pure module and can be tested without a database.)

**Interfaces:**
- Consumes: `Photo` from Task 2.
- Produces: `saveBookingPhotos({ photos, uploadsDir, insertRow }) → Promise<void>`; `insertRow` is `async ({ storageKey, originalName, contentType, sizeBytes }) => void`. Writes each file under a random 48-hex-character `storageKey`, calls `insertRow`, and if anything throws, deletes every file this call wrote, then rethrows the same error.

- [ ] **Step 1: Write the failing test** — `tests/booking-photo-store.test.js`:

```js
// Saving a booking's photos: files and rows go together, or neither stays.
// Spec: docs/superpowers/specs/2026-09-25-book-server-6-customer-photos-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { saveBookingPhotos } from '../server/booking-photo-store.js';

const photos = [
  { buffer: Buffer.from('one'), contentType: 'image/jpeg', extension: 'jpg' },
  { buffer: Buffer.from('two!'), contentType: 'image/png', extension: 'png' },
  { buffer: Buffer.from('three'), contentType: 'image/webp', extension: 'webp' },
];

test('each photo is written and its row described, in order, with our own names', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'photos-'));
  const rows = [];
  try {
    await saveBookingPhotos({ photos, uploadsDir: dir, insertRow: async (r) => { rows.push(r); } });
    assert.deepEqual(rows.map((r) => [r.originalName, r.contentType, r.sizeBytes]), [
      ['Customer photo 1.jpg', 'image/jpeg', 3], ['Customer photo 2.png', 'image/png', 4], ['Customer photo 3.webp', 'image/webp', 5],
    ]);
    for (const [i, r] of rows.entries()) {
      assert.match(r.storageKey, /^[0-9a-f]{48}$/);
      assert.deepEqual(await readFile(path.join(dir, r.storageKey)), photos[i].buffer);
    }
  } finally { await rm(dir, { recursive: true }); }
});

test('if a row fails, every file already written is removed and the error is raised', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'photos-'));
  let calls = 0;
  try {
    await assert.rejects(
      saveBookingPhotos({ photos, uploadsDir: dir, insertRow: async () => { if (++calls === 3) throw new Error('insert broke'); } }),
      /insert broke/
    );
    assert.deepEqual(await readdir(dir), []);
  } finally { await rm(dir, { recursive: true }); }
});
```

- [ ] **Step 2: Run** → FAIL (module not found).
- [ ] **Step 3: Implement** `server/booking-photo-store.js`:

```js
// Writes a booking's checked photos to disk and describes each to the caller
// to insert. If anything fails, the files written by this call are removed and
// the error is raised, so the caller's transaction rolls back with nothing left on disk.
// Spec: docs/superpowers/specs/2026-09-25-book-server-6-customer-photos-design.md
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export async function saveBookingPhotos({ photos, uploadsDir, insertRow }) {
  const written = [];
  try {
    for (const [i, photo] of photos.entries()) {
      const storageKey = randomBytes(24).toString('hex');
      await writeFile(path.join(uploadsDir, storageKey), photo.buffer);
      written.push(storageKey);
      await insertRow({
        storageKey,
        originalName: `Customer photo ${i + 1}.${photo.extension}`,
        contentType: photo.contentType,
        sizeBytes: photo.buffer.length,
      });
    }
  } catch (err) {
    await Promise.all(written.map((key) => unlink(path.join(uploadsDir, key)).catch(() => {})));
    throw err;
  }
}
```

- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Break it on purpose.** Comment out the `unlink` line in the catch; confirm the second test fails (`readdir` not empty); restore; PASS.
- [ ] **Step 6: Commit** — `git add server/booking-photo-store.js tests/booking-photo-store.test.js && git commit -m "feat: saveBookingPhotos - write photos, remove them if the save fails"`

---

### Task 4: The booking route reads a bigger body and answers 400 when it is too big

**Files:**
- Modify: `server/server.js` (`readJsonBody` ~line 444; the booking route ~line 4586; import from `./booking-photos.js`)
- Create: `tests/portal-booking-photos.test.js` (the shared file for Tasks 4-6; this task creates it with its harness and two tests)

**Interfaces:**
- Consumes: `MAX_BOOKING_BODY_BYTES` from Task 2.
- Produces: `readJsonBody(req, maxBytes = 2_000_000, { answerOverflow = false } = {})`. With `answerOverflow: true`, a body past `maxBytes` is not buffered further but the request is still read to its end (destroyed only if it passes `2 × maxBytes`), then it rejects `Error('Payload too large')`. Default behaviour is unchanged for every other route.
- Produces (test file): helpers `book(body, { guest })`, `photoOf(marker)`, `newFilesWith(before, marker)`, `counts()` used by Tasks 5-6.

- [ ] **Step 1: Write the failing test** — create `tests/portal-booking-photos.test.js`. Start from the harness of `tests/portal-booking-answers.test.js` (same imports, `before`/`after`, `nextDate`, `GUEST`, `book`, `counts`; a service made with `questions: []`), then add:

```js
// Customer photos sent with a booking.
// Spec: docs/superpowers/specs/2026-09-25-book-server-6-customer-photos-design.md
// Successful bookings are signed in; guest bookings are rate-limited per IP and
// refused guest bookings stop before the limiter. Keep the private-link photo
// test here, not in portal-booking-link.test.js (which must stay under 30 lookups).
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { UPLOADS_DIR } from './helpers/workshopFixtures.js';
import { MAX_BOOKING_BODY_BYTES } from '../server/booking-photos.js';

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
```

The Task 4 tests:

```js
test('a request over the size cap gets a 400, not a dropped connection or a 500', async () => {
  const marker = `cap-${randomBytes(6).toString('hex')}`;
  const before = await filesNow();
  const c = await counts();
  const big = 'A'.repeat(MAX_BOOKING_BODY_BYTES + 1_000_000);
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
```

- [ ] **Step 2: Run** `node --test tests/portal-booking-photos.test.js` → both FAIL (today: connection error / 500).
- [ ] **Step 3: Implement.**

In `server/server.js`, replace `readJsonBody`'s signature and body handling so that it reads:

```js
async function readJsonBody(req, maxBytes = 2_000_000, { answerOverflow = false } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    let overflowed = false;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (overflowed) {
        // Still reading so the client can be answered; stop at twice the cap.
        if (bytes > maxBytes * 2) { reject(new Error('Payload too large')); req.destroy(); }
        return;
      }
      if (bytes > maxBytes) {
        if (answerOverflow) { overflowed = true; chunks.length = 0; return; }
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (overflowed) return reject(new Error('Payload too large'));
      if (bytes === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}
```

(Keep the existing comment above the function. `req.destroy()` in the default path is exactly as before.)

Add `import { MAX_BOOKING_BODY_BYTES, readBookingPhotos } from './booking-photos.js';` beside the other server imports (~line 78). In the booking route replace `const body = await readJsonBody(req);` with:

```js
  let body;
  try {
    body = await readJsonBody(req, MAX_BOOKING_BODY_BYTES, { answerOverflow: true });
  } catch (err) {
    // The rest of a too-big body may still be arriving; close after answering.
    res.setHeader('connection', 'close');
    return badRequest(res, err.message === 'Payload too large'
      ? 'Those photos are too large to send — please add fewer or smaller photos'
      : 'Invalid request body');
  }
```

Note: `book()` in the test sends `marker` as an extra body field; the route ignores unknown fields.

- [ ] **Step 4: Run** the new file → PASS; then `node --test tests/portal-booking-request.test.js tests/portal-booking-answers.test.js` → PASS (existing behaviour unchanged).
- [ ] **Step 5: Break it on purpose.** Make `answerOverflow` a no-op (force the default path); confirm the cap test fails with a connection error; restore; PASS.
- [ ] **Step 6: Commit** — `git add server/server.js tests/portal-booking-photos.test.js && git commit -m "feat: booking route answers 400 to an oversized or unreadable body"`

---

### Task 5: Check photos before any write; save them inside the booking

**Files:**
- Modify: `server/server.js` (booking route; import `saveBookingPhotos` from `./booking-photo-store.js`)
- Test: `tests/portal-booking-photos.test.js`

**Interfaces:**
- Consumes: `readBookingPhotos` (Task 2), `saveBookingPhotos` (Task 3), the test helpers from Task 4.
- Produces: a booking request may carry `photos: [{ dataBase64 }]`; stored rows have `from_customer = true`, `original_name = 'Customer photo N.<ext>'`.

Deviation from the spec, decided at planning: photos are saved as the **last write** inside the lock (after the customer update and the job re-read), not "right after the job insert". Same lock and transaction, so an error still rolls the whole booking back; being last means no later step can throw and leave files with no rolled-back row.

- [ ] **Step 1: Write the failing tests** (append; use a signed-in `book(...)` for successes, `{ guest: true }` for refusals):

```js
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

const bigJpeg = Buffer.concat([JPEG_HEAD, Buffer.alloc(10 * 1024 * 1024)]).toString('base64');
for (const [label, makePhotos, message] of [
  ['too many photos', (m) => Array(6).fill(photoOf(m)), 'You can add up to 5 photos'],
  ['a photo that is too big', () => [{ dataBase64: bigJpeg }], 'Each photo can be up to 10 MB'],
  ['not a photo', () => [{ dataBase64: Buffer.from('just text').toString('base64') }], 'Only photos can be added (JPEG, PNG or WebP)'],
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
```

Add to `after`: `await purgeAttachmentFiles(owner.shop.id)` before `deleteTestShop` (import from `./helpers/workshopFixtures.js`) so test photos do not pile up in `uploads/`. Add `import { staffRequest }`-based `staff` helper as in the answers test.

- [ ] **Step 2: Run** → FAIL (photos ignored: no rows; refusals return 201 or write a job).
- [ ] **Step 3: Implement.** In the booking route, after the `questionAnswers` block and before the `// No account required to book` comment:

```js
  // Photos are checked here with the other request checks: before the guest
  // limiter and before any write, so a refusal leaves nothing behind. They are
  // allowed on a "not sure" booking too - they describe the problem, not the service.
  const checkedPhotos = readBookingPhotos(body.photos);
  if (checkedPhotos.error) return badRequest(res, checkedPhotos.error);
  const photos = checkedPhotos.value;
```

Import `saveBookingPhotos` from `./booking-photo-store.js`. Inside the lock, after `const row = await db.prepare(WORKSHOP_JOB_SELECT ...).get(jobId);` and before the final `return`:

```js
    // The last write, so nothing after it can fail and leave files behind for a
    // booking that rolled back. saveBookingPhotos removes its own files if a
    // write or insert fails, and the error rolls the whole booking back.
    await saveBookingPhotos({
      photos,
      uploadsDir: UPLOADS_DIR,
      insertRow: ({ storageKey, originalName, contentType, sizeBytes }) => db
        .prepare(
          `INSERT INTO workshop_job_attachments (workshop_job_id, storage_key, original_name, content_type, size_bytes, from_customer)
           VALUES (?, ?, ?, ?, ?, true)`
        )
        .run(jobId, storageKey, originalName, contentType, sizeBytes),
    });
```

- [ ] **Step 4: Run** `node --test tests/portal-booking-photos.test.js` → PASS; then the other portal booking test files → PASS.
- [ ] **Step 5: Break it on purpose.** (a) Move the `readBookingPhotos` block to just after `resolveGuestCustomer`; confirm a guest refusal test now fails on the "no customer row" count; restore. (b) Comment out `saveBookingPhotos`; confirm the storage tests fail; restore. Confirm PASS and clean `git diff`.
- [ ] **Step 6: Commit** — `git add server/server.js tests/portal-booking-photos.test.js && git commit -m "feat: customer photos ride with the booking request"`

---

### Task 6: `photoCount` on the private link; status and spec bookkeeping

**Files:**
- Modify: `server/server.js` (private link route, ~line 4711)
- Modify: `docs/superpowers/specs/2026-09-25-book-server-6-customer-photos-design.md` (header line; note the "last write" placement)
- Modify: `.agents/STATUS.md`
- Test: `tests/portal-booking-photos.test.js`

**Interfaces:**
- Produces: private link response gains `photoCount: number` (photos with `from_customer = true`); nothing else about them.

- [ ] **Step 1: Write the failing test** (append):

```js
test('the private link says how many photos were sent, and nothing else about them', async () => {
  const two = await book({ photos: [photoOf('link1'), photoOf('link2')] });
  const none = await book({});
  const read = (res) => portalRequest(server.baseUrl, null, res.body.privateLink.replace(/^.*?(\/api\/portal)/, '$1'));
  const a = await read(two);
  const b = await read(none);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(a.body.photoCount, 2);
  assert.equal(b.body.photoCount, 0);
  assert.doesNotMatch(JSON.stringify(a.body), /Customer photo|storage|attachment/i);
});
```

Check how `tests/portal-booking-link.test.js` turns `privateLink` into the read-back URL (`linkPath` in `server/booking-link.js`) and copy that exactly — the regex above is a guess.

- [ ] **Step 2: Run** → FAIL (`photoCount` undefined).
- [ ] **Step 3: Implement.** In the link route's SELECT add, after `s.name AS service_name, b.make ..., b.model AS bike_model`:

```sql
              , (SELECT count(*)::int FROM workshop_job_attachments a
                 WHERE a.workshop_job_id = w.id AND a.from_customer) AS photo_count
```

and in the response object add `photoCount: row.photo_count,` after `stage`.
- [ ] **Step 4: Run** `node --test tests/portal-booking-photos.test.js tests/portal-booking-link.test.js` → PASS (link file still 14 lookups: untouched).
- [ ] **Step 5: Break it on purpose.** Drop `AND a.from_customer` and add a staff upload to one job in a quick throwaway check, or simply change `count(*)` filter to `false`; confirm the test fails; restore.
- [ ] **Step 6: Bookkeeping.** In the spec: change the header's "Not yet reviewed as a written spec" to "Approved as a written spec by Jack, 25 Sep", and in "When photos are saved" note that saving is the last write inside the lock. In `.agents/STATUS.md`: piece 6 built on the branch, PR to follow; keep the file's existing style.
- [ ] **Step 7: Full proof.** With compose Postgres up: `npm test` → all pass; `npm run lint` if the repo has it (`grep '"lint"' package.json`). `git status` shows only `.claude/launch.json` untracked.
- [ ] **Step 8: Commit** — `git add server/server.js tests/portal-booking-photos.test.js docs .agents/STATUS.md && git commit -m "feat: private link shows how many photos were sent"`, then push the branch and open a PR (do not merge).
