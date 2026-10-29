// Sites, tills and the till's own sync (the Release 2 offline core).
// Two dispatcher branches (server.js) run these:
// - /api/till/:shopSlug/snapshot and /sync are till routes: the till's own
//   token authenticates them, the shop comes from :shopSlug, and a handler
//   gets (req, res, params, query, till).
// - the rest (/api/sites, /api/tills and /api/till-attention) are staff
//   routes, under the /api/ branch: a handler gets (req, res, params, query, afterRelease, shopId) and needs a
//   staff session. /api/tills and /api/till-attention are staff routes, not
//   till routes.
// Row-level security is bound to the shop in both.
// Moved out of server.js unchanged (split plan §4.1, WP-0.4).
import { dbExec, prepare } from '../db.js';
import { hashLinkCode, newLinkCode } from '../booking-link.js';
import { badRequest, notFound, readJsonBody, sendJson } from '../lib/http.js';
import { currentSession } from '../lib/session.js';
import { listOpen as listOpenAttention, resolve as resolveAttention } from '../till/attention.js';
import { buildSnapshot } from '../till/snapshot.js';
import { TransientSyncError, batchProblem, processSyncItems } from '../till/sync.js';
import { TILL_ORDER, serializeThisTill, thisTill, tillCookie } from '../till/this-till.js';
import { someoneElseCheckedIn } from './till-pins.js';
import { serializeThisWorkshop, thisWorkshop, workshopCookie } from '../till/this-workshop.js';
import { markSessionWorkshop } from '../lib/workshop-owner.js';

const OWNER_ONLY = { error: 'Only the owner can set up a till', code: 'owner_only' };
const NOT_OWNER_HERE = { error: 'Only the owner can set up a till. Switch to the owner first.', code: 'not_owner_checked_in' };
// The Tills list's refusals, in the drawn note's words (set-till-tills).
const OWNER_ONLY_TILLS = { error: 'Only the owner can add or remove tills.', code: 'owner_only' };
const NOT_OWNER_TILLS = { error: 'Only the owner can add or remove tills. Switch to the owner first.', code: 'not_owner_checked_in' };
const ALREADY_A_TILL = { error: 'This computer is already a till', code: 'already_a_till' };
const ALREADY_A_WORKSHOP = { error: 'This computer is already a workshop computer', code: 'already_a_workshop' };

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

// A till and a workshop computer, for Rename and Remove (tills-list design 2).
const TILL_KIND = { table: 'tills', columns: 'id, code, name', missing: 'Till not found' };
const WORKSHOP_KIND = { table: 'workshop_computers', columns: 'id, name', missing: 'Workshop computer not found' };

// Rename and Remove, after the route's owner check: not while someone else
// is checked in by PIN on this browser (roles and switches 2).
async function renameDevice(kind, req, res, rawId) {
  if (await someoneElseCheckedIn(req)) return sendJson(res, 403, NOT_OWNER_TILLS);
  const { name } = (await readJsonBody(req)) ?? {};
  if (name !== undefined && name !== null && typeof name !== 'string') return badRequest(res, 'The name must be text');
  const named = (name ?? '').trim();
  if (named.length > 60) return badRequest(res, 'A name can be up to 60 characters');
  const done = await lockedDevice(kind, rawId, (id) =>
    db.prepare(`UPDATE ${kind.table} SET name = ? WHERE id = ? RETURNING ${kind.columns}`).get(named || null, id));
  if (!done) return notFound(res, kind.missing);
  sendJson(res, 200, done);
}

// Switched off, not deleted: what was done on it stays, and a till's number
// stays in use (till-setup entries 7 and 17).
async function removeDevice(kind, req, res, rawId) {
  if (await someoneElseCheckedIn(req)) return sendJson(res, 403, NOT_OWNER_TILLS);
  const done = await lockedDevice(kind, rawId, (id) =>
    db.prepare(`UPDATE ${kind.table} SET active = false WHERE id = ? RETURNING id`).get(id));
  if (!done) return notFound(res, kind.missing);
  sendJson(res, 200, { id: done.id, active: false });
}

// BEGIN, the row locked while it is on, `write`, COMMIT; null (rolled back)
// when there is no such row on. The caller replies after this returns.
async function lockedDevice(kind, rawId, write) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) return null;
  await dbExec('BEGIN');
  try {
    const row = await db.prepare(`SELECT id FROM ${kind.table} WHERE id = ? AND active = true FOR UPDATE`).get(id);
    const done = row ? await write(id) : null;
    await dbExec(done ? 'COMMIT' : 'ROLLBACK');
    return done;
  } catch (err) {
    await dbExec('ROLLBACK').catch(() => {});
    throw err;
  }
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

  // Set up this till (till-setup; openspec/changes/till-setup): the Owner,
  // signed in, makes this computer a till. Never by PIN (roles and switches 2).
  // screens: till-setup, set-till-tills-owner
  route('GET', '/api/till-setup', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx?.login.is_owner) return sendJson(res, 403, OWNER_ONLY);
    const sites = await db.prepare('SELECT * FROM sites ORDER BY id').all();
    const tills = await db.prepare(`SELECT site_id, code, active FROM tills ORDER BY ${TILL_ORDER}`).all();
    // Every number used at a site, switched off or not: codes stay unique.
    const taken = (site) => tills.filter((t) => t.site_id === site.id).map((t) => Number(t.code.slice(site.code.length))).sort((a, b) => a - b);
    const mine = await thisTill(req);
    const workshop = mine ? null : await thisWorkshop(req);
    sendJson(res, 200, {
      sites: sites.map((s) => ({ ...serializeSite(s), taken: taken(s) })),
      thisTill: mine ? serializeThisTill(mine) : null,
      thisWorkshop: workshop ? serializeThisWorkshop(workshop) : null,
      tills: tills.filter((t) => t.active).map((t) => t.code),
    });
  });

  route('POST', '/api/till-setup', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx?.login.is_owner) return sendJson(res, 403, OWNER_ONLY);
    // The Owner's sign-in, but someone else checked in here by PIN: not them
    // (roles and switches 2; the giverHere rule; review, 28 Oct).
    if (await someoneElseCheckedIn(req)) return sendJson(res, 403, NOT_OWNER_HERE);
    if (await thisTill(req)) return sendJson(res, 409, ALREADY_A_TILL);
    if (await thisWorkshop(req)) return sendJson(res, 409, ALREADY_A_WORKSHOP);
    const { siteId, number, name, reclaim } = (await readJsonBody(req)) ?? {};
    // RLS hides other shops' sites, so a foreign siteId reads as missing.
    const site = Number.isInteger(siteId) ? await db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId) : null;
    if (!site) return badRequest(res, 'Choose one of your shops');
    if (!Number.isInteger(number) || number < 1 || number > 99) return badRequest(res, 'A till number is 1 to 99');
    if (name !== undefined && name !== null && typeof name !== 'string') return badRequest(res, 'The name must be text');
    const named = (name ?? '').trim();
    if (named.length > 60) return badRequest(res, 'A till name can be up to 60 characters');
    const code = `${site.code}${number}`;
    const TAKEN = { error: `Till ${code} is in use. Choose another number.`, code: 'taken' };
    // The browser's own token; the offline till's is another, never shown here
    // (step C decides how the offline till gets its own; review, 28 Oct).
    const browserToken = newLinkCode();
    // Re-claiming: this computer becomes that till instead of a lost or
    // replaced one, whose browser stops being it. Its name stays. Server only
    // until it is drawn (the drawing's taken numbers can't be picked).
    if (reclaim === true) {
      const claimed = await db.prepare(
        'UPDATE tills SET browser_token_hash = ? WHERE site_id = ? AND code = ? AND active = true RETURNING id, name'
      ).get(hashLinkCode(browserToken), site.id, code);
      if (claimed) {
        res.setHeader('Set-Cookie', tillCookie(req, browserToken));
        return sendJson(res, 200, { till: { id: claimed.id, code, name: claimed.name, siteName: site.name } });
      }
    }
    if (await db.prepare('SELECT 1 FROM tills WHERE code = ?').get(code)) return sendJson(res, 409, TAKEN);
    let made;
    try {
      made = await db.prepare('INSERT INTO tills (site_id, code, name, token_hash, browser_token_hash, registered_by_login_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING id')
        .get(site.id, code, named || null, hashLinkCode(newLinkCode()), hashLinkCode(browserToken), ctx.login.id);
    } catch (err) {
      // Two set up the same number at once: the code's unique index keeps one.
      if (err.code === '23505') return sendJson(res, 409, TAKEN);
      throw err;
    }
    res.setHeader('Set-Cookie', tillCookie(req, browserToken));
    sendJson(res, 201, { till: { id: made.id, code, name: named || null, siteName: site.name } });
  });

  // Make this computer a workshop computer (openspec/changes/workshop-computer;
  // stage-1 gaps 4; walk-through 8 decision 1): the Owner, signed in, as for
  // a till; a shop and an optional name, no number. Never by PIN (roles and
  // switches 2).
  // screens: till-setup, till-checkin-workshop
  route('POST', '/api/till-setup/workshop', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx?.login.is_owner) return sendJson(res, 403, OWNER_ONLY);
    if (await someoneElseCheckedIn(req)) return sendJson(res, 403, NOT_OWNER_HERE);
    if (await thisTill(req)) return sendJson(res, 409, ALREADY_A_TILL);
    if (await thisWorkshop(req)) return sendJson(res, 409, ALREADY_A_WORKSHOP);
    const { siteId, name } = (await readJsonBody(req)) ?? {};
    // RLS hides other shops' sites, so a foreign siteId reads as missing.
    const site = Number.isInteger(siteId) ? await db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId) : null;
    if (!site) return badRequest(res, 'Choose one of your shops');
    if (name !== undefined && name !== null && typeof name !== 'string') return badRequest(res, 'The name must be text');
    const named = (name ?? '').trim();
    if (named.length > 60) return badRequest(res, 'A name can be up to 60 characters');
    const browserToken = newLinkCode();
    const made = await db.prepare('INSERT INTO workshop_computers (site_id, name, browser_token_hash, registered_by_login_id) VALUES (?, ?, ?, ?) RETURNING id')
      .get(site.id, named || null, hashLinkCode(browserToken), ctx.login.id);
    // This sign-in is the workshop computer's from now on, whatever its
    // cookies say later (openspec/changes/workshop-lock-server).
    await markSessionWorkshop(req, made.id);
    res.setHeader('Set-Cookie', workshopCookie(req, browserToken));
    sendJson(res, 201, { workshop: { id: made.id, name: named || null, siteName: site.name } });
  });

  // The Tills list (openspec/changes/tills-list; set-till-tills-owner): every
  // till and workshop computer that's on, with where, when and by whom it was
  // registered. The Owner's only (owner setup 17).
  // screens: set-till-tills-owner
  route('GET', '/api/till-setup/list', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx?.login.is_owner) return sendJson(res, 403, OWNER_ONLY_TILLS);
    const registered = (r) => ({ siteName: r.site_name, registeredAt: new Date(r.created_at).toISOString(), registeredBy: r.registered_by ?? null });
    const tills = await db.prepare(
      `SELECT t.id, t.code, t.name, t.created_at, s.name AS site_name, l.name AS registered_by
         FROM tills t JOIN sites s ON s.id = t.site_id LEFT JOIN logins l ON l.id = t.registered_by_login_id
        WHERE t.active = true ORDER BY ${TILL_ORDER.replaceAll('code', 't.code')}`
    ).all();
    const workshops = await db.prepare(
      `SELECT w.id, w.name, w.created_at, s.name AS site_name, l.name AS registered_by
         FROM workshop_computers w JOIN sites s ON s.id = w.site_id LEFT JOIN logins l ON l.id = w.registered_by_login_id
        WHERE w.active = true ORDER BY w.id`
    ).all();
    sendJson(res, 200, {
      tills: tills.map((t) => ({ id: t.id, code: t.code, name: t.name, ...registered(t) })),
      workshopComputers: workshops.map((w) => ({ id: w.id, name: w.name, ...registered(w) })),
    });
  });

  // Rename and Remove (tills-list design 2; set-till-tills-owner,
  // set-till-remove): the Owner's, and not while someone else is checked in
  // by PIN here (roles and switches 2). Each locks its row, switched on,
  // and replies after COMMIT; a till or workshop computer that's off,
  // missing or another shop's (row-level security) is 404.
  // screens: set-till-tills-owner, set-till-remove
  // The owner check is in each route, so the owner-only scan reads it.
  route('PUT', '/api/till-setup/tills/:id', async (req, res, params) => {
    if (!(await currentSession(req))?.login.is_owner) return sendJson(res, 403, OWNER_ONLY_TILLS);
    await renameDevice(TILL_KIND, req, res, params.id);
  });
  route('POST', '/api/till-setup/tills/:id/remove', async (req, res, params) => {
    if (!(await currentSession(req))?.login.is_owner) return sendJson(res, 403, OWNER_ONLY_TILLS);
    await removeDevice(TILL_KIND, req, res, params.id);
  });
  route('PUT', '/api/till-setup/workshop/:id', async (req, res, params) => {
    if (!(await currentSession(req))?.login.is_owner) return sendJson(res, 403, OWNER_ONLY_TILLS);
    await renameDevice(WORKSHOP_KIND, req, res, params.id);
  });
  route('POST', '/api/till-setup/workshop/:id/remove', async (req, res, params) => {
    if (!(await currentSession(req))?.login.is_owner) return sendJson(res, 403, OWNER_ONLY_TILLS);
    await removeDevice(WORKSHOP_KIND, req, res, params.id);
  });

  // The offline core's switch-off, kept for its callers: the same rules as
  // Remove (tills-list, the review, 29 Oct): locked, not while someone else
  // is checked in here, and a till already off is 404.
  route('POST', '/api/tills/:id/deactivate', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can switch a till off' });
    await removeDevice(TILL_KIND, req, res, params.id);
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
