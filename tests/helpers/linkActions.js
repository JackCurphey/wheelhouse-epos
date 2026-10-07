// Shared by the piece 12 tests: the customer's private-link actions, an online
// booking, and the reads and seeds those tests make.
// Every link call goes through the booking-link limiter - 30 per server per 15
// minutes, and each test file starts its own server - so a file keeps its
// link calls under 30.
// Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
import { pool, runWithShop, prepare } from '../../server/db.js';
import { jsonRequest } from './http.js';
import { futureDate } from './workshopFixtures.js';
import { BOOKING_CONTACT } from './bookable.js';

export const codeOf = (privateLink) => privateLink.split('/').pop();

export function linkActions(baseUrl, shopSlug) {
  const path = (code, action) => `/api/portal/${shopSlug}/booking-links/${code}${action ? `/${action}` : ''}`;
  const post = (code, action, body = {}) => jsonRequest(baseUrl, null, path(code, action), { method: 'POST', body });
  return {
    read: (code) => jsonRequest(baseUrl, null, path(code)),
    cancel: (code) => post(code, 'cancel'),
    change: (code, body) => post(code, 'change', body),
    withdraw: (code) => post(code, 'withdraw-change'),
  };
}

// An online booking by a signed-in customer; the caller gives mechanicId,
// jobDate, startTime and serviceIds.
export function tryBooking(baseUrl, cookie, shopSlug, body) {
  return jsonRequest(baseUrl, cookie, `/api/portal/${shopSlug}/bookings`, {
    method: 'POST',
    body: { description: 'Squeaky brakes', newBike: { make: 'Dawes', model: 'Galaxy' }, ...BOOKING_CONTACT, ...body },
  });
}

export async function bookOnline(baseUrl, cookie, shopSlug, body) {
  const res = await tryBooking(baseUrl, cookie, shopSlug, body);
  if (res.status !== 201) throw new Error(`booking failed (${res.status}): ${JSON.stringify(res.body)}`);
  return { ...res.body, code: codeOf(res.body.privateLink) };
}

export const liveHolds = (shopId, jobId) => runWithShop(shopId, () => prepare(
  `SELECT job_date, start_time, mechanic_id, purpose FROM workshop_capacity_holds
   WHERE workshop_job_id = ? AND state IN ('held', 'confirmed') ORDER BY id`
).all(jobId)).then((rows) => rows.map((r) => ({ ...r })));

export const jobRow = (shopId, jobId) =>
  runWithShop(shopId, () => prepare('SELECT * FROM workshop_jobs WHERE id = ?').get(jobId));

export const setJob = (shopId, jobId, sql, ...args) =>
  runWithShop(shopId, () => prepare(`UPDATE workshop_jobs SET ${sql} WHERE id = ?`).run(...args, jobId));

// A stored change request and its hold, written as the change route writes
// them - for tests whose subject is what a request does, not how one is made.
export async function seedRequest(shopId, jobId, { jobDate, mechanicId, startTime = '14:00', endTime = '15:00' }) {
  await runWithShop(shopId, async () => {
    await prepare(
      `UPDATE workshop_jobs SET booking_state = 'reschedule_requested', requested_job_date = ?, requested_mechanic_id = ?,
         requested_start_time = ?, requested_end_time = ?, requested_at = now() WHERE id = ?`
    ).run(jobDate, mechanicId, startTime, endTime, jobId);
    await prepare(
      `INSERT INTO workshop_capacity_holds (workshop_job_id, job_date, start_time, mechanic_id, minutes, state, purpose)
       VALUES (?, ?, ?, ?, 60, 'held', 'requested')`
    ).run(jobId, jobDate, startTime, mechanicId);
  });
}

// A different weekday date on each call, Monday to Friday, at least three weeks
// out (futureDate), a week further on after every five. `from` as futureDate's.
export function dayMaker(from = new Date()) {
  let n = 0;
  return () => {
    const i = n++;
    const d = new Date(`${futureDate(1 + (i % 5), from)}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7 * Math.floor(i / 5));
    return d.toISOString().slice(0, 10);
  };
}

// Takes one shop-and-date booking lock from outside the server, as another
// booking write would, until the returned release() is called.
export async function holdBookingLock(shopId, date) {
  const client = await pool.connect();
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock($1::int, $2::int)', [shopId, Number(date.replace(/-/g, ''))]);
  return async () => {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  };
}

// True when the promise has not settled after `ms`.
export async function stillWaiting(promise, ms = 500) {
  let settled = false;
  promise.then(() => { settled = true; }, () => { settled = true; });
  await new Promise((resolve) => setTimeout(resolve, ms));
  return !settled;
}
