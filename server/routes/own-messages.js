// A shop's own automatic messages in Settings › Messages
// (openspec/changes/own-messages-server design 6; set-msg-new; owner setup
// decision 14). Listing needs a staff session; adding, changing and removing
// are for the Owner, as Settings are. The dispatcher binds the shop's
// row-level security.
import { prepare } from '../db.js';
import { badRequest, notFound, readJsonBody, sendJson } from '../lib/http.js';
import { currentSession } from '../lib/session.js';
import { ownerOnly } from '../lib/owner-only.js';
import { MAX_SERIAL } from '../lib/uploads.js';

const SEND_WHEN = ['after_collected', 'before_booked', 'after_sale'];
const LIMIT = { days: 365, months: 24 };

const asJson = (m) => ({
  id: m.id, name: m.name, sendWhen: m.send_when, amount: m.amount, unit: m.unit,
  byText: m.by_text, byEmail: m.by_email, wording: m.wording, enabled: m.enabled,
});

// The message as sent, checked; throws the refusal's words.
function checked(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new Error('Send the message as an object');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw new Error('Give the message a name.');
  if (name.length > 60) throw new Error('Keep the name to 60 characters.');
  if (!SEND_WHEN.includes(body.sendWhen)) throw new Error('Choose when the message goes.');
  const unit = body.unit === 'days' ? 'days' : body.unit === 'months' ? 'months' : null;
  if (!unit) throw new Error('Choose days or months.');
  if (!Number.isInteger(body.amount) || body.amount < 1 || body.amount > LIMIT[unit]) {
    throw new Error(`Type how long as a whole number from 1 to ${LIMIT[unit]} ${unit}.`);
  }
  if (body.byText !== true && body.byEmail !== true) throw new Error('Choose text, email or both.');
  const wording = typeof body.wording === 'string' ? body.wording.trim() : '';
  if (!wording) throw new Error('Write what the message says.');
  if (wording.length > 2000) throw new Error('Keep the wording to 2,000 characters.');
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') throw new Error('enabled must be true or false');
  return { name, sendWhen: body.sendWhen, amount: body.amount, unit, byText: body.byText === true, byEmail: body.byEmail === true, wording, enabled: body.enabled };
}

const idOf = (params) => {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 && id <= MAX_SERIAL ? id : null;
};

export function register(route) {
  // screens: settings
  route('GET', '/api/own-messages', async (req, res) => {
    if (!(await currentSession(req))) return sendJson(res, 401, { error: 'Not signed in' });
    sendJson(res, 200, (await prepare('SELECT * FROM shop_messages ORDER BY id').all()).map(asJson));
  });

  // screens: settings
  route('POST', '/api/own-messages', async (req, res) => {
    if (await ownerOnly(req, res)) return;
    let m;
    try {
      m = checked(await readJsonBody(req));
    } catch (err) {
      return badRequest(res, err.message);
    }
    const row = await prepare(
      `INSERT INTO shop_messages (name, send_when, amount, unit, by_text, by_email, wording, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    ).get(m.name, m.sendWhen, m.amount, m.unit, m.byText, m.byEmail, m.wording, m.enabled ?? true);
    sendJson(res, 201, asJson(row));
  });

  // A new time, or switching back on, starts the count again (design 2), so
  // no backlog of past collections, days or sales goes at once. Leaving out
  // `enabled` keeps it as it was (review 3).
  // screens: settings
  route('PUT', '/api/own-messages/:id', async (req, res, params) => {
    if (await ownerOnly(req, res)) return;
    const id = idOf(params);
    if (!id) return notFound(res, 'No such message');
    let m;
    try {
      m = checked(await readJsonBody(req));
    } catch (err) {
      return badRequest(res, err.message);
    }
    const row = await prepare(
      `UPDATE shop_messages SET
         active_from = CASE WHEN send_when <> ? OR amount <> ? OR unit <> ? OR (NOT enabled AND ?) THEN now() ELSE active_from END,
         name = ?, send_when = ?, amount = ?, unit = ?, by_text = ?, by_email = ?, wording = ?, enabled = COALESCE(?, enabled), updated_at = now()
       WHERE id = ? RETURNING *`
    ).get(m.sendWhen, m.amount, m.unit, m.enabled === true, m.name, m.sendWhen, m.amount, m.unit, m.byText, m.byEmail, m.wording, m.enabled ?? null, id);
    if (!row) return notFound(res, 'No such message');
    sendJson(res, 200, asJson(row));
  });

  // Removing it stops any of its messages still waiting; what went stays in the outbox.
  // screens: settings
  route('DELETE', '/api/own-messages/:id', async (req, res, params) => {
    if (await ownerOnly(req, res)) return;
    const id = idOf(params);
    if (!id) return notFound(res, 'No such message');
    await prepare(
      `UPDATE customer_messages SET intent_state = 'undone', status = 'undone'
        WHERE shop_message_id = ? AND intent_state = 'intended'`
    ).run(id);
    const gone = await prepare('DELETE FROM shop_messages WHERE id = ? RETURNING id').get(id);
    if (!gone) return notFound(res, 'No such message');
    sendJson(res, 200, { ok: true });
  });
}
