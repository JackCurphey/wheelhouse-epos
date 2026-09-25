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
