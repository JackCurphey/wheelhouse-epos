// screens: cw-settings, cw-settings-deposit, cw-settings-provider
// Cycle to Work settings and scheme providers (openspec/changes/cycle-to-work,
// design 2 and 7; migration 137). Anyone signed in reads them, because a new
// order needs the hold days and the providers to pick from; only the Owner
// changes them, until roles are built. Staff routes: a handler gets
// (req, res, params, query, afterRelease, shopId) with the shop's row-level
// security already bound.
//
// Commission is a cost: someone who can't see costs and margin is never sent it
// (canSeeCosts). A provider is retired, never deleted, so orders keep theirs.
import { ownerOnly } from '../lib/owner-only.js';
import { canSeeCosts } from '../lib/can-see-costs.js';
import { dbExec, prepare } from '../db.js';
import { badRequest, notFound, readJsonBody, sendJson, ValidationError } from '../lib/http.js';

const db = { prepare, exec: dbExec };

// Amounts are pence for 'pounds' and hundredths of a percent for 'percent'.
const PERCENT_MAX = 10000;

function serializeSettings(r) {
  return {
    holdDays: r.hold_days, remindDays: r.remind_days, quoteValidDays: r.quote_valid_days, orderRule: r.order_rule,
    depositKind: r.deposit_kind, depositValue: r.deposit_value, depositOnCertificate: r.deposit_on_certificate,
    depositOnPullOut: r.deposit_on_pull_out, howToApply: r.how_to_apply, todayLines: r.today_lines,
  };
}
// The shop's row, made on first read.
async function loadSettings(lock = false) {
  // RETURNING its own key: this table has no id for db.js to return.
  await db.prepare('INSERT INTO c2w_settings DEFAULT VALUES ON CONFLICT (shop_id) DO NOTHING RETURNING shop_id').run();
  return db.prepare(`SELECT * FROM c2w_settings${lock ? ' FOR UPDATE' : ''}`).get();
}

function serializeProvider(r, costs) {
  const p = {
    id: r.id, name: r.name, paysInDays: r.pays_in_days, accessoriesInside: r.accessories_inside,
    handoverNote: r.handover_note, handoverChecks: r.handover_note.split('\n').map((l) => l.trim()).filter(Boolean),
    retiredAt: r.retired_at ? r.retired_at.toISOString() : null,
  };
  if (costs) Object.assign(p, { commissionKind: r.commission_kind, commissionValue: r.commission_value });
  return p;
}

// Each reader takes the body's field if sent: undefined means "keep".
function days(v, label, min) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (!Number.isInteger(v) || v < min || v > 365) throw new ValidationError(`${label} is a whole number of days, ${min} to 365`);
  return v;
}
function oneOf(v, label, options) {
  if (v === undefined) return undefined;
  if (!options.includes(v)) throw new ValidationError(`Choose ${label}`);
  return v;
}
function words(v, label, max, { required = false } = {}) {
  if (v === undefined) return undefined;
  if (typeof v !== 'string') throw new ValidationError(`${label} is words`);
  const s = required ? v.trim() : v;
  if (required && !s) throw new ValidationError(`${label} is needed`);
  if (s.length > max) throw new ValidationError(`${label} is up to ${max} characters`);
  return s;
}
function yesNo(v, label) {
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') throw new ValidationError(`${label} is yes or no`);
  return v;
}
function amount(v, kind, label) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (!Number.isInteger(v) || v < 0) throw new ValidationError(`${label} is a whole number, 0 or more`);
  if (kind === 'percent' && v > PERCENT_MAX) throw new ValidationError(`${label} is at most 100%`);
  return v;
}
// Writes the fields that were sent; the rest stay as they are.
function changes(fields) {
  const sent = Object.entries(fields).filter(([, v]) => v !== undefined);
  return { sql: sent.map(([k]) => `${k} = ?`).join(', '), values: sent.map(([, v]) => v) };
}

class Refused extends Error {
  constructor(status, body) { super(body.error); this.status = status; this.body = body; }
}
// BEGIN, the change, COMMIT; a refusal rolls back.
async function save(res, status, change) {
  let reply;
  await db.exec('BEGIN');
  try {
    reply = await change();
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK').catch(() => {});
    if (err instanceof ValidationError) return badRequest(res, err.message);
    if (err instanceof Refused) return sendJson(res, err.status, err.body);
    throw err;
  }
  sendJson(res, status, reply);
}

function readProvider(body, current) {
  const kind = oneOf(body.commissionKind, 'how the commission is counted', ['percent', 'pounds']);
  const value = amount(body.commissionValue, kind ?? current?.commission_kind ?? 'percent', 'Commission');
  // Switching between % and £ without a new amount would read the old number in the new unit.
  if (current && kind !== undefined && kind !== current.commission_kind && value === undefined) {
    throw new ValidationError('Give the commission in its new unit');
  }
  return {
    name: words(body.name, 'The name', 60, { required: true }),
    commission_kind: kind,
    commission_value: value,
    pays_in_days: days(body.paysInDays, 'Pays in about', 0),
    accessories_inside: yesNo(body.accessoriesInside, 'Accessories inside what the provider pays'),
    handover_note: words(body.handoverNote, 'Checks at hand-over', 2000),
  };
}

export function register(route) {
  route('GET', '/api/c2w/settings', async (req, res) => {
    sendJson(res, 200, { settings: serializeSettings(await loadSettings()) });
  });

  route('PUT', '/api/c2w/settings', async (req, res) => {
    if (await ownerOnly(req, res)) return;
    const body = await readJsonBody(req);
    await save(res, 200, async () => {
      const current = await loadSettings(true);
      const depositKind = oneOf(body.depositKind, 'how the deposit is counted', ['pounds', 'percent']);
      if (depositKind !== undefined && depositKind !== current.deposit_kind && body.depositValue === undefined && current.deposit_value !== null) {
        throw new ValidationError('Give the deposit in its new unit');
      }
      const fields = {
        hold_days: days(body.holdDays, 'The hold', 1),
        remind_days: days(body.remindDays, 'The reminder', 0),
        quote_valid_days: days(body.quoteValidDays, 'How long a quote is valid', 1),
        order_rule: oneOf(body.orderRule, 'when a bike that isn’t in stock is ordered', ['certificate', 'applied', 'deposit']),
        deposit_kind: depositKind,
        deposit_value: amount(body.depositValue, depositKind ?? current.deposit_kind, 'The deposit'),
        deposit_on_certificate: oneOf(body.depositOnCertificate, 'what happens to the deposit when the certificate arrives', ['refund', 'count']),
        deposit_on_pull_out: oneOf(body.depositOnPullOut, 'what happens to the deposit if the customer pulls out', ['refund', 'keep']),
        how_to_apply: words(body.howToApply, 'How to apply', 2000),
        today_lines: yesNo(body.todayLines, 'On Today'),
      };
      // Until the till can take a deposit against an order, "Straight away,
      // with a deposit" stays off (default taken 12 Nov,
      // docs/decisions/2026-11-12-cycle-to-work-defaults-taken.md, item 1).
      if (fields.order_rule === 'deposit') {
        throw new Refused(400, { error: 'Ordering straight away with a deposit isn’t ready yet: the till can’t take a deposit for an order', code: 'deposit_not_ready' });
      }
      const { sql, values } = changes(fields);
      const row = sql ? await db.prepare(`UPDATE c2w_settings SET ${sql} RETURNING *`).get(...values) : current;
      return { settings: serializeSettings(row) };
    });
  });

  // The providers to pick from; ?retired=1 lists retired ones too, for Settings.
  route('GET', '/api/c2w/providers', async (req, res, params, query) => {
    const costs = await canSeeCosts(req);
    const all = query.get('retired') === '1';
    const rows = await db.prepare(`SELECT * FROM c2w_providers${all ? '' : ' WHERE retired_at IS NULL'} ORDER BY retired_at NULLS FIRST, id`).all();
    sendJson(res, 200, { providers: rows.map((r) => serializeProvider(r, costs)) });
  });

  route('POST', '/api/c2w/providers', async (req, res) => {
    if (await ownerOnly(req, res)) return;
    const body = await readJsonBody(req);
    const costs = await canSeeCosts(req);
    await save(res, 201, async () => {
      const f = readProvider(body, null);
      if (f.name === undefined) throw new ValidationError('The name is needed');
      const row = await db.prepare(`INSERT INTO c2w_providers (name, commission_kind, commission_value, pays_in_days, accessories_inside, handover_note)
        VALUES (?, ?, ?, ?, ?, ?) RETURNING *`).get(
        f.name, f.commission_kind ?? 'percent', f.commission_value ?? null, f.pays_in_days ?? null, f.accessories_inside ?? true, f.handover_note ?? '',
      );
      return { provider: serializeProvider(row, costs) };
    });
  });

  // New terms apply to new orders: an order copies what it needs when it's made.
  route('PUT', '/api/c2w/providers/:id', async (req, res, params) => {
    if (await ownerOnly(req, res)) return;
    const id = Number(params.id);
    const body = await readJsonBody(req);
    const costs = await canSeeCosts(req);
    await save(res, 200, async () => {
      const current = Number.isInteger(id) ? await db.prepare('SELECT * FROM c2w_providers WHERE id = ? FOR UPDATE').get(id) : null;
      if (!current) throw new Refused(404, { error: 'Not found' });
      if (current.retired_at) throw new Refused(409, { error: 'This provider is retired', code: 'retired' });
      const { sql, values } = changes(readProvider(body, current));
      const row = sql ? await db.prepare(`UPDATE c2w_providers SET ${sql} WHERE id = ? RETURNING *`).get(...values, id) : current;
      return { provider: serializeProvider(row, costs) };
    });
  });

  route('POST', '/api/c2w/providers/:id/retire', async (req, res, params) => {
    if (await ownerOnly(req, res)) return;
    const id = Number(params.id);
    const costs = await canSeeCosts(req);
    if (!Number.isInteger(id)) return notFound(res);
    const row = await db.prepare('UPDATE c2w_providers SET retired_at = COALESCE(retired_at, now()) WHERE id = ? RETURNING *').get(id);
    if (!row) return notFound(res);
    sendJson(res, 200, { provider: serializeProvider(row, costs) });
  });
}
