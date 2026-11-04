// Moving from Citrus Lime, sending files and seeing how they're getting on
// (openspec/changes/citrus-import-products, design 4 and 13; mv-progress,
// mv-progress-failed, mv-summary). Owner only, until roles. A send only stores the
// file and replies; it's read off the request, in a worker (bring-across.js).
import { dbExec, prepare } from '../db.js';
import { readJsonBody, sendJson, badRequest, notFound } from '../lib/http.js';
import { currentSession } from '../lib/session.js';
import { ownerOnly } from '../lib/owner-only.js';
import { wakeBringingAcross } from '../move/bring-across.js';
import { readRequestKey } from '../booking-request-key.js';
import { someoneElseCheckedIn } from './till-pins.js';

const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MAX_NAME = 200;
const MAX_WAITING_A_SHOP = 10;
const OWNER_ONLY = "Only the shop's owner can bring data across";
const CANT_READ = { error: 'Wheelhouse couldn’t read this file', code: 'cant_read' };
const REUSED_KEY = { error: 'That was sent before with a different file. Choose the file again.', code: 'reused_key' };
const BUSY = { error: 'Wheelhouse is still taking in another of your files. Try again in a moment.', code: 'busy' };

const serializeFile = (f) => ({
  id: f.id,
  report: f.report,
  fileName: f.file_name,
  state: f.state,
  rowsTotal: f.rows_total,
  rowsIn: f.rows_in,
  rowsSame: f.rows_same,
  rowsSkipped: f.rows_skipped,
  rowsLook: f.rows_look,
  stockIn: f.stock_in,
  stockLook: f.stock_look,
});

// Owner only, and not while someone else is checked in on this computer.
async function refused(req, res) {
  if (await ownerOnly(req, res, OWNER_ONLY)) return true;
  if (await someoneElseCheckedIn(req)) { sendJson(res, 403, { error: OWNER_ONLY, code: 'owner_only' }); return true; }
  return false;
}

// One send at a time per shop, as each holds a whole file in memory: a stalled
// upload holds up only its own shop, until its connection ends.
const sendingShops = new Set();

export function register(route) {
  route('GET', '/api/move', async (req, res) => {
    if (await refused(req, res)) return;
    const files = await prepare('SELECT * FROM move_files ORDER BY id').all();
    sendJson(res, 200, { files: files.map(serializeFile) });
  });

  route('POST', '/api/move/files', async (req, res, params, query, afterRelease, shopId) => {
    if (await refused(req, res)) return;
    if (sendingShops.has(shopId)) { res.setHeader('Retry-After', '2'); return sendJson(res, 429, BUSY); }
    sendingShops.add(shopId);
    try {
      let body;
      try {
        body = await readJsonBody(req, Math.ceil(MAX_FILE_BYTES * 1.4));
      } catch (err) {
        if (err.message === 'Payload too large') return sendJson(res, 422, CANT_READ);
        throw err;
      }
      const key = readRequestKey(body);
      if (key.error) return badRequest(res, key.error);
      if (!key.value) return badRequest(res, 'A request key is required');
      if (typeof body.dataBase64 !== 'string' || !body.dataBase64) return badRequest(res, 'No file received');
      const bytes = Buffer.from(body.dataBase64, 'base64');
      if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES) return sendJson(res, 422, CANT_READ);
      const fileName = String(body.fileName ?? '').replaceAll('\u0000', '').toWellFormed().trim().slice(-MAX_NAME).toWellFormed();

      const ctx = await currentSession(req);
      await dbExec('BEGIN');
      let file;
      try {
        const { keyHash, bodyHash } = key.value;
        // The first send holds the key's place until it commits (the unique
        // index), so a retry at the same moment waits here and then finds it.
        const made = await prepare(
          `INSERT INTO move_files (file_name, sent_by_login_id, request_key_hash, request_body_hash)
           VALUES (?, ?, ?, ?) ON CONFLICT (shop_id, request_key_hash) WHERE request_key_hash IS NOT NULL DO NOTHING RETURNING *`
        ).get(fileName, ctx.login.id, keyHash, bodyHash);
        if (made) {
          const { n } = await prepare(`SELECT count(*)::int AS n FROM move_files WHERE state = 'reading'`).get();
          if (n > MAX_WAITING_A_SHOP) {
            await dbExec('ROLLBACK');
            res.setHeader('Retry-After', '5');
            return sendJson(res, 429, BUSY);
          }
          await prepare('INSERT INTO move_file_bytes (file_id, bytes) VALUES (?, ?) RETURNING file_id').get(made.id, bytes);
          file = made;
        } else {
          file = await prepare('SELECT * FROM move_files WHERE request_key_hash = ?').get(keyHash);
          if (file.request_body_hash !== bodyHash) {
            await dbExec('ROLLBACK');
            return sendJson(res, 409, REUSED_KEY);
          }
        }
        await dbExec('COMMIT');
      } catch (err) {
        await dbExec('ROLLBACK');
        throw err;
      }
      wakeBringingAcross(shopId);
      sendJson(res, 202, serializeFile(file));
    } finally {
      sendingShops.delete(shopId);
    }
  });

  // Choose another file: a file that couldn't be read goes from the list.
  route('DELETE', '/api/move/files/:id', async (req, res, params) => {
    if (await refused(req, res)) return;
    const id = Number(params.id);
    if (!Number.isInteger(id)) return notFound(res, 'File not found');
    // With whatever it still holds, so nothing of it stays and nothing blocks it.
    await dbExec('BEGIN');
    try {
      const file = await prepare(`SELECT id FROM move_files WHERE id = ? AND state = 'cant_read' FOR UPDATE`).get(id);
      if (!file) {
        await dbExec('ROLLBACK');
        return notFound(res, 'File not found');
      }
      await prepare('DELETE FROM move_rows WHERE file_id = ?').run(id);
      await prepare('DELETE FROM move_file_bytes WHERE file_id = ?').run(id);
      await prepare('DELETE FROM move_files WHERE id = ?').run(id);
      await dbExec('COMMIT');
    } catch (err) {
      await dbExec('ROLLBACK');
      throw err;
    }
    sendJson(res, 200, { ok: true });
  });
}
