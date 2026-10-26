// A shop's own automatic messages (openspec/changes/own-messages-server;
// owner setup decision 14; set-msg-new; Jack's answers of 26 Oct,
// docs/decisions/2026-10-26-receipt-and-own-messages.md). Each is found from
// what has happened — a collection, a booked day, a sale — by a check the
// sender's round runs once a minute while the shop is open (design 2), so no
// other route sets anything up. Only customers who said yes to offers and
// news, never one who stopped that message, once per job or sale. Inside
// the shop's runWithShop throughout.
import { prepare } from '../db.js';
import { effectiveHours, openingHoursFor, weekdayOf } from '../capacity.js';
import { toCapacitySettings } from '../workshop/jobs.js';
import { jobMessageVars } from '../workshop/job-messages.js';
import { isPretend } from './senders/index.js';
import { formatOpeningHours, render } from './templates.js';
import { newLinkCode, hashLinkCode, linkPath } from '../booking-link.js';
import { stopLink } from './stop-codes.js';
import { stopLine } from './service-reminders.js';

export const KEY = 'own_message';
// Bookings still on their way in: confirmed, or waiting on a date change.
const BOOKED = "('scheduled', 'reschedule_requested')";
// A customer who can get one: active, not merged away, said yes to offers
// and news (answer 1), and hasn't stopped this message (answer 2).
const ELIGIBLE = `c.active = 1 AND c.merged_into_id IS NULL AND c.marketing_permission
  AND NOT EXISTS (SELECT 1 FROM shop_message_stops st WHERE st.shop_message_id = ? AND st.customer_id = c.id)`;

/** The shop's local date ("2026-09-02") and time ("11:00") at an instant. */
function localNow(now, tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** Whether the shop is open at this instant, by its opening hours; and its time zone. */
async function openNow(now) {
  const settings = await prepare('SELECT * FROM workshop_settings LIMIT 1').get();
  const tz = settings?.time_zone ?? 'Europe/London';
  if (!settings) return { open: false, tz };
  const { date, time } = localNow(now, tz);
  const hours = effectiveHours(toCapacitySettings(settings), weekdayOf(date));
  return { open: Boolean(hours && time >= hours.open && time < hours.close), tz, date, settings };
}

/**
 * Which way it goes (design 3): the customer's own way when the message goes
 * that way (text covers WhatsApp), else the message's other way the customer
 * has; null with neither.
 */
export function ownChannel(message, c) {
  const textWay = c.update_channel === 'whatsapp' ? 'whatsapp' : 'sms';
  const byText = message.by_text && c.phone ? { channel: textWay, to: c.phone } : null;
  const byEmail = message.by_email && c.email ? { channel: 'email', to: c.email } : null;
  if (c.update_channel === 'email') return byEmail ?? byText;
  if (c.update_channel === 'sms' || c.update_channel === 'whatsapp') return byText ?? byEmail;
  return byText ?? byEmail;
}

function publicBase() {
  if (!process.env.APP_PUBLIC_URL) throw new Error('APP_PUBLIC_URL is needed for an automatic message’s links');
  return process.env.APP_PUBLIC_URL;
}

// On the shop's own connection, never a second one from the pool while the
// engine's is held (openspec/changes/server-stays-up-when-busy).
async function shopRow(shopId) {
  return prepare('SELECT name, slug FROM shops WHERE id = ?').get(shopId);
}

// The job's link, issued afresh only once sending is real (messageLink).
async function issueJobLink(jobId, shopId) {
  const code = newLinkCode();
  await prepare('UPDATE workshop_jobs SET link_token_hash = ?, updated_at = now() WHERE id = ?').run(hashLinkCode(code), jobId);
  return `${publicBase()}${linkPath((await shopRow(shopId)).slug, code)}`;
}

/** The tap-ins (design 4), given the job's link: the job's, as Bike ready's; a sale has the customer's name, the shop's and its hours. */
async function varsFor(candidate, shopId, settings, link) {
  if (candidate.job_id) return (await jobMessageVars(candidate.job_id, shopId, link)).vars;
  return {
    'Customer’s first name': (candidate.customer_name ?? '').trim().split(/\s+/)[0],
    'Shop name': (await shopRow(shopId)).name,
    'Opening hours': settings ? formatOpeningHours(openingHoursFor(toCapacitySettings(settings))) : null,
  };
}

/** What has come due for one message, as of this instant (design 2). */
function candidates(m, now, tz, today) {
  const span = 'make_interval(months => ?::int, days => ?::int)';
  const months = m.unit === 'months' ? m.amount : 0;
  const days = m.unit === 'days' ? m.amount : 0;
  const notYet = "NOT EXISTS (SELECT 1 FROM customer_messages x WHERE x.shop_message_id = ? AND x.event_key = ";
  if (m.send_when === 'after_collected') {
    return prepare(
      `SELECT w.id AS job_id, 'job:' || w.id AS event_key, c.id AS customer_id, c.name AS customer_name, c.phone, c.email, c.update_channel
         FROM workshop_jobs w JOIN customers c ON c.id = w.customer_id
        WHERE w.custody_state = 'collected' AND w.collected_at IS NOT NULL
          AND w.collected_at + ${span} <= ? AND w.collected_at + ${span} >= ?
          AND ${ELIGIBLE} AND ${notYet}'job:' || w.id)`
    ).all(months, days, now.toISOString(), months, days, m.active_from, m.id, m.id);
  }
  if (m.send_when === 'before_booked') {
    return prepare(
      `SELECT w.id AS job_id, 'job:' || w.id AS event_key, c.id AS customer_id, c.name AS customer_name, c.phone, c.email, c.update_channel
         FROM workshop_jobs w JOIN customers c ON c.id = w.customer_id
        WHERE w.booking_state IN ${BOOKED} AND w.custody_state <> 'collected'
          AND w.job_date::date >= ?::date
          -- Its days began after the message was set up, or it was booked after (review 2).
          AND (w.job_date::date - ${span})::date <= ?::date
          AND ((w.job_date::date - ${span})::date >= (?::timestamptz AT TIME ZONE ?)::date OR w.created_at >= ?)
          AND ${ELIGIBLE} AND ${notYet}'job:' || w.id)`
    ).all(today, months, days, today, months, days, m.active_from, tz, m.active_from, m.id, m.id);
  }
  return prepare(
    `SELECT NULL::int AS job_id, 'sale:' || s.source || ':' || s.id AS event_key, c.id AS customer_id, c.name AS customer_name, c.phone, c.email, c.update_channel
       FROM all_sales s JOIN customers c ON c.id = s.customer_id
      WHERE s.made_at + ${span} <= ? AND s.made_at + ${span} >= ?
        AND ${ELIGIBLE} AND ${notYet}'sale:' || s.source || ':' || s.id)`
  ).all(months, days, now.toISOString(), months, days, m.active_from, m.id, m.id);
}

/**
 * Queues what has come due for the shop's own messages, as of `now`. Nothing
 * while the shop is closed: what came due then goes when it opens. Returns
 * how many were queued.
 */
export async function queueOwnMessages(shopId, now = new Date()) {
  const { open, tz, date, settings } = await openNow(now);
  if (!open) return 0;
  const messages = await prepare('SELECT * FROM shop_messages WHERE enabled ORDER BY id').all();
  let count = 0;
  for (const m of messages) {
    for (const cand of await candidates(m, now, tz, date)) {
      const how = ownChannel(m, cand);
      if (!how) continue;
      // Written with "[link]" first; the real links are made only once the row
      // is in, so a second server finding the same job never replaces a link
      // a message already carries (review 4).
      const vars = await varsFor(cand, shopId, settings, '[link]');
      const ending = stopLine('[link]');
      const body = `${render(m.wording, vars)} ${ending}`;
      // One per job or sale, even with two servers (the unique index).
      const row = await prepare(
        `INSERT INTO customer_messages (customer_id, job_id, body, status, intent_state, channel, template_key, subject, to_address, send_after, ending, shop_message_id, event_key)
         VALUES (?, ?, ?, 'queued', 'intended', ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (shop_message_id, event_key) WHERE shop_message_id IS NOT NULL AND event_key IS NOT NULL DO NOTHING
         RETURNING id`
      ).get(cand.customer_id, cand.job_id, body, how.channel, KEY, how.channel === 'email' ? m.name : null, how.to, now.toISOString(), ending, m.id, cand.event_key);
      if (!row) continue;
      count += 1;
      if (!isPretend()) {
        const link = await stopLink(publicBase(), (await shopRow(shopId)).slug, cand.customer_id, 'own_message', m.id);
        const real = await varsFor(cand, shopId, settings, cand.job_id ? await issueJobLink(cand.job_id, shopId) : null);
        await prepare('UPDATE customer_messages SET body = ?, ending = ? WHERE id = ?').run(`${render(m.wording, real)} ${stopLine(link)}`, stopLine(link), row.id);
      }
    }
  }
  return count;
}

// The sender's round asks every few seconds; each shop is checked at most once a minute.
const lastChecked = new Map();
export async function ownMessagesRound(shopId, now = new Date()) {
  if (process.env.WH_OWN_MESSAGES_SCAN === 'off') return 0;
  const last = lastChecked.get(shopId) ?? 0;
  if (now.getTime() - last < 60_000) return 0;
  lastChecked.set(shopId, now.getTime());
  return queueOwnMessages(shopId, now);
}

/** Just before it goes (design 5): the message still there and on, the customer still saying yes and not stopped. */
export async function ownMessageStillGoes(m) {
  if (!m.shop_message_id || !m.customer_id) return false;
  return Boolean(await prepare(
    `SELECT 1 FROM shop_messages sm JOIN customers c ON c.id = ?
      WHERE sm.id = ? AND sm.enabled AND ${ELIGIBLE}`
  ).get(m.customer_id, m.shop_message_id, m.shop_message_id));
}
