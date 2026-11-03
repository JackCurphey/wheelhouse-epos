// Moving from Citrus Lime, sending files and seeing how they're getting on
// (openspec/changes/citrus-import-products, design 4 and 12; mv-progress,
// mv-progress-failed, mv-summary). Owner only, until roles.
import { dbExec, prepare } from '../db.js';
import { readJsonBody, sendJson, badRequest } from '../lib/http.js';
import { currentSession } from '../lib/session.js';
import { ownerOnly } from '../lib/owner-only.js';
import { readSpreadsheet, CantRead } from '../lib/spreadsheet-read.js';
import { recognise } from '../move/citrus-files.js';
import { wakeBringingAcross } from '../move/bring-across.js';
import { readRequestKey } from '../booking-request-key.js';
import { someoneElseCheckedIn } from './till-pins.js';

const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MAX_NAME = 200;
const INSERT_CHUNK = 1000;
const OWNER_ONLY = "Only the shop's owner can bring data across";
const CANT_READ = { error: 'Wheelhouse couldn’t read this file', code: 'cant_read' };
const REUSED_KEY = { error: 'That was sent before with a different file. Choose the file again.', code: 'reused_key' };

const serializeFile = (f) => ({
  id: f.id,
  report: f.report,
  fileName: f.file_name,
  state: f.state,
  rowsTotal: f.rows_total,
  rowsIn: f.rows_in,
  rowsLook: f.rows_look,
  stockIn: f.stock_in,
});

// Owner only, and not while someone else is checked in on this computer.
async function refused(req, res) {
  if (await ownerOnly(req, res, OWNER_ONLY)) return true;
  if (await someoneElseCheckedIn(req)) { sendJson(res, 403, { error: OWNER_ONLY, code: 'owner_only' }); return true; }
  return false;
}

export function register(route) {
  route('GET', '/api/move', async (req, res) => {
    if (await refused(req, res)) return;
    const files = await prepare('SELECT * FROM move_files ORDER BY id').all();
    sendJson(res, 200, { files: files.map(serializeFile) });
  });

  route('POST', '/api/move/files', async (req, res) => {
    if (await refused(req, res)) return;
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
    const fileName = String(body.fileName ?? '').replaceAll('\u0000', '').trim().slice(-MAX_NAME);

    // Read before the transaction: reading a big file shouldn't hold anything.
    let found;
    try {
      found = recognise(readSpreadsheet(Buffer.from(body.dataBase64, 'base64'), fileName));
    } catch (err) {
      if (!(err instanceof CantRead)) throw err;
    }
    if (!found) return sendJson(res, 422, CANT_READ);

    const ctx = await currentSession(req);
    await dbExec('BEGIN');
    let file;
    try {
      const { keyHash, bodyHash } = key.value;
      // The first send holds the key's place until it commits (the unique
      // index), so a retry at the same moment waits here and then finds it.
      const made = await prepare(
        `INSERT INTO move_files (report, file_name, store_name, rows_total, sent_by_login_id, request_key_hash, request_body_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (shop_id, request_key_hash) WHERE request_key_hash IS NOT NULL DO NOTHING RETURNING *`
      ).get(found.report, fileName, found.storeName, found.rows.length, ctx.login.id, keyHash, bodyHash);
      if (made) {
        for (let at = 0; at < found.rows.length; at += INSERT_CHUNK) {
          const chunk = found.rows.slice(at, at + INSERT_CHUNK).map((d) => JSON.stringify(d));
          await prepare('INSERT INTO move_rows (file_id, data) SELECT ?, unnest(?::jsonb[]) RETURNING id').all(made.id, chunk);
        }
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
    wakeBringingAcross();
    sendJson(res, 201, serializeFile(file));
  });
}
