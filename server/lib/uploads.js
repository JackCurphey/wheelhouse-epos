// Shared by more than one route area (split plan §4.1, WP-0.4; #180, 15 Oct):
// where uploaded files live, the largest id Postgres's int4 holds, and
// readUploadedImage, which the product photo, logo and hero image uploads
// share. Moved out of server.js unchanged. Creating the folder at startup and
// serving an uploaded image stay in server.js.
import { writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepare, dbExec } from '../db.js';
import { readJsonBody, ValidationError } from './http.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

// Attachment bytes live here as flat files named by a random per-file token
// (see workshop_job_attachments.storage_key) - never the customer's original
// filename, so there's nothing to sanitize or path-traverse with. The token
// alone never grants access; every read goes through the download route,
// which checks the owning job through the normal RLS-scoped `db`. Backed by
// a named Docker volume (docker-compose.yml) so uploads survive a rebuild
// the same way Postgres's data does.
export const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// The largest value a SERIAL (int4) id can hold.
export const MAX_SERIAL = 2147483647;

// Same base64-in-a-JSON-body convention as the workshop job attachments,
// and the same opaque-storage_key-on-disk approach - but the uploader can be
// any of three different call sites (a product photo, the website logo,
// or its hero image), so the actual read/validate/store logic lives in one
// shared helper and each route just says what changed after the upload.

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Shared by product photo, logo, and hero image uploads - only the size
// cap and what happens with the resulting URL differ between them.
export async function readUploadedImage(req, maxBytes) {
  const maxBodyBytes = Math.ceil(maxBytes * 1.4);
  let body;
  try {
    body = await readJsonBody(req, maxBodyBytes);
  } catch (err) {
    throw new ValidationError(err.message === 'Payload too large' ? `That image is too large (max ${Math.round(maxBytes / 1024 / 1024)}MB).` : 'Invalid request body');
  }
  if (!body.dataBase64) throw new ValidationError('No image data received');

  const contentType = String(body.contentType || '').trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new ValidationError('Image must be JPEG, PNG, or WebP');
  }

  let buffer;
  try {
    buffer = Buffer.from(body.dataBase64, 'base64');
  } catch {
    throw new ValidationError('Could not decode image data');
  }
  if (!buffer.length) throw new ValidationError('That image is empty');
  if (buffer.length > maxBytes) throw new ValidationError(`That image is too large (max ${Math.round(maxBytes / 1024 / 1024)}MB).`);

  const storageKey = randomBytes(24).toString('hex');
  await writeFile(path.join(UPLOADS_DIR, storageKey), buffer);
  // uploaded_image_types has no `id` column (storage_key is its primary
  // key), so this INSERT carries its own RETURNING clause - otherwise
  // db.js's prepare() would auto-append `RETURNING id` (see needsReturningId
  // there) and the query would fail with "column \"id\" does not exist".
  await db.prepare('INSERT INTO uploaded_image_types (storage_key, content_type) VALUES (?, ?) RETURNING storage_key').run(storageKey, contentType);
  return `/api/uploaded-images/${storageKey}`;
}
