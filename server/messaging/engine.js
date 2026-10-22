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
 * Why a message wouldn't be queued for this customer ('off' or 'no_contact'),
 * or null when it would: checked first by a trigger that must do something
 * only for a message that goes (a new link). Inside runWithShop.
 */
export async function whyNotQueued(key, customerId) {
  if (!(await templateFor(key)).enabled) return 'off';
  const c = customerId ? await prepare('SELECT phone, email, update_channel FROM customers WHERE id = ?').get(customerId) : null;
  return c && channelFor(c) ? null : 'no_contact';
}

/** Stops a job's message still waiting its minute (reopening the work stops its Bike ready). */
export async function undoWaiting(jobId, key) {
  await prepare(
    `UPDATE customer_messages SET intent_state = 'undone', status = 'undone'
     WHERE job_id = ? AND template_key = ? AND intent_state = 'intended'`
  ).run(jobId, key);
}

/**
 * Stops every message for a job that hasn't gone yet, minute up or not: the
 * job is being deleted, so there is nothing left for it to be about (audit
 * item 11). Run in the delete's transaction. One already claimed is left.
 */
export async function undoJobMessages(jobId) {
  await prepare(
    `UPDATE customer_messages SET intent_state = 'undone', status = 'undone'
     WHERE job_id = ? AND intent_state = 'intended'`
  ).run(jobId);
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

/**
 * Sends a one-off text now (the old app's customer texts), through the
 * channel's sender — pretend for now — and records it like any other.
 * Inside the shop's runWithShop. Returns the message's id.
 */
export async function sendTextNow({ customerId, to, body, loginId = null }) {
  const now = new Date().toISOString();
  const { id } = await prepare(
    `INSERT INTO customer_messages (customer_id, body, status, intent_state, channel, to_address, send_after, claimed_at, sent_by_login_id)
     VALUES (?, ?, 'queued', 'sending', 'sms', ?, ?, ?, ?) RETURNING id`
  ).get(customerId, body, to, now, now, loginId);
  let result;
  try {
    result = await senderFor('sms').send({ channel: 'sms', to, subject: null, body });
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  await recordResult(id, result);
  return id;
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
 * before the engine) are never claimed. One shop or message failing is
 * logged and the round carries on with the rest.
 */
export async function sendDue() {
  const { rows: shops } = await pool.query('SELECT id FROM shops');
  for (const { id: shopId } of shops) {
    try {
      await sendDueForShop(shopId);
    } catch (err) {
      console.error(`Messages: sending failed for shop ${shopId} this round`, err);
    }
  }
}

async function sendDueForShop(shopId) {
  const now = new Date();
  const due = await runWithShop(shopId, async () => {
    await prepare(
      `UPDATE customer_messages SET intent_state = 'unknown', status = 'unknown'
       WHERE intent_state = 'sending' AND claimed_at < ?`
    ).run(new Date(now.getTime() - STUCK_MS).toISOString());
    return prepare(
      `UPDATE customer_messages SET intent_state = 'sending', claimed_at = ?
       WHERE intent_state = 'intended' AND send_after IS NOT NULL AND send_after <= ?
       RETURNING id, channel, to_address, subject, body`
    ).all(now.toISOString(), now.toISOString());
  });
  for (const m of due) {
    try {
      await sendOne(shopId, m);
    } catch (err) {
      // Left 'sending': the stuck rule moves it to unknown, never re-sent.
      console.error(`Messages: message ${m.id} could not be recorded`, err);
    }
  }
}

async function sendOne(shopId, m) {
  let result;
  try {
    result = await senderFor(m.channel).send({ channel: m.channel, to: m.to_address, subject: m.subject, body: m.body });
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  await runWithShop(shopId, () => recordResult(m.id, result));
}

// What the sender said, on a message it was claimed for. Inside runWithShop.
function recordResult(id, result) {
  return prepare(
    `UPDATE customer_messages SET intent_state = ?, status = ?, sent_at = ?, provider_sid = ?, pretend = ?, error = ?
     WHERE id = ? AND intent_state = 'sending'`
  ).run(result.ok ? 'delivered' : 'failed', result.ok ? 'sent' : 'failed', result.ok ? new Date().toISOString() : null,
    result.providerId ?? null, Boolean(result.pretend), result.ok ? null : result.error ?? 'Not sent', id);
}

/**
 * Starts the timer; returns stop(), which stops the timer and resolves once
 * any round in flight has finished (shutdown waits for it before ending the
 * pool). One run at a time.
 */
export function startSender(intervalMs = Number(process.env.WH_MESSAGES_TICK_MS ?? 5000)) {
  let round = null;
  const timer = setInterval(() => {
    if (round) return;
    round = sendDue()
      .catch((err) => console.error('Messages: sending failed this round', err))
      .finally(() => { round = null; });
  }, intervalMs);
  timer.unref();
  return () => {
    clearInterval(timer);
    return round ?? Promise.resolve();
  };
}

/** A message as the outbox shows it. */
export function serializeMessage(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    jobId: row.job_id ?? null,
    // The shop's (outbound) or the customer's (inbound), for the conversation.
    direction: row.direction ?? 'outbound',
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
