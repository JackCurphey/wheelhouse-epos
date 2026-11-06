// Moving from Citrus Lime, sending files and seeing how they're getting on
// (openspec/changes/citrus-import-products, design 4 and 13; mv-progress,
// mv-progress-failed, mv-summary). Owner only, until roles. A send only stores the
// file and replies; it's read off the request, in a worker (bring-across.js).
import { dbExec, prepare } from '../db.js';
import { readJsonBody, sendJson, badRequest, notFound } from '../lib/http.js';
import { currentSession } from '../lib/session.js';
import { ownerOnly } from '../lib/owner-only.js';
import { notOwnerHere } from '../lib/product-editor.js';
import { wakeBringingAcross } from '../move/bring-across.js';
import { fixRow, leaveOutRow, lookList } from '../move/fix-row.js';
import { helpInbox, sendHelp } from '../move/help-inbox.js';
import { readRequestKey } from '../booking-request-key.js';
import { someoneElseCheckedIn } from './till-pins.js';
import { CHECK_IN_FIRST, whoIsBooking } from './purchase-orders.js';

const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MAX_FILE_BODY_BYTES = Math.ceil(MAX_FILE_BYTES * 1.4);
const MAX_NAME = 200;
const MAX_WAITING_A_SHOP = 10;
const OWNER_ONLY = "Only the shop's owner can bring data across";
const CANT_READ = { error: 'Wheelhouse couldn’t read this file', code: 'cant_read' };
const NO_INBOX = { error: 'Ask us to help isn’t connected yet.', code: 'no_inbox' };
const REUSED_HELP = { error: 'That was sent before with something else. Try again.', code: 'reused_key' };
const MAX_HELP = 4000;
const MAX_CARD = 120;
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
  rowsLeftOut: f.rows_left_out,
  rowsFixed: f.rows_fixed,
  stockIn: f.stock_in,
  stockLook: f.stock_look,
  stockLeftOut: f.stock_left_out,
});

// Owner only, and not while someone else is checked in on this computer.
async function refused(req, res) {
  if (await ownerOnly(req, res, OWNER_ONLY)) return true;
  if (await someoneElseCheckedIn(req)) { sendJson(res, 403, { error: OWNER_ONLY, code: 'owner_only' }); return true; }
  return false;
}
// What changes: the Owner, and the one there; an empty till or workshop computer asks for a
// PIN, as changing a product does (product-editing, the review), since a file brings across
// products with their prices and costs.
const refusedToChange = (req, res) => notOwnerHere(req, res, OWNER_ONLY);

// What a fix or leave-out needs, read and checked; it has answered if it returns null.
async function readRowRequest(req, res, params) {
  if (await refusedToChange(req, res)) return null;
  if (!/^\d{1,9}$/.test(params.id)) { notFound(res, 'Row not found'); return null; }
  const who = await whoIsBooking(req);
  if (!who) { sendJson(res, 409, CHECK_IN_FIRST); return null; }
  const body = await readJsonBody(req);
  if (body === null || typeof body !== 'object' || Array.isArray(body)) { badRequest(res, 'Send the row'); return null; }
  const key = readRequestKey(body);
  if (key.error || !key.value) { badRequest(res, key.error ?? 'A request key is required'); return null; }
  if (typeof body.seen !== 'string') { badRequest(res, 'Send what you saw of this row'); return null; }
  return { id: Number(params.id), who, body, key: key.value, seen: body.seen };
}
// Only what a person ticked, as it is: anything else counts as not ticked. Each person
// a row looks like has a tick of their own, so notSameAs is a list.
const readDecided = (d) => ({ shared: d?.shared === true, notSameAs: Array.isArray(d?.notSameAs) ? d.notSameAs.filter((id) => Number.isInteger(id) && Math.abs(id) < 2 ** 31) : [] });

// One send at a time per shop, as each holds a whole file in memory: a stalled
// upload holds up only its own shop, until its connection ends.
const sendingShops = new Set();

export function register(route) {
  route('GET', '/api/move', async (req, res) => {
    if (await refused(req, res)) return;
    const files = await prepare('SELECT * FROM move_files ORDER BY id').all();
    sendJson(res, 200, { files: files.map(serializeFile), helpOffered: helpInbox() !== null });
  });

  route('POST', '/api/move/files', async (req, res, params, query, afterRelease, shopId) => {
    let body;
    try {
      body = await readJsonBody(req, MAX_FILE_BODY_BYTES);
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
  }, {
    maxBody: MAX_FILE_BODY_BYTES,
    upload: true,
    // Answered before a body is taken: who may send, and one at a time at a shop.
    beforeBody: async (req, res, shopId) => {
      if (await refusedToChange(req, res)) return null;
      if (sendingShops.has(shopId)) {
        res.setHeader('Retry-After', '2');
        sendJson(res, 429, BUSY);
        return null;
      }
      sendingShops.add(shopId);
      return () => sendingShops.delete(shopId);
    },
  });

  route('GET', '/api/move/look', async (req, res) => {
    if (await refused(req, res)) return;
    sendJson(res, 200, await lookList());
  });

  // One row at a time, always: nothing here takes more than one (mv-fix; answer 6).
  route('POST', '/api/move/rows/:id/fix', async (req, res, params, query, afterRelease, shopId) => {
    const r = await readRowRequest(req, res, params);
    if (!r) return;
    const { status, body } = await fixRow(r.id, { seen: r.seen, fields: r.body.fields ?? {}, decided: readDecided(r.body.decided), key: r.key, who: r.who });
    if (body.more) wakeBringingAcross(shopId);
    sendJson(res, status, body);
  });

  route('POST', '/api/move/rows/:id/leave-out', async (req, res, params) => {
    const r = await readRowRequest(req, res, params);
    if (!r) return;
    const { status, body } = await leaveOutRow(r.id, { seen: r.seen, key: r.key, who: r.who });
    sendJson(res, status, body);
  });

  // Ask us to help (mv-help): what was written, the card and who's asking; nothing from the rows.
  route('POST', '/api/move/help', async (req, res, params, query, afterRelease, shopId) => {
    if (await refusedToChange(req, res)) return;
    const inbox = helpInbox();
    if (!inbox) return sendJson(res, 503, NO_INBOX);
    const who = await whoIsBooking(req);
    if (!who) return sendJson(res, 409, CHECK_IN_FIRST);
    const body = await readJsonBody(req);
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return badRequest(res, 'Write what looks wrong');
    const key = readRequestKey(body);
    if (key.error || !key.value) return badRequest(res, key.error ?? 'A request key is required');
    const clean = (v) => (typeof v === 'string' ? v.replaceAll('\u0000', '').toWellFormed().trim() : '');
    const text = clean(body.text);
    const card = clean(body.card);
    if (!text || text.length > MAX_HELP) return badRequest(res, 'Write what looks wrong, in up to 4,000 characters');
    if (!card || card.length > MAX_CARD) return badRequest(res, 'Say which card this is from');
    const ctx = await currentSession(req);
    const shop = await prepare('SELECT name FROM shops WHERE id = ?').get(shopId);
    let sent;
    try {
      sent = await sendHelp({ text, card, who, replyTo: ctx.login.email ?? '', shopName: shop.name, ...key.value }, inbox);
    } catch (err) {
      console.error('Move: Ask us to help couldn’t be passed on', err.code ?? err.name);
      return sendJson(res, 502, { error: 'Couldn’t send. What you wrote is kept here. Try again.', code: 'not_sent' });
    }
    if (sent.reused) return sendJson(res, 409, REUSED_HELP);
    sendJson(res, 200, { ok: true });
  });

  // Choose another file: a file that couldn't be read goes from the list.
  route('DELETE', '/api/move/files/:id', async (req, res, params) => {
    if (await refusedToChange(req, res)) return;
    const id = Number(params.id);
    if (!Number.isInteger(id)) return notFound(res, 'File not found');
    // With whatever it still holds, so nothing of it stays and nothing blocks it.
    await dbExec('BEGIN');
    try {
      await prepare("SET LOCAL lock_timeout = '2s'").run();
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
      if (err.code === '55P03') return sendJson(res, 503, { error: 'Wheelhouse is busy with your files just now. Try again in a moment.', code: 'busy' });
      throw err;
    }
    sendJson(res, 200, { ok: true });
  });
}
