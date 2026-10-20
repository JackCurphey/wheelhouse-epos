// The messages engine (Jack, 20 Oct, docs/decisions/2026-10-20-messages-engine.md;
// openspec/changes/messages-engine/design.md). A message is queued for a
// customer, filled in from Wheelhouse's or the shop's wording, and waits for
// its send time (the Undo minute for staff-triggered messages); the server's
// timer then sends it through the channel's sender — pretend for every channel
// for now, so it lands in the outbox and nothing leaves the server.
//
// send_after is an instant, so it uses the plain system time (as clock.js
// says of instants), set and compared from here, never Postgres now().
import { pool, prepare, runWithShop } from '../db.js';
import { TEMPLATES, render, templateFor } from './templates.js';
import { senderFor } from './senders/index.js';

/** The Undo minute for messages staff trigger (drawn: "in 1 minute"); shorter in tests. */
export const UNDO_MS = Number(process.env.WH_MESSAGES_DELAY_MS ?? 60_000);
// A send that never finished (the server stopped mid-send) is moved to
// unknown after this, and never sent again automatically.
const STUCK_MS = 5 * 60_000;

/** How to reach a customer: their chosen way, else text, else email; null with neither. */
export function channelFor(c) {
  const by = { sms: c.phone, whatsapp: c.phone, email: c.email };
  if (c.update_channel && by[c.update_channel]) return { channel: c.update_channel, to: by[c.update_channel] };
  if (c.phone) return { channel: 'sms', to: c.phone };
  if (c.email) return { channel: 'email', to: c.email };
  return null;
}

/**
 * Queues one message for a customer, inside the shop's runWithShop. Returns
 * the queued message, or { skipped: 'off' | 'no_contact' }.
 */
export async function queueMessage({ customerId, jobId = null, key, vars, delayMs = 0, loginId = null }) {
  const template = await templateFor(key);
  if (!template.enabled) return { skipped: 'off' };
  const c = await prepare('SELECT phone, email, update_channel FROM customers WHERE id = ?').get(customerId);
  const how = c && channelFor(c);
  if (!how) return { skipped: 'no_contact' };
  const body = render(template.wording, vars);
  const subject = how.channel === 'email' ? render(template.subject, vars) : null;
  const sendAfter = new Date(Date.now() + delayMs).toISOString();
  const row = await prepare(
    `INSERT INTO customer_messages (customer_id, job_id, body, status, intent_state, channel, template_key, subject, to_address, send_after, sent_by_login_id)
     VALUES (?, ?, ?, 'queued', 'intended', ?, ?, ?, ?, ?, ?) RETURNING id`
  ).get(customerId, jobId, body, how.channel, key, subject, how.to, sendAfter, loginId);
  return { id: row.id, channel: how.channel, to: how.to, sendAfter };
}

/** Undo: only while it's still waiting. Returns true, or false when it's already gone. */
export async function undoMessage(id) {
  const row = await prepare(
    `UPDATE customer_messages SET intent_state = 'undone', status = 'undone'
     WHERE id = ? AND intent_state = 'intended' AND send_after IS NOT NULL AND send_after > ? RETURNING id`
  ).get(id, new Date().toISOString());
  return Boolean(row);
}

/**
 * One run of the timer: for each shop, claims its due messages in one
 * statement (so two runs can't claim the same one), sends each outside any
 * shop scope, then records what happened. Rows with no send_after (written
 * before the engine) are never claimed.
 */
export async function sendDue() {
  const { rows: shops } = await pool.query('SELECT id FROM shops');
  for (const { id: shopId } of shops) {
    const now = new Date();
    const due = await runWithShop(shopId, async () => {
      await prepare(
        `UPDATE customer_messages SET intent_state = 'unknown', status = 'unknown'
         WHERE intent_state = 'sending' AND send_after < ?`
      ).run(new Date(now.getTime() - STUCK_MS).toISOString());
      return prepare(
        `UPDATE customer_messages SET intent_state = 'sending'
         WHERE intent_state = 'intended' AND send_after IS NOT NULL AND send_after <= ?
         RETURNING id, channel, to_address, subject, body`
      ).all(now.toISOString());
    });
    for (const m of due) {
      let result;
      try {
        result = await senderFor(m.channel).send({ channel: m.channel, to: m.to_address, subject: m.subject, body: m.body });
      } catch (err) {
        result = { ok: false, error: err.message };
      }
      await runWithShop(shopId, () => prepare(
        `UPDATE customer_messages SET intent_state = ?, status = ?, sent_at = ?, provider_sid = ?, pretend = ?, error = ?
         WHERE id = ? AND intent_state = 'sending'`
      ).run(result.ok ? 'delivered' : 'failed', result.ok ? 'sent' : 'failed', result.ok ? new Date().toISOString() : null,
        result.providerId ?? null, Boolean(result.pretend), result.ok ? null : result.error ?? 'Not sent', m.id));
    }
  }
}

/** Starts the timer; returns stop(). One run at a time. */
export function startSender(intervalMs = Number(process.env.WH_MESSAGES_TICK_MS ?? 5000)) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await sendDue();
    } catch (err) {
      console.error('Messages: sending failed this round', err);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

/** A message as the outbox shows it. */
export function serializeMessage(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    jobId: row.job_id ?? null,
    key: row.template_key ?? null,
    name: TEMPLATES[row.template_key]?.name ?? 'Message',
    channel: row.channel ?? 'sms',
    to: row.to_address ?? null,
    subject: row.subject ?? null,
    body: row.body,
    state: row.intent_state,
    pretend: row.pretend,
    sendAfter: row.send_after ?? null,
    sentAt: row.sent_at ?? null,
    error: row.error ?? null,
    createdAt: row.created_at,
  };
}
