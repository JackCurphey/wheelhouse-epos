// The outbox and Undo (the messages engine, Jack 20 Oct: pretend for now;
// openspec/changes/messages-engine/design.md). Staff routes: the dispatcher
// binds the shop's row-level security; each needs a staff session.
import { prepare } from '../db.js';
import { badRequest, sendJson } from '../lib/http.js';
import { currentSession } from '../lib/session.js';
import { MAX_SERIAL } from '../lib/uploads.js';
import { serializeMessage, undoMessage } from '../messaging/engine.js';

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
}
