// Use my phone (walk-through 8 decision 6; docs/decisions/2026-10-23-use-my-phone.md;
// openspec/changes/use-my-phone): a code that adds one photo to one line of a
// draft quote from a phone, with no sign-in, for 15 minutes.
//
// Only the code's hash is kept, as for booking links. A draft's lines get new
// ids on every save, so the code holds the draft's id and the line's place and
// words; when the photo arrives, the job's latest quote must still be that
// draft and the line at that place must still have those words, or the code
// counts as spent and nothing changes. Runs inside the shop's row-level
// security, so another shop's code is never found.
import { prepare, dbExec } from '../db.js';
import { currentMoment } from '../clock.js';
import { newLinkCode, hashLinkCode } from '../booking-link.js';
import { saveBookingPhotos } from '../booking-photo-store.js';
import { UPLOADS_DIR } from '../lib/uploads.js';

export const PHOTO_CODE_MINUTES = 15;
const CODE_SHAPE = /^[0-9a-f]{64}$/;

// The job's latest quote and its lines in order, when it's a draft.
async function draftOf(jobId) {
  const latest = await prepare('SELECT id, state FROM workshop_quotes WHERE workshop_job_id = ? ORDER BY revision DESC LIMIT 1').get(jobId);
  if (!latest || latest.state !== 'draft') return null;
  const lines = await prepare('SELECT id, description, reason FROM workshop_quote_lines WHERE workshop_quote_id = ? ORDER BY id').all(latest.id);
  return { id: latest.id, lines };
}

// A code for the line at linePosition of the job's draft quoteId.
export async function makePhotoCode({ jobId, quoteId, linePosition }) {
  const quote = Number.isInteger(quoteId)
    ? await prepare('SELECT id FROM workshop_quotes WHERE id = ? AND workshop_job_id = ?').get(quoteId, jobId)
    : null;
  if (!quote) return { ok: false, code: 'not_found', message: 'Quote not found' };
  const draft = await draftOf(jobId);
  if (!draft || draft.id !== quote.id) return { ok: false, code: 'illegal', message: 'A photo can only be added while the quote is a draft' };
  const line = Number.isInteger(linePosition) && linePosition >= 0 ? draft.lines[linePosition] : undefined;
  if (!line) return { ok: false, code: 'bad', message: 'There is no such line on the quote' };
  const code = newLinkCode();
  const expiresAt = new Date(currentMoment().getTime() + PHOTO_CODE_MINUTES * 60 * 1000).toISOString();
  const { lastInsertRowid } = await prepare(
    `INSERT INTO quote_photo_codes (code_hash, workshop_job_id, workshop_quote_id, line_position, line_description, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(hashLinkCode(code), jobId, draft.id, linePosition, line.description, expiresAt);
  return { ok: true, code, codeId: lastInsertRowid, expiresAt };
}

// The code's row and the line it adds to, while it can still add its photo;
// otherwise null. `lock` holds the row for the rest of a transaction, so two
// photos at once can't both use it.
async function liveCode(code, { lock = false } = {}) {
  if (typeof code !== 'string' || !CODE_SHAPE.test(code)) return null;
  const row = await prepare(`SELECT * FROM quote_photo_codes WHERE code_hash = ?${lock ? ' FOR UPDATE' : ''}`).get(hashLinkCode(code));
  if (!row || row.used_at || new Date(row.expires_at) <= currentMoment()) return null;
  const draft = await draftOf(row.workshop_job_id);
  const line = draft && draft.id === row.workshop_quote_id ? draft.lines[row.line_position] : undefined;
  if (!line || line.description !== row.line_description) return null;
  return { row, line };
}

// What the phone shows: the shop, the job's reference and bike, the line and
// its reason. Nothing about the customer.
export async function photoCodeView(code) {
  const live = await liveCode(code);
  if (!live) return null;
  const job = await prepare(
    `SELECT w.reference, NULLIF(trim(coalesce(b.make, '') || ' ' || coalesce(b.model, '')), '') AS bike, s.name AS shop_name
       FROM workshop_jobs w JOIN shops s ON s.id = w.shop_id LEFT JOIN customer_bikes b ON b.id = w.bike_id
      WHERE w.id = ?`
  ).get(live.row.workshop_job_id);
  return { shopName: job.shop_name, reference: job.reference, bike: job.bike, line: live.line.description, reason: live.line.reason || null };
}

// Adds a checked, cleaned photo ({ buffer, contentType, extension }) with the
// code: one of the job's files, on the line, and the code spent, all at once.
// null when the code can't add a photo.
export async function addPhotoWithCode(code, photo) {
  await dbExec('BEGIN');
  try {
    const live = await liveCode(code, { lock: true });
    if (!live) {
      await dbExec('ROLLBACK');
      return null;
    }
    const jobId = live.row.workshop_job_id;
    let attachmentId;
    await saveBookingPhotos({
      photos: [photo],
      uploadsDir: UPLOADS_DIR,
      name: () => `Photo from a phone.${photo.extension}`,
      insertRow: async ({ storageKey, originalName, contentType, sizeBytes }) => {
        ({ lastInsertRowid: attachmentId } = await prepare(
          `INSERT INTO workshop_job_attachments (workshop_job_id, storage_key, original_name, content_type, size_bytes)
           VALUES (?, ?, ?, ?, ?)`
        ).run(jobId, storageKey, originalName, contentType, sizeBytes));
        await prepare('UPDATE workshop_quote_lines SET photo_attachment_id = ? WHERE id = ?').run(attachmentId, live.line.id);
        await prepare('UPDATE quote_photo_codes SET used_at = ?, attachment_id = ? WHERE id = ?')
          .run(currentMoment().toISOString(), attachmentId, live.row.id);
      },
    });
    await dbExec('COMMIT');
    const job = await prepare('SELECT reference FROM workshop_jobs WHERE id = ?').get(jobId);
    return { reference: job.reference, line: live.line.description };
  } catch (err) {
    await dbExec('ROLLBACK').catch(() => {});
    throw err;
  }
}

// For the computer's pop-up: waiting, added (with the photo's file) or expired.
export async function photoCodeStatus({ jobId, codeId }) {
  const row = Number.isInteger(codeId) && codeId > 0 && codeId <= 2147483647
    ? await prepare('SELECT * FROM quote_photo_codes WHERE id = ? AND workshop_job_id = ?').get(codeId, jobId)
    : null;
  if (!row) return null;
  if (row.used_at) return { state: 'added', attachmentId: row.attachment_id };
  if (new Date(row.expires_at) <= currentMoment()) return { state: 'expired' };
  return { state: 'waiting' };
}
