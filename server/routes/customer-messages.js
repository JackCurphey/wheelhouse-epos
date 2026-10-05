// Customer messages (SMS) sent from the staff app.
// Staff routes: they run under the dispatcher's /api/ branch (server.js), so
// a handler gets (req, res, params, query, afterRelease, shopId) with the
// shop's row-level security already bound, and needs a staff session.
// Moved out of server.js unchanged (split plan §4.1, WP-0.4).
import { dbExec, prepare } from '../db.js';
import { badRequest, notFound, readJsonBody, sendJson } from '../lib/http.js';
import { currentSession } from '../lib/session.js';
import { sendSms } from '../sms.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

// One-off texts sent to a customer via Twilio (see sms.js). A failed send
// still gets a history row (status: 'failed') rather than being dropped, so
// staff can see what was actually attempted.

function serializeCustomerMessage(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    direction: row.direction,
    body: row.body,
    status: row.status,
    error: row.error,
    sentByName: row.sent_by_name,
    createdAt: row.created_at,
  };
}

const MESSAGE_SELECT = `SELECT m.*, l.name AS sent_by_name FROM customer_messages m LEFT JOIN logins l ON l.id = m.sent_by_login_id`;

export function register(route) {
  route('GET', '/api/customers/:id/texts', async (req, res, params) => {
    const customerId = Number(params.id);
    const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!customer) return notFound(res, 'Customer not found');
    const rows = await db.prepare(MESSAGE_SELECT + ' WHERE m.customer_id = ? ORDER BY m.id DESC').all(customerId);
    sendJson(res, 200, rows.map(serializeCustomerMessage));
  });

  route('POST', '/api/customers/:id/texts', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const customerId = Number(params.id);
    const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!customer) return notFound(res, 'Customer not found');
    if (!customer.phone) return badRequest(res, 'This customer has no phone number on file');
    const body = await readJsonBody(req);
    const text = String(body.body || '').trim();
    if (!text) return badRequest(res, 'Message text is required');
    if (text.length > 1600) return badRequest(res, 'Message is too long');

    const result = await sendSms(customer.phone, text);
    const info = await db
      .prepare(
        `INSERT INTO customer_messages (customer_id, body, status, error, provider_sid, sent_by_login_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(customerId, text, result.ok ? 'sent' : 'failed', result.ok ? null : result.error, result.ok ? result.sid : null, ctx.login.id);
    const row = await db.prepare(MESSAGE_SELECT + ' WHERE m.id = ?').get(info.lastInsertRowid);
    // Always 201: the request itself succeeded (an attempt was made and
    // recorded) even when the send didn't - the frontend reads row.status to
    // show the outcome, rather than this route throwing on a Twilio failure.
    sendJson(res, 201, serializeCustomerMessage(row));
  });
}
