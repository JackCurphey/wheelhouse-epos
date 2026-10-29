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
import { currentSession, signedInSession } from '../lib/session.js';
import { currentShopTimeZone } from '../workshop/jobs.js';
import { SESSION_COOKIE } from '../auth.js';
import { hashPinAsync, verifyPinAsync } from '../till/pin.js';
import { thisTill, tillCookie, tillCookieToken } from '../till/this-till.js';
import { ownerIdleMinutes, thisWorkshop, trustPinHere, workshopCookie, workshopCookieToken } from '../till/this-workshop.js';

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
// A newer PIN was offered (another window's Give me a different one) after this one was shown (review, 28 Oct).
const REPLACED = { error: 'Your PIN was offered in another window. Pick again.', code: 'offer_replaced' };
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
    else if (!offer?.pin_offer_hash) refusal = [400, NO_OFFER];
    else if (!(await verifyPinAsync(pin, offer.pin_offer_hash))) refusal = [400, REPLACED];
    else if (await takenByOthers(pin, employeeId)) refusal = [409, { error: 'Someone has just been given that PIN. Ask for a different one.', code: 'pin_taken' }];
    if (refusal) {
      await dbExec('ROLLBACK');
      return refusal;
    }
    await prepare('UPDATE employees SET pin_hash = pin_offer_hash, pin_offer_hash = NULL, pin_offer_at = NULL, pin_set_at = now(), updated_at = now() WHERE id = ?').run(employeeId);
    await dbExec('COMMIT');
    return null;
  } catch (err) {
    await dbExec('ROLLBACK').catch(() => {});
    throw err;
  }
}

/**
 * This browser's till, or its workshop computer, or neither: a till's key
 * wins should a browser somehow carry both (workshop-computer design 1).
 */
async function thisComputer(req) {
  const till = await thisTill(req);
  return { till, workshop: till ? null : await thisWorkshop(req) };
}

/**
 * The person checked in on this browser, or null: the cookie's check-in,
 * made under this same sign-in, on this browser's till or workshop computer
 * (or, on a browser that is neither, on none: till-setup design 3), today,
 * not ended, by someone still active. On a workshop computer, a check-in
 * unused for the shop's time (10 minutes with trust PIN off; trust-pin-workshop)
 * is ended there and then and counts as none (workshop-computer design 2;
 * walk-through 8 decision 3; build plan Q6). Row-level security keeps it to
 * the request's shop.
 */
export async function currentCheckin(req) {
  const token = parseCookies(req)[CHECKIN_COOKIE];
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  // The sign-in as stored: whether it counts as the Owner here is decided from this check-in.
  const ctx = await signedInSession(req);
  if (!ctx) return null;
  const { till, workshop } = await thisComputer(req);
  // The shop's time on a workshop computer (trust-pin-workshop): null is
  // never. The Owner's own check-in waits 10 minutes at most (design 8).
  const idleMinutes = workshop ? (await trustPinHere()).idleMinutes : null;
  const ownerMinutes = workshop ? ownerIdleMinutes(idleMinutes) : null;
  const row = await prepare(
    `SELECT c.id, c.employee_id, c.till_id, c.workshop_computer_id, e.name, e.is_cashier,
            (c.workshop_computer_id IS NOT NULL AND COALESCE(c.last_active_at, c.checked_in_at) <= now() - make_interval(mins =>
              CASE WHEN EXISTS (SELECT 1 FROM logins l WHERE l.employee_id = e.id AND l.is_owner = true) THEN ?::int ELSE ?::int END)) AS idle
       FROM pin_checkins c JOIN employees e ON e.id = c.employee_id
      WHERE c.token_hash = ? AND c.login_id = ? AND c.day = ? AND c.till_id IS NOT DISTINCT FROM ?::int
        AND c.workshop_computer_id IS NOT DISTINCT FROM ?::int AND c.ended_at IS NULL AND e.active = 1`
  ).get(ownerMinutes, idleMinutes, hashLinkCode(token), ctx.login.id, await today(), till?.id ?? null, workshop?.id ?? null);
  if (!row) return null;
  if (row.idle) {
    await prepare('UPDATE pin_checkins SET ended_at = now() WHERE id = ? AND ended_at IS NULL').run(row.id);
    return null;
  }
  return row;
}

// Who may give PINs at the till: the person checked in on this browser by
// PIN (not the browser's sign-in), if they are the Owner. Manager and "Give
// everything a Manager can do" aren't stored yet; they join here with roles
// (WP-1.1; decided-while-building.md, 28 Oct, giving a PIN at the till).
// Giving a PIN is the till's: never on a workshop computer (workshop-computer).
async function giverHere(req) {
  const mine = await currentCheckin(req);
  if (!mine || mine.workshop_computer_id) return null;
  return (await isTheOwner(mine)) ? mine : null;
}
export const isTheOwner = async (checkin) => Boolean(await prepare('SELECT 1 FROM logins WHERE employee_id = ? AND is_owner = true AND active = true').get(checkin.employee_id));

/**
 * Whether the sign-in's own PIN and settings are the sign-in's to use on this
 * browser (the review, 29 Oct). Anywhere but a workshop computer, yes. On a
 * workshop computer, only while the person checked in by PIN is the
 * sign-in's own team member: otherwise whoever is working could get the
 * sign-in (usually the Owner) a new PIN and check in as them.
 */
export async function ownAccountHere(req, ctx) {
  const { workshop } = await thisComputer(req);
  if (!workshop) return true;
  const mine = await currentCheckin(req);
  if (!mine) return false;
  return Boolean(await prepare('SELECT 1 FROM logins WHERE id = ? AND employee_id = ?').get(ctx.login.id, mine.employee_id));
}
export const NOT_YOURS_HERE = { error: 'On a workshop computer, only the person signed in changes their own PIN and settings, checked in with their own PIN', code: 'not_your_account_here' };

// Someone checked in by PIN on this browser who isn't the Owner: then the
// Owner's sign-in doesn't set up a till or a workshop computer here
// (giverHere's rule; roles and switches 2; till-setup, review, 28 Oct).
export async function someoneElseCheckedIn(req) {
  const mine = await currentCheckin(req);
  return Boolean(mine) && !(await isTheOwner(mine));
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

// Who a tap checks in on this till or workshop computer (trust-pin-workshop
// design 3 and 4; serving-pills): someone active, with a PIN, never the
// Owner, who typed their PIN (not a tap) on this same till or workshop
// computer on the shop's day, under this same sign-in (as currentCheckin),
// since their PIN was last cleared or changed (the review, 29 Oct). `id`
// narrows it to one person.
async function tapNames({ till, workshop }, loginId, day, id = null) {
  const rows = await prepare(
    `SELECT DISTINCT e.id, e.name, e.is_mechanic FROM pin_checkins c JOIN employees e ON e.id = c.employee_id
      WHERE c.till_id IS NOT DISTINCT FROM ?::int AND c.workshop_computer_id IS NOT DISTINCT FROM ?::int AND c.login_id = ? AND c.day = ? AND c.by_tap = false AND e.active = 1 AND e.pin_hash IS NOT NULL
        AND c.checked_in_at > GREATEST(COALESCE(e.pin_cleared_at, '-infinity'::timestamptz), COALESCE(e.pin_set_at, '-infinity'::timestamptz))
        AND NOT EXISTS (SELECT 1 FROM logins l WHERE l.employee_id = e.id AND l.is_owner = true)
        AND (?::int IS NULL OR e.id = ?::int)
      ORDER BY e.name, e.id`
  ).all(till?.id ?? null, workshop?.id ?? null, loginId, day, id, id);
  return rows.map((r) => ({ id: r.id, name: r.name, role: r.is_mechanic ? 'Mechanic' : 'Staff' }));
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
    if (!(await ownAccountHere(req, ctx))) return sendJson(res, 403, NOT_YOURS_HERE);
    const me = await teamMemberOf(ctx.login);
    sendJson(res, 200, { canHavePin: Boolean(me) || ctx.login.is_owner === true, hasPin: Boolean(me?.pin_hash) });
  });

  // Whether "Your till PIN" opens by itself (pin-first, pin-cleared; UX
  // walk-through 4 H1; whos-in-and-first-pin): for a team member with no
  // PIN, never asked ("first"), or asked before their PIN was last cleared
  // ("cleared"). Not the Owner's own sign-in: they made the shop.
  // screens: pin-first, pin-cleared
  route('GET', '/api/your-settings/till-pin/ask', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    if (!(await ownAccountHere(req, ctx))) return sendJson(res, 403, NOT_YOURS_HERE);
    const row = ctx.login.is_owner ? null : await prepare(
      `SELECT l.till_pin_asked_at AS asked, e.pin_cleared_at AS cleared FROM logins l JOIN employees e ON e.id = l.employee_id
        WHERE l.id = ? AND e.pin_hash IS NULL AND e.active = 1`
    ).get(ctx.login.id);
    const ask = !row ? null
      : row.cleared && (!row.asked || row.asked < row.cleared) ? 'cleared'
        : !row.asked ? 'first' : null;
    sendJson(res, 200, { ask });
  });

  // Skip for now, or Keep this PIN: asked, until the PIN is next cleared.
  // screens: pin-first, pin-cleared
  route('POST', '/api/your-settings/till-pin/ask', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    if (!(await ownAccountHere(req, ctx))) return sendJson(res, 403, NOT_YOURS_HERE);
    await prepare('UPDATE logins SET till_pin_asked_at = now() WHERE id = ?').run(ctx.login.id);
    sendJson(res, 200, { ask: null });
  });

  // "Your new till PIN": four digits nobody else has, shown once; each call
  // replaces the last ("Give me a different one"). Kept only hashed.
  // screens: pin-change, pin-first
  route('POST', '/api/your-settings/till-pin/offer', async (req, res, params, query, afterRelease, shopId) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    if (!(await ownAccountHere(req, ctx))) return sendJson(res, 403, NOT_YOURS_HERE);
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
    if (!(await ownAccountHere(req, ctx))) return sendJson(res, 403, NOT_YOURS_HERE);
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
    const cleared = await prepare('UPDATE employees SET pin_hash = NULL, pin_offer_hash = NULL, pin_offer_at = NULL, pin_cleared_at = now(), updated_at = now() WHERE id = ? RETURNING id').get(id);
    if (!cleared) return notFound(res, 'Team member not found');
    // Whoever forgot it is no longer serving on any till today.
    await prepare('UPDATE pin_checkins SET ended_at = now() WHERE employee_id = ? AND ended_at IS NULL').run(id);
    sendJson(res, 200, { ok: true });
  });

  // Who is serving on this browser, who has checked in on this till today
  // (till-checkin), which till this browser is (till-setup), and who the
  // Owner serving here can give a PIN to.
  // screens: till-checkin, till-serving-menu, till-serving-menu-several
  route('GET', '/api/till-checkin', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const mine = await currentCheckin(req);
    const { till, workshop } = await thisComputer(req);
    // A till's or a workshop computer's cookie is renewed each time it's
    // read, so one in use never loses it (review, 28 Oct).
    if (till) res.setHeader('Set-Cookie', tillCookie(req, tillCookieToken(req)));
    if (workshop) res.setHeader('Set-Cookie', workshopCookie(req, workshopCookieToken(req)));
    const people = await prepare(
      `SELECT DISTINCT e.id, e.name FROM pin_checkins c JOIN employees e ON e.id = c.employee_id
        WHERE c.day = ? AND c.till_id IS NOT DISTINCT FROM ?::int AND c.workshop_computer_id IS NOT DISTINCT FROM ?::int AND e.active = 1 ORDER BY e.name, e.id`
    ).all(await today(), till?.id ?? null, workshop?.id ?? null);
    // Only for the Owner serving at a till: who has no PIN (till-serving-menu).
    // Giving a PIN is the till's, never a workshop computer's.
    const giver = mine && !workshop ? await giverHere(req) : null;
    // The shop's time, for the screen, and with trust PIN on the names to
    // tap on a workshop computer (trust-pin-workshop).
    const trust = await trustPinHere();
    sendJson(res, 200, {
      // The Owner working here goes back sooner (design 8), so the screen does too.
      idleMinutes: workshop && mine && (await isTheOwner(mine)) ? ownerIdleMinutes(trust.idleMinutes) : trust.idleMinutes,
      trustPin: trust.trustPin,
      names: (till || workshop) && trust.trustPin ? await tapNames({ till, workshop }, ctx.login.id, await today()) : [],
      serving: mine ? { id: mine.employee_id, name: mine.name } : null,
      till: till ? { code: till.code, name: till.name, siteName: till.site_name } : null,
      workshop: workshop ? { name: workshop.name, siteName: workshop.site_name } : null,
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
    // On this browser's till or workshop computer, if it is one (till-setup
    // design 3; workshop-computer), last used now.
    const { till, workshop } = await thisComputer(req);
    await prepare('INSERT INTO pin_checkins (employee_id, login_id, token_hash, day, till_id, workshop_computer_id, last_active_at) VALUES (?, ?, ?, ?, ?, ?, now())')
      .run(who.id, ctx.login.id, hashLinkCode(token), await today(), till?.id ?? null, workshop?.id ?? null);
    // The server ends it with the shop's day; the cookie lasts no longer than a day.
    res.setHeader('Set-Cookie', checkinCookie(req, token, 24 * 60 * 60));
    sendJson(res, 201, { serving: { id: who.id, name: who.name } });
  });

  // "Who’s working?" (till-checkin-workshop-names; roles and switches 3): with
  // trust PIN on, someone who typed their PIN on this workshop computer today
  // taps their name instead. The shop's row and the person's are locked
  // until the check-in is recorded, so trust PIN switched off or a PIN
  // cleared at that moment can't slip in between (trust-pin-workshop).
  // screens: till-checkin-workshop-names
  route('POST', '/api/till-checkin/tap', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const body = await readJsonBody(req);
    const id = body?.employeeId;
    if (!Number.isInteger(id) || id <= 0) return sendJson(res, 400, { error: 'Choose a name', code: 'not_a_name' });
    // A till's or a workshop computer's own (serving-pills); never a browser that is neither.
    const { till, workshop } = await thisComputer(req);
    if (!till && !workshop) return sendJson(res, 403, { error: 'Tapping a name is only on a till or a workshop computer', code: 'not_shared_computer' });
    const day = await today();
    const token = newLinkCode();
    let refusal = null;
    let who = null;
    await dbExec('BEGIN');
    try {
      const shop = await prepare("SELECT trust_pin FROM shops WHERE id = current_setting('app.current_shop_id')::int FOR SHARE").get();
      await prepare('SELECT id FROM employees WHERE id = ? FOR UPDATE').get(id);
      if (shop?.trust_pin !== true) refusal = { error: 'Trust PIN is off: enter your PIN', code: 'trust_pin_off' };
      else [who] = await tapNames({ till, workshop }, ctx.login.id, day, id);
      if (!refusal && !who) refusal = { error: 'Enter your PIN: you haven’t typed it on this computer today', code: 'not_typed_here' };
      if (refusal) {
        await dbExec('ROLLBACK');
      } else {
        // Taking over: whoever was checked in on this browser stops, as with a PIN.
        const previous = parseCookies(req)[CHECKIN_COOKIE];
        if (previous && /^[0-9a-f]{64}$/.test(previous)) {
          await prepare('UPDATE pin_checkins SET ended_at = now() WHERE token_hash = ? AND ended_at IS NULL').run(hashLinkCode(previous));
        }
        await prepare('INSERT INTO pin_checkins (employee_id, login_id, token_hash, day, till_id, workshop_computer_id, last_active_at, by_tap) VALUES (?, ?, ?, ?, ?, ?, now(), true)')
          .run(who.id, ctx.login.id, hashLinkCode(token), day, till?.id ?? null, workshop?.id ?? null);
        await dbExec('COMMIT');
      }
    } catch (err) {
      await dbExec('ROLLBACK').catch(() => {});
      throw err;
    }
    if (refusal) return sendJson(res, 403, refusal);
    res.setHeader('Set-Cookie', checkinCookie(req, token, 24 * 60 * 60));
    sendJson(res, 201, { serving: { id: who.id, name: who.name } });
  });

  // Someone is using the workshop computer (a press, a click, a key): their
  // check-in's 10 minutes start again, while it still counts. Reading the
  // check-in never does this (workshop-computer design 2). Elsewhere it
  // changes nothing.
  // screens: till-checkin-workshop
  route('POST', '/api/till-checkin/active', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const mine = await currentCheckin(req);
    if (mine?.workshop_computer_id) await prepare('UPDATE pin_checkins SET last_active_at = now() WHERE id = ? AND ended_at IS NULL').run(mine.id);
    sendJson(res, 200, { serving: mine ? { id: mine.employee_id, name: mine.name } : null });
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
    const found = (await pinTarget(giver, id)) ?? (await keepPin(id, body?.pin, { firstOnly: true }));
    // "Your PIN…" is Your settings' words; at the till it stays "Ask for a new PIN".
    const refused = found?.[1] === REPLACED ? [400, NO_OFFER] : found;
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
