// The online booking pages' customer accounts and what they read:
// /api/portal/:shopSlug/ signup, login, logout and me, and the mechanics,
// services, terms, availability and the customer's bikes. Portal routes run
// under the dispatcher's /api/portal/ branch (server.js): signup, login and
// logout get (req, res, params, query) and resolve their own shop; the rest
// get the shop's row-level security from :shopSlug and check the customer
// themselves with currentCustomerSession(). Mark's file. Moved out of
// server.js unchanged (split plan §4.1, WP-0.4); bookings and booking links
// follow in the next move.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { prepare, dbExec } from '../db.js';
import { badRequest, notFound, makeRateLimiter, nowIso, parseCookies, readJsonBody, sendJson } from '../lib/http.js';
import { UPLOADS_DIR } from '../lib/uploads.js';
import { serializeBike } from '../lib/serializers.js';
import { currentCustomerSession } from '../lib/session.js';
import { clientIp, isHttpsRequest } from '../proxy-trust.js';
import { queueMessage, whyNotQueued } from '../messaging/engine.js';
import { bookingMessageVars, messageLink } from '../workshop/job-messages.js';
import { jobChecklistCopy } from '../workshop/checklists.js';
import {
  CustomerAuthError, resolveGuestCustomer, signupCustomer, verifyCustomerLogin, createCustomerSession, destroyCustomerSession,
  serializeCustomerLogin, CUSTOMER_SESSION_COOKIE, CUSTOMER_SESSION_MAX_AGE_SECONDS,
} from '../customer-auth.js';
import { MAX_RANGE_DAYS, isRealDate, dayCount, widestHours, startTimesFor, fitsDropoff, fitsFreeTime, legacyView, modeForDate, openingHoursFor } from '../capacity.js';
import { formatOpeningHours } from '../messaging/templates.js';
import { computeOrderTotals } from '../lib/sales.js';
import { currentMoment, shopToday, earliestBookable, startIsInTime, dropoffIsInTime } from '../clock.js';
import { STANDARD_BOOKING_TERMS } from '../standard-terms.js';
import {
  requestedOf, WORKSHOP_JOB_SELECT, resolveJobMechanicId, addMinutesToTime, timeToMinutes, resolveJobTimes,
  CLEAR_REQUEST, capacityRefusal, refusal, SLOT_GONE, sendQuoteResult, parseWorkingDays, currentShopToday,
  toCapacitySettings, withBookingLock, withJobBookingLock, applyLocked, syncJobHold, createWorkshopJob,
  checkJobSlot, loadCapacity,
} from '../workshop/jobs.js';
import {
  approve as approveQuote, earlierAnswers, agreedBefore, latestAnswers, recordLineDecision, readQuoteForCustomer, serializeQuoteWithLines, currentQuoteForJob,
} from '../workshop/quotes.js';
import { parseBookingRequest } from '../booking-request.js';
import { MAX_BOOKING_BODY_BYTES, readBookingPhotos, sniffImage } from '../booking-photos.js';
import { saveBookingPhotos } from '../booking-photo-store.js';
import { checkAnswers } from '../service-questions.js';
import { newLinkCode, hashLinkCode, linkPath, linkExpiry, bookingStage } from '../booking-link.js';
import { readRequestKey } from '../booking-request-key.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

// Parallel to the staff ones (server/routes/auth.js) but on their own cookie name, so a
// customer session and a staff session can coexist in the same browser
// without either one clobbering the other.

function setCustomerSessionCookie(req, res, token) {
  const secure = isHttpsRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${CUSTOMER_SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${CUSTOMER_SESSION_MAX_AGE_SECONDS}${secure}`
  );
}

function clearCustomerSessionCookie(res) {
  res.setHeader('Set-Cookie', `${CUSTOMER_SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

const portalLoginLimiter = makeRateLimiter(10, 15 * 60 * 1000);
const portalSignupLimiter = makeRateLimiter(5, 60 * 60 * 1000);

// A second, public-facing surface (see public-portal/) for customers to
// book their own workshop slots. Its auth is entirely separate from staff
// auth (see server/customer-auth.js) - signup/login/logout manage their own
// shop resolution and session, same as /api/auth/* does for staff, and
// never touch RLS-protected tables directly. Every other /api/portal/*
// route needs the shop's RLS context (resolved from the :shopSlug in the
// URL, see the dispatcher below) to read/write customers/employees/
// workshop_jobs/etc through the normal db.prepare(...) shim.

// Guest bookings skip signup entirely, so nothing else gates how often this
// network can create jobs/customers - mirrors portalSignupLimiter's limits
// since it's standing in for that same missing gate.
const portalGuestBookingLimiter = makeRateLimiter(5, 60 * 60 * 1000);

// Private booking links need no sign-in. The code is unguessable; this is the
// second line, so nobody can churn through codes.
const bookingLinkLimiter = makeRateLimiter(30, 15 * 60 * 1000);

// A customer may change or cancel through the link while the bike has not
// reached the shop and the booking is live (piece 12) - and only while no work
// has started on it and its day has not passed in the shop's time zone (Jack,
// 27 Sep). `today` is the shop's today (currentShopToday).
const CUSTOMER_ACTIONABLE = new Set(['pending', 'offered', 'scheduled', 'reschedule_requested']);
function customerTooLate(row, today) {
  return row.custody_state !== 'expected' || row.work_state !== 'not_started' || row.job_date < today;
}
function customerCanAct(row, today) {
  return !customerTooLate(row, today) && CUSTOMER_ACTIONABLE.has(row.booking_state);
}
// A time the shop offered is accepted or cancelled, not changed (Jack, 1 Oct,
// decision 12; 20 Oct, offer another time).
function customerCanChange(row, today) {
  return customerCanAct(row, today) && row.booking_state !== 'offered';
}

// What a customer is allowed to see about their own job. Deliberately a
// separate function from serializeWorkshopJob() (server/workshop/jobs.js) rather than a filtered
// version of it: the staff serializer is where new fields get added, and a
// shared one silently exposes each new field to customers the day it lands.
// Notably absent - the linked order (id, status, total) and `notes`, which
// staff edit freely in the diary and treat as internal. The customer's own
// description survives in `title` ("Online booking: ..."), which is what the
// portal's my-bookings list falls back to.
function serializePortalBooking(row) {
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    bikeLabel: row.bike_label !== undefined ? row.bike_label : undefined,
    mechanicName: row.mechanic_name !== undefined ? row.mechanic_name : undefined,
    jobDate: row.job_date,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    createdAt: row.created_at,
  };
}

// Why the customer may not change or cancel through the link, or null. The
// code is what a screen branches on; the words are the spec's. Work started
// or a day gone by gets the in-shop words too (Jack, 27 Sep).
const CUSTOMER_REFUSALS = {
  cancel: {
    inShop: 'Your bike is already with the shop - please contact them to cancel',
    other: "This booking can't be cancelled online",
  },
  change: {
    inShop: 'Your bike is already with the shop - please contact them to change it',
    other: "This booking can't be changed online",
  },
};
function customerActionRefusal(job, action, today) {
  if (customerTooLate(job, today)) {
    return { status: 409, body: { error: CUSTOMER_REFUSALS[action].inShop, code: 'in_shop' } };
  }
  if (!CUSTOMER_ACTIONABLE.has(job.booking_state) || (action === 'change' && job.booking_state === 'offered')) {
    return { status: 409, body: { error: CUSTOMER_REFUSALS[action].other, code: 'illegal' } };
  }
  return null;
}

// The booked services as a customer may see them: names always; prices and the
// total only when the shop shows prices online (the /services rule). The total
// is summed in SQL, and left out when any service had no price - a total that
// ignored one job would mislead. Runs inside the request's shop context.
// Spec: docs/superpowers/specs/2026-09-26-book-server-7-multiple-services-design.md
async function bookedServices(jobId) {
  const settings = await db.prepare('SELECT show_prices_online FROM workshop_settings LIMIT 1').get();
  const showPrices = settings?.show_prices_online === 1;
  const rows = await db.prepare(
    `SELECT s.name, js.booked_price FROM workshop_job_services js
     JOIN workshop_services s ON s.id = js.service_id
     WHERE js.workshop_job_id = ? ORDER BY js.position`
  ).all(jobId);
  const total = await db.prepare(
    `SELECT CASE WHEN count(*) > 0 AND count(booked_price) = count(*) THEN sum(booked_price) END AS total
     FROM workshop_job_services WHERE workshop_job_id = ?`
  ).get(jobId);
  return {
    services: rows.map((r) => ({ name: r.name, price: showPrices ? r.booked_price ?? null : null })),
    totalPrice: showPrices ? total?.total ?? null : null,
  };
}

// Staff see an online booking only through the job's Notes (piece 9): the
// bike note, each answered question, and the description, in that order,
// leaving out any part that is empty. A choice question's line names the
// choice (or "I'm not sure") and, when the customer also typed words,
// appends them after " - "; a question answered by words alone shows the
// words on their own. A free-text question's line is just its answer.
function answerNoteLine({ wording, kind, answer, text }) {
  if (kind === 'text') return answer ? `${wording} ${answer}` : null;
  const choiceOrNotSure = answer && typeof answer === 'object' && answer.notSure ? "I'm not sure" : answer;
  const words = text || null;
  const value = choiceOrNotSure && words ? `${choiceOrNotSure} - ${words}` : choiceOrNotSure || words;
  return value ? `${wording} ${value}` : null;
}

function bookingNotes({ bikeNote, questionAnswers, description }) {
  const lines = [];
  if (bikeNote) lines.push(`Bike (customer's words): ${bikeNote}`);
  for (const entry of questionAnswers ?? []) {
    const line = answerNoteLine(entry);
    if (line) lines.push(line);
  }
  if (description) lines.push(`Customer's description: ${description}`);
  return lines.join('\n');
}

// Every check a customer's chosen time passes, in the booking route's order,
// run inside the booking lock. Shared by a new booking and a change (piece
// 12), so a change passes exactly what a booking passes. `ignoreJobId` leaves
// the job's own booking and request out, so a change never collides with the
// booking it changes. Returns { times } or { refusal }, the { status, body } a
// route sends.
async function checkCustomerTime({ jobDate, mechanicId, startTime: rawStart, minutes, ignoreJobId = null }) {
  // The mode for this date decides what the customer chose: a day (drop-off)
  // or a time (timed). Read inside the lock, from the calculator.
  const capacity = await loadCapacity(jobDate, jobDate, { ignoreJobId });
  // Nothing in the past, and nothing sooner than the shop's minimum notice,
  // on the shop's own clock (piece 10) - the same rule availability applies.
  const moment = currentMoment();
  if (jobDate < shopToday(capacity.settings.timeZone, moment)) {
    return { refusal: refusal('That date has passed - please choose another day.') };
  }
  const earliest = earliestBookable(capacity.settings, moment);
  const mode = capacity.days[0].mode;
  const startTime = (rawStart || '').trim();
  let times;
  if (mode === 'dropoff') {
    if (startTime) return { refusal: refusal('This shop takes drop-offs on that day - choose the day, not a time.') };
    times = { startTime: '', endTime: '' };
  } else {
    times = resolveJobTimes(startTime, startTime ? addMinutesToTime(startTime, minutes) : '');
    if (!times.startTime) return { refusal: refusal('A start time is required') };
    if (times.error) return { refusal: refusal(times.error) };
  }
  const inTime = mode === 'dropoff'
    ? dropoffIsInTime(earliest, jobDate, capacity.settings.dropoffWindowEnd)
    : startIsInTime(earliest, jobDate, times.startTime);
  if (!inTime) return { refusal: refusal("That's too soon for the shop - please choose a later time or day.") };

  // Closed days, the day's own opening hours and mechanic overlap first - the
  // same rules the staff routes enforce, from the same place, so their
  // specific messages win.
  const slot = await checkJobSlot({ jobDate, startTime: times.startTime, endTime: times.endTime, mechanicId, ignoreJobId });
  if (slot) return { refusal: slot.taken ? capacityRefusal(slot.error) : refusal(slot.error) };

  // Blocks and the shop's hours are shop rules (400); minutes other bookings
  // have used are capacity (409). The reserve check subtracts the job being
  // booked (freeMinutes has the reserve taken off already). Staff routes
  // deliberately do NOT apply this - a shop may choose to work through its
  // own lunch; a customer may not choose it for them. A block's reason is
  // never given.
  const mech = capacity.days[0].mechanics.find((m) => m.mechanicId === mechanicId);
  if (!mech || !mech.working || (times.startTime && !fitsFreeTime(mech, times.startTime, times.endTime))) {
    return { refusal: refusal('That mechanic is unavailable at that time - please choose another time or day.') };
  }
  if (mech.freeMinutes < minutes) {
    return { refusal: capacityRefusal('That mechanic does not have enough free time that day - please choose another day, or a shorter job.') };
  }
  return { times };
}

// WP-0.2: a booking request sent again with the same request key. Null when
// the key is new. The same details get the booking already made, with the
// same private link (worked out from the key, so nothing is written); other
// details are refused.
// Spec: docs/superpowers/specs/2026-10-05-wp-0-2-booking-bugs-server.md
const REUSED_KEY = { status: 409, body: { error: 'This booking was already sent with different details', code: 'reused_key' } };
async function replayBookingRequest({ keyHash, bodyHash, linkCode }, shopSlug) {
  const made = await db.prepare('SELECT id, booking_request_body_hash FROM workshop_jobs WHERE booking_request_key_hash = ?').get(keyHash);
  if (!made) return null;
  if (made.booking_request_body_hash !== bodyHash) return REUSED_KEY;
  const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(made.id);
  return {
    status: 200,
    body: { ...serializePortalBooking(row), ...(await bookedServices(made.id)), privateLink: linkPath(shopSlug, linkCode) },
  };
}

// The booking link's code, checked the same way on every link route: the
// attempt limiter, a well-formed code, a job with that hash in this shop (the
// dispatcher bound the shop from :shopSlug, so row-level security hides every
// other shop's), and not expired. Answers the refusal itself and returns
// null, or returns { id }.
// Exported for the booking link's quote answer, which stays in server.js
// until answerAndAddToOrder moves with Jack's quote routes.
export async function resolveBookingLink(req, res, code) {
  if (!bookingLinkLimiter.check(clientIp(req))) {
    sendJson(res, 429, { error: 'Too many attempts - please wait a few minutes and try again.' });
    return null;
  }
  // collected_on: the shop's own date of collection, for the 30 days after it.
  const row = /^[0-9a-f]{64}$/.test(code)
    ? await db.prepare(
      `SELECT w.id, w.reference, w.job_date, w.custody_state,
              to_char(w.collected_at AT TIME ZONE COALESCE(ws.time_zone, 'Europe/London'), 'YYYY-MM-DD') AS collected_on,
              s.name AS shop_name, s.address AS shop_address, s.phone AS shop_phone
         FROM workshop_jobs w
         JOIN shops s ON s.id = w.shop_id
         LEFT JOIN workshop_settings ws ON ws.shop_id = w.shop_id
        WHERE w.link_token_hash = ?`
    ).get(hashLinkCode(code))
    : null;
  if (!row) {
    sendJson(res, 404, { error: "We can't find that booking" });
    return null;
  }
  const expiry = linkExpiry({ jobDate: row.job_date, custodyState: row.custody_state, collectedOn: row.collected_on }, await currentShopToday());
  if (expiry.expired) {
    // Which job it was and why, with the shop, for the expired page (cp-expired,
    // bk-expired): nothing that identifies the customer.
    sendJson(res, 410, {
      error: 'This link has expired',
      reference: row.reference,
      reason: expiry.reason,
      shop: { name: row.shop_name, address: row.shop_address || null, phone: row.shop_phone || null },
    });
    return null;
  }
  return { id: row.id };
}

// What the link shows. Deliberately narrow: nothing that identifies the
// customer, no staff notes. The booked services and total only when the shop
// shows prices online (bookedServices). Piece 12 adds what the customer may do
// and the change they asked for.
// Spec: docs/superpowers/specs/2026-09-26-book-server-7-multiple-services-design.md
async function bookingLinkView(jobId, shop) {
  const row = await db.prepare(
    `SELECT w.id, w.reference, w.job_date, w.start_time, w.customer_description, w.customer_bike_note, w.question_answers,
            w.booking_state, w.custody_state, w.work_state, w.signed_off_name,
            w.requested_job_date, w.requested_mechanic_id, w.requested_start_time, w.requested_end_time, w.change_declined_at,
            w.offered_from_date, w.offered_from_time, w.offer_message, w.decline_message,
            w.booked_in_at, w.collected_at,
            (SELECT max(p.part_date) FROM workshop_job_parts p WHERE p.workshop_job_id = w.id) AS last_day,
            b.make AS bike_make, b.model AS bike_model,
            (SELECT count(*)::int FROM workshop_job_attachments a
             WHERE a.workshop_job_id = w.id AND a.from_customer) AS photo_count
     FROM workshop_jobs w
     LEFT JOIN customer_bikes b ON b.id = w.bike_id
     WHERE w.id = ?`
  ).get(jobId);
  const requested = requestedOf(row);
  const today = await currentShopToday();
  const stage = bookingStage(row);
  // "Checked by [name]" once the bike is ready, if the shop shows who signed
  // the job off (mechanic sign-off answer 3; Jack, 18 Oct). Off to start.
  const shows = await db.prepare('SELECT show_sign_off_to_customers, confirmation_note, timed_lead_minutes, dropoff_window_start, dropoff_window_end, booking_mode, next_booking_mode, next_booking_mode_from FROM workshop_settings LIMIT 1').get();
  const checkedBy = shows?.show_sign_off_to_customers === 1 && (stage === 'ready_to_collect' || stage === 'collected')
    ? row.signed_off_name ?? null : null;
  // When to drop the bike off, once the booking stands (Jack, 19 Oct,
  // docs/decisions/2026-10-19-retire-old-workshop-settings.md answers 3 and 7):
  // a set time less the shop's lead time, or the drop-off window when the
  // shop books bikes in for the whole day that day (a set-time shop's job
  // with no time gets nothing: the window isn't its rule; fresh review).
  let dropOff = null;
  if (shows && (stage === 'confirmed' || stage === 'change_requested')) {
    if (row.start_time) {
      const by = addMinutesToTime(row.start_time, -(Number(shows.timed_lead_minutes) || 0));
      dropOff = { by, booked: row.start_time, leadMinutes: timeToMinutes(row.start_time) - timeToMinutes(by) };
    } else if (modeForDate({ bookingMode: shows.booking_mode, nextBookingMode: shows.next_booking_mode, nextBookingModeFrom: shows.next_booking_mode_from }, row.job_date) === 'dropoff'
      && shows.dropoff_window_start && shows.dropoff_window_end) {
      dropOff = { from: shows.dropoff_window_start, to: shows.dropoff_window_end };
    }
  }
  // The shop's additional note, once the booking stands, with or without a
  // drop-off line (Jack, 19 Oct, docs/decisions/2026-10-19-confirmation-note.md).
  const confirmationNote = shows?.confirmation_note && (stage === 'confirmed' || stage === 'change_requested')
    ? shows.confirmation_note : null;
  return {
    reference: row.reference,
    shopName: shop.name,
    jobDate: row.job_date,
    startTime: row.start_time || '',
    description: row.customer_description ?? null,
    bikeNote: row.customer_bike_note ?? null,
    // As asked at booking, from the frozen copy - never the service's current wording.
    answers: (row.question_answers ?? []).map(({ wording, answer, text }) => ({ wording, answer, ...(text ? { text } : {}) })),
    bike: row.bike_make !== null || row.bike_model !== null ? { make: row.bike_make, model: row.bike_model } : null,
    stage,
    checkedBy,
    dropOff,
    confirmationNote,
    photoCount: row.photo_count,
    requested: requested && { jobDate: requested.jobDate, startTime: requested.startTime, mechanicId: requested.mechanicId },
    // The time the shop offered, and where the customer first asked (Jack, 20 Oct).
    offer: row.booking_state === 'offered'
      ? { fromDate: row.offered_from_date, fromTime: row.offered_from_time || '', message: row.offer_message ?? null } : null,
    canAccept: row.booking_state === 'offered' && !customerTooLate(row, today),
    // What the shop told the customer when it declined (Jack, 20 Oct).
    declineMessage: stage === 'declined' ? row.decline_message ?? null : null,
    canChange: customerCanChange(row, today),
    canCancel: customerCanAct(row, today),
    changeDeclined: row.change_declined_at !== null,
    // How far the bike and its work are (Jack, 21 Oct, booking page stages; the
    // contract in openspec/changes/archive/2026-10-21-booking-page-stages/design.md).
    workState: row.work_state,
    bookedInAt: row.booked_in_at ? new Date(row.booked_in_at).toISOString() : null,
    collectedAt: row.collected_at ? new Date(row.collected_at).toISOString() : null,
    // The job's last day, as the job page's "Ready by"; no time until staff can set one.
    // Only while the booking stands and the bike hasn't gone (fresh review).
    expectedReady: (row.booking_state === 'scheduled' || row.booking_state === 'reschedule_requested') && row.custody_state !== 'collected'
      ? { date: row.last_day || row.job_date, time: null } : null,
    shop: await shopLines(),
    // The job's checklist once the work is finished (cp-summary's "Full service
    // checklist"; Jack, 22 Oct): every item, ticked or not, and what the
    // mechanic found. Only one a mechanic used (its own copy, fixed), so
    // never "0 of 10" for a service done without the ticks; none while the
    // work is under way, or for a job without one.
    checklist: row.work_state === 'complete' ? customerChecklist(await jobChecklistCopy(row.id)) : null,
    ...(await jobMoney(row.id)),
    ...(await bookedServices(row.id)),
  };
}

// What was done, what was declined, what's left to pay and what's been paid
// (cp-summary's "What we did" and pay card; Jack, 21 Oct, booking page stages
// answer 4: with Show prices off, every figure is null and the rest shows).
// The work is the job's order's lines; declined is the newest quote's
// declined lines; to pay is what the till would charge (computeOrderTotals,
// group discount included), null once paid; paid is the sale that paid it.
// The quote as a customer sees it (Jack, 22 Oct): staff names only when the
// shop's "Show who signed off to customers" switch is on (mechanic sign-off
// answer 3: no staff names reach customers until a shop chooses), so "Alex
// recommends more work" or "We recommend more work"; and the customer's own
// first name, for "Thanks, Maya".
async function customerQuote(result, jobId) {
  const shows = (await db.prepare('SELECT show_sign_off_to_customers FROM workshop_settings LIMIT 1').get())?.show_sign_off_to_customers === 1;
  const who = await db.prepare(
    `SELECT m.name AS mechanic_name, c.name AS customer_name FROM workshop_jobs j
       LEFT JOIN employees m ON m.id = j.mechanic_id LEFT JOIN customers c ON c.id = j.customer_id
      WHERE j.id = ?`
  ).get(jobId);
  const showPrices = (await db.prepare('SELECT show_prices_online FROM workshop_settings LIMIT 1').get())?.show_prices_online === 1;
  const q = serializeQuoteWithLines(result.quote, result.lines, result.totals);
  return {
    ...q,
    lines: q.lines.map((l) => ({ ...l, decidedByName: shows ? l.decidedByName : null })),
    mechanicName: shows ? who?.mechanic_name ?? null : null,
    earlier: await earlierAnswers(result.quote),
    agreedTotal: await agreedBefore(result.quote, showPrices),
    customerFirstName: who?.customer_name ? who.customer_name.trim().split(/\s+/)[0] : null,
  };
}

function customerChecklist(c) {
  return c ? { name: c.name, items: c.items.map((i) => ({ name: i.label, done: i.done, note: i.note })) } : null;
}

async function jobMoney(jobId) {
  const settings = await db.prepare('SELECT show_prices_online FROM workshop_settings LIMIT 1').get();
  const showPrices = settings?.show_prices_online === 1;
  const figure = (n) => (showPrices && n !== null && n !== undefined ? Number(n) : null);
  const order = await db.prepare(
    `SELECT d.id, d.status, d.discount, d.customer_id, s.total AS paid_total, s.created_at AS paid_at
       FROM sale_documents d LEFT JOIN sales s ON s.id = d.converted_sale_id
      WHERE d.workshop_job_id = ? AND d.kind = 'order' AND d.status <> 'cancelled'
      ORDER BY d.id DESC LIMIT 1`
  ).get(jobId);
  const items = order
    ? await db.prepare('SELECT name, unit_price, qty, line_total FROM sale_document_items WHERE document_id = ? ORDER BY id').all(order.id)
    : [];
  // Every revision the customer saw, not only the newest: a newer quote keeps
  // the earlier answers (fresh review). Priced in the database, as the quote is.
  // Each line's latest answer: pads said no to and then yes to aren't "no thanks".
  const declined = (await latestAnswers(jobId)).filter((l) => l.decision === 'declined');
  const paid = order?.status === 'converted' && order.paid_at
    ? { at: new Date(order.paid_at).toISOString(), amount: figure(order.paid_total) } : null;
  let due = 0;
  if (order && !paid && items.length) {
    due = (await computeOrderTotals({
      items: items.map((l) => ({ unitPrice: l.unit_price, qty: l.qty })), discount: order.discount, customerId: order.customer_id,
    })).total;
  }
  return {
    work: items.map((l) => ({ name: l.name, price: figure(l.line_total) })),
    declined: declined.map((l) => ({ name: l.description, price: figure(l.line_total) })),
    toPay: paid || due <= 0 ? null : figure(due),
    // Nothing owed on collection, said even with prices hidden, as Bike ready says it.
    nothingToPay: !paid && due <= 0,
    paid,
  };
}

// The shop's lines on the customer's page (cp-summary's shopLines): address,
// phone and opening hours, each null when the shop hasn't given it.
async function shopLines() {
  const shop = await db.prepare('SELECT address, phone FROM shops WHERE id = current_setting(\'app.current_shop_id\')::int').get();
  const settings = await db.prepare('SELECT * FROM workshop_settings LIMIT 1').get();
  return {
    address: shop?.address || null,
    phone: shop?.phone || null,
    openingHours: (settings && formatOpeningHours(openingHoursFor(toCapacitySettings(settings)))) || null,
  };
}

// A change of day, mechanic or time through the link (piece 12). The new time
// passes checkCustomerTime with the booking's own job left out.
// - pending: moves at once and stays pending (decision 4); its hold moves.
// - scheduled: becomes a request (decision 2) - the booking keeps its time
//   and hold, the requested time is stored and held too (decision 6).
// - reschedule_requested: the new request replaces the stored one.
// A confirmed booking asking for the time it already has makes no request,
// and withdraws any it had (decision log D5).
// How long the booking takes. Every online booking stores its services'
// total as planned_minutes; a staff job with a link falls back to its times,
// then to the not-sure hour.
function bookedMinutes(job) {
  return job.planned_minutes
    || (job.start_time ? Math.max(0, timeToMinutes(job.end_time) - timeToMinutes(job.start_time)) : 60);
}

async function changeBookingTime(job, { jobDate, mechanicId, startTime }) {
  const refused = customerActionRefusal(job, 'change', await currentShopToday());
  if (refused) return refused;
  const sameAsBooked = jobDate === job.job_date && mechanicId === job.mechanic_id
    && (startTime || '').trim() === (job.start_time || '');
  if (job.booking_state !== 'pending' && sameAsBooked) {
    if (job.booking_state === 'reschedule_requested') await withdrawRequest(job);
    return undefined;
  }
  const minutes = bookedMinutes(job);
  const checked = await checkCustomerTime({ jobDate, mechanicId, startTime, minutes, ignoreJobId: job.id });
  if (checked.refusal) return checked.refusal;
  const { times } = checked;
  if (job.booking_state === 'pending') {
    await applyLocked(job, 'change_time');
    await db.prepare(
      `UPDATE workshop_jobs SET job_date = ?, mechanic_id = ?, start_time = ?, end_time = ?, change_declined_at = NULL, updated_at = now()
       WHERE id = ?`
    ).run(jobDate, mechanicId, times.startTime, times.endTime, job.id);
  } else {
    await applyLocked(job, job.booking_state === 'scheduled' ? 'request_reschedule' : 'change_time');
    await db.prepare(
      `UPDATE workshop_jobs SET requested_job_date = ?, requested_mechanic_id = ?, requested_start_time = ?,
         requested_end_time = ?, requested_at = now(), change_declined_at = NULL, updated_at = now()
       WHERE id = ?`
    ).run(jobDate, mechanicId, times.startTime, times.endTime, job.id);
  }
  // Places, moves or keeps the holds to match (syncRequestedHold runs first).
  await syncJobHold(job.id);
  return undefined;
}

// The customer takes their change request back: the booking returns to
// scheduled at the time it kept all along, and the requested time is let go.
async function withdrawRequest(job) {
  await applyLocked(job, 'withdraw');
  await db.prepare(`UPDATE workshop_jobs SET ${CLEAR_REQUEST}, change_declined_at = NULL, updated_at = now() WHERE id = ?`).run(job.id);
  await syncJobHold(job.id);
}

// A booking message from the customer's side (pretend for now, so the link
// reads "[link]"): Booking confirmed for a booking confirmed at once (Jack, 19
// Oct, auto-confirm), Request received for one waiting for the shop, Booking
// cancelled when the customer cancels (Jack, 20 Oct, booking messages answer
// 4). The link is the one the customer already has, made absolute with
// APP_PUBLIC_URL only: these routes need no sign-in, so the Host a request
// claims must never reach a customer's message (fresh review). Without it, a
// real message isn't queued. After the commit; one that can't be queued is
// logged, and what the customer did stands.
async function sendLinkMessage(key, jobId, shopId, privateLink) {
  try {
    const { customerId } = await prepare('SELECT customer_id AS "customerId" FROM workshop_jobs WHERE id = ?').get(jobId);
    if (await whyNotQueued(key, customerId)) return;
    const link = await messageLink(async () => {
      if (!process.env.APP_PUBLIC_URL) throw new Error('APP_PUBLIC_URL is needed for a customer message sent from a public route');
      return `${process.env.APP_PUBLIC_URL}${privateLink}`;
    });
    const { vars } = await bookingMessageVars(jobId, shopId, link, key);
    await queueMessage({ customerId, jobId, key, vars });
  } catch (err) {
    console.error(`Messages: ${key} for job ${jobId} couldn't be queued`, err);
  }
}

export function register(route) {
  route('POST', '/api/portal/:shopSlug/signup', async (req, res, params) => {
    const ip = clientIp(req);
    if (!portalSignupLimiter.check(ip)) {
      return sendJson(res, 429, { error: 'Too many accounts created from this network - please try again later.' });
    }
    const body = await readJsonBody(req);
    let created;
    try {
      created = await signupCustomer({ shopSlug: params.shopSlug, email: body.email, password: body.password, name: body.name });
    } catch (err) {
      if (err instanceof CustomerAuthError) return badRequest(res, err.message);
      throw err;
    }
    const token = await createCustomerSession(created.login.id);
    setCustomerSessionCookie(req, res, token);
    sendJson(res, 201, {
      id: created.login.id,
      email: created.login.email,
      name: created.customer.name,
      shopName: created.shop.name,
      shopSlug: created.shop.slug,
    });
  });

  route('POST', '/api/portal/:shopSlug/login', async (req, res, params) => {
    const ip = clientIp(req);
    if (!portalLoginLimiter.check(ip)) {
      return sendJson(res, 429, { error: 'Too many login attempts - please wait a few minutes and try again.' });
    }
    const body = await readJsonBody(req);
    let login;
    try {
      login = await verifyCustomerLogin(params.shopSlug, body.email, body.password);
    } catch (err) {
      if (err instanceof CustomerAuthError) return sendJson(res, 401, { error: err.message });
      throw err;
    }
    portalLoginLimiter.reset(ip);
    const token = await createCustomerSession(login.id);
    setCustomerSessionCookie(req, res, token);
    sendJson(res, 200, serializeCustomerLogin(login));
  });

  route('POST', '/api/portal/:shopSlug/logout', async (req, res) => {
    const { [CUSTOMER_SESSION_COOKIE]: token } = parseCookies(req);
    await destroyCustomerSession(token);
    clearCustomerSessionCookie(res);
    sendJson(res, 200, { ok: true });
  });

  route('GET', '/api/portal/:shopSlug/me', async (req, res, params) => {
    const ctx = await currentCustomerSession(req);
    if (!ctx || ctx.shop.slug !== params.shopSlug) return sendJson(res, 401, { error: 'Not signed in' });
    const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(ctx.login.customer_id);
    sendJson(res, 200, {
      id: ctx.login.id,
      email: ctx.login.email,
      name: customer ? customer.name : '',
      shopName: ctx.shop.name,
      shopSlug: ctx.shop.slug,
    });
  });

  // Public - no login required to see what's open, only to actually book.
  route('GET', '/api/portal/:shopSlug/mechanics', async (req, res) => {
    const mechanics = await db
      .prepare('SELECT id, name, working_days FROM employees WHERE is_mechanic = 1 AND active = 1 ORDER BY name')
      .all();
    const settings = await db.prepare('SELECT * FROM workshop_settings LIMIT 1').get();
    sendJson(res, 200, {
      mechanics: mechanics.map((m) => ({ id: m.id, name: m.name, workingDays: parseWorkingDays(m.working_days) })),
      // The widest day, so the old booking page's grid covers every open hour;
      // a shorter day comes back from /availability as busy time.
      openingTime: widestHours(toCapacitySettings(settings)).open,
      closingTime: widestHours(toCapacitySettings(settings)).close,
      openingDays: parseWorkingDays(settings.opening_days),
    });
  });

  // The customer booking page's service list (book screens 01 and 02). Public,
  // no sign-in, inside the shop's row-level security context like every portal
  // route, so it can only ever read this shop's rows. Only services the shop has
  // ticked bookable online, and prices only when the shop shows prices online
  // (docs/decisions/2026-09-04-booking-mode-and-downtime.md §7). Prices pass
  // through as stored - nothing is totalled here.
  // shopName: the booking screens' header (d1 spec).
  // screens: service, service-list
  // Piece 8: docs/superpowers/specs/2026-09-26-book-server-8-service-includes-design.md
  route('GET', '/api/portal/:shopSlug/services', async (req, res, params, query, shop) => {
    const settings = await db.prepare('SELECT show_prices_online, confirm_bookings_automatically FROM workshop_settings LIMIT 1').get();
    const showPrices = settings?.show_prices_online === 1;
    const services = await db.prepare(
      `SELECT id, name, price, minutes, kind, category_id, questions FROM workshop_services
       WHERE active = 1 AND bookable_online = 1 ORDER BY position, name`
    ).all();
    const categories = await db.prepare(
      'SELECT id, name FROM workshop_service_categories ORDER BY position, name'
    ).all();
    const toPublic = (s) => ({ id: s.id, name: s.name, price: showPrices ? s.price : null, minutes: s.minutes, questions: s.questions });
    const individual = services.filter((s) => s.kind === 'individual');
    // What each full service includes, for its card and for d2's "already part
    // of your <full service>" warning: services still in use, bookable online
    // or not (piece 8 decision 4), in the shop's order.
    const links = await db.prepare(
      `SELECT i.service_id, s.id, s.name FROM workshop_service_includes i
       JOIN workshop_services s ON s.id = i.included_service_id
       WHERE s.active = 1 AND s.kind = 'individual' ORDER BY i.service_id, i.position`
    ).all();
    const includesOf = (id) => links.filter((l) => l.service_id === id).map((l) => ({ id: l.id, name: l.name }));
    sendJson(res, 200, {
      shopName: shop.name,
      showPrices,
      // Step 4 words its button by it (Jack, 19 Oct, auto-confirm; drawn as bk-details-auto).
      confirmsAutomatically: settings?.confirm_bookings_automatically === 1,
      full: services.filter((s) => s.kind === 'full').map((s) => ({ ...toPublic(s), includes: includesOf(s.id) })),
      categories: categories
        .map((c) => ({
          id: c.id,
          name: c.name,
          services: individual.filter((s) => s.category_id === c.id).map(toPublic),
        }))
        .filter((c) => c.services.length > 0),
      uncategorised: individual.filter((s) => s.category_id === null).map(toPublic),
    });
  });

  // The terms a customer is agreeing to when they book: this shop's own when
  // it has set one, else the standard Wheelhouse terms. Public, no sign-in,
  // read through the shop's row-level security like every portal route, so it
  // can only ever read this shop's own setting.
  // Spec: docs/superpowers/specs/2026-09-26-book-server-11-terms-design.md
  route('GET', '/api/portal/:shopSlug/terms', async (req, res) => {
    const settings = await db.prepare('SELECT booking_terms FROM workshop_settings LIMIT 1').get();
    const standard = !settings?.booking_terms;
    sendJson(res, 200, {
      title: 'Booking terms',
      text: standard ? STANDARD_BOOKING_TERMS : settings.booking_terms,
      standard,
    });
  });

  // Public: the customer calendar. `busy` and `fullDays` keep the shape the old
  // booking page reads (public-portal/portal.js:263) - blocks, closures and a
  // shorter day come back as busy time with no reason. With `minutes`, `days`
  // adds what the new screens need: the mode per date, and per mechanic the
  // start times (timed) or whether the job fits (drop-off). Never returned: a
  // block's reason, other customers' jobs, minute totals.
  // screens: date, appointment, full
  route('GET', '/api/portal/:shopSlug/availability', async (req, res, params, query) => {
    const start = query.get('start');
    const end = query.get('end');
    if (!isRealDate(start || '') || !isRealDate(end || '')) {
      return badRequest(res, 'Valid start and end dates are required');
    }
    if (end < start) return badRequest(res, 'The end date must be on or after the start date');
    if (dayCount(start, end) > MAX_RANGE_DAYS) {
      return badRequest(res, `Ask for at most ${MAX_RANGE_DAYS} days at a time`);
    }
    let minutes = null;
    if (query.get('minutes') !== null) {
      minutes = Number(query.get('minutes'));
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 720) {
        return badRequest(res, 'minutes must be a whole number between 1 and 720');
      }
    }
    let mechanicFilter = null;
    if (query.get('mechanicId')) {
      mechanicFilter = Number(query.get('mechanicId'));
      if (!Number.isInteger(mechanicFilter)) return badRequest(res, 'mechanicId must be a whole number');
    }
    const keep = (x) => mechanicFilter === null || x.mechanicId === mechanicFilter;

    const { settings, jobs, days } = await loadCapacity(start, end);
    const busy = [];
    const fullDays = [];
    for (const day of days) {
      const view = legacyView(day, settings, jobs);
      busy.push(...view.busy);
      fullDays.push(...view.fullDays);
    }
    const body = { busy: busy.filter(keep), fullDays: fullDays.filter(keep) };
    if (minutes !== null) {
      // Nothing sooner than the shop's minimum notice, on the shop's clock (piece
      // 10). A date before today is always before the earliest moment, so it
      // offers nothing.
      const earliest = earliestBookable(settings);
      body.days = days.map((day) => ({
        date: day.date,
        mode: day.mode,
        ...(day.mode === 'dropoff'
          ? { dropoffWindow: { start: settings.dropoffWindowStart, end: settings.dropoffWindowEnd } } : {}),
        mechanics: day.mechanics.filter(keep).map((m) => (day.mode === 'timed'
          ? {
            mechanicId: m.mechanicId,
            startTimes: startTimesFor(m, minutes).filter((t) => startIsInTime(earliest, day.date, t)),
          }
          : {
            mechanicId: m.mechanicId,
            bookable: fitsDropoff(m, minutes) && dropoffIsInTime(earliest, day.date, settings.dropoffWindowEnd),
          })),
      }));
    }
    sendJson(res, 200, body);
  });

  route('GET', '/api/portal/:shopSlug/bikes', async (req, res, params) => {
    const ctx = await currentCustomerSession(req);
    if (!ctx || ctx.shop.slug !== params.shopSlug) return sendJson(res, 401, { error: 'Not signed in' });
    const rows = await db
      .prepare('SELECT * FROM customer_bikes WHERE customer_id = ? AND active = 1 ORDER BY make, model')
      .all(ctx.login.customer_id);
    sendJson(res, 200, rows.map(serializeBike));
  });

  route('POST', '/api/portal/:shopSlug/bikes', async (req, res, params) => {
    const ctx = await currentCustomerSession(req);
    if (!ctx || ctx.shop.slug !== params.shopSlug) return sendJson(res, 401, { error: 'Not signed in' });
    const body = await readJsonBody(req);
    const make = (body.make || '').trim();
    const model = (body.model || '').trim();
    if (!make && !model) return badRequest(res, 'Make or model is required');
    const info = await db
      .prepare(
        `INSERT INTO customer_bikes (customer_id, make, model, colour, serial_number, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(ctx.login.customer_id, make, model, (body.colour || '').trim(), (body.serialNumber || '').trim(), nowIso());
    const row = await db.prepare('SELECT * FROM customer_bikes WHERE id = ?').get(info.lastInsertRowid);
    sendJson(res, 201, serializeBike(row));
  });

  // screens: approval, approval-done, stale
  // The customer reads the quote their approval link points at. Scoped through
  // readQuoteForCustomer() (server/workshop/quotes.js), which uses the same
  // ownership check recordLineDecision() and approve() use below - a quote
  // belonging to another customer in this shop is refused exactly like one
  // that does not exist. This route returns the revision the approval link
  // names - including a superseded one - so screen 51 (stale) can tell the
  // customer the quote has since changed. It cannot compare revisions itself;
  // each revision is its own row (createRevision(), quotes.js), and there is
  // only ever one row here to look at.
  route('GET', '/api/portal/:shopSlug/quotes/:id', async (req, res, params) => {
    const ctx = await currentCustomerSession(req);
    if (!ctx || ctx.shop.slug !== params.shopSlug) return sendJson(res, 401, { error: 'Not signed in' });
    const result = await readQuoteForCustomer({
      quoteId: Number(params.id),
      customerId: ctx.login.customer_id,
    });
    if (!result.ok) return notFound(res, 'Quote not found');
    sendJson(res, 200, await customerQuote(result, result.quote.workshop_job_id));
  });

  // screens: approval
  // Under /api/portal/ because the customer makes this decision on their phone,
  // authenticated as a customer - not as staff. Resolved exactly the way every
  // other portal route does it.
  route('POST', '/api/portal/:shopSlug/quotes/:id/lines/:lineId/decision', async (req, res, params) => {
    const ctx = await currentCustomerSession(req);
    if (!ctx || ctx.shop.slug !== params.shopSlug) return sendJson(res, 401, { error: 'Not signed in' });
    const body = await readJsonBody(req);
    sendQuoteResult(res, await recordLineDecision({
      quoteId: Number(params.id),
      lineId: Number(params.lineId),
      decision: body.decision,
      customerId: ctx.login.customer_id,
    }));
  });

  // screens: approval-done, approved, stale
  route('POST', '/api/portal/:shopSlug/quotes/:id/approve', async (req, res, params) => {
    const ctx = await currentCustomerSession(req);
    if (!ctx || ctx.shop.slug !== params.shopSlug) return sendJson(res, 401, { error: 'Not signed in' });
    const body = await readJsonBody(req);
    // The revision the customer's link was issued for. Required, never defaulted
    // to the current one - defaulting it would approve whatever the price happens
    // to be now, which is the exact failure screen 51 exists to show.
    if (!Number.isInteger(body.revision)) {
      return badRequest(res, 'revision is required - it comes from the approval link');
    }
    sendQuoteResult(res, await approveQuote({
      quoteId: Number(params.id),
      linkRevision: body.revision,
      customerId: ctx.login.customer_id,
    }));
  });

  route('GET', '/api/portal/:shopSlug/bookings', async (req, res, params) => {
    const ctx = await currentCustomerSession(req);
    if (!ctx || ctx.shop.slug !== params.shopSlug) return sendJson(res, 401, { error: 'Not signed in' });
    const rows = await db
      .prepare(WORKSHOP_JOB_SELECT + ' WHERE w.customer_id = ? ORDER BY w.job_date DESC, w.start_time DESC')
      .all(ctx.login.customer_id);
    sendJson(res, 200, rows.map((r) => serializePortalBooking(r)));
  });

  route('POST', '/api/portal/:shopSlug/bookings', async (req, res, params, query, shop) => {
    const ctx = await currentCustomerSession(req);
    const signedIn = ctx && ctx.shop.slug === params.shopSlug;
    let body;
    try {
      body = await readJsonBody(req, MAX_BOOKING_BODY_BYTES, { answerOverflow: true });
    } catch (err) {
      // The rest of a too-big body may still be arriving; close after answering.
      res.setHeader('connection', 'close');
      return badRequest(res, err.message === 'Payload too large'
        ? 'Those photos are too large to send — please add fewer or smaller photos'
        : 'Invalid request body');
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return badRequest(res, 'Invalid request body');

    // A retry of a booking already made (WP-0.2) is answered before anything
    // else is checked: its own slot is taken now, so the checks below would
    // refuse it. Checked again inside the lock, for two retries at once.
    const key = readRequestKey(body);
    if (key.error) return badRequest(res, key.error);
    const requestKey = key.value;
    if (requestKey) {
      const replay = await replayBookingRequest(requestKey, params.shopSlug);
      if (replay) return sendJson(res, replay.status, replay.body);
    }

    // The request's own fields are checked before any customer row is created, so
    // a bad request leaves nothing behind. The phone the channel rule needs is the
    // guest's, or the signed-in customer's own.
    const phoneForChannel = signedIn
      ? ((await db.prepare('SELECT phone FROM customers WHERE id = ?').get(ctx.login.customer_id))?.phone || '') || (body.guestPhone || '')
      : body.guestPhone;
    const parsed = parseBookingRequest(body, phoneForChannel);
    if (parsed.error) return badRequest(res, parsed.error);
    const request = parsed.value;

    // Answers belong to a chosen service's questions; "not sure" has none. Any
    // answers value other than absent, null or an empty list is refused —
    // including a non-list value, which would otherwise be silently dropped.
    if (request.notSure && !(body.answers === undefined || body.answers === null ||
      (Array.isArray(body.answers) && body.answers.length === 0))) {
      return badRequest(res, 'Answers can only be given for a chosen service');
    }

    const jobDate = (body.jobDate || '').trim();
    if (!isRealDate(jobDate)) return badRequest(res, 'A valid date is required');
    const description = (body.description || '').trim();
    if (request.notSure && !description) return badRequest(res, 'Please describe what you need done');

    // The bike in the customer's own words (piece 9) - a note on the booking,
    // not a customer_bikes row; staff create the real bike at check-in.
    // Optional: absent, null or blank after trimming stores null.
    if (body.bikeNote !== undefined && body.bikeNote !== null && typeof body.bikeNote !== 'string') {
      return badRequest(res, 'Your bike description must be text');
    }
    const bikeNote = typeof body.bikeNote === 'string' ? body.bikeNote.trim() : '';
    if (bikeNote.length > 200) return badRequest(res, 'Your bike description can be up to 200 characters');
    // The spending limit (Workshop day 41): whole pounds, or none to ask first.
    const spendLimit = body.spendLimit ?? null;
    if (spendLimit !== null && !(Number.isInteger(spendLimit) && spendLimit >= 1 && spendLimit <= 100000)) {
      return badRequest(res, 'Enter the most the whole bill can come to, in whole pounds.');
    }

    // What the customer chose: one or more services this shop ticked bookable
    // online, in the order chosen, or the "not sure" hour. Read through the
    // shop's row-level security, so another shop's service id finds nothing.
    let chosen; // [{ id, name, minutes, questions }] in the order chosen
    if (request.notSure) {
      chosen = [];
    } else {
      const found = await db
        .prepare('SELECT id, name, minutes, questions FROM workshop_services WHERE id = ANY(?) AND active = 1 AND bookable_online = 1')
        .all(request.serviceIds);
      if (found.length !== request.serviceIds.length) return badRequest(res, 'That service is not available to book');
      const byId = new Map(found.map((s) => [s.id, s]));
      chosen = request.serviceIds.map((id) => byId.get(id));
      // A full service already covers the individual services it includes
      // (piece 8), so booking one alongside it would charge twice for the same
      // work. The booking screen locks them; this holds however a booking
      // arrives (d2 decision, 26 Sep).
      const overlap = await db.prepare(
        `SELECT f.name AS full_name, p.name AS part_name FROM workshop_service_includes i
         JOIN workshop_services f ON f.id = i.service_id
         JOIN workshop_services p ON p.id = i.included_service_id
         WHERE i.service_id = ANY(?) AND i.included_service_id = ANY(?)
         ORDER BY f.name, i.position LIMIT 1`
      ).get(request.serviceIds, request.serviceIds);
      if (overlap) return badRequest(res, `${overlap.full_name} already includes ${overlap.part_name}`);
    }
    const minutes = request.notSure ? 60 : chosen.reduce((sum, s) => sum + s.minutes, 0);
    if (minutes > 720) return badRequest(res, "That's too much work for one visit - please book the jobs separately");
    const serviceNames = request.notSure ? 'Not sure' : chosen.map((s) => s.name).join(' + ');

    // Each chosen service's answers, checked against its questions as they are
    // now, before the guest customer row - the first write. A frozen copy goes on
    // the job so later edits to the questions never change this booking. Not
    // sure has no services, so no answers to check.
    let questionAnswers = null;
    if (!request.notSure) {
      const list = body.answers === undefined || body.answers === null ? [] : body.answers;
      if (!Array.isArray(list)) return badRequest(res, 'Answers must be a list');
      const chosenIds = new Set(chosen.map((s) => s.id));
      if (list.some((a) => !chosenIds.has(a?.serviceId))) {
        return badRequest(res, "Those answers don't match the services chosen");
      }
      questionAnswers = [];
      for (const s of chosen) {
        const mine = list.filter((a) => a.serviceId === s.id).map(({ serviceId: _drop, ...rest }) => rest);
        const checked = checkAnswers(s.questions ?? [], mine);
        if (checked.error) return badRequest(res, checked.error);
        questionAnswers.push(...checked.value.map((x) => ({ serviceId: s.id, ...x })));
      }
    }

    // Photos are checked here with the other request checks: before the guest
    // limiter and before any write, so a refusal leaves nothing behind. They are
    // allowed on a "not sure" booking too - they describe the problem, not the service.
    const checkedPhotos = readBookingPhotos(body.photos);
    if (checkedPhotos.error) return badRequest(res, checkedPhotos.error);
    const photos = checkedPhotos.value;

    // No account required to book: an out-of-towner booking a single job
    // shouldn't be forced through signup. Falls back to a guest customer
    // (a new row each time, see resolveGuestCustomer) instead of the
    // signed-in customer's own record - rate-limited per IP since guests skip
    // portalSignupLimiter (server/routes/portal.js), the only other gate on how fast jobs/customers get
    // created here.
    let customerId;
    if (signedIn) {
      customerId = ctx.login.customer_id;
    } else {
      const ip = clientIp(req);
      if (!portalGuestBookingLimiter.check(ip)) {
        return sendJson(res, 429, { error: 'Too many booking requests from this network - please try again later.' });
      }
      try {
        const guest = await resolveGuestCustomer({ name: body.guestName, phone: body.guestPhone });
        customerId = guest.id;
      } catch (err) {
        if (err instanceof CustomerAuthError) return badRequest(res, err.message);
        throw err;
      }
    }

    const mechResolved = await resolveJobMechanicId(body.mechanicId, null);
    if (!mechResolved.ok || !mechResolved.mechanicId) return badRequest(res, 'Please choose a mechanic');

    // Inside the lock: the time checks (checkCustomerTime), then the writes.
    let confirmedAtOnce = false;
    const out = await withBookingLock([jobDate], async () => {
      if (requestKey) {
        const replay = await replayBookingRequest(requestKey, params.shopSlug);
        if (replay) return replay;
      }
      const checked = await checkCustomerTime({ jobDate, mechanicId: mechResolved.mechanicId, startTime: body.startTime, minutes });
      if (checked.refusal) return checked.refusal;
      const { times } = checked;

      // Either an existing bike of theirs, or a new one registered inline -
      // never a bike belonging to another customer (checked below).
      let bikeId = null;
      if (body.newBike) {
        const make = (body.newBike.make || '').trim();
        const model = (body.newBike.model || '').trim();
        if (!make && !model) return refusal('Bike make or model is required');
        const info = await db
          .prepare(
            `INSERT INTO customer_bikes (customer_id, make, model, colour, serial_number, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(
            customerId,
            make,
            model,
            (body.newBike.colour || '').trim(),
            (body.newBike.serialNumber || '').trim(),
            nowIso()
          );
        bikeId = info.lastInsertRowid;
      } else if (body.bikeId) {
        const bike = await db
          .prepare('SELECT * FROM customer_bikes WHERE id = ? AND customer_id = ? AND active = 1')
          .get(Number(body.bikeId), customerId);
        if (!bike) return refusal('Bike not found');
        bikeId = bike.id;
      }

      // Never trusts a client-sent customerId or status - always the resolved
      // customer (signed-in, or a new guest row each time, see
      // resolveGuestCustomer), 'pending' until a mechanic reviews it, same
      // principle as createSale() never trusting a client-sent total. With the
      // shop's "Confirm bookings automatically" on, a booking that has passed
      // every check above is saved confirmed instead, where accepting would put
      // it, and marked new until staff open it (Jack, 19 Oct, auto-confirm).
      // Read here, inside the lock, so a switch mid-booking can't half-apply.
      const autoSetting = await db.prepare('SELECT confirm_bookings_automatically FROM workshop_settings LIMIT 1').get();
      confirmedAtOnce = autoSetting?.confirm_bookings_automatically === 1;
      const linkCode = requestKey ? requestKey.linkCode : newLinkCode();
      let jobId;
      try {
        const bikeNoteValue = bikeNote || null;
        const title = (description
          ? `Online booking: ${serviceNames} - ${description}`
          : `Online booking: ${serviceNames}`).slice(0, 200);
        jobId = await createWorkshopJob({
          title,
          customerId,
          bikeId,
          mechanicId: mechResolved.mechanicId,
          jobDate,
          startTime: times.startTime,
          endTime: times.endTime,
          bookingState: confirmedAtOnce ? 'scheduled' : 'pending',
          onlineUnseen: confirmedAtOnce,
          workState: 'not_started',
          custodyState: 'expected',
          notes: bookingNotes({ bikeNote: bikeNoteValue, questionAnswers, description }),
          skipAutoOrder: false,
          plannedMinutes: minutes,
          termsAcceptedAt: nowIso(),
          serviceIds: request.serviceIds,
          linkTokenHash: hashLinkCode(linkCode),
          customerDescription: description || null,
          customerBikeNote: bikeNoteValue,
          spendLimit,
          questionAnswers,
          bookingRequestKeyHash: requestKey?.keyHash,
          bookingRequestBodyHash: requestKey?.bodyHash,
        });
      } catch (err) {
        // The 024 index, a second guard behind the lock. createWorkshopJob's own
        // ROLLBACK was a savepoint, so this transaction is still usable. The 039
        // index is the last guard on a request key: the same key, on another
        // day, committed while this one waited. Its link is worked out from the
        // key, so the 027 link index can trip first for the same reason.
        const keyIndexes = ['idx_workshop_jobs_booking_request_key', 'idx_workshop_jobs_link_token_hash'];
        if (err.code === '23505' && requestKey && keyIndexes.includes(err.constraint)) return REUSED_KEY;
        if (err.code === '23505') return capacityRefusal(SLOT_GONE);
        throw err;
      }
      // Saved only now, after the job is in, inside the lock: every refusal path
      // above (including the 409 from the index) returns before this, and that
      // return still COMMITs, so writing earlier would keep the change on a
      // refused booking. Email is written only when one was sent; a phone is
      // filled in only when the customer has none, never overwritten. For a guest
      // this row is brand new each time (see resolveGuestCustomer); for a
      // signed-in customer it overwrites.
      await db
        .prepare(
          `UPDATE customers SET update_channel = ?, marketing_permission = ?, email = COALESCE(NULLIF(?, ''), email), phone = COALESCE(NULLIF(phone, ''), NULLIF(?, ''), phone), updated_at = ? WHERE id = ?`
        )
        .run(request.updateChannel, request.marketingPermission, request.email, String(body.guestPhone || '').trim(), nowIso(), customerId);
      const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(jobId);
      const booked = await bookedServices(jobId);
      // The last write, so nothing after it can fail and leave files behind for a
      // booking that rolled back. saveBookingPhotos removes its own files if a
      // write or insert fails, and the error rolls the whole booking back.
      await saveBookingPhotos({
        photos,
        uploadsDir: UPLOADS_DIR,
        insertRow: ({ storageKey, originalName, contentType, sizeBytes }) => db
          .prepare(
            `INSERT INTO workshop_job_attachments (workshop_job_id, storage_key, original_name, content_type, size_bytes, from_customer)
             VALUES (?, ?, ?, ?, ?, true)`
          )
          .run(jobId, storageKey, originalName, contentType, sizeBytes),
      });
      // The only time the code leaves the server: the database keeps its hash.
      return {
        status: 201,
        body: {
          ...serializePortalBooking(row),
          ...booked,
          privateLink: linkPath(params.shopSlug, linkCode),
        },
      };
    });
    // After the commit, as accepting sends it: Booking confirmed for a booking
    // confirmed at once, carrying the link the customer has just been given
    // (never a new one, which would end theirs). One that can't be queued is
    // logged; the booking stands.
    if (out.status === 201) await sendLinkMessage(confirmedAtOnce ? 'booking_confirmed' : 'request_received', out.body.id, shop.id, out.body.privateLink);
    sendJson(res, out.status, out.body);
  });

  // The private booking link, read back without sign-in.
  // screens: pending, change-pending, cancelled
  route('GET', '/api/portal/:shopSlug/booking-links/:code', async (req, res, params, query, shop) => {
    const found = await resolveBookingLink(req, res, params.code);
    if (!found) return;
    sendJson(res, 200, await bookingLinkView(found.id, shop));
  });

  // The days and times this booking could move to (Jack, 20 Oct: Change the
  // date; openspec/changes/change-date): for its own mechanic and length, with
  // the booking and any change it asked for left out of capacity, so its own
  // slot can be chosen again. Refused as the change route refuses, and for a
  // booking with no mechanic (the change route needs one).
  // screens: bk-change
  route('GET', '/api/portal/:shopSlug/booking-links/:code/availability', async (req, res, params, query) => {
    const found = await resolveBookingLink(req, res, params.code);
    if (!found) return;
    const start = query.get('start');
    const end = query.get('end');
    if (!isRealDate(start || '') || !isRealDate(end || '')) {
      return badRequest(res, 'Valid start and end dates are required');
    }
    if (end < start) return badRequest(res, 'The end date must be on or after the start date');
    if (dayCount(start, end) > MAX_RANGE_DAYS) {
      return badRequest(res, `Ask for at most ${MAX_RANGE_DAYS} days at a time`);
    }
    const job = await db.prepare('SELECT * FROM workshop_jobs WHERE id = ?').get(found.id);
    const refused = customerActionRefusal(job, 'change', await currentShopToday());
    if (refused) return sendJson(res, refused.status, refused.body);
    if (job.mechanic_id === null) {
      return sendJson(res, 409, { error: CUSTOMER_REFUSALS.change.other, code: 'illegal' });
    }
    const minutes = bookedMinutes(job);
    const { settings, days } = await loadCapacity(start, end, { ignoreJobId: job.id });
    const earliest = earliestBookable(settings);
    sendJson(res, 200, {
      mechanicId: job.mechanic_id,
      minutes,
      days: days.map((day) => {
        const m = day.mechanics.find((x) => x.mechanicId === job.mechanic_id);
        const closed = !m || !m.working;
        return day.mode === 'timed'
          ? { date: day.date, mode: day.mode, closed, startTimes: closed ? [] : startTimesFor(m, minutes).filter((t) => startIsInTime(earliest, day.date, t)) }
          : {
            date: day.date, mode: day.mode, closed,
            bookable: !closed && fitsDropoff(m, minutes) && dropoffIsInTime(earliest, day.date, settings.dropoffWindowEnd),
            dropoffWindow: { start: settings.dropoffWindowStart, end: settings.dropoffWindowEnd },
          };
      }),
    });
  });

  // The customer's quote on their booking link (journey 4): the job's current
  // quote, once sent (a draft being written is never shown). No sign-in - the
  // link's code is the key, as for the rest of the booking page.
  // screens: approval, approval-done
  route('GET', '/api/portal/:shopSlug/booking-links/:code/quote', async (req, res, params) => {
    const found = await resolveBookingLink(req, res, params.code);
    if (!found) return;
    const result = await currentQuoteForJob(found.id);
    if (!result.ok) return notFound(res, 'There is no quote for this booking');
    sendJson(res, 200, await customerQuote(result, found.id));
  });

  // A quote line's photo (Jack, 1 Oct; dq-quote-photo), for the customer's
  // card: only a line of the booking's current customer-readable quote, sent
  // as the picture its bytes show. Anything else is not found.
  // screens: approval
  route('GET', '/api/portal/:shopSlug/booking-links/:code/quote/lines/:lineId/photo', async (req, res, params) => {
    const found = await resolveBookingLink(req, res, params.code);
    if (!found) return;
    const result = await currentQuoteForJob(found.id);
    const line = result.ok ? result.lines.find((l) => l.id === Number(params.lineId)) : null;
    const file = line?.photo_attachment_id
      ? await db.prepare('SELECT storage_key FROM workshop_job_attachments WHERE id = ? AND workshop_job_id = ?').get(line.photo_attachment_id, found.id)
      : null;
    const bytes = file ? await readFile(path.join(UPLOADS_DIR, file.storage_key)).catch(() => null) : null;
    const kind = bytes ? sniffImage(bytes) : null;
    if (!kind) return notFound(res, 'There is no photo for that line');
    res.writeHead(200, {
      'Content-Type': kind.contentType,
      'Content-Length': bytes.length,
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      // Kept a few minutes by the customer's browser, so each view doesn't
      // spend the link's guessing limit again (fresh review).
      'Cache-Control': 'private, max-age=300',
    });
    res.end(bytes);
  });

  // The customer cancels through their booking link (piece 12, decision 1):
  // allowed until the bike reaches the shop, work starts or its day passes;
  // immediate, and every hold of the job - its own and a requested one - goes
  // at once.
  // screens: cancel, cancelled
  route('POST', '/api/portal/:shopSlug/booking-links/:code/cancel', async (req, res, params, query, shop) => {
    const found = await resolveBookingLink(req, res, params.code);
    if (!found) return;
    const out = await withJobBookingLock(found.id, [], async (job) => {
      // A double tap: the customer's own cancel already went through, so the
      // answer is the cancelled booking, unchanged (final review), and no second
      // message goes (fresh review, 21 Oct).
      if (job.booking_state === 'cancelled' && job.cancelled_by === 'customer') return { already: true };
      const refused = customerActionRefusal(job, 'cancel', await currentShopToday());
      if (refused) return refused;
      await applyLocked(job, 'cancel');
      await db.prepare(
        `UPDATE workshop_jobs SET cancelled_by = 'customer', cancelled_at = now(), change_declined_at = NULL, ${CLEAR_REQUEST}
         WHERE id = ?`
      ).run(job.id);
      await syncJobHold(job.id);
      return undefined;
    });
    if (out?.gone) return sendJson(res, 404, { error: "We can't find that booking" });
    if (out && !out.already) return sendJson(res, out.status, out.body);
    if (!out?.already) await sendLinkMessage('booking_cancelled', found.id, shop.id, linkPath(params.shopSlug, params.code));
    sendJson(res, 200, await bookingLinkView(found.id, shop));
  });

  // The customer accepts the time the shop offered (Jack, 20 Oct,
  // docs/decisions/2026-10-20-offer-another-time.md): it becomes a confirmed
  // booking at that time, its hold kept. A second press after accepting
  // answers with the confirmed booking.
  // screens: bk-offered
  route('POST', '/api/portal/:shopSlug/booking-links/:code/accept-offer', async (req, res, params, query, shop) => {
    const found = await resolveBookingLink(req, res, params.code);
    if (!found) return;
    // The Accept says which time the customer was shown, so a time the shop
    // has changed since is never confirmed unseen (Jack, 22 Oct, Mark's audit P2 2).
    const body = await readJsonBody(req);
    const shownDate = String(body?.jobDate ?? '').trim();
    const shownTime = body?.startTime ? String(body.startTime).trim() : '';
    // A page that doesn't say its time (one loaded before this check) is
    // answered as out of date, so it reloads and shows the time on offer.
    const STALE = { status: 409, body: { error: 'The shop has changed the time it’s offering. Here’s the new one.', code: 'stale' } };
    const out = await withJobBookingLock(found.id, [], async (job) => {
      if (job.booking_state !== 'offered') {
        if (job.booking_state === 'scheduled' && job.offer_accepted_at) return undefined;
        return { status: 409, body: { error: "There's no time offered to accept", code: 'illegal' } };
      }
      if (!isRealDate(shownDate) || job.job_date !== shownDate || (job.start_time || '') !== shownTime) return STALE;
      if (customerTooLate(job, await currentShopToday())) {
        return { status: 409, body: { error: CUSTOMER_REFUSALS.change.inShop, code: 'in_shop' } };
      }
      await applyLocked(job, 'accept_offer');
      await db.prepare(
        'UPDATE workshop_jobs SET offered_from_date = NULL, offered_from_time = NULL, offer_message = NULL, offer_accepted_at = now() WHERE id = ?'
      ).run(job.id);
      await syncJobHold(job.id);
      return undefined;
    });
    if (out?.gone) return sendJson(res, 404, { error: "We can't find that booking" });
    if (out) return sendJson(res, out.status, out.body);
    sendJson(res, 200, await bookingLinkView(found.id, shop));
  });

  // screens: reschedule, change-pending
  route('POST', '/api/portal/:shopSlug/booking-links/:code/change', async (req, res, params, query, shop) => {
    const found = await resolveBookingLink(req, res, params.code);
    if (!found) return;
    const body = await readJsonBody(req);
    const jobDate = String(body.jobDate ?? '').trim();
    if (!isRealDate(jobDate)) return badRequest(res, 'A valid date is required');
    const mechResolved = await resolveJobMechanicId(body.mechanicId, null);
    if (!mechResolved.ok || !mechResolved.mechanicId) return badRequest(res, 'Please choose a mechanic');
    let out;
    try {
      out = await withJobBookingLock(found.id, [jobDate], (job) =>
        changeBookingTime(job, { jobDate, mechanicId: mechResolved.mechanicId, startTime: body.startTime }));
    } catch (err) {
      // The 024 index, behind the lock: another live hold took the exact slot.
      // Thrown out of the lock, so every write of this change rolled back.
      if (err.code !== '23505') throw err;
      out = capacityRefusal(SLOT_GONE);
    }
    if (out?.gone) return sendJson(res, 404, { error: "We can't find that booking" });
    if (out) return sendJson(res, out.status, out.body);
    sendJson(res, 200, await bookingLinkView(found.id, shop));
  });

  // The customer withdraws their change request (piece 12).
  // screens: change-pending
  route('POST', '/api/portal/:shopSlug/booking-links/:code/withdraw-change', async (req, res, params, query, shop) => {
    const found = await resolveBookingLink(req, res, params.code);
    if (!found) return;
    const out = await withJobBookingLock(found.id, [], async (job) => {
      if (job.booking_state !== 'reschedule_requested') {
        return { status: 409, body: { error: "There's no change request to withdraw", code: 'illegal' } };
      }
      await withdrawRequest(job);
      return undefined;
    });
    if (out?.gone) return sendJson(res, 404, { error: "We can't find that booking" });
    if (out) return sendJson(res, out.status, out.body);
    sendJson(res, 200, await bookingLinkView(found.id, shop));
  });
}
