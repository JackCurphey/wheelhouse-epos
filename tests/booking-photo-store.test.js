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
