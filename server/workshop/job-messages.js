// What a job's messages are filled in with (the messages engine, Jack 20 Oct:
// pretend for now; openspec/changes/messages-engine/design.md "Triggers").
// Inside the shop's runWithShop.
import { prepare } from '../db.js';
import { openingHoursFor, modeForDate } from '../capacity.js';
import { toCapacitySettings, addMinutesToTime, timeToMinutes } from './jobs.js';
import { formatOpeningHours } from '../messaging/templates.js';
import { isPretend } from '../messaging/senders/index.js';
import { computeOrderTotals } from '../lib/sales.js';

/**
 * The link a message carries. While sending is pretend nothing reaches the
 * customer, so a new link would only stop the one they have working: the
 * message shows "[link]" instead. Once real sending is on, `issue` makes the
 * fresh link (journey 4 decision 5: only the newest link works).
 */
export async function messageLink(issue) {
  return isPretend() ? '[link]' : issue();
}

export const money = (amount) => `£${Number(amount).toFixed(2)}`;

/** The job's customer, and its tap-ins, given the link issued for it. */
// Bike still waiting's [What’s left to pay] (drawn on cp-setting's pop-up):
// what's owed, "Paid" once the order is paid, Bike ready's words with nothing
// on it. LEFT_TO_PAY finds the sentence in a queued message, so it can be
// brought up to date when the message goes (whatsLeftToPay).
const leftToPaySentence = (orderStatus, due) => (orderStatus === 'converted' ? 'Paid — nothing more to pay'
  : due > 0 ? `${money(due)} to pay on collection` : 'Nothing to pay on collection');
export const LEFT_TO_PAY = /£[\d,]+\.\d\d to pay on collection|Paid — nothing more to pay|Nothing to pay on collection/;

/** The job's [What’s left to pay] now, as the till would charge it. Inside runWithShop. */
export async function whatsLeftToPay(jobId) {
  const order = await prepare(
    `SELECT d.id, d.discount, d.status, w.customer_id FROM workshop_jobs w
       LEFT JOIN sale_documents d ON d.workshop_job_id = w.id AND d.kind = 'order' AND d.status <> 'cancelled'
      WHERE w.id = ? ORDER BY d.id DESC LIMIT 1`
  ).get(jobId);
  let due = 0;
  if (order?.id && order.status !== 'converted') {
    const lines = await prepare('SELECT unit_price, qty FROM sale_document_items WHERE document_id = ?').all(order.id);
    due = (await computeOrderTotals({
      items: lines.map((l) => ({ unitPrice: l.unit_price, qty: l.qty })), discount: order.discount, customerId: order.customer_id,
    })).total;
  }
  return leftToPaySentence(order?.status, due);
}

export async function jobMessageVars(jobId, shopId, link) {
  const job = await prepare(
    `SELECT w.reference, w.customer_id, c.name AS customer_name, trim(b.make || ' ' || b.model) AS bike_label,
            d.id AS order_id, d.discount AS order_discount, d.status AS order_status
       FROM workshop_jobs w LEFT JOIN customers c ON c.id = w.customer_id
       LEFT JOIN customer_bikes b ON b.id = w.bike_id
       LEFT JOIN sale_documents d ON d.workshop_job_id = w.id AND d.kind = 'order' AND d.status <> 'cancelled'
      WHERE w.id = ? ORDER BY d.id DESC LIMIT 1`
  ).get(jobId);
  // The request's own connection, not a second one (portal-connection-per-request).
  const shop = await prepare('SELECT name FROM shops WHERE id = ?').get(shopId);
  const settings = await prepare('SELECT * FROM workshop_settings LIMIT 1').get();
  // Paid already, or nothing on the order: "Nothing to pay on collection".
  // What the till would charge: the same sum as the amount due (group discount included).
  let due = 0;
  if (job.order_id && job.order_status !== 'converted') {
    const lines = await prepare('SELECT unit_price, qty FROM sale_document_items WHERE document_id = ?').all(job.order_id);
    due = (await computeOrderTotals({
      items: lines.map((l) => ({ unitPrice: l.unit_price, qty: l.qty })), discount: job.order_discount, customerId: job.customer_id,
    })).total;
  }
  const owed = due > 0 ? money(due) : 'Nothing';
  const leftToPay = leftToPaySentence(job.order_status, due);
  return {
    customerId: job.customer_id,
    customerName: job.customer_name,
    vars: {
      'Customer’s first name': (job.customer_name ?? '').trim().split(/\s+/)[0],
      Bike: job.bike_label || null,
      'Shop name': shop.name,
      'Job number': job.reference,
      'Link to the quote': link,
      'Link to the job': link,
      'Amount to pay': owed,
      'What’s left to pay': leftToPay,
      'Opening hours': settings ? formatOpeningHours(openingHoursFor(toCapacitySettings(settings))) : null,
    },
  };
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Thu 17 Sep, 11:30", as the booking messages are drawn; the day alone with no time. */
export function dayAndTime(date, time) {
  if (!date) return null;
  const d = new Date(`${String(date).slice(0, 10)}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${time ? `, ${time}` : ''}`;
}
// How long before the booking, as people say it (as the booking page does, Jack, 19 Oct).
function leadWords(minutes) {
  if (minutes === 30) return 'half an hour';
  if (minutes === 60) return 'an hour';
  if (minutes === 90) return 'an hour and a half';
  if (minutes % 60 === 0) return `${minutes / 60} hours`;
  return `${minutes} minutes`;
}

/**
 * The [When to drop off] sentence, as drawn in bk-msg-confirmed: the booking
 * page's own rule (server/routes/portal.js, the link view's dropOff) for a set
 * time less the shop's lead time, or the drop-off window on a whole-day day.
 */
function dropOffSentence(job, settings, bike) {
  if (!settings) return null;
  const what = bike || 'bike';
  if (job.start_time) {
    const by = addMinutesToTime(job.start_time, -(Number(settings.timed_lead_minutes) || 0));
    const lead = timeToMinutes(job.start_time) - timeToMinutes(by);
    return lead <= 0 ? `Drop your ${what} off at your booking time, ${job.start_time}.` : `Drop your ${what} off by ${by}, ${leadWords(lead)} before your booking.`;
  }
  const mode = modeForDate({ bookingMode: settings.booking_mode, nextBookingMode: settings.next_booking_mode, nextBookingModeFrom: settings.next_booking_mode_from }, job.job_date);
  return mode === 'dropoff' && settings.dropoff_window_start && settings.dropoff_window_end
    ? `Drop your ${what} off between ${settings.dropoff_window_start} and ${settings.dropoff_window_end}.` : null;
}

/**
 * A booking message's tap-ins (the approved wordings, bk-msg-*), for the
 * message `key`, given the link it carries. Inside the shop's runWithShop.
 */
export async function bookingMessageVars(jobId, shopId, link, key, extra = {}) {
  const base = await jobMessageVars(jobId, shopId, link);
  const job = await prepare(
    `SELECT job_date, start_time, title, offered_from_date, offered_from_time, offer_message, decline_message
       FROM workshop_jobs WHERE id = ?`
  ).get(jobId);
  const services = await prepare(
    `SELECT s.name FROM workshop_job_services js JOIN workshop_services s ON s.id = js.service_id
      WHERE js.workshop_job_id = ? ORDER BY js.position, js.id`
  ).all(jobId);
  const settings = await prepare(
    'SELECT timed_lead_minutes, dropoff_window_start, dropoff_window_end, booking_mode, next_booking_mode, next_booking_mode_from, confirmation_note FROM workshop_settings LIMIT 1'
  ).get();
  const when = dayAndTime(job.job_date, job.start_time);
  const vars = {
    ...base.vars,
    Service: services.map((r) => r.name).join(', ') || job.title,
    'Booked day and time': when,
    'Link to the booking': link,
    'When to drop off': dropOffSentence(job, settings, base.vars.Bike),
    'Your note on the confirmation': settings?.confirmation_note || null,
  };
  if (key === 'time_offered') {
    // "can’t do [the time asked for] and suggests [the time offered] instead".
    vars['Booked day and time'] = dayAndTime(job.offered_from_date, job.offered_from_time) ?? when;
    vars['Suggested day and time'] = when;
    vars['The shop’s message'] = job.offer_message || null;
  }
  if (key === 'request_declined') {
    // After an offer, the time the customer asked for, not the one offered (fresh review).
    vars['Booked day and time'] = dayAndTime(job.offered_from_date, job.offered_from_time) ?? when;
    vars['The shop’s message'] = job.decline_message || null;
  }
  if (key === 'booking_cancelled') {
    // An offer never accepted: the time the customer asked for (an accepted
    // offer clears it), not the one offered (fresh review, 21 Oct).
    vars['Booked day and time'] = dayAndTime(job.offered_from_date, job.offered_from_time) ?? when;
  }
  if (key === 'date_change_answered') vars['New day and time'] = when;
  return { ...base, vars: { ...vars, ...extra } };
}
