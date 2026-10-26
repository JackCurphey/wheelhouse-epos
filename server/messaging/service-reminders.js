// Service reminders (openspec/changes/service-reminder-send; account and
// reminders decision 2; Jack's answers of 25 Oct,
// docs/decisions/2026-10-25-morning-questions.md 1 to 4): set up when a bike
// is collected, for a customer who said yes, at the soonest service's months,
// when the shop opens; one per bike; checked again and written afresh when it
// goes. Inside the shop's runWithShop throughout.
import { prepare } from '../db.js';
import { LIVE_BOOKING_STATES, effectiveHours, weekdayOf } from '../capacity.js';
import { toCapacitySettings } from '../workshop/jobs.js';
import { channelFor, queueMessage, whyNotQueued } from './engine.js';
import { render, templateFor } from './templates.js';
import { stopLink } from './stop-codes.js';
import { messageLink } from '../workshop/job-messages.js';

const KEY = 'service_reminder';
// Links read "[link]" while sending is pretend, as messageLink's do: the
// booking landing and the stop page come in later pieces.
const LINK = '[link]';
// Added after the shop's wording, so it can't be taken off (drawn: "It can't
// be taken off"); its link is the customer's stop page (stop-reminders),
// "[link]" while sending is pretend.
export const stopLine = (link) => `Stop these: ${link}.`;
export const STOP_LINE = stopLine(LINK);
const LIVE = LIVE_BOOKING_STATES.map((s) => `'${s}'`).join(', ');

/** The job's service with the fewest reminder months, then the first in its order (answer 2); null with none. */
function soonestService(jobId) {
  return prepare(
    `SELECT s.name, s.reminder_months AS months FROM workshop_job_services js
       JOIN workshop_services s ON s.id = js.service_id
      WHERE js.workshop_job_id = ? AND s.reminder_months IS NOT NULL
      ORDER BY s.reminder_months, js.position LIMIT 1`
  ).get(jobId);
}

const addDay = (date) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * When it goes (answer 4): the shop's date of collection plus the months, then
 * the first open day from there, at its opening time, in the shop's time zone.
 */
export async function dueAt(jobId, { months = 0, days = 0 }) {
  const settings = await prepare('SELECT * FROM workshop_settings LIMIT 1').get();
  const tz = settings?.time_zone ?? 'Europe/London';
  const { due } = await prepare(
    "SELECT to_char((collected_at AT TIME ZONE ?)::date + make_interval(months => ?::int, days => ?::int), 'YYYY-MM-DD') AS due FROM workshop_jobs WHERE id = ?"
  ).get(tz, months, days, jobId);
  const hours = settings ? toCapacitySettings(settings) : null;
  let day = due;
  let open = hours?.openingTime ?? '09:00';
  for (let i = 0; i < 7 && hours; i++, day = addDay(day)) {
    const today = effectiveHours(hours, weekdayOf(day));
    if (today) { open = today.open; break; }
  }
  // A shop open no day of the week: the due day, at its usual opening time.
  if (hours && !effectiveHours(hours, weekdayOf(day))) day = due;
  const { at } = await prepare('SELECT ((?::date + ?::time) AT TIME ZONE ?) AS at').get(day, open, tz);
  return new Date(at);
}

/** The words' tap-ins, as they are now. */
async function reminderVars(jobId, shopId, serviceName) {
  const job = await prepare(
    `SELECT c.name AS customer_name, trim(b.make || ' ' || b.model) AS bike_label
       FROM workshop_jobs w LEFT JOIN customers c ON c.id = w.customer_id
       LEFT JOIN customer_bikes b ON b.id = w.bike_id WHERE w.id = ?`
  ).get(jobId);
  // On the shop's own connection, never a second one from the pool while this
  // one is held (openspec/changes/server-stays-up-when-busy).
  const shop = await prepare('SELECT name FROM shops WHERE id = ?').get(shopId);
  return {
    'Customer’s first name': (job?.customer_name ?? '').trim().split(/\s+/)[0],
    Bike: job?.bike_label || null,
    Service: serviceName,
    'Shop name': shop.name,
    'Link to book': LINK,
  };
}

/**
 * Sets up the reminder for a job just collected, when its customer said yes
 * and a service has months; drops any still waiting for the same bike, or
 * from this job before (answer 3). Returns the queued message, or null.
 */
export async function queueServiceReminder(jobId, shopId, base) {
  const job = await prepare(
    `SELECT w.customer_id, w.bike_id, c.service_reminders FROM workshop_jobs w
       JOIN customers c ON c.id = w.customer_id
      WHERE w.id = ? AND w.custody_state = 'collected' AND w.collected_at IS NOT NULL`
  ).get(jobId);
  if (!job?.service_reminders) return null;
  const service = await soonestService(jobId);
  if (!service) return null;
  const undo = "UPDATE customer_messages SET intent_state = 'undone', status = 'undone' WHERE template_key = 'service_reminder' AND intent_state = 'intended'";
  await prepare(`${undo} AND job_id = ?`).run(jobId);
  if (job.bike_id) await prepare(`${undo} AND job_id IN (SELECT id FROM workshop_jobs WHERE bike_id = ?)`).run(job.bike_id);
  // Nothing goes to a customer with no way to reach them, or with the message
  // off, so no stop code is made for one (review).
  if (await whyNotQueued(KEY, job.customer_id)) return null;
  const at = await dueAt(jobId, { months: service.months });
  // The stop link is made now and kept with the message: the timer that sends
  // it has no request to make one from (stop-reminders design 2).
  const link = await messageLink(async () => {
    const shop = await prepare('SELECT slug FROM shops WHERE id = ?').get(shopId);
    return stopLink(base, shop.slug, job.customer_id);
  });
  const queued = await queueMessage({
    customerId: job.customer_id, jobId, key: KEY, vars: await reminderVars(jobId, shopId, service.name),
    at, ending: stopLine(link),
  });
  return queued.skipped ? null : queued;
}

/**
 * When it comes due: whether it still goes (design 5), and if so its words
 * written now (answer 1): { body, subject, channel, to }, or null to undo it.
 */
export async function serviceReminderNow(m, shopId) {
  if (!m.job_id) return null;
  // The job's customer now: merging records moves the job, not the message (review).
  const job = await prepare(
    `SELECT w.id, w.bike_id, w.collected_at, w.customer_id, c.service_reminders, c.phone, c.email, c.update_channel
       FROM workshop_jobs w JOIN customers c ON c.id = w.customer_id
      WHERE w.id = ? AND w.custody_state = 'collected'`
  ).get(m.job_id);
  if (!job?.service_reminders) return null;
  const template = await templateFor(KEY);
  if (!template.enabled) return null;
  if (job.bike_id) {
    const later = await prepare(
      `SELECT 1 FROM workshop_jobs WHERE bike_id = ? AND id <> ?
          AND ((collected_at IS NOT NULL AND collected_at > ?)
            OR (booking_state IN (${LIVE}) AND custody_state <> 'collected'))`
    ).get(job.bike_id, job.id, job.collected_at);
    if (later) return null;
  }
  const how = channelFor(job);
  const service = await soonestService(job.id);
  if (!how || !service) return null;
  const vars = await reminderVars(job.id, shopId, service.name);
  return {
    customerId: job.customer_id,
    body: `${render(template.wording, vars)} ${m.ending ?? STOP_LINE}`,
    subject: how.channel === 'email' ? render(template.subject, vars) : null,
    channel: how.channel,
    to: how.to,
  };
}
