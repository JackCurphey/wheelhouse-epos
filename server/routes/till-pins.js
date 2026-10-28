// Till PINs and the PIN check-in (openspec/changes/pins-and-checkin; drawn as
// pin-change, till-checkin and till-pin-wrong in signin.mjs; signing in
// decisions 4, 6, 7, 8 and 9; roles and switches 5). Wheelhouse picks each
// person's four-digit PIN, nobody else at the shop has it, and only its hash
// is kept; the Owner clears someone else's; typing a PIN alone checks a
// person in on the till's browser for the shop's day; and the Owner, checked
// in at the till, gives a PIN to someone with none (openspec/changes/give-pin-at-till).
// Staff routes: they run with the shop's row-level security already bound.
// No PIN is ever logged.
import { randomInt } from 'node:crypto';
import { TeamError, attachRoles } from '../team.js';
import { dbExec, prepare } from '../db.js';
import { shopToday } from '../clock.js';
import { hashLinkCode, newLinkCode } from '../booking-link.js';
import { isHttpsRequest } from '../proxy-trust.js';
import { notFound, parseCookies, readJsonBody, sendJson } from '../lib/http.js';
import { currentSession } from '../lib/session.js';
import { currentShopTimeZone } from '../workshop/jobs.js';
import { SESSION_COOKIE } from '../auth.js';
import { hashPinAsync, verifyPinAsync } from '../till/pin.js';

export const CHECKIN_COOKIE = 'wh_till_checkin';
const OFFER_MINUTES = 15;
const FOUR_DIGITS = /^[0-9]{4}$/;
const WRONG_PIN = { error: 'That PIN isn’t anyone’s — try again', code: 'wrong_pin' };
// Keeping PINs one at a time per shop, so two can't keep the same one.
const PIN_LOCK = -97;

const today = async () => shopToday(await currentShopTimeZone());

/**
 * A four-digit PIN nobody else has (signing in 7): draw at random until one
 * isn't taken. `isTaken` and `draw` are passed in so the rule can be tested.
 */
export async function pickPin(isTaken, draw = () => randomInt(0, 10_000)) {
  for (let i = 0; i < 100; i += 1) {
    const pin = String(draw()).padStart(4, '0');
    if (!(await isTaken(pin))) return pin;
  }
  throw new Error('No free PIN found');
}

// Whether anyone at the shop but this person has the PIN, active or not
// (someone made active again keeps theirs).
async function takenByOthers(pin, employeeId) {
  const rows = await prepare('SELECT pin_hash FROM employees WHERE pin_hash IS NOT NULL AND id <> ?').all(employeeId);
  const hits = await Promise.all(rows.map((r) => verifyPinAsync(pin, r.pin_hash)));
  return hits.includes(true);
}

// The team member behind the sign-in, read fresh (an Owner's may just have been made).
async function teamMemberOf(login) {
  const row = await prepare('SELECT employee_id FROM logins WHERE id = ?').get(login.id);
  if (!row?.employee_id) return null;
  return prepare('SELECT id, name, pin_hash, pin_offer_hash, pin_offer_at, active FROM employees WHERE id = ?').get(row.employee_id);
}

// A PIN belongs to a team member; the Owner with only a sign-in becomes one,
// taking payments, when they first get a PIN (design 6). Anyone else needs
// adding to the team first.
async function teamMemberForPin(login, shopId) {
  const me = await teamMemberOf(login);
  if (me || login.is_owner !== true) return me;
  try {
    await attachRoles({ shopId, loginId: login.id, isMechanic: false, isCashier: true, workingDays: undefined });
  } catch (err) {
    // Another offer made the Owner's team member first: use that one.
    if (!(err instanceof TeamError)) throw err;
  }
  return teamMemberOf(login);
}

// Offers a team member a PIN nobody else at the shop has, kept only hashed
// until it is kept; each offer replaces the last ("Give me a different one").
async function offerPin(employeeId) {
  const pin = await pickPin((p) => takenByOthers(p, employeeId));
  await prepare('UPDATE employees SET pin_offer_hash = ?, pin_offer_at = now() WHERE id = ?').run(await hashPinAsync(pin), employeeId);
  return pin;
}

const NO_OFFER = { error: 'Ask for a new PIN', code: 'no_offer' };
const HAS_PIN = { error: 'They already have a PIN', code: 'has_pin' };

/**
 * Keep this PIN: only the one offered, within 15 minutes, and only if nobody
 * kept it meanwhile; the old PIN stops working. One at a time per shop, so
 * two people can't keep the same PIN. `firstOnly` (giving a PIN at the till)
 * also refuses someone who got a PIN meanwhile. Returns null once kept, or
 * the refusal as [status, body].
 */
async function keepPin(employeeId, pin, { firstOnly = false } = {}) {
  if (typeof pin !== 'string' || !FOUR_DIGITS.test(pin)) return [400, NO_OFFER];
  await dbExec('BEGIN');
  try {
    await prepare("SELECT pg_advisory_xact_lock(current_setting('app.current_shop_id')::int, ?::int)").get(PIN_LOCK);
    const offer = await prepare(
      `SELECT pin_hash, pin_offer_hash FROM employees WHERE id = ? AND pin_offer_at > now() - interval '${OFFER_MINUTES} minutes'`
    ).get(employeeId);
    let refusal = null;
    if (firstOnly && offer?.pin_hash) refusal = [409, HAS_PIN];
    else if (!offer?.pin_offer_hash || !(await verifyPinAsync(pin, offer.pin_offer_hash))) refusal = [400, NO_OFFER];
    else if (await takenByOthers(pin, employeeId)) refusal = [409, { error: 'Someone has just been given that PIN. Ask for a different one.', code: 'pin_taken' }];
    if (refusal) {
      await dbExec('ROLLBACK');
      return refusal;
    }
    await prepare('UPDATE employees SET pin_hash = pin_offer_hash, pin_offer_hash = NULL, pin_offer_at = NULL, updated_at = now() WHERE id = ?').run(employeeId);
    await dbExec('COMMIT');
    return null;
  } catch (err) {
    await dbExec('ROLLBACK').catch(() => {});
    throw err;
  }
}

/**
 * The person checked in on this browser, or null: the cookie's check-in,
 * made under this same sign-in, today, not ended, by someone still active.
 * Row-level security keeps it to the request's shop.
 */
export async function currentCheckin(req) {
  const token = parseCookies(req)[CHECKIN_COOKIE];
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const ctx = await currentSession(req);
  if (!ctx) return null;
  const row = await prepare(
    `SELECT c.id, c.employee_id, e.name, e.is_cashier FROM pin_checkins c JOIN employees e ON e.id = c.employee_id
      WHERE c.token_hash = ? AND c.login_id = ? AND c.day = ? AND c.ended_at IS NULL AND e.active = 1`
  ).get(hashLinkCode(token), ctx.login.id, await today());
  return row ?? null;
}

// Who may give PINs at the till: the person checked in on this browser by
// PIN (not the browser's sign-in), if they are the Owner. Manager and "Give
// everything a Manager can do" aren't stored yet; they join here with roles
// (WP-1.1; decided-while-building.md, 28 Oct, giving a PIN at the till).
async function giverHere(req) {
  const mine = await currentCheckin(req);
  if (!mine) return null;
  const owner = await prepare('SELECT 1 FROM logins WHERE employee_id = ? AND is_owner = true AND active = true').get(mine.employee_id);
  return owner ? mine : null;
}

// The people the giver can give a PIN to: active, no PIN, never the giver
// and never the Owner (whose PIN stays the Owner's: signing in, 5 Oct).
async function peopleWithNoPin(giver) {
  const rows = await prepare(
    `SELECT e.id, e.name, e.is_mechanic, l.id AS login_id FROM employees e LEFT JOIN logins l ON l.employee_id = e.id
      WHERE e.active = 1 AND e.pin_hash IS NULL AND e.id <> ? AND (l.id IS NULL OR l.is_owner = false)
      ORDER BY e.name, e.id`
  ).all(giver.employee_id);
  return rows.map((r) => ({ id: r.id, name: r.name, role: r.is_mechanic ? 'Mechanic' : 'Staff', tillOnly: r.login_id === null }));
}

// The person a PIN is given to, or the refusal as [status, body].
async function pinTarget(giver, id) {
  if (id === giver.employee_id) return [403, { error: 'Nobody gives their own PIN', code: 'own_pin' }];
  const person = await prepare(
    `SELECT e.id, e.pin_hash, EXISTS (SELECT 1 FROM logins l WHERE l.employee_id = e.id AND l.is_owner = true) AS is_owner
       FROM employees e WHERE e.id = ? AND e.active = 1`
  ).get(id);
  if (!person) return [404, { error: 'Team member not found' }];
  if (person.is_owner) return [403, { error: "The owner's PIN is the owner's own", code: 'owner_pin' }];
  if (person.pin_hash) return [409, HAS_PIN];
  return null;
}
const NOT_GIVER = { error: 'Only the owner, checked in at the till, can give a PIN', code: 'not_giver' };

const checkinCookie = (req, token, maxAge) =>
  `${CHECKIN_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${isHttpsRequest(req) ? '; Secure' : ''}`;

// Signing in 8: no lock after wrong PINs. Guessing is slowed instead: after
// 10 tries at a shop in 10 minutes, each further try waits 3 seconds before
// it is checked. Every try is counted before its PIN is checked, so a burst
// sent at once can't all slip in under the limit; a right PIN is then taken
// off the count. The wait is one at a time per sign-in and browser: a second
// try from the same one while one waits is turned away, so one person
// guessing never holds up another till, and waiting never holds more than
// one database connection per browser (review, 28 Oct, item 4).
const SLOW_MS = 3000;
const WINDOW_MS = 10 * 60 * 1000;
function makeCounter(max) {
  const seen = new Map();
  const entry = (key) => {
    const found = seen.get(key);
    if (found && Date.now() - found.start < WINDOW_MS) return found;
    const fresh = { count: 0, start: Date.now() };
    seen.set(key, fresh);
    return fresh;
  };
  return {
    /** Counts one more; true while that is within the limit. */
    take(key) { const e = entry(key); e.count += 1; return e.count <= max; },
    /** Takes one back (a right PIN). */
    giveBack(key) { const e = seen.get(key); if (e && e.count > 0) e.count -= 1; },
  };
}
const tries = makeCounter(10);
// "Give me a different one": 10 offers a sign-in in 10 minutes (review, 28 Oct, item 5).
const offers = makeCounter(10);
const waiting = new Set();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SLOW_DOWN = { error: 'Wait a moment, then try again', code: 'slow_down' };
// This sign-in on this browser: the session cookie's hash (a dev sign-in has none).
const browserKey = (req, ctx) => `${ctx.login.id}|${hashLinkCode(parseCookies(req)[SESSION_COOKIE] ?? '')}`;

export function register(route) {
  // Your settings › Till PIN (yourSettingsDialog's pinBlock).
  // screens: your-settings, pin-change, pin-first
  route('GET', '/api/your-settings/till-pin', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const me = await teamMemberOf(ctx.login);
    sendJson(res, 200, { canHavePin: Boolean(me) || ctx.login.is_owner === true, hasPin: Boolean(me?.pin_hash) });
  });

  // "Your new till PIN": four digits nobody else has, shown once; each call
  // replaces the last ("Give me a different one"). Kept only hashed.
  // screens: pin-change, pin-first
  route('POST', '/api/your-settings/till-pin/offer', async (req, res, params, query, afterRelease, shopId) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    if (!offers.take(String(ctx.login.id))) return sendJson(res, 429, SLOW_DOWN);
    const me = await teamMemberForPin(ctx.login, shopId);
    if (!me) return sendJson(res, 409, { error: 'Ask the owner to add you to the team first', code: 'no_team_member' });
    const pin = await offerPin(me.id);
    // Shown once: never kept by the browser or anything between.
    res.setHeader('Cache-Control', 'no-store');
    sendJson(res, 201, { pin });
  });

  // Keep this PIN (keepPin's rules).
  // screens: pin-change, pin-first
  route('POST', '/api/your-settings/till-pin', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const body = await readJsonBody(req);
    const me = await teamMemberOf(ctx.login);
    if (!me) return sendJson(res, 400, NO_OFFER);
    const refused = await keepPin(me.id, body?.pin);
    if (refused) return sendJson(res, ...refused);
    sendJson(res, 200, { hasPin: true });
  });

  // A forgotten PIN, cleared from the staff list (signing in 6). The Owner
  // only until roles; nobody clears their own (roles and switches 5).
  // screens: set-staff-clear-pin
  route('POST', '/api/team/:id/clear-pin', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    if (!ctx.login.is_owner) return sendJson(res, 403, { error: "Only the shop's owner can clear a PIN", code: 'owner_only' });
    // A made-up id never gets here: the dispatcher answers 404 first (idParamsWellFormed).
    const id = Number(params.id);
    const own = await prepare('SELECT 1 FROM logins WHERE id = ? AND employee_id = ?').get(ctx.login.id, id);
    if (own) return sendJson(res, 403, { error: 'Nobody clears their own PIN', code: 'own_pin' });
    const cleared = await prepare('UPDATE employees SET pin_hash = NULL, pin_offer_hash = NULL, pin_offer_at = NULL, updated_at = now() WHERE id = ? RETURNING id').get(id);
    if (!cleared) return notFound(res, 'Team member not found');
    // Whoever forgot it is no longer serving on any till today.
    await prepare('UPDATE pin_checkins SET ended_at = now() WHERE employee_id = ? AND ended_at IS NULL').run(id);
    sendJson(res, 200, { ok: true });
  });

  // Who is serving on this browser, who has checked in today (till-checkin),
  // and who the Owner serving here can give a PIN to.
  // screens: till-checkin, till-serving-menu, till-serving-menu-several
  route('GET', '/api/till-checkin', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const mine = await currentCheckin(req);
    const people = await prepare(
      `SELECT DISTINCT e.id, e.name FROM pin_checkins c JOIN employees e ON e.id = c.employee_id
        WHERE c.day = ? AND e.active = 1 ORDER BY e.name, e.id`
    ).all(await today());
    // Only for the Owner serving here: who has no PIN (till-serving-menu).
    const giver = mine ? await giverHere(req) : null;
    sendJson(res, 200, {
      serving: mine ? { id: mine.employee_id, name: mine.name } : null,
      checkedInToday: people.map((p) => ({ id: p.id, name: p.name })),
      givePin: giver ? await peopleWithNoPin(giver) : [],
    });
  });

  // Check in, or take over, by PIN alone (signing in 4). A wrong PIN says so
  // and never locks (8, 9); guessing is slowed (above).
  // screens: till-checkin, till-pin-wrong
  route('POST', '/api/till-checkin', async (req, res, params, query, afterRelease, shopId) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const body = await readJsonBody(req);
    const pin = body?.pin;
    if (typeof pin !== 'string' || !FOUR_DIGITS.test(pin)) return sendJson(res, 400, { error: 'A PIN is four digits', code: 'not_a_pin' });
    const shop = String(shopId);
    if (!tries.take(shop)) {
      const mine = browserKey(req, ctx);
      if (waiting.has(mine)) return sendJson(res, 429, SLOW_DOWN);
      waiting.add(mine);
      try { await pause(SLOW_MS); } finally { waiting.delete(mine); }
    }
    const people = await prepare('SELECT id, name, pin_hash FROM employees WHERE active = 1 AND pin_hash IS NOT NULL').all();
    const hits = await Promise.all(people.map((p) => verifyPinAsync(pin, p.pin_hash)));
    const who = people[hits.indexOf(true)];
    if (!who) return sendJson(res, 400, WRONG_PIN);
    tries.giveBack(shop);
    // Taking over: whoever was checked in on this browser stops serving.
    const previous = parseCookies(req)[CHECKIN_COOKIE];
    if (previous && /^[0-9a-f]{64}$/.test(previous)) {
      await prepare('UPDATE pin_checkins SET ended_at = now() WHERE token_hash = ? AND ended_at IS NULL').run(hashLinkCode(previous));
    }
    const token = newLinkCode();
    await prepare('INSERT INTO pin_checkins (employee_id, login_id, token_hash, day) VALUES (?, ?, ?, ?)')
      .run(who.id, ctx.login.id, hashLinkCode(token), await today());
    // The server ends it with the shop's day; the cookie lasts no longer than a day.
    res.setHeader('Set-Cookie', checkinCookie(req, token, 24 * 60 * 60));
    sendJson(res, 201, { serving: { id: who.id, name: who.name } });
  });

  // Switch: nobody serving on this browser, back to Enter your PIN.
  // screens: till-checkin
  route('POST', '/api/till-checkin/end', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    await endCheckinHere(req, res, ctx);
    sendJson(res, 200, { serving: null });
  });

  // "[Name]’s till PIN" at the till: the Owner checked in here offers a PIN
  // to someone with none, the screen turned to them (Jack's answers 28 Oct,
  // 3 to 5). Shown once, only in this reply; never logged.
  // screens: till-give-pin, till-give-pin-pick
  route('POST', '/api/till-checkin/give-pin/:id/offer', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const giver = await giverHere(req);
    if (!giver) return sendJson(res, 403, NOT_GIVER);
    // The same count as Your settings' offers, for this sign-in.
    if (!offers.take(String(ctx.login.id))) return sendJson(res, 429, SLOW_DOWN);
    const id = Number(params.id);
    const refused = await pinTarget(giver, id);
    if (refused) return sendJson(res, ...refused);
    const pin = await offerPin(id);
    res.setHeader('Cache-Control', 'no-store');
    sendJson(res, 201, { pin });
  });

  // Close without giving a PIN: the PIN shown is withdrawn, so nobody can
  // keep it afterwards (review, 28 Oct, item 3).
  // screens: till-give-pin
  route('DELETE', '/api/till-checkin/give-pin/:id/offer', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const giver = await giverHere(req);
    if (!giver) return sendJson(res, 403, NOT_GIVER);
    const id = Number(params.id);
    const refused = await pinTarget(giver, id);
    if (refused) return sendJson(res, ...refused);
    await prepare('UPDATE employees SET pin_offer_hash = NULL, pin_offer_at = NULL WHERE id = ? AND pin_hash IS NULL').run(id);
    sendJson(res, 200, { ok: true });
  });

  // Keep this PIN, given at the till: keepPin's rules, for someone who still
  // has none; then the till goes back to Enter your PIN, ready for them.
  // screens: till-give-pin, till-checkin
  route('POST', '/api/till-checkin/give-pin/:id', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const giver = await giverHere(req);
    if (!giver) return sendJson(res, 403, NOT_GIVER);
    const id = Number(params.id);
    const body = await readJsonBody(req);
    const refused = (await pinTarget(giver, id)) ?? (await keepPin(id, body?.pin, { firstOnly: true }));
    if (refused) return sendJson(res, ...refused);
    await endCheckinHere(req, res, ctx);
    sendJson(res, 200, { serving: null });
  });
}

// Switch: this browser's check-in ends, and its cookie goes.
async function endCheckinHere(req, res, ctx) {
  const token = parseCookies(req)[CHECKIN_COOKIE];
  if (token && /^[0-9a-f]{64}$/.test(token)) {
    await prepare('UPDATE pin_checkins SET ended_at = now() WHERE token_hash = ? AND login_id = ? AND ended_at IS NULL').run(hashLinkCode(token), ctx.login.id);
  }
  res.setHeader('Set-Cookie', checkinCookie(req, '', 0));
}
