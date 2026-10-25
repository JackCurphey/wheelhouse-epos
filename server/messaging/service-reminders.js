// Service reminders (openspec/changes/service-reminder-send; account and
// reminders decision 2; Jack's answers of 25 Oct,
// docs/decisions/2026-10-25-morning-questions.md 1 to 4): set up when a bike
// is collected, for a customer who said yes, at the soonest service's months,
// when the shop opens; one per bike; checked again and written afresh when it
// goes. Inside the shop's runWithShop throughout.
import { pool, prepare } from '../db.js';
import { LIVE_BOOKING_STATES, effectiveHours, weekdayOf } from '../capacity.js';
import { toCapacitySettings } from '../workshop/jobs.js';
import { channelFor, queueMessage } from './engine.js';
import { render, templateFor } from './templates.js';

const KEY = 'service_reminder';
// Links read "[link]" while sending is pretend, as messageLink's do: the
// booking landing and the stop page come in later pieces.
const LINK = '[link]';
// Added after the shop's wording, so it can't be taken off (drawn: "It can't be taken off").
export const STOP_LINE = `Stop these: ${LINK}.`;
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
async function dueAt(jobId, months) {
  const settings = await prepare('SELECT * FROM workshop_settings LIMIT 1').get();
  const tz = settings?.time_zone ?? 'Europe/London';
  const { due } = await prepare(
    "SELECT to_char((collected_at AT TIME ZONE ?)::date + make_interval(months => ?::int), 'YYYY-MM-DD') AS due FROM workshop_jobs WHERE id = ?"
  ).get(tz, months, jobId);
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
  const { rows: [shop] } = await pool.query('SELECT name FROM shops WHERE id = $1', [shopId]);
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
export async function queueServiceReminder(jobId, shopId) {
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
  const at = await dueAt(jobId, service.months);
  const queued = await queueMessage({
    customerId: job.customer_id, jobId, key: KEY, vars: await reminderVars(jobId, shopId, service.name),
    at, ending: STOP_LINE,
  });
  return queued.skipped ? null : queued;
}

/**
 * When it comes due: whether it still goes (design 5), and if so its words
 * written now (answer 1): { body, subject, channel, to }, or null to undo it.
 */
export async function serviceReminderNow(m, shopId) {
  if (!m.job_id || !m.customer_id) return null;
  const job = await prepare(
    `SELECT w.id, w.bike_id, w.collected_at, c.service_reminders, c.phone, c.email, c.update_channel
       FROM workshop_jobs w JOIN customers c ON c.id = ?
      WHERE w.id = ? AND w.custody_state = 'collected'`
  ).get(m.customer_id, m.job_id);
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
    body: `${render(template.wording, vars)} ${STOP_LINE}`,
    subject: how.channel === 'email' ? render(template.subject, vars) : null,
    channel: how.channel,
    to: how.to,
  };
}
