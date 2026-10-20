// The outbox and Undo, and Settings › Messages (the messages engine, Jack
// 20 Oct: pretend for now; openspec/changes/messages-engine/design.md;
// drawings set-msg-list, set-msg-edit). Staff routes: the dispatcher binds
// the shop's row-level security; each needs a staff session, and changing a
// message is for the Owner, as Settings are.
import { prepare } from '../db.js';
import { badRequest, notFound, readJsonBody, sendJson, nowIso } from '../lib/http.js';
import { currentSession } from '../lib/session.js';
import { ownerOnly } from '../lib/owner-only.js';
import { MAX_SERIAL } from '../lib/uploads.js';
import { serializeMessage, undoMessage } from '../messaging/engine.js';
import { LIVE_KEYS, TEMPLATES, render, templateFor } from '../messaging/templates.js';

const MAX_WORDING = 2000;
const MAX_SUBJECT = 200;

// The preview's example, from the drawings (set-msg-edit, bk-msg-*): Maya
// Patel's Trek Domane AL 3, job WH-1042; links and anything the drawings leave
// open stay as their bracketed placeholders. The shop's own name is used.
const EXAMPLE = {
  'Customer’s first name': 'Maya',
  Bike: 'Trek Domane AL 3',
  'Job number': 'WH-1042',
  'Amount to pay': '£111.00',
  'Link to the quote': '[link]',
  'Link to the job': '[link]',
  'Link to the booking': '[link]',
  'Opening hours': '[opening hours]',
  Service: 'Standard service',
  'Booked day and time': 'Thu 17 Sep, 11:30',
  'When to drop off': 'Drop your Trek Domane AL 3 off by 11:00, half an hour before your booking.',
  'Your note on the confirmation': 'Please bring the lock key, and tell us about any accessories.',
  'Suggested day and time': 'Sat 19 Sep, [time]',
  'The shop’s message': '[The shop’s message]',
  'New day and time': 'Fri 25 Sep, [time]',
};
// Where a message's drawing fills a tap-in differently (bk-msg-change: the
// new day's drop-off time is open).
const EXAMPLE_FOR = {
  date_change_answered: { 'When to drop off': 'Drop your Trek Domane AL 3 off by [time], half an hour before your booking.' },
};

const asSetting = (t) => ({
  key: t.key, name: t.name, when: t.when, enabled: t.enabled, wording: t.wording, subject: t.subject,
  changed: t.changed, tapIns: t.tapIns, live: LIVE_KEYS.includes(t.key), group: t.group ?? null,
});

// A shop's own text, or null for Wheelhouse's: blank goes back to Wheelhouse's.
function ownText(value, max, name, { oneLine = false } = {}) {
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error(`${name} must be text`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${name} can be at most ${max} characters`);
  // An email subject is one line: a line break could add headers.
  if (oneLine && /[\r\n]/.test(text)) throw new Error(`${name} must be one line`);
  return text || null;
}
const isObject = (body) => body !== null && typeof body === 'object' && !Array.isArray(body);

export function register(route) {
  // screens: customer, diary
  route('GET', '/api/messages', async (req, res, params, query) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const where = [];
    const args = [];
    for (const [param, column] of [['customerId', 'customer_id'], ['jobId', 'job_id']]) {
      const value = query.get(param);
      if (value === null) continue;
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > MAX_SERIAL) return badRequest(res, `${param} must be a whole number`);
      where.push(`${column} = ?`);
      args.push(Number(value));
    }
    const limit = Math.max(1, Math.min(Math.trunc(Number(query.get('limit'))) || 50, 200));
    const rows = await prepare(
      `SELECT * FROM customer_messages ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ${limit}`
    ).all(...args);
    sendJson(res, 200, rows.map(serializeMessage));
  });

  // Undo a message within its minute.
  // screens: diary
  route('POST', '/api/messages/:id/undo', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const id = Number(params.id);
    if (!(await undoMessage(id))) return sendJson(res, 409, { error: 'It’s already gone', code: 'illegal' });
    const row = await prepare('SELECT * FROM customer_messages WHERE id = ?').get(id);
    sendJson(res, 200, serializeMessage(row));
  });

  // Settings › Messages: every message, with this shop's wording.
  // screens: settings
  route('GET', '/api/message-templates', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const list = [];
    for (const key of Object.keys(TEMPLATES)) list.push(asSetting(await templateFor(key)));
    sendJson(res, 200, list);
  });

  // Change a message: { enabled?, wording?, subject? }; null or blank wording
  // or subject goes back to Wheelhouse's.
  // screens: settings
  route('PUT', '/api/message-templates/:key', async (req, res, params) => {
    if (await ownerOnly(req, res)) return;
    if (!Object.hasOwn(TEMPLATES, params.key)) return notFound(res, 'No such message');
    const body = await readJsonBody(req);
    if (!isObject(body)) return badRequest(res, 'Send the changes as an object');
    // Only what was sent changes, in one statement, so two changes at once
    // can't undo each other.
    const sent = {};
    try {
      if (body.enabled !== undefined) {
        if (typeof body.enabled !== 'boolean') throw new Error('enabled must be true or false');
        sent.enabled = body.enabled;
      }
      if (body.wording !== undefined) sent.wording = ownText(body.wording, MAX_WORDING, 'wording');
      if (body.subject !== undefined) sent.subject = ownText(body.subject, MAX_SUBJECT, 'subject', { oneLine: true });
    } catch (err) {
      return badRequest(res, err.message);
    }
    const set = [...Object.keys(sent).map((c) => `${c} = EXCLUDED.${c}`), 'updated_at = EXCLUDED.updated_at'];
    await prepare(
      `INSERT INTO message_templates (key, enabled, wording, subject, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (shop_id, key) DO UPDATE SET ${set.join(', ')}`
    ).run(params.key, sent.enabled ?? true, sent.wording ?? null, sent.subject ?? null, nowIso());
    sendJson(res, 200, asSetting(await templateFor(params.key)));
  });

  // The preview: the wording being typed (or the shop's own) filled in with
  // the drawings' example, as a text and as an email.
  // screens: settings
  route('POST', '/api/message-templates/:key/preview', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    if (!Object.hasOwn(TEMPLATES, params.key)) return notFound(res, 'No such message');
    const body = await readJsonBody(req);
    if (!isObject(body)) return badRequest(res, 'Send the wording as an object');
    const saved = await templateFor(params.key);
    let wording;
    let subject;
    try {
      wording = body.wording === undefined ? saved.wording : ownText(body.wording, MAX_WORDING, 'wording') ?? TEMPLATES[params.key].wording;
      subject = body.subject === undefined ? saved.subject : ownText(body.subject, MAX_SUBJECT, 'subject', { oneLine: true }) ?? TEMPLATES[params.key].subject;
    } catch (err) {
      return badRequest(res, err.message);
    }
    const vars = { ...EXAMPLE, ...EXAMPLE_FOR[params.key], 'Shop name': ctx.shop.name };
    const text = render(wording, vars);
    sendJson(res, 200, { text, email: { subject: render(subject, vars), body: text } });
  });
}
