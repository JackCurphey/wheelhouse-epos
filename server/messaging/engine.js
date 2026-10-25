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
import { LEFT_TO_PAY, whatsLeftToPay } from '../workshop/job-messages.js';

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
export async function queueMessage({ customerId, jobId = null, key, vars, delayMs = 0, loginId = null, hold = false, ending = null, at = null }) {
  const template = await templateFor(key);
  if (!template.enabled) return { skipped: 'off' };
  const c = await prepare('SELECT phone, email, update_channel FROM customers WHERE id = ?').get(customerId);
  const how = c && channelFor(c);
  if (!how) return { skipped: 'no_contact' };
  // A fixed ending goes after the shop's wording, so it can't be taken off
  // (the service reminder's "Stop these").
  const body = ending ? `${render(template.wording, vars)} ${ending}` : render(template.wording, vars);
  const subject = how.channel === 'email' ? render(template.subject, vars) : null;
  // Held (Don't close things by themselves): a send time of never, so the
  // sender never claims it and Undo still stops it, until Send now
  // (openspec/changes/dont-close-server design 1).
  // `at`: a send time of its own, months off (the service reminder's).
  const sendAfter = hold ? 'infinity' : (at ?? new Date(Date.now() + delayMs)).toISOString();
  const row = await prepare(
    `INSERT INTO customer_messages (customer_id, job_id, body, status, intent_state, channel, template_key, subject, to_address, send_after, sent_by_login_id, ending)
     VALUES (?, ?, ?, 'queued', 'intended', ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).get(customerId, jobId, body, how.channel, key, subject, how.to, sendAfter, loginId, ending);
  return { id: row.id, channel: how.channel, to: how.to, sendAfter: hold ? null : sendAfter, held: hold };
}

/**
 * Send now: a held message's send time becomes now, and the sender sends it
 * next round. Bike still waiting then counts its days from now, so the two
 * never go together (review). False when it isn't held.
 */
export async function sendHeldNow(id) {
  const now = new Date();
  const row = await prepare(
    "UPDATE customer_messages SET send_after = ? WHERE id = ? AND intent_state = 'intended' AND send_after = 'infinity'::timestamptz RETURNING id, job_id, template_key"
  ).get(now.toISOString(), id);
  if (row?.template_key === 'bike_ready' && row.job_id) {
    const days = (await prepare('SELECT collection_reminder_days AS days FROM workshop_settings LIMIT 1').get())?.days ?? 3;
    const later = new Date(now.getTime() + days * 86_400_000).toISOString();
    await prepare(
      "UPDATE customer_messages SET send_after = ? WHERE job_id = ? AND template_key = 'bike_still_waiting' AND intent_state = 'intended' AND send_after < ?"
    ).run(later, row.job_id, later);
  }
  return Boolean(row);
}

/**
 * An email to the address given, for one sale's receipt (openspec/changes/receipt-email
 * design 1): not the customer's chosen way, and with no customer when the sale
 * has none. Due at once; the timer sends it through the email sender, pretend
 * for now. Inside the shop's runWithShop. Returns the message's id.
 */
export async function sendEmailTo({ to, subject, body, saleId, customerId = null, loginId = null }) {
  const { id } = await prepare(
    `INSERT INTO customer_messages (customer_id, sale_id, body, status, intent_state, channel, template_key, subject, to_address, send_after, sent_by_login_id)
     VALUES (?, ?, ?, 'queued', 'intended', 'email', 'receipt', ?, ?, ?, ?) RETURNING id`
  ).get(customerId, saleId, body, subject, to, new Date().toISOString(), loginId);
  return id;
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

/**
 * A quote reminder waits up to a week, so it's checked when it's due: its
 * job still there, the bike not collected, the booking not ended, the job's
 * newest quote still waiting for an answer, and Quote to approve and the
 * reminder both still on (Jack, 22 Oct; fresh review).
 */
async function reminderStillNeeded(jobId) {
  if (!jobId) return false;
  const job = await prepare(
    `SELECT 1 FROM workshop_jobs j
      WHERE j.id = ? AND j.custody_state <> 'collected' AND j.booking_state NOT IN ('cancelled', 'declined', 'expired')
        AND (SELECT q.state FROM workshop_quotes q WHERE q.workshop_job_id = j.id ORDER BY q.revision DESC LIMIT 1) = 'sent'`
  ).get(jobId);
  if (!job) return false;
  return (await templateFor('quote_to_approve')).enabled && (await templateFor('quote_reminder')).enabled;
}

/**
 * Bike still waiting waits days, so it's checked when it's due (WP-4.3,
 * openspec/changes/uncollected-bike design 2): the bike still in the shop, the
 * work still finished and signed off, its Bike ready sent since it was marked
 * ready (not switched off or undone), and the message on. A paid bike is
 * reminded too, "Paid — nothing more to pay" (cp-setting).
 */
async function stillWaitingNeeded(jobId) {
  if (!jobId) return false;
  const job = await prepare(
    `SELECT 1 FROM workshop_jobs j
      WHERE j.id = ? AND j.custody_state = 'in_shop' AND j.work_state = 'complete' AND j.signed_off_at IS NOT NULL
        AND EXISTS (SELECT 1 FROM customer_messages r WHERE r.job_id = j.id AND r.template_key = 'bike_ready'
                     AND r.sent_at IS NOT NULL AND r.sent_at >= j.signed_off_at)`
  ).get(jobId);
  return Boolean(job) && (await templateFor('bike_still_waiting')).enabled;
}

/**
 * Bike ready only while the bike is still in the shop and finished, checked as
 * it goes: a held one sent late, or one in its minute, is never sent once the
 * bike has gone (dont-close-server, review).
 */
export async function readyStillNeeded(jobId) {
  if (!jobId) return true;
  return Boolean(await prepare(
    "SELECT 1 FROM workshop_jobs WHERE id = ? AND custody_state = 'in_shop' AND work_state = 'complete'"
  ).get(jobId));
}

const DUE_CHECKS = { quote_reminder: reminderStillNeeded, bike_still_waiting: stillWaitingNeeded, bike_ready: readyStillNeeded };

async function sendDueForShop(shopId) {
  const now = new Date();
  const due = await runWithShop(shopId, async () => {
    await prepare(
      `UPDATE customer_messages SET intent_state = 'unknown', status = 'unknown'
       WHERE intent_state = 'sending' AND claimed_at < ?`
    ).run(new Date(now.getTime() - STUCK_MS).toISOString());
    // A held Bike ready never comes due, so its check above never runs: one
    // whose bike has gone (collected, or the work reopened) is stopped here,
    // not left waiting for a Send now that can't send it (review).
    await prepare(
      `UPDATE customer_messages m SET intent_state = 'undone', status = 'undone'
       WHERE m.intent_state = 'intended' AND m.template_key = 'bike_ready' AND m.send_after = 'infinity'
         AND NOT EXISTS (SELECT 1 FROM workshop_jobs j WHERE j.id = m.job_id AND j.custody_state = 'in_shop' AND j.work_state = 'complete')`
    ).run();
    const claimed = await prepare(
      `UPDATE customer_messages SET intent_state = 'sending', claimed_at = ?
       WHERE intent_state = 'intended' AND send_after IS NOT NULL AND send_after <= ?
       RETURNING id, channel, to_address, subject, body, template_key, job_id, customer_id, ending`
    ).all(now.toISOString(), now.toISOString());
    const sendable = [];
    for (const m of claimed) {
      const stillNeeded = DUE_CHECKS[m.template_key];
      if (stillNeeded && !(await stillNeeded(m.job_id))) {
        await prepare("UPDATE customer_messages SET intent_state = 'undone', status = 'undone' WHERE id = ?").run(m.id);
        continue;
      }
      // A service reminder was set up months ago: checked, and its words
      // written, now (service-reminder-send design 5 and 6; Jack, 25 Oct).
      if (m.template_key === 'service_reminder') {
        const { serviceReminderNow } = await import('./service-reminders.js');
        const now = await serviceReminderNow(m, shopId);
        if (!now) {
          await prepare("UPDATE customer_messages SET intent_state = 'undone', status = 'undone' WHERE id = ?").run(m.id);
          continue;
        }
        Object.assign(m, { customer_id: now.customerId, body: now.body, subject: now.subject, channel: now.channel, to_address: now.to });
        await prepare('UPDATE customer_messages SET customer_id = ?, body = ?, subject = ?, channel = ?, to_address = ? WHERE id = ?').run(m.customer_id, m.body, m.subject, m.channel, m.to_address, m.id);
      }
      // Bike still waiting was filled in days ago: what's left to pay is said
      // as it is now, paid or not (fresh review), and recorded as sent.
      if (m.template_key === 'bike_still_waiting' && LEFT_TO_PAY.test(m.body)) {
        m.body = m.body.replace(LEFT_TO_PAY, await whatsLeftToPay(m.job_id));
        await prepare('UPDATE customer_messages SET body = ? WHERE id = ?').run(m.body, m.id);
      }
      sendable.push(m);
    }
    return sendable;
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

// Postgres's "never" comes back as Infinity, or as the word, depending on how it's read.
const isHeld = (t) => t === Infinity || t === 'infinity' || (t instanceof Date && !Number.isFinite(t.getTime()));

/** A message as the outbox shows it. */
export function serializeMessage(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    jobId: row.job_id ?? null,
    // The shop's (outbound) or the customer's (inbound), for the conversation.
    direction: row.direction ?? 'outbound',
    key: row.template_key ?? null,
    // A receipt isn't one of the automatic messages (openspec/changes/receipt-email).
    name: TEMPLATES[row.template_key]?.name ?? (row.template_key === 'receipt' ? 'Receipt' : 'Message'),
    channel: row.channel ?? 'sms',
    to: row.to_address ?? null,
    subject: row.subject ?? null,
    body: row.body,
    state: row.intent_state,
    pretend: row.pretend,
    // A held message has no send time until Send now (dont-close-server design 4).
    held: isHeld(row.send_after),
    sendAfter: isHeld(row.send_after) ? null : row.send_after ?? null,
    sentAt: row.sent_at ?? null,
    error: row.error ?? null,
    createdAt: row.created_at,
  };
}
