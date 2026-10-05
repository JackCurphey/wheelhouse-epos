// Sites, tills and the till's own sync (the Release 2 offline core).
// Two dispatcher branches (server.js) run these:
// - /api/till/:shopSlug/snapshot and /sync are till routes: the till's own
//   token authenticates them, the shop comes from :shopSlug, and a handler
//   gets (req, res, params, query, till).
// - the rest (/api/sites, /api/tills, /api/till-attention and
//   PUT /api/employees/:id/pin) are staff routes, under the /api/ branch: a
//   handler gets (req, res, params, query, afterRelease, shopId) and needs a
//   staff session. /api/tills and /api/till-attention are staff routes, not
//   till routes.
// Row-level security is bound to the shop in both.
// Moved out of server.js unchanged (split plan §4.1, WP-0.4).
import { dbExec, prepare } from '../db.js';
import { hashLinkCode, newLinkCode } from '../booking-link.js';
import { badRequest, notFound, readJsonBody, sendJson } from '../lib/http.js';
import { currentSession } from '../lib/session.js';
import { listOpen as listOpenAttention, resolve as resolveAttention } from '../till/attention.js';
import { hashPin, isValidPin } from '../till/pin.js';
import { buildSnapshot } from '../till/snapshot.js';
import { TransientSyncError, batchProblem, processSyncItems } from '../till/sync.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

// A till is registered once by the owner and gets a token shown once; only
// its hash is stored (the same scheme as the booking link). The token never
// expires, so it cannot lapse in the middle of an outage; switching the till
// off is how it is withdrawn.
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §5, §8

function serializeSite(row) {
  return { id: row.id, name: row.name, code: row.code };
}

function serializeTill(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    siteId: row.site_id,
    active: row.active,
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : null,
    pendingCount: row.last_pending_count,
  };
}

export function register(route) {
  route('GET', '/api/sites', async (req, res) => {
    sendJson(res, 200, (await db.prepare('SELECT * FROM sites ORDER BY code').all()).map(serializeSite));
  });

  route('POST', '/api/sites', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can add a site' });
    const { name, code } = await readJsonBody(req);
    if (typeof name !== 'string' || !name.trim()) return badRequest(res, 'A site needs a name');
    if (typeof code !== 'string' || !/^[A-Z]{1,3}$/.test(code)) return badRequest(res, 'A site code is one to three capital letters');
    if (await db.prepare('SELECT 1 FROM sites WHERE code = ?').get(code)) return sendJson(res, 409, { error: 'That site code is taken' });
    const { lastInsertRowid } = await db.prepare('INSERT INTO sites (name, code) VALUES (?, ?)').run(name.trim(), code);
    sendJson(res, 201, serializeSite(await db.prepare('SELECT * FROM sites WHERE id = ?').get(lastInsertRowid)));
  });

  route('GET', '/api/tills', async (req, res) => {
    sendJson(res, 200, (await db.prepare('SELECT * FROM tills ORDER BY code').all()).map(serializeTill));
  });

  route('POST', '/api/tills', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can register a till' });
    const { siteId, number, name } = await readJsonBody(req);
    // RLS hides other shops' sites, so a foreign siteId reads as missing.
    const site = Number.isInteger(siteId) ? await db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId) : null;
    if (!site) return badRequest(res, 'Choose one of your sites');
    if (!Number.isInteger(number) || number < 1 || number > 99) return badRequest(res, 'A till number is 1 to 99');
    if (typeof name !== 'string' || !name.trim()) return badRequest(res, 'A till needs a name');
    const code = `${site.code}${number}`;
    if (await db.prepare('SELECT 1 FROM tills WHERE code = ?').get(code)) return sendJson(res, 409, { error: `Till ${code} already exists` });
    const token = newLinkCode();
    const { lastInsertRowid } = await db.prepare(
      'INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, ?, ?, ?)'
    ).run(site.id, code, name.trim(), hashLinkCode(token));
    const till = await db.prepare('SELECT * FROM tills WHERE id = ?').get(lastInsertRowid);
    sendJson(res, 201, { till: serializeTill(till), token });
  });

  route('POST', '/api/tills/:id/deactivate', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can switch a till off' });
    const { changes } = await db.prepare('UPDATE tills SET active = false WHERE id = ?').run(Number(params.id));
    if (!changes) return notFound(res, 'Till not found');
    sendJson(res, 200, { id: Number(params.id), active: false });
  });

  route('PUT', '/api/employees/:id/pin', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can set a PIN' });
    const { pin } = await readJsonBody(req);
    if (!isValidPin(pin)) return badRequest(res, 'A PIN is 4 to 6 digits');
    const { changes } = await db.prepare('UPDATE employees SET pin_hash = ?, updated_at = now() WHERE id = ?').run(hashPin(pin), Number(params.id));
    if (!changes) return notFound(res, 'Team member not found');
    res.writeHead(204).end();
  });

  // A till authenticates with its bearer token (see the /api/till/ dispatcher
  // branch below), never a staff session - `till` is the tills row the
  // dispatcher already resolved and verified.
  route('GET', '/api/till/:shopSlug/snapshot', async (req, res, params, query, till) => {
    sendJson(res, 200, await buildSnapshot(till));
  });

  route('POST', '/api/till/:shopSlug/sync', async (req, res, params, query, till) => {
    const body = await readJsonBody(req);
    const problem = batchProblem(body);
    if (problem) return badRequest(res, problem);
    const pending = Number.isInteger(body.pendingCount) && body.pendingCount >= 0 ? body.pendingCount : 0;
    await db.prepare('UPDATE tills SET last_seen_at = now(), last_pending_count = ? WHERE id = ?').run(pending, till.id);
    let results;
    try {
      results = await processSyncItems(till, body.items);
    } catch (err) {
      if (!(err instanceof TransientSyncError)) throw err;
      console.warn(`till sync: ${till.code} asked to retry after ${err.cause?.code}: ${err.cause?.message}`);
      return sendJson(res, 503, { error: 'Busy - try again' });
    }
    sendJson(res, 200, { results });
  });

  route('GET', '/api/till-attention', async (req, res) => {
    const rows = await listOpenAttention();
    sendJson(res, 200, rows.map((r) => ({
      id: r.id, kind: r.kind, detail: r.detail,
      tillSaleId: r.till_sale_id, productId: r.product_id, customerId: r.customer_id,
      createdAt: new Date(r.created_at).toISOString(),
    })));
  });

  route('POST', '/api/till-attention/:id/resolve', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!(await resolveAttention(Number(params.id), ctx.login.id))) return notFound(res, 'Nothing open with that id');
    sendJson(res, 200, { id: Number(params.id), resolved: true });
  });
}
