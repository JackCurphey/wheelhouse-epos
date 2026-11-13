// Sending each closed day to the accounts software (reports-accounts-and-reopen design 5 to 7). A day is sent
// straight after its close is saved (or a reopened day's new close), as one summary: balanced, from the close's own
// sales, to the account chosen for each line, kept exactly as sent. It goes once: a day already sent is never sent
// again, except a reopened day closed again, which REPLACES its summary so the service never holds both. A day that
// can't go is still closed, and says why: a line with no account chosen (the day fails, with that line), a summary
// that doesn't balance, a service that didn't take it, or a connection that is disconnected or lost (the day waits).
// Choosing the missing account, or reconnecting, sends the days that waited or failed, oldest first, one at a time.
import { prepare } from '../db.js';
import { accounts, providerName } from './index.js';
import { buildSummary } from './summary.js';
import { ConnectionLost } from './errors.js';

const pounds = (p) => `£${(p / 100).toFixed(2)}`;
const connection = () => prepare('SELECT provider, status FROM accounts_connections').get();

async function save(day, closeId, fields) {
  const f = { reason: null, failed_line: null, amount_pence: null, summary: null, not_recorded: [], ...fields };
  await prepare(
    `INSERT INTO accounts_sends (day, close_id, status, reason, failed_line, amount_pence, summary, not_recorded, external_id, provider, version, sent_at, updated_at)
     VALUES (?::date, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, COALESCE(?, 0), ?, now())
     ON CONFLICT (shop_id, day) DO UPDATE SET close_id = EXCLUDED.close_id, status = EXCLUDED.status, reason = EXCLUDED.reason, failed_line = EXCLUDED.failed_line,
       amount_pence = EXCLUDED.amount_pence, summary = COALESCE(EXCLUDED.summary, accounts_sends.summary), not_recorded = EXCLUDED.not_recorded,
       external_id = COALESCE(EXCLUDED.external_id, accounts_sends.external_id), provider = COALESCE(EXCLUDED.provider, accounts_sends.provider), version = CASE WHEN ?::int IS NULL THEN accounts_sends.version ELSE ?::int END,
       sent_at = COALESCE(EXCLUDED.sent_at, accounts_sends.sent_at), updated_at = now()`
  ).run(day, closeId, f.status, f.reason, f.failed_line, f.amount_pence, f.summary ? JSON.stringify(f.summary) : null, f.not_recorded, f.external_id ?? null, f.provider ?? null, f.version ?? null, f.sent_at ?? null, f.version ?? null, f.version ?? null);
  return prepare('SELECT * FROM accounts_sends WHERE day = ?::date').get(day);
}

/**
 * Send (or, for a reopened day closed again, replace) one closed day's summary. Returns the day's send row, or null
 * when nothing is sent: no connection, or the close is reopened (nothing is sent while a day is reopened).
 */
const inFlight = new Set();
export async function sendClosedDay(closeId, options = {}) {
  // One send of a day at a time in this server, so two quick requests never post the same day twice.
  if (inFlight.has(closeId)) return null;
  inFlight.add(closeId);
  try { return await sendOne(closeId, options); } finally { inFlight.delete(closeId); }
}

async function sendOne(closeId, { replace = false } = {}) {
  const conn = await connection();
  if (!conn) return null;
  const close = await prepare("SELECT to_char(day, 'YYYY-MM-DD') AS day, reopened_at FROM day_closes WHERE id = ?").get(closeId);
  if (!close || close.reopened_at) return null;
  const existing = await prepare('SELECT * FROM accounts_sends WHERE day = ?::date').get(close.day);
  if (existing?.status === 'sent' && !replace) return existing; // a day is never sent twice
  if (conn.status !== 'connected') return save(close.day, closeId, { status: 'waiting' });

  const name = providerName(conn.provider);
  const summary = await buildSummary(closeId);
  const base = { amount_pence: summary.totalPence, not_recorded: summary.notRecorded };
  if (!summary.balanced) return save(close.day, closeId, { ...base, status: 'failed', reason: `The day’s lines don’t add up: money taken ${pounds(summary.totalPence)}, sales and VAT ${pounds(summary.totalPence - summary.imbalancePence)}` });
  const chosen = new Map((await prepare('SELECT line_key, account_id, account_name FROM accounts_choices WHERE provider = ?').all(conn.provider)).map((r) => [r.line_key, r]));
  const missing = summary.lines.find((l) => !chosen.has(l.key));
  if (missing) return save(close.day, closeId, { ...base, status: 'failed', reason: `${missing.label} has no ${name} account chosen`, failed_line: missing.key });

  const payload = {
    day: close.day, totalPence: summary.totalPence, balanced: true, notRecorded: summary.notRecorded,
    lines: summary.lines.map((l) => ({ ...l, accountId: chosen.get(l.key).account_id, accountName: chosen.get(l.key).account_name })),
  };
  const service = accounts();
  // A day sent before is corrected in place; one never sent (or waiting) is posted.
  const corrected = Boolean(existing?.external_id) && existing.provider === conn.provider;
  try {
    const sent = corrected ? await service.replaceSummary(conn.provider, existing.external_id, payload) : await service.postSummary(conn.provider, close.day, payload);
    return save(close.day, closeId, { ...base, status: 'sent', summary: payload, external_id: sent.externalId, version: corrected ? existing.version + 1 : 1, sent_at: new Date().toISOString(), provider: conn.provider });
  } catch (err) {
    if (err instanceof ConnectionLost) {
      await prepare("UPDATE accounts_connections SET status = 'lost', disconnected_at = now()").run();
      return save(close.day, closeId, { ...base, status: 'waiting' });
    }
    // Another send for the same day may have got there first (the day is unique): a sent day never turns into a failure.
    const now = await prepare('SELECT * FROM accounts_sends WHERE day = ?::date').get(close.day);
    if (now?.status === 'sent' && !replace) return now;
    return save(close.day, closeId, { ...base, status: 'failed', reason: `${name} didn’t take it. It will be tried again when you choose an account or reconnect.` });
  }
}

/** The days that waited or failed, oldest first, one at a time (after a reconnect, or an account chosen). */
export async function sendWaitingDays() {
  const rows = await prepare("SELECT close_id FROM accounts_sends WHERE status IN ('waiting', 'failed') AND close_id IS NOT NULL ORDER BY day").all();
  for (const r of rows) await afterClose(r.close_id); // one day's trouble never stops the next, nor undoes what was just saved
}

/** After a close is saved: a failure here must never undo the close, so it is logged and the day shows as not sent. */
export async function afterClose(closeId, options) {
  try {
    await sendClosedDay(closeId, options);
  } catch (err) {
    console.error('accounts: could not send the day', err);
  }
}
