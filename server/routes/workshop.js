// The workshop's staff routes (Workshop > diary, job window): /api/workshop-jobs
// and the helpers only they use. Staff routes: they run under the dispatcher's
// /api/ branch (server.js), so a handler gets (req, res, params, query,
// afterRelease, shopId) with the shop's row-level security already bound, and
// needs a staff session. Jack's file (split plan §3). Moved out of server.js
// unchanged (split plan §4.1, WP-0.4); the shared workshop helpers other areas
// call are in server/workshop/jobs.js.
import { writeFile, unlink } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { prepare, dbExec, pool } from '../db.js';
import { UPLOADS_DIR } from '../lib/uploads.js';
import { badRequest, notFound, readJsonBody, sendJson, nowIso } from '../lib/http.js';
import { newLinkCode, hashLinkCode, linkPath, linkExpiry, photoCodePath } from '../booking-link.js';
import { currentSession } from '../lib/session.js';
import { isHttpsRequest } from '../proxy-trust.js';
import { queueMessage, undoWaiting, undoJobMessages, whyNotQueued, UNDO_MS } from '../messaging/engine.js';
import { TEMPLATES } from '../messaging/templates.js';
import { jobMessageVars, bookingMessageVars, messageLink } from '../workshop/job-messages.js';
import {
  createRevision as createQuoteRevision, send as sendQuoteForApproval, withdraw as withdrawQuote,
  serializeQuote, readQuote, serializeQuoteWithLines, listRevisions,
} from '../workshop/quotes.js';
import { readLegacyStatus, bookingRequest, custody, work } from '../workshop/state-machines.js';
import { applyEvent } from '../workshop/transitions.js';
import { shopNow } from '../clock.js';
import { SIGN_OFF_REQUIRED, signOffMechanic, recordSignOff, clearSignOff } from '../workshop/sign-off.js';
import { ChecklistError, jobChecklist, setJobChecklistItem } from '../workshop/checklists.js';
import { addNote, cleanNote, conversations as noteConversations, jobNotes, NOTE_WORDS } from '../workshop/job-notes.js';
import { removePhotoDetails } from '../photo-metadata.js';
import { makePhotoCode, photoCodeStatus } from '../workshop/photo-codes.js';
import {
  CLEAR_REQUEST, SLOT_GONE, WORKSHOP_JOB_SELECT, capacityRefusal, checkJobSlot, createWorkshopJob,
  currentShopToday, currentShopTimeZone, parseWorkingDays, refusal, requestedOf, resolveJobMechanicId, resolveJobTimes,
  serializeWorkshopJob, syncJobHold, timeToMinutes, addMinutesToTime, withBookingLock, withJobBookingLock, applyLocked,
  sendQuoteResult, answerAndAddToOrder, agreeWithinLimit, wholeBill,
} from '../workshop/jobs.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

// 'pending' is a customer-submitted booking (see /api/portal/*) awaiting a
// mechanic's manual review before it counts as scheduled - it still occupies
// its diary slot like any other status, so a second booking can't silently
// double it up, but staff have to explicitly approve it first.
export const JOB_STATUSES = ['pending', 'scheduled', 'waiting_parts', 'on_hold', 'complete'];

function resolveJobStatus(raw, existing) {
  if (raw === undefined) return existing || 'scheduled';
  if (!JOB_STATUSES.includes(raw)) return null;
  return raw;
}

// ---- A job's parts: one per day it is worked (migration 037; Workshop day
// decision 52). Part 1 is the job's own date, times and mechanic, kept
// identical by triggers; later parts come from "Add another day" and from
// carry-over. Spec: docs/superpowers/specs/2026-10-03-multi-day-jobs-design.md
function serializePart(row) {
  return {
    id: row.id,
    position: row.position,
    date: row.part_date,
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    mechanicId: row.mechanic_id ?? null,
    mechanicName: row.mechanic_name ?? null,
  };
}

// Adds each job's parts, in order, to serialized jobs.
async function attachParts(jobs) {
  if (!jobs.length) return jobs;
  const rows = await db.prepare(
    `SELECT p.*, e.name AS mechanic_name FROM workshop_job_parts p
     LEFT JOIN employees e ON e.id = p.mechanic_id
     WHERE p.workshop_job_id = ANY(?::int[]) ORDER BY p.workshop_job_id, p.position`
  ).all(jobs.map((j) => j.id));
  const byJob = new Map();
  for (const r of rows) {
    if (!byJob.has(r.workshop_job_id)) byJob.set(r.workshop_job_id, []);
    byJob.get(r.workshop_job_id).push(serializePart(r));
  }
  return jobs.map((j) => ({ ...j, parts: byJob.get(j.id) ?? [] }));
}

const addDaysIso = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// The first day on or after `from` that the shop opens and the mechanic works
// (any day the shop opens when there is no mechanic), within 60 days.
async function nextWorkingDay(from, mechanicId) {
  const settings = await db.prepare('SELECT opening_days FROM workshop_settings LIMIT 1').get();
  const shopDays = settings ? parseWorkingDays(settings.opening_days) : null;
  let mechDays = null;
  if (mechanicId) {
    const m = await db.prepare('SELECT working_days FROM employees WHERE id = ?').get(mechanicId);
    mechDays = m ? parseWorkingDays(m.working_days) : null;
  }
  for (let i = 0; i < 60; i += 1) {
    const date = addDaysIso(from, i);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (Array.isArray(shopDays) && !shopDays.includes(weekday)) continue;
    if (Array.isArray(mechDays) && !mechDays.includes(weekday)) continue;
    return date;
  }
  return null;
}

// Carry-over (decision 52; Jack, 3 Oct): an unfinished job - the bike is in
// the shop and the work isn't finished - whose last day has passed gets a new
// part on the next working day from today, at the same time, with the same
// mechanic. Run when the jobs list is read (nothing runs at midnight). Not
// refused for overlapping another job: the diary shows the overlap.
// Idempotent: once a job has a part today or later it no longer qualifies,
// and a second reader racing the first is stopped by UNIQUE(job, position).
async function carryOverUnfinished() {
  const today = await currentShopToday();
  const late = await db.prepare(
    `SELECT w.id, w.shop_id, p.part_date, p.start_time, p.end_time, p.mechanic_id, p.position
       FROM workshop_jobs w
       JOIN workshop_job_parts p ON p.workshop_job_id = w.id
      WHERE w.custody_state = 'in_shop' AND w.work_state <> 'complete'
        AND w.booking_state IN ('scheduled', 'reschedule_requested')
        AND p.position = (SELECT max(position) FROM workshop_job_parts q WHERE q.workshop_job_id = w.id)
        AND p.part_date < ?`
  ).all(today);
  for (const last of late) {
    const date = await nextWorkingDay(today, last.mechanic_id);
    if (!date) continue;
    const added = await db.prepare(
      `INSERT INTO workshop_job_parts (shop_id, workshop_job_id, part_date, start_time, end_time, mechanic_id, position)
       VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (workshop_job_id, position) DO NOTHING RETURNING id`
    ).get(last.shop_id, last.id, date, last.start_time, last.end_time, last.mechanic_id, last.position + 1);
    if (added) await db.prepare('UPDATE workshop_jobs SET version = version + 1, updated_at = now() WHERE id = ?').run(last.id);
  }
}

async function resolveJobCustomerId(rawId, existingId) {
  if (rawId === undefined) return { ok: true, customerId: existingId };
  if (rawId === null || rawId === '') return { ok: true, customerId: null };
  const customerId = Number(rawId);
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ? AND active = 1').get(customerId);
  if (!customer) return { ok: false };
  return { ok: true, customerId };
}

// A bike belongs to exactly one customer, so a job can only be linked to a
// bike when it's also linked to that same bike's owner. When bikeId isn't
// explicitly provided (e.g. a drag/resize that only moves the time), the
// existing link is kept unless it no longer matches the resolved customer,
// in which case it's silently dropped rather than rejecting the request.
async function resolveJobBikeId(rawId, existingId, resolvedCustomerId) {
  if (rawId === undefined) {
    if (!existingId) return { ok: true, bikeId: null };
    const bike = await db.prepare('SELECT * FROM customer_bikes WHERE id = ?').get(existingId);
    if (!bike || !resolvedCustomerId || bike.customer_id !== resolvedCustomerId) {
      return { ok: true, bikeId: null };
    }
    return { ok: true, bikeId: existingId };
  }
  if (rawId === null || rawId === '') return { ok: true, bikeId: null };
  const bikeId = Number(rawId);
  const bike = await db.prepare('SELECT * FROM customer_bikes WHERE id = ? AND active = 1').get(bikeId);
  if (!bike) return { ok: false, error: 'Bike not found or inactive' };
  if (!resolvedCustomerId || bike.customer_id !== resolvedCustomerId) {
    return { ok: false, error: "That bike doesn't belong to the selected customer" };
  }
  return { ok: true, bikeId };
}

// A job's length when it has no times: whole minutes, 1 to 720, or null.
function resolvePlannedMinutes(input, fallback) {
  if (input === undefined) return { value: fallback ?? null };
  if (input === null || input === '') return { value: null };
  const n = Number(input);
  if (!Number.isInteger(n) || n < 1 || n > 720) {
    return { error: 'The planned length must be a whole number of minutes between 1 and 720' };
  }
  return { value: n };
}

const VERSION_REQUIRED = 'version is required - send the version you last read';

// The words applyEvent uses for a lost race (server/workshop/transitions.js).
const staleRefusal = {
  status: 409,
  body: { error: 'This job changed while you were looking at it. Reload and try again.', code: 'stale' },
};

// ---- A job's later days (Jack, 3 Oct: "Add another day" on the job page) ----
// Each changes the job, so each needs the version the caller saw and bumps
// it. Day 1 is the job's own date and is moved with PUT /api/workshop-jobs/:id.
// Spec: docs/superpowers/specs/2026-10-03-multi-day-jobs-design.md
async function sendJobWithParts(res, id) {
  const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
  if (!row) return notFound(res, 'Job not found');
  sendJson(res, 200, (await attachParts([serializeWorkshopJob(row)]))[0]);
}

const bumpJobVersion = (id) => db.prepare('UPDATE workshop_jobs SET version = version + 1, updated_at = now() WHERE id = ?').run(id);

const lastPartOf = (id) => db.prepare('SELECT * FROM workshop_job_parts WHERE workshop_job_id = ? ORDER BY position DESC LIMIT 1').get(id);

// Staff answer a customer's change request (piece 12). Under the booking lock
// for both days; the version is the one staff last read.
async function answerChangeRequest(req, res, id, answer, shopId) {
  const body = await readJsonBody(req);
  if (!Number.isInteger(body.version)) return badRequest(res, VERSION_REQUIRED);
  const requestedGone = { status: 409, body: { error: 'The requested time is no longer free', code: 'capacity' } };
  let out;
  try {
    out = await withJobBookingLock(id, [], async (job) => {
      if (job.version !== body.version) return staleRefusal;
      const requested = requestedOf(job);
      if (!requested) {
        return { status: 409, body: { error: `There's no change request to ${answer}`, code: 'illegal' } };
      }
      if (answer === 'accept') {
        // The shop's slot rules, the job itself left out; never the capacity
        // calculator - staff are never refused for capacity (decision log D14).
        const slotError = await checkJobSlot({
          jobDate: requested.jobDate, startTime: requested.startTime, endTime: requested.endTime,
          mechanicId: requested.mechanicId, ignoreJobId: id,
        });
        if (slotError) return requestedGone;
        await applyLocked(job, 'accept');
        await db.prepare(
          `UPDATE workshop_jobs SET job_date = ?, mechanic_id = ?, start_time = ?, end_time = ?, ${CLEAR_REQUEST}, updated_at = now()
           WHERE id = ?`
        ).run(requested.jobDate, requested.mechanicId, requested.startTime, requested.endTime, id);
        // The requested hold becomes the booking's own; the old one goes.
        await db.prepare(
          `UPDATE workshop_capacity_holds SET state = 'released'
           WHERE workshop_job_id = ? AND purpose = 'booking' AND state IN ('held', 'confirmed')`
        ).run(id);
        await db.prepare(
          `UPDATE workshop_capacity_holds SET purpose = 'booking'
           WHERE workshop_job_id = ? AND purpose = 'requested' AND state IN ('held', 'confirmed')`
        ).run(id);
      } else {
        await applyLocked(job, 'decline');
        await db.prepare(
          `UPDATE workshop_jobs SET ${CLEAR_REQUEST}, change_declined_at = now(), updated_at = now() WHERE id = ?`
        ).run(id);
      }
      await syncJobHold(id);
      const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
      return { status: 200, body: serializeWorkshopJob(row) };
    });
  } catch (err) {
    // The 024 index: another live hold sits on the requested slot.
    if (err.code !== '23505') throw err;
    out = requestedGone;
  }
  if (out?.gone) return notFound(res, 'Job not found');
  const bookingMessage = answer === 'accept' && out.status === 200 ? await sendBookingMessage(req, id, shopId, 'date_change_answered') : undefined;
  sendJson(res, out.status, bookingMessage ? { ...out.body, bookingMessage } : out.body);
}

// One item of "Waiting for you" (decision log D12).
function waitingItem(row) {
  const kind = row.booking_state === 'pending' ? 'new_booking'
    : row.booking_state === 'reschedule_requested' ? 'change_request' : 'customer_cancelled';
  const slot = (jobDate, startTime, endTime, mechanicId, mechanicName) => ({
    jobDate, startTime: startTime || '', endTime: endTime || '', mechanicId, mechanicName: mechanicName ?? null,
  });
  const current = slot(row.job_date, row.start_time, row.end_time, row.mechanic_id, row.mechanic_name);
  return {
    kind,
    jobId: row.id,
    reference: row.reference,
    ...current,
    customerName: row.customer_name ?? null,
    bikeLabel: row.bike_label ?? null, // the tablet cards' bike line (#241)
    serviceNames: row.service_names,
    services: row.services,
    arrivedAt: { new_booking: row.created_at, change_request: row.requested_at, customer_cancelled: row.cancelled_at }[kind],
    ...(kind === 'change_request'
      ? {
        from: current,
        to: slot(row.requested_job_date, row.requested_start_time, row.requested_end_time, row.requested_mechanic_id, row.requested_mechanic_name),
      }
      : {}),
  };
}

// The address a customer opens: APP_PUBLIC_URL when set, else the address
// the member of staff is using.
function publicBase(req) {
  return process.env.APP_PUBLIC_URL || `${isHttpsRequest(req) ? 'https' : 'http'}://${req.headers.host}`;
}

// A job's booking link, issued afresh for a message that carries it (journey
// 4 decision 5: only a hash is kept, so the old link stops working).
async function issueJobLink(req, jobId, shopId) {
  const code = newLinkCode();
  await db.prepare('UPDATE workshop_jobs SET link_token_hash = ?, updated_at = ? WHERE id = ?').run(hashLinkCode(code), nowIso(), jobId);
  const { rows: [shop] } = await pool.query('SELECT slug FROM shops WHERE id = $1', [shopId]);
  return `${publicBase(req)}${linkPath(shop.slug, code)}`;
}

// Bike ready for a job just marked ready. The job's link is issued afresh
// only for a message that will go, so a customer who gets nothing keeps the
// link they have (fresh review).
async function queueBikeReady(req, jobId, shopId) {
  const { customerId } = await prepare('SELECT customer_id AS "customerId" FROM workshop_jobs WHERE id = ?').get(jobId);
  const skipped = await whyNotQueued('bike_ready', customerId);
  if (skipped) return { skipped };
  const link = await messageLink(() => issueJobLink(req, jobId, shopId));
  const { vars } = await jobMessageVars(jobId, shopId, link);
  const ctx = await currentSession(req);
  return queueMessage({ customerId, jobId, key: 'bike_ready', vars, delayMs: UNDO_MS, loginId: ctx?.login?.id ?? null });
}

// A booking message for a staff answer (Jack, 20 Oct,
// docs/decisions/2026-10-20-booking-messages.md answer 4), at once, the
// customer's way. A message that can't be queued is logged: the answer it
// follows has already been made and stands.
// Returns { skipped: 'no_contact', name } when the customer can't be reached,
// for staff to be told (booking messages answer 5); otherwise nothing.
async function sendBookingMessage(req, jobId, shopId, key) {
  try {
    const { customerId } = await prepare('SELECT customer_id AS "customerId" FROM workshop_jobs WHERE id = ?').get(jobId);
    const why = await whyNotQueued(key, customerId);
    if (why === 'no_contact') return { skipped: 'no_contact', name: TEMPLATES[key].name };
    if (why) return undefined;
    const link = await messageLink(() => issueJobLink(req, jobId, shopId));
    const { vars } = await bookingMessageVars(jobId, shopId, link, key);
    const ctx = await currentSession(req);
    await queueMessage({ customerId, jobId, key, vars, loginId: ctx?.login?.id ?? null });
  } catch (err) {
    console.error(`Messages: ${key} for job ${jobId} couldn't be queued`, err);
  }
  return undefined;
}

// Why a job's message didn't go, for the person who pressed the button.
function notSent(skipped, name, customerName) {
  if (skipped === 'off') return `${name} is switched off in Settings › Messages.`;
  return `${customerName} has no phone number or email on file.`;
}

// ---------- Workshop job attachments ----------
// Files (e.g. an e-bike's downloaded diagnostic report) attached to a
// workshop job. Uploaded as base64 inside a normal JSON body rather than
// multipart/form-data - this project deliberately has exactly one
// dependency (pg), and a hand-rolled multipart parser is a lot of surface
// area for something that's rare and small (a PDF report, not a video) for
// a single shop's workshop.

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // plenty for a PDF report; small enough a handful of them won't fill the disk
// Base64 inflates the raw bytes by ~1.37x, so the request-body cap needs
// headroom above the decoded-file cap it's ultimately enforcing.
const MAX_ATTACHMENT_BODY_BYTES = Math.ceil(MAX_ATTACHMENT_BYTES * 1.4);

function serializeAttachment(row) {
  return {
    id: row.id,
    workshopJobId: row.workshop_job_id,
    originalName: row.original_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at,
    fromCustomer: row.from_customer,
  };
}

// Why a storage slot can't be used, or null: slots switched off for the shop,
// or no such slot here (storage slots, Workshop day 27).
async function slotRefusal(slotId) {
  const on = await db.prepare('SELECT storage_slots_on FROM workshop_settings LIMIT 1').get();
  if (on?.storage_slots_on !== 1) return 'Storage slots are off for this shop';
  if (!Number.isInteger(slotId) || !(await db.prepare('SELECT 1 FROM storage_slots WHERE id = ?').get(slotId))) return 'That slot doesn’t exist';
  return null;
}

export function register(route) {
  route('GET', '/api/workshop-jobs', async (req, res, params, query) => {
    const start = query.get('start');
    const end = query.get('end');
    await carryOverUnfinished();
    let sql = WORKSHOP_JOB_SELECT + ' WHERE 1=1';
    const args = [];
    // A job is in the range when any of its days is (a job over several days).
    if (start || end) {
      sql += ` AND EXISTS (SELECT 1 FROM workshop_job_parts p WHERE p.workshop_job_id = w.id
      AND (?::text IS NULL OR p.part_date >= ?) AND (?::text IS NULL OR p.part_date <= ?))`;
      args.push(start || null, start || null, end || null, end || null);
    }
    const status = query.get('status');
    if (status) {
      sql += ' AND w.status = ?';
      args.push(status);
    }
    // The bikes in the shop whatever their days, for the Overview (Jack, 21 Oct,
    // docs/decisions/2026-10-21-workshop-overview.md): a ready bike from an
    // earlier day has no part today.
    const custody = query.get('custody');
    if (custody !== null) {
      if (!['expected', 'in_shop', 'collected'].includes(custody)) return badRequest(res, "custody must be 'expected', 'in_shop' or 'collected'");
      sql += ' AND w.custody_state = ?';
      args.push(custody);
    }
    sql += ' ORDER BY w.job_date, w.start_time';
    const rows = await db.prepare(sql).all(...args);
    sendJson(res, 200, await attachParts(rows.map(serializeWorkshopJob)));
  });

  route('GET', '/api/workshop-jobs/:id', async (req, res, params) => {
    const id = Number(params.id);
    const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
    if (!row) return notFound(res, 'Job not found');
    sendJson(res, 200, (await attachParts([serializeWorkshopJob(row)]))[0]);
  });

  // A new booking link for a job: the old one stops working at once, because a
  // job holds one hash. Returned once; staff text it or read it out.
  // Spec: docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md
  // Staff handlers get (req, res, params, query, afterRelease, shopId); the slug
  // for the path comes from shops, which is outside row-level security.
  // screens: expired
  route('POST', '/api/workshop-jobs/:id/private-link', async (req, res, params, query, afterRelease, shopId) => {
    const job = await db.prepare('SELECT id, customer_id FROM workshop_jobs WHERE id = ?').get(Number(params.id));
    if (!job) return notFound(res, 'Job not found');
    if (!job.customer_id) return badRequest(res, 'This job has no customer to send a link to');
    const code = newLinkCode();
    await db.prepare('UPDATE workshop_jobs SET link_token_hash = ?, updated_at = ? WHERE id = ?')
      .run(hashLinkCode(code), nowIso(), job.id);
    const { rows: [shop] } = await pool.query('SELECT slug FROM shops WHERE id = $1', [shopId]);
    sendJson(res, 201, { privateLink: linkPath(shop.slug, code) });
  });

  // Use my phone (docs/decisions/2026-10-23-use-my-phone.md; openspec/changes/use-my-phone):
  // a code for one line of the job's draft quote, which a phone opens with no
  // sign-in. Only its hash is kept; the code leaves the server once, here.
  // screens: quote-editor
  route('POST', '/api/workshop-jobs/:id/quote-photo-codes', async (req, res, params, query, afterRelease, shopId) => {
    const job = await db.prepare('SELECT id FROM workshop_jobs WHERE id = ?').get(Number(params.id));
    if (!job) return notFound(res, 'Job not found');
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return badRequest(res, 'Invalid request body');
    }
    const result = await makePhotoCode({ jobId: job.id, quoteId: body.quoteId, linePosition: body.linePosition });
    if (!result.ok) {
      if (result.code === 'not_found') return notFound(res, result.message);
      if (result.code === 'illegal') return sendJson(res, 409, { error: result.message, code: 'illegal' });
      return badRequest(res, result.message);
    }
    const { rows: [shop] } = await pool.query('SELECT slug FROM shops WHERE id = $1', [shopId]);
    const path = photoCodePath(shop.slug, result.code);
    sendJson(res, 201, { codeId: result.codeId, path, url: `${publicBase(req)}${path}`, expiresAt: result.expiresAt });
  });

  // What the pop-up asks every few seconds: waiting, added or expired.
  // screens: quote-editor
  route('GET', '/api/workshop-jobs/:id/quote-photo-codes/:codeId', async (req, res, params) => {
    const status = await photoCodeStatus({ jobId: Number(params.id), codeId: Number(params.codeId) });
    if (!status) return notFound(res, 'Code not found');
    sendJson(res, 200, status);
  });

  route('POST', '/api/workshop-jobs', async (req, res) => {
    const body = await readJsonBody(req);
    const title = (body.title || '').trim();
    if (!title) return badRequest(res, 'Job title is required');
    const jobDate = (body.jobDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jobDate)) return badRequest(res, 'A valid date is required');
    const notes = (body.notes || '').trim();
    // What the customer told us about the problem, the job's "From the
    // customer" (Jack, 20 Oct, docs/decisions/2026-10-20-new-job-customer-note.md);
    // blank is none.
    if (body.customerDescription !== undefined && body.customerDescription !== null && typeof body.customerDescription !== 'string') {
      return badRequest(res, 'What the customer told us must be text');
    }
    const customerDescription = typeof body.customerDescription === 'string' ? body.customerDescription.trim() : '';
    if (customerDescription.length > 2000) return badRequest(res, 'What the customer told us can be up to 2,000 characters');

    const times = resolveJobTimes((body.startTime || '').trim(), (body.endTime || '').trim());
    if (times.error) return badRequest(res, times.error);

    const resolved = await resolveJobCustomerId(body.customerId, null);
    if (!resolved.ok) return badRequest(res, 'Customer not found or inactive');

    const bikeResolved = await resolveJobBikeId(body.bikeId, null, resolved.customerId);
    if (!bikeResolved.ok) return badRequest(res, bikeResolved.error);

    const mechResolved = await resolveJobMechanicId(body.mechanicId, null);
    if (!mechResolved.ok) return badRequest(res, 'Mechanic not found or inactive');

    // A walk-in for the shared queue carries a length and no mechanic or time.
    const planned = resolvePlannedMinutes(body.plannedMinutes, null);
    if (planned.error) return badRequest(res, planned.error);

    // The services New job chose, kept as an online booking's are, so the job
    // has its service's checklist (Jack, 22 Oct, service checklists).
    if (body.serviceIds !== undefined && !Array.isArray(body.serviceIds)) return badRequest(res, 'serviceIds must be a list');
    if (!(body.serviceIds ?? []).every(Number.isInteger)) return badRequest(res, 'Service not found');
    const serviceIds = [...new Set(body.serviceIds ?? [])];
    for (const serviceId of serviceIds) {
      if (!(await db.prepare('SELECT 1 FROM workshop_services WHERE id = ?').get(serviceId))) return badRequest(res, 'Service not found');
    }

    const status = resolveJobStatus(body.status, null);
    if (status === null) return badRequest(res, `status must be one of: ${JOB_STATUSES.join(', ')}`);
    // The staff diary still sends a legacy status and will until Phase 4 replaces
    // it. Translating here rather than changing the request contract is what
    // keeps public/app.js working untouched through this phase.
    const created = readLegacyStatus(status);

    // A bike made in the shop (New job's Waiting for parts) may go on its slot
    // as it's made; one not here yet has no slot (storage slots, 22 Oct).
    const madeSlot = body.storageSlotId ?? null;
    if (madeSlot !== null) {
      if (created.custody !== 'in_shop') return badRequest(res, 'Only a bike that’s here can go on a slot');
      const why = await slotRefusal(madeSlot);
      if (why) return badRequest(res, why);
    }

    // Staff are held to the shop's rules, never to capacity: no calculator here.
    // The only capacity answer is the 024 index firing on a stale pre-2b hold,
    // which rolls the whole write back.
    let out;
    try {
      out = await withBookingLock([jobDate], async () => {
        const slotError = await checkJobSlot({
          jobDate,
          startTime: times.startTime,
          endTime: times.endTime,
          mechanicId: mechResolved.mechanicId,
        });
        if (slotError) return refusal(slotError.error);

        const jobId = await createWorkshopJob({
          title,
          customerId: resolved.customerId,
          bikeId: bikeResolved.bikeId,
          mechanicId: mechResolved.mechanicId,
          jobDate,
          startTime: times.startTime,
          endTime: times.endTime,
          bookingState: created.booking,
          workState: created.work,
          custodyState: created.custody ?? 'expected',
          notes,
          customerDescription: customerDescription || null,
          skipAutoOrder: !!body.skipAutoOrder,
          plannedMinutes: planned.value,
          serviceIds,
        });
        if (madeSlot !== null) await db.prepare('UPDATE workshop_jobs SET storage_slot_id = ? WHERE id = ?').run(madeSlot, jobId);
        const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(jobId);
        return { status: 201, body: serializeWorkshopJob(row) };
      });
    } catch (err) {
      if (err.code === '23505') out = capacityRefusal(SLOT_GONE);
      // The storage slot was removed just now (fresh review).
      else if (err.code === '23503' && madeSlot !== null) out = { status: 400, body: { error: 'That slot doesn’t exist' } };
      else throw err;
    }
    if (out.status === 201) out.body = (await attachParts([out.body]))[0];
    sendJson(res, out.status, out.body);
  });

  // screens: diary, week
  route('POST', '/api/workshop-jobs/:id/parts', async (req, res, params) => {
    const id = Number(params.id);
    const body = await readJsonBody(req);
    if (!Number.isInteger(body.version)) return badRequest(res, VERSION_REQUIRED);
    const last = await lastPartOf(id);
    if (!last) return notFound(res, 'Job not found');
    const date = await nextWorkingDay(addDaysIso(last.part_date, 1), last.mechanic_id);
    if (!date) return badRequest(res, 'There is no working day for this mechanic in the next 60 days');
    const out = await withJobBookingLock(id, [date], async (job) => {
      if (job.version !== body.version) return staleRefusal;
      const now = await lastPartOf(id);
      if (now.id !== last.id || now.part_date !== last.part_date) return staleRefusal;
      const slot = await checkJobSlot({ jobDate: date, startTime: last.start_time, endTime: last.end_time, mechanicId: last.mechanic_id, ignoreJobId: id });
      if (slot) return refusal(slot.error);
      await db.prepare(
        `INSERT INTO workshop_job_parts (shop_id, workshop_job_id, part_date, start_time, end_time, mechanic_id, position)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(job.shop_id, id, date, last.start_time, last.end_time, last.mechanic_id, last.position + 1);
      await bumpJobVersion(id);
      return undefined;
    });
    if (out?.gone) return notFound(res, 'Job not found');
    if (out) return sendJson(res, out.status, out.body);
    return sendJobWithParts(res, id);
  });

  // screens: diary, week
  route('PUT', '/api/workshop-jobs/:id/parts/:partId', async (req, res, params) => {
    const id = Number(params.id);
    const partId = Number(params.partId);
    const body = await readJsonBody(req);
    if (!Number.isInteger(body.version)) return badRequest(res, VERSION_REQUIRED);
    const part = await db.prepare('SELECT * FROM workshop_job_parts WHERE id = ? AND workshop_job_id = ?').get(partId, id);
    if (!part) return notFound(res, 'That day of the job was not found');
    if (part.position === 1) return badRequest(res, "Move a job's first day by moving the job itself");
    const jobDate = body.jobDate !== undefined ? String(body.jobDate).trim() : part.part_date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jobDate)) return badRequest(res, 'A valid date is required');
    const times = resolveJobTimes(
      body.startTime !== undefined ? String(body.startTime).trim() : part.start_time,
      body.endTime !== undefined ? String(body.endTime).trim() : part.end_time,
    );
    if (times.error) return badRequest(res, times.error);
    const mech = await resolveJobMechanicId(body.mechanicId, part.mechanic_id);
    if (!mech.ok) return badRequest(res, 'Mechanic not found or inactive');
    const out = await withJobBookingLock(id, [part.part_date, jobDate], async (job) => {
      if (job.version !== body.version) return staleRefusal;
      const slot = await checkJobSlot({ jobDate, startTime: times.startTime, endTime: times.endTime, mechanicId: mech.mechanicId, ignoreJobId: id });
      if (slot) return refusal(slot.error);
      await db.prepare('UPDATE workshop_job_parts SET part_date = ?, start_time = ?, end_time = ?, mechanic_id = ? WHERE id = ?')
        .run(jobDate, times.startTime, times.endTime, mech.mechanicId, partId);
      await bumpJobVersion(id);
      return undefined;
    });
    if (out?.gone) return notFound(res, 'Job not found');
    if (out) return sendJson(res, out.status, out.body);
    return sendJobWithParts(res, id);
  });

  // screens: diary, week
  route('DELETE', '/api/workshop-jobs/:id/parts/:partId', async (req, res, params) => {
    const id = Number(params.id);
    const partId = Number(params.partId);
    const body = await readJsonBody(req);
    if (!Number.isInteger(body.version)) return badRequest(res, VERSION_REQUIRED);
    const part = await db.prepare('SELECT * FROM workshop_job_parts WHERE id = ? AND workshop_job_id = ?').get(partId, id);
    if (!part) return notFound(res, 'That day of the job was not found');
    if (part.position === 1) return badRequest(res, "A job's first day can't be removed");
    const out = await withJobBookingLock(id, [part.part_date], async (job) => {
      if (job.version !== body.version) return staleRefusal;
      await db.prepare('DELETE FROM workshop_job_parts WHERE id = ?').run(partId);
      // Close up the positions after it, in two steps so UNIQUE(job, position)
      // never sees two parts at the same position mid-update.
      await db.prepare('UPDATE workshop_job_parts SET position = -position WHERE workshop_job_id = ? AND position > ?').run(id, part.position);
      await db.prepare('UPDATE workshop_job_parts SET position = -position - 1 WHERE workshop_job_id = ? AND position < 0').run(id);
      await bumpJobVersion(id);
      return undefined;
    });
    if (out?.gone) return notFound(res, 'Job not found');
    if (out) return sendJson(res, out.status, out.body);
    return sendJobWithParts(res, id);
  });

  route('PUT', '/api/workshop-jobs/:id', async (req, res, params) => {
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM workshop_jobs WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Job not found');
    const body = await readJsonBody(req);
    // The old diary now sends the version it last read (staff diary piece).
    // Optional, so a caller that doesn't send one keeps the old behaviour.
    if (body.version !== undefined && !Number.isInteger(body.version)) return badRequest(res, VERSION_REQUIRED);

    const title = body.title !== undefined ? String(body.title).trim() : existing.title;
    if (!title) return badRequest(res, 'Job title is required');
    const jobDate = body.jobDate !== undefined ? String(body.jobDate).trim() : existing.job_date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jobDate)) return badRequest(res, 'A valid date is required');
    const notes = body.notes !== undefined ? String(body.notes).trim() : existing.notes;

    const startTimeInput = body.startTime !== undefined ? String(body.startTime).trim() : existing.start_time;
    const endTimeInput = body.endTime !== undefined ? String(body.endTime).trim() : existing.end_time;
    const times = resolveJobTimes(startTimeInput, endTimeInput);
    if (times.error) return badRequest(res, times.error);

    const resolved = await resolveJobCustomerId(body.customerId, existing.customer_id);
    if (!resolved.ok) return badRequest(res, 'Customer not found or inactive');

    const bikeResolved = await resolveJobBikeId(body.bikeId, existing.bike_id, resolved.customerId);
    if (!bikeResolved.ok) return badRequest(res, bikeResolved.error);

    const mechResolved = await resolveJobMechanicId(body.mechanicId, existing.mechanic_id);
    if (!mechResolved.ok) return badRequest(res, 'Mechanic not found or inactive');

    const planned = resolvePlannedMinutes(body.plannedMinutes, existing.planned_minutes);
    if (planned.error) return badRequest(res, planned.error);
    // A timed job's length is its times; planned_minutes only speaks for untimed work.
    const plannedMinutes = times.startTime
      ? Math.max(0, timeToMinutes(times.endTime) - timeToMinutes(times.startTime))
      : planned.value;

    // A job's state moves through the action routes (state machines, version,
    // sign-off), never by saving it. The old form's `status` field wrote the
    // state columns directly - finishing without a sign-off, un-cancelling a
    // booking - and nothing sends it any more, so it is refused rather than obeyed.
    if (body.status !== undefined) {
      return badRequest(res, "A job's status can't be changed by saving it. Use the job's own actions instead: book in, start, hold, finish, reopen or cancel.");
    }

    // A time on offer to the customer stays where it is until they answer, so
    // they can never accept a time they weren't shown; staff offer again
    // instead (Jack, 22 Oct, Mark's audit P2 2).
    if (existing.booking_state === 'offered' && (
      jobDate !== existing.job_date
      || (times.startTime || '') !== (existing.start_time || '')
      || (times.endTime || '') !== (existing.end_time || '')
      || mechResolved.mechanicId !== existing.mechanic_id
    )) {
      return sendJson(res, 409, { error: 'This time is on offer to the customer. To change it, use Offer another time.', code: 'illegal' });
    }

    // A complete job is a record of work already done, so its details are
    // frozen - the browser disables every field on the form. Changing status
    // is the one edit that stays open, because that is how a job is reopened.
    // Was `existing.status === 'complete'`. The derived column now also reads
    // 'complete' for a cancelled, declined or expired booking, and freezing those
    // against edits is a behaviour change nobody asked for. This guard was always
    // about finished work.
    if (existing.work_state === 'complete') {
      const changesBeyondStatus =
        title !== existing.title ||
        jobDate !== existing.job_date ||
        notes !== existing.notes ||
        times.startTime !== existing.start_time ||
        times.endTime !== existing.end_time ||
        resolved.customerId !== existing.customer_id ||
        bikeResolved.bikeId !== existing.bike_id ||
        mechResolved.mechanicId !== existing.mechanic_id;
      if (changesBeyondStatus) {
        return badRequest(res, 'This job is complete - reopen it before making changes.');
      }
    }

    // Both days are locked: the one the job leaves and the one it joins, and the
    // day a customer asked to move to (piece 12). The UPDATE and its hold commit
    // or roll back together.
    let out;
    try {
      out = await withBookingLock([existing.job_date, jobDate, existing.requested_job_date].filter(Boolean), async () => {
        // A customer's change request (piece 12), read again under the lock.
        // An ordinary save keeps it; dropping the job onto exactly the requested
        // time answers it - the change is accepted. Request columns left on a job
        // that is no longer a request are cleared on any save.
        const current = await db.prepare('SELECT * FROM workshop_jobs WHERE id = ? FOR UPDATE').get(id);
        if (body.version !== undefined && current && current.version !== body.version) return staleRefusal;
        const slotError = await checkJobSlot({
          jobDate,
          startTime: times.startTime,
          endTime: times.endTime,
          mechanicId: mechResolved.mechanicId,
          ignoreJobId: id,
        });
        if (slotError) return refusal(slotError.error);

        const request = current ? requestedOf(current) : null;
        let bookingState = null;
        let clearRequest = Boolean(current?.requested_job_date) && !request;
        if (request) {
          // Same day, start and mechanic answers the request whatever the
          // length (staff diary piece): the drop is the staff member's answer.
          const onRequested = jobDate === request.jobDate && times.startTime === request.startTime
            && mechResolved.mechanicId === request.mechanicId;
          if (onRequested) {
            bookingState = 'scheduled';
            clearRequest = true;
          }
        }

        await db.prepare(
          `UPDATE workshop_jobs SET title = ?, customer_id = ?, bike_id = ?, mechanic_id = ?, job_date = ?, start_time = ?, end_time = ?, notes = ?, planned_minutes = ?, updated_at = ?,
           version = version + 1,
           booking_state = COALESCE(?, booking_state)${clearRequest ? `, ${CLEAR_REQUEST}` : ''}
         WHERE id = ?`
        ).run(
          title,
          resolved.customerId,
          bikeResolved.bikeId,
          mechResolved.mechanicId,
          jobDate,
          times.startTime,
          times.endTime,
          notes,
          plannedMinutes,
          nowIso(),
          bookingState,
          id
        );
        await syncJobHold(id);
        const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
        return { status: 200, body: serializeWorkshopJob(row) };
      });
    } catch (err) {
      // Only a stale pre-2b hold can trip the 024 index for staff.
      if (err.code === '23505') out = capacityRefusal(SLOT_GONE);
      else throw err;
    }
    sendJson(res, out.status, out.body);
  });

  // ---------- Workshop job actions ----------
  //
  // One endpoint per thing a person does, not a status field on the job's PUT
  // (above).
  // The URL names what happened, so the access log, the screen trace and any
  // future per-action permission all read the path instead of the body.
  //
  // Every one of these carries a `screens:` comment naming the screen designs it
  // serves. scripts/ci/assert-screen-trace.mjs fails the build if a workshop
  // route has no such comment or names an id that is not in screen-index.json -
  // the design's "an endpoint no screen consumes is not built" rule, made into a
  // check that runs rather than a promise in a document.
  function jobActionRoute(action, machine, event) {
    route('POST', `/api/workshop-jobs/:id/${action}`, async (req, res, params, query, afterRelease, shopId) => {
      const id = Number(params.id);
      const body = await readJsonBody(req);
      // The caller must say which version it saw. Defaulting it would turn every
      // racing write into a silent last-one-wins, which is the bug the version
      // column exists to prevent.
      if (!Number.isInteger(body.version)) {
        return badRequest(res, VERSION_REQUIRED);
      }
      // A decline may carry a message for the customer (Workshop day 15; Jack,
      // 20 Oct), checked before anything moves.
      let declineMessage = null;
      if (machine === bookingRequest && event === 'decline' && body.message !== undefined && body.message !== null) {
        if (typeof body.message !== 'string') return badRequest(res, 'The message must be text');
        declineMessage = body.message.trim();
        if (declineMessage.length > 1000) return badRequest(res, 'The message can be up to 1,000 characters');
      }
      // Book-in may say where the bike is kept (storage slots, Workshop day 27;
      // drawn as till-book-in), checked before anything moves.
      let bookInSlot;
      if (machine === custody && event === 'book_in' && body.storageSlotId !== undefined && body.storageSlotId !== null) {
        const why = await slotRefusal(body.storageSlotId);
        if (why) return badRequest(res, why);
        bookInSlot = body.storageSlotId;
      }
      const answeringRequest = machine === bookingRequest && (event === 'accept' || event === 'decline');
      // Finishing the work needs a mechanic to sign it off, and reopening it
      // clears the sign-off (Jack, 16 Oct, docs/decisions/2026-10-16-mechanic-sign-off.md
      // answers 1 and 4), in the same transaction as the move.
      const signing = machine === work && event === 'finish';
      const unsigning = machine === work && event === 'reopen';
      let signer = null;
      if (signing) {
        signer = await signOffMechanic(body.signedOffBy);
        if (signer === null) return sendJson(res, 400, SIGN_OFF_REQUIRED);
      }
      // Choosing the mechanic as the request is accepted (Workshop day decision
      // 62; drawn on request-new): absent keeps the one it has; null is the
      // shared queue.
      let acceptMechanic;
      if (machine === bookingRequest && event === 'accept' && body.mechanicId !== undefined) {
        const chosen = await resolveJobMechanicId(body.mechanicId, null);
        if (!chosen.ok) return badRequest(res, 'Mechanic not found or inactive');
        acceptMechanic = chosen.mechanicId;
      }
      // A booking message answers a customer's request or an offered time, not a
      // reschedule staff asked for themselves (fresh review): the state it
      // answered, read under the lock.
      let answering = null;
      let result;
      let readyMessage;
      if (signing || unsigning) {
        await db.exec('BEGIN');
        try {
          result = await applyEvent({ jobId: id, machine, event, expectedVersion: body.version });
          if (result.ok && signing) {
            // The mechanic deleted or switched off since the check above.
            if (!(await recordSignOff(id, signer))) {
              await db.exec('ROLLBACK');
              return sendJson(res, 400, SIGN_OFF_REQUIRED);
            }
            // Marking it ready sends "Bike ready", with a minute to Undo (UX
            // walk-through 1 H2; the messages engine, pretend for now), in the
            // same transaction: if it can't be queued, nothing is finished.
            readyMessage = await queueBikeReady(req, id, shopId);
          }
          if (result.ok && unsigning) {
            await clearSignOff(id);
            await undoWaiting(id, 'bike_ready');
          }
          await db.exec(result.ok ? 'COMMIT' : 'ROLLBACK');
        } catch (err) {
          await db.exec('ROLLBACK');
          throw err;
        }
      } else if (machine === bookingRequest) {
        // Under the job's day lock (re-read if it moves meanwhile): the event,
        // the clearing of any change request, who cancelled and the decline
        // message, and the job's held time all commit together or not at all.
        // A customer's change request is answered with accept-change or
        // decline-change (piece 12): plain accept/decline would return the job to
        // scheduled without moving it or telling the customer. With a chosen
        // mechanic: the version first, then the mechanic free at the booked time,
        // then the accept and the move together (as the job's save does).
        try {
          result = await withJobBookingLock(id, [], async (current) => {
            if (answeringRequest && requestedOf(current)) {
              return { refused: { status: 409, body: {
                error: 'This booking has a change request from the customer - accept or decline the change instead', code: 'illegal',
              } } };
            }
            answering = answeringRequest ? current.booking_state : null;
            let moving = false;
            if (acceptMechanic !== undefined) {
              if (current.version !== body.version) return { refused: staleRefusal };
              moving = current.mechanic_id !== acceptMechanic;
              if (moving) {
                const slotError = await checkJobSlot({
                  jobDate: current.job_date, startTime: current.start_time, endTime: current.end_time, mechanicId: acceptMechanic, ignoreJobId: id,
                });
                if (slotError) return { refused: refusal(slotError.error) };
              }
            }
            const applied = await applyEvent({ jobId: id, machine, event, expectedVersion: body.version });
            if (!applied.ok) return applied;
            if (moving) {
              await db.prepare('UPDATE workshop_jobs SET mechanic_id = ?, version = version + 1, updated_at = now() WHERE id = ?').run(acceptMechanic, id);
            }
            // No staff booking event keeps a customer's request (accept and decline
            // of one are refused above), so any request columns left on the job go -
            // a staff request_reschedule must never hold a time nobody checked
            // (piece 12). The job is locked, so nothing wrote it since the event.
            await db.prepare(`UPDATE workshop_jobs SET ${CLEAR_REQUEST} WHERE id = ?`).run(id);
            if (event === 'decline') {
              await db.prepare('UPDATE workshop_jobs SET decline_message = ? WHERE id = ?').run(declineMessage || null, id);
            }
            // A staff cancellation never shows in "Waiting for you" (piece 12), and
            // the link no longer speaks of a declined change.
            if (event === 'cancel') {
              await db.prepare(
                "UPDATE workshop_jobs SET cancelled_by = 'staff', cancelled_at = now(), change_declined_at = NULL WHERE id = ?"
              ).run(id);
            }
            // A hold that outlives its booking is capacity the diary is still promising
            // away, released in the same request rather than on a timer - but a
            // reschedule declined back onto a still-live booking (scheduled) must keep
            // its hold. syncJobHold decides from the job's current state, not from
            // which event fired, so it releases only when the job is no longer live
            // and otherwise keeps (or realigns) the one hold a live job holds.
            await syncJobHold(id);
            return { ...applied, job: await db.prepare('SELECT * FROM workshop_jobs WHERE id = ?').get(id) };
          });
        } catch (err) {
          if (err.code !== '23505') throw err;
          result = { refused: capacityRefusal(SLOT_GONE) };
        }
        if (result.gone) return notFound(res, 'Job not found');
        if (result.refused) return sendJson(res, result.refused.status, result.refused.body);
      } else if (bookInSlot !== undefined) {
        // The bike comes in and goes on its slot together, or neither.
        await db.exec('BEGIN');
        try {
          result = await applyEvent({ jobId: id, machine, event, expectedVersion: body.version });
          if (result.ok) await db.prepare('UPDATE workshop_jobs SET storage_slot_id = ? WHERE id = ?').run(bookInSlot, id);
          await db.exec(result.ok ? 'COMMIT' : 'ROLLBACK');
        } catch (err) {
          await db.exec('ROLLBACK');
          // The slot was removed just now (fresh review).
          if (err.code === '23503') return badRequest(res, 'That slot doesn’t exist');
          throw err;
        }
      } else {
        result = await applyEvent({ jobId: id, machine, event, expectedVersion: body.version });
      }
      if (!result.ok) {
        if (result.code === 'not_found') return notFound(res, 'Job not found');
        // `code` is what a screen branches on: 'stale' means reload and look
        // again, 'illegal' means the move was never allowed and retrying cannot
        // help. The message is for people and may be reworded; the code may not.
        return sendJson(res, 409, { error: result.message, code: result.code });
      }
      // After the commit: a message that can't be queued is logged, not an error
      // (the answer it follows has been made and stands).
      let bookingMessage;
      if (event === 'accept' && answering === 'pending') bookingMessage = await sendBookingMessage(req, id, shopId, 'booking_confirmed');
      if (event === 'decline' && (answering === 'pending' || answering === 'offered')) bookingMessage = await sendBookingMessage(req, id, shopId, 'request_declined');
      // The shop cancelling (Jack, 20 Oct, booking messages answer 4; 21 Oct).
      if (event === 'cancel') bookingMessage = await sendBookingMessage(req, id, shopId, 'booking_cancelled');
      const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
      sendJson(res, 200, { ...serializeWorkshopJob(row), ...(readyMessage ? { readyMessage } : {}), ...(bookingMessage ? { bookingMessage } : {}) });
    });
  }

  // The job page says it was opened (Jack, 19 Oct, auto-confirm): an online
  // booking confirmed at once loses its "new, booked online" mark. Any signed-in
  // staff member; no version (seeing a job is not an edit), and doing it again
  // changes nothing. A GET never changes data, so this is its own POST.
  // screens: job-page, diary
  route('POST', '/api/workshop-jobs/:id/seen', async (req, res, params) => {
    const { changes } = await db.prepare('UPDATE workshop_jobs SET online_unseen = 0 WHERE id = ?').run(Number(params.id));
    if (!changes) return notFound(res, 'Job not found');
    res.writeHead(204).end();
  });

  // The job's checklist (Jack, 22 Oct, service checklists; drawn as job-checklist
  // and job-mechanic's bar): its service's, or the copy its first tick made.
  // Null when the job has none. Any signed-in staff member ticks and notes.
  // screens: job-page
  route('GET', '/api/workshop-jobs/:id/checklist', async (req, res, params) => {
    const id = Number(params.id);
    if (!(await db.prepare('SELECT 1 FROM workshop_jobs WHERE id = ?').get(id))) return notFound(res, 'Job not found');
    sendJson(res, 200, await jobChecklist(id));
  });

  // screens: job-page
  route('PUT', '/api/workshop-jobs/:id/checklist/items/:index', async (req, res, params) => {
    const body = await readJsonBody(req);
    try {
      sendJson(res, 200, await setJobChecklistItem(Number(params.id), Number(params.index), body));
    } catch (err) {
      if (!(err instanceof ChecklistError)) throw err;
      sendJson(res, err.status, err.code ? { error: err.message, code: err.code } : { error: err.message });
    }
  });

  // Where a bike in the shop is kept, changed or cleared (storage slots; the
  // job page's "Kept on [slot]"). Only while the bike is in: book-in sets it,
  // collecting clears it. Not a versioned move: the last choice wins.
  // screens: job-page
  route('PUT', '/api/workshop-jobs/:id/storage-slot', async (req, res, params) => {
    const id = Number(params.id);
    const body = await readJsonBody(req);
    const slotId = body.storageSlotId;
    if (slotId !== null) {
      const why = await slotRefusal(slotId);
      if (why) return badRequest(res, why);
    }
    if (!(await db.prepare('SELECT 1 FROM workshop_jobs WHERE id = ?').get(id))) return notFound(res, 'Job not found');
    let changes;
    try {
      ({ changes } = await db.prepare(
        "UPDATE workshop_jobs SET storage_slot_id = ?, updated_at = now() WHERE id = ? AND custody_state = 'in_shop'"
      ).run(slotId, id));
    } catch (err) {
      if (err.code === '23503') return badRequest(res, 'That slot doesn’t exist');
      throw err;
    }
    if (!changes) return sendJson(res, 409, { error: 'Only a bike in the shop can be put on a slot.', code: 'illegal' });
    const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
    sendJson(res, 200, serializeWorkshopJob(row));
  });

  // screens: requests, review
  jobActionRoute('accept', bookingRequest, 'accept');

  // screens: reject, rejected
  jobActionRoute('decline', bookingRequest, 'decline');

  // screens: reschedule, change-pending
  jobActionRoute('request-reschedule', bookingRequest, 'request_reschedule');

  // screens: cancel, cancelled
  jobActionRoute('cancel', bookingRequest, 'cancel');

  // screens: expired
  jobActionRoute('expire', bookingRequest, 'expire');

  // Offer another time (Jack, 20 Oct, docs/decisions/2026-10-20-offer-another-time.md;
  // openspec/changes/offer-another-time): staff move a request to a time they
  // suggest, with a message. The job itself moves, so its hold follows and the
  // time first asked for is let go (answer 1); where it was asked is kept for
  // the customer's page. Offering again keeps that. Staff slot rules, the job
  // itself left out; under the booking lock for both days.
  // Drawn as request-offer-pick and request-offer.
  // screens: requests, diary
  route('POST', '/api/workshop-jobs/:id/offer', async (req, res, params, query, afterRelease, shopId) => {
    const id = Number(params.id);
    const body = await readJsonBody(req);
    if (!Number.isInteger(body.version)) return badRequest(res, VERSION_REQUIRED);
    const jobDate = String(body.jobDate ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jobDate)) return badRequest(res, 'A valid date is required');
    const mech = await resolveJobMechanicId(body.mechanicId, null);
    if (!mech.ok || mech.mechanicId === null) return badRequest(res, 'Please choose a mechanic');
    // Text only, as decline's message is: an object would be stored as "[object Object]".
    if (body.message !== undefined && body.message !== null && typeof body.message !== 'string') return badRequest(res, 'The message must be text');
    const message = body.message === undefined || body.message === null ? '' : body.message.trim();
    if (message.length > 1000) return badRequest(res, 'The message can be up to 1,000 characters');
    const startTime = String(body.startTime ?? '').trim();
    const taken = { status: 409, body: { error: 'That time is no longer free', code: 'capacity' } };
    let out;
    try {
      out = await withJobBookingLock(id, [jobDate], async (job) => {
        if (job.version !== body.version) return staleRefusal;
        if (job.booking_state !== 'pending' && job.booking_state !== 'offered') {
          return { status: 409, body: { error: 'Only a booking request can be offered another time', code: 'illegal' } };
        }
        // The customer's link can't act once the bike is in the shop or the work
        // has started (customerTooLate in portal.js), so an offer would wait
        // with nobody able to answer it (audit item 15, #315).
        if (job.custody_state !== 'expected') {
          return { status: 409, body: { error: 'The bike is already in the shop, so this can’t be offered another time.', code: 'illegal' } };
        }
        if (job.work_state !== 'not_started') {
          return { status: 409, body: { error: 'The work has already started, so this can’t be offered another time.', code: 'illegal' } };
        }
        // The customer couldn't accept a day gone by (fresh review).
        const now = shopNow(await currentShopTimeZone());
        if (jobDate < now.date) return { status: 400, body: { error: 'That date has passed - please choose another day.' } };
        const minutes = job.planned_minutes
          || (job.start_time ? Math.max(0, timeToMinutes(job.end_time) - timeToMinutes(job.start_time)) : 60);
        const times = resolveJobTimes(startTime, startTime ? addMinutesToTime(startTime, minutes) : '');
        if (times.error) return { status: 400, body: { error: times.error } };
        // Nor a time already gone today (audit item 16, #315).
        if (jobDate === now.date && times.startTime && timeToMinutes(times.startTime) < now.minutes) {
          return { status: 400, body: { error: 'That time has passed - please choose a later time.' } };
        }
        const slotError = await checkJobSlot({
          jobDate, startTime: times.startTime, endTime: times.endTime, mechanicId: mech.mechanicId, ignoreJobId: id,
        });
        if (slotError) return slotError.taken ? taken : { status: 400, body: { error: slotError.error } };
        const first = job.booking_state === 'pending';
        await applyLocked(job, 'offer');
        await db.prepare(
          `UPDATE workshop_jobs SET job_date = ?, mechanic_id = ?, start_time = ?, end_time = ?,
             offered_from_date = ?, offered_from_time = ?, offer_message = ?, updated_at = now()
           WHERE id = ?`
        ).run(jobDate, mech.mechanicId, times.startTime, times.endTime,
          first ? job.job_date : job.offered_from_date, first ? (job.start_time || '') : job.offered_from_time,
          message || null, id);
        await syncJobHold(id);
        const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
        return { status: 200, body: serializeWorkshopJob(row) };
      });
    } catch (err) {
      // The 024 index: another live hold sits on the offered slot.
      if (err.code !== '23505') throw err;
      out = taken;
    }
    if (out?.gone) return notFound(res, 'Job not found');
    const bookingMessage = out.status === 200 ? await sendBookingMessage(req, Number(params.id), shopId, 'time_offered') : undefined;
    sendJson(res, out.status, bookingMessage ? { ...out.body, bookingMessage } : out.body);
  });

  // screens: change-pending, diary
  route('POST', '/api/workshop-jobs/:id/accept-change', async (req, res, params, query, afterRelease, shopId) =>
    answerChangeRequest(req, res, Number(params.id), 'accept', shopId));

  // screens: change-pending, diary
  route('POST', '/api/workshop-jobs/:id/decline-change', async (req, res, params) =>
    answerChangeRequest(req, res, Number(params.id), 'decline'));

  // Staff saw a customer's cancellation (piece 12, decision 5): it leaves
  // "Waiting for you". Keeps the first time it was seen; still needs the version.
  // screens: cancelled, diary
  route('POST', '/api/workshop-jobs/:id/cancellation-seen', async (req, res, params) => {
    const id = Number(params.id);
    const body = await readJsonBody(req);
    if (!Number.isInteger(body.version)) return badRequest(res, VERSION_REQUIRED);
    const job = await db.prepare('SELECT id, cancelled_by FROM workshop_jobs WHERE id = ?').get(id);
    if (!job) return notFound(res, 'Job not found');
    if (job.cancelled_by !== 'customer') {
      return sendJson(res, 409, { error: "Only a customer's cancellation can be marked as seen", code: 'illegal' });
    }
    const { changes } = await db.prepare(
      `UPDATE workshop_jobs SET cancellation_seen_at = COALESCE(cancellation_seen_at, now()), version = version + 1, updated_at = now()
     WHERE id = ? AND version = ?`
    ).run(id, body.version);
    if (changes === 0) return sendJson(res, staleRefusal.status, staleRefusal.body);
    const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
    sendJson(res, 200, serializeWorkshopJob(row));
  });

  // "Waiting for you" (piece 12, decision 3): new online bookings (only the
  // portal sets terms_accepted_at), customers' change requests and customers'
  // cancellations not yet seen - oldest first by when each arrived.
  // screens: requests, diary
  route('GET', '/api/workshop-waiting', async (req, res) => {
    const rows = await db.prepare(
      `SELECT w.*, c.name AS customer_name, trim(b.make || ' ' || b.model) AS bike_label, m.name AS mechanic_name, rm.name AS requested_mechanic_name,
            (SELECT coalesce(json_agg(s.name ORDER BY js.position), '[]'::json)
               FROM workshop_job_services js JOIN workshop_services s ON s.id = js.service_id
              WHERE js.workshop_job_id = w.id) AS service_names,
            (SELECT coalesce(json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY js.position), '[]'::json)
               FROM workshop_job_services js JOIN workshop_services s ON s.id = js.service_id
              WHERE js.workshop_job_id = w.id) AS services
     FROM workshop_jobs w
     LEFT JOIN customers c ON c.id = w.customer_id
     LEFT JOIN customer_bikes b ON b.id = w.bike_id
     LEFT JOIN employees m ON m.id = w.mechanic_id
     LEFT JOIN employees rm ON rm.id = w.requested_mechanic_id
     WHERE (w.booking_state = 'pending' AND w.terms_accepted_at IS NOT NULL)
        OR (w.booking_state = 'reschedule_requested' AND w.requested_job_date IS NOT NULL)
        OR (w.booking_state = 'cancelled' AND w.cancelled_by = 'customer' AND w.cancellation_seen_at IS NULL)`
    ).all();
    const items = rows.map(waitingItem)
      .sort((a, b) => (new Date(a.arrivedAt) - new Date(b.arrivedAt)) || (a.jobId - b.jobId));
    sendJson(res, 200, { count: items.length, items });
  });

  // screens: intake, scan
  jobActionRoute('book-in', custody, 'book_in');

  // screens: collection, closed
  jobActionRoute('collect', custody, 'collect');

  // The action is reopen-custody, not reopen, because the work machine has a
  // reopen event too and they are different acts: one is a bike coming back
  // through the door, the other is a final check that failed. One URL for both
  // would be the same conflation the single status column produced.
  // screens: reopen
  jobActionRoute('reopen-custody', custody, 'reopen');

  // screens: queue, job-page
  jobActionRoute('start', work, 'start');

  // screens: waiting
  jobActionRoute('await-parts', work, 'await_parts');

  // screens: waiting
  jobActionRoute('parts-arrived', work, 'parts_arrived');

  // screens: job, waiting
  jobActionRoute('hold', work, 'hold');

  // screens: job, waiting
  jobActionRoute('resume', work, 'resume');

  // screens: finished, job-page
  jobActionRoute('finish', work, 'finish');

  // See reopen-custody above: a failed final check is not a bike coming back.
  // screens: reopen
  jobActionRoute('reopen-work', work, 'reopen');

  // ---------- Quotes ----------
  // screens: quote-editor, quote-send, approved
  route('GET', '/api/quotes/:id', async (req, res, params) => {
    const result = await readQuote({ quoteId: Number(params.id) });
    if (!result.ok) return notFound(res, 'Quote not found');
    // The customer's limit and the whole bill with this quote, so the job page
    // offers Save and tell within it (Workshop day 41-43).
    const bill = await wholeBill(result.quote.id, result.quote.workshop_job_id);
    sendJson(res, 200, { ...serializeQuoteWithLines(result.quote, result.lines, result.totals),
      limit: bill ? { spendLimit: bill.spendLimit, wholeBill: bill.wholeBill } : null });
  });

  // screens: quote-editor, approved, job
  route('GET', '/api/workshop-jobs/:id/quotes', async (req, res, params) => {
    const rows = await listRevisions({ jobId: Number(params.id) });
    sendJson(res, 200, rows.map(serializeQuote));
  });

  // screens: quote-editor
  route('POST', '/api/workshop-jobs/:id/quotes', async (req, res, params) => {
    const body = await readJsonBody(req);
    if (!Array.isArray(body.lines)) return badRequest(res, 'lines must be an array');
    sendQuoteResult(res, await createQuoteRevision({ jobId: Number(params.id), lines: body.lines }), 201);
  });

  // Send (journey 4 decision 5): the quote goes to sent and the message goes to
  // the customer with their booking link. Once real sending is on that link is
  // issued afresh (only a hash of the old one is kept; the old link stops
  // working); while it is pretend, the message says [link] and their link is left
  // alone. The answer says whether the message went, and carries a link for staff
  // to hand over only when none did. The staff app's one-minute Undo
  // lives in the app, which calls this only when the minute is up.
  // screens: quote-send
  route('POST', '/api/quotes/:id/send', async (req, res, params, query, afterRelease, shopId) => {
    const ctx = await currentSession(req);
    const result = await sendQuoteForApproval({ quoteId: Number(params.id) });
    if (!result.ok) return sendQuoteResult(res, result);
    const jobId = result.quote.workshop_job_id;
    // The quote is sent and committed. Everything below only tells the customer,
    // so a fault here is logged and shown to staff as "no message went" - never a
    // 500 that makes them send a quote that has already gone.
    let message;
    let link = null;
    try {
      // The message carries a link the way every other message does: while
      // sending is pretend it says "[link]" and the customer's own link is left
      // working (openspec/specs/messages/spec.md).
      const messageLinkText = await messageLink(() => issueJobLink(req, jobId, shopId));
      // Through the messages engine, with no further wait: the panel had its
      // minute's Undo before calling this (pretend for now; Jack, 20 Oct).
      const { customerId, customerName, vars } = await jobMessageVars(jobId, shopId, messageLinkText);
      if (!customerId) message = { status: 'not_sent', reason: 'This job has no customer.' };
      else {
        const queued = await queueMessage({ customerId, jobId, key: 'quote_to_approve', vars, loginId: ctx?.login?.id ?? null });
        // One reminder, the shop's hours later, unless the quote is answered,
        // withdrawn or replaced first (Jack, 22 Oct). It goes only with the quote.
        // Its own fault is only logged: the quote's message has gone (fresh review).
        if (!queued.skipped) {
          try {
            await undoWaiting(jobId, 'quote_reminder');
            const settings = await db.prepare('SELECT quote_reminder_hours FROM workshop_settings LIMIT 1').get();
            await queueMessage({ customerId, jobId, key: 'quote_reminder', vars, delayMs: (settings?.quote_reminder_hours ?? 24) * 3600_000, loginId: ctx?.login?.id ?? null });
          } catch (err) {
            console.error(`Quote ${result.quote.id}'s reminder couldn't be queued`, err);
          }
        }
        message = queued.skipped
          ? { status: 'not_sent', reason: notSent(queued.skipped, 'Quote to approve', customerName) }
          : { status: 'sent', channel: queued.channel, to: queued.to, pretend: true };
      }
      // Staff read a link from this reply only when no message went (the quote
      // panel offers it to copy and hand over). When one did, the link is the
      // one it carries: a real one, or none while sending is pretend.
      link = message.status === 'sent' ? (messageLinkText === '[link]' ? null : messageLinkText) : await issueJobLink(req, jobId, shopId);
    } catch (err) {
      console.error(`Quote ${result.quote.id} was sent but its message couldn't be queued`, err);
      message = { status: 'not_sent', reason: 'The quote is sent, but the message could not be queued. Give the customer their link another way.' };
      link = await issueJobLink(req, jobId, shopId).catch(() => null);
    }
    sendJson(res, 200, { quote: serializeQuote(result.quote), message, link });
  });

  // Work within the customer's spending limit (Workshop day 41-43; dq-job-within):
  // agreed without a quote, and the customer is told what was added. The
  // panel had its minute's Undo before calling this, as for Send quote.
  // screens: quote-send
  route('POST', '/api/quotes/:id/within-limit', async (req, res, params, query, afterRelease, shopId) => {
    const ctx = await currentSession(req);
    const result = await agreeWithinLimit({ quoteId: Number(params.id), loginId: ctx?.login?.id ?? null });
    if (!result.ok) return sendQuoteResult(res, result);
    const jobId = result.quote.workshop_job_id;
    let message;
    try {
      const messageLinkText = await messageLink(() => issueJobLink(req, jobId, shopId));
      const { customerId, customerName, vars } = await jobMessageVars(jobId, shopId, messageLinkText);
      const added = await db.prepare(
        `SELECT string_agg(description, ', ' ORDER BY id) AS names, sum(quantity * unit_amount) AS total
           FROM workshop_quote_lines WHERE workshop_quote_id = ?`
      ).get(result.quote.id);
      const shop = await db.prepare('SELECT phone FROM shops WHERE id = ?').get(shopId);
      Object.assign(vars, {
        'Work added': added.names,
        'Amount added': `£${Number(added.total).toFixed(2)}`,
        'Spending limit': `£${result.spendLimit.toLocaleString('en-GB')}`,
        // With no phone in Shop details, "Call the shop", as the customer's page says.
        'Shop phone': shop?.phone || 'the shop',
      });
      if (!customerId) message = { status: 'not_sent', reason: 'This job has no customer.' };
      else {
        const queued = await queueMessage({ customerId, jobId, key: 'work_within_limit', vars, loginId: ctx?.login?.id ?? null });
        message = queued.skipped
          ? { status: 'not_sent', reason: notSent(queued.skipped, 'Work added within your limit', customerName) }
          : { status: 'sent', channel: queued.channel, to: queued.to, pretend: true };
      }
    } catch (err) {
      console.error(`Quote ${result.quote.id} was agreed within the limit but its message couldn't be queued`, err);
      message = { status: 'not_sent', reason: 'The work is added, but the message could not be queued. Let the customer know another way.' };
    }
    sendJson(res, 200, { quote: serializeQuote(result.quote), message });
  });

  // screens: quote-send
  route('POST', '/api/quotes/:id/withdraw', async (req, res, params) => {
    sendQuoteResult(res, await withdrawQuote({ quoteId: Number(params.id) }));
  });

  // Record their answer (journey 4 decision 4): staff, after a phone call or a
  // chat in the shop. Who took it and when are recorded with each line.
  // screens: approved
  route('POST', '/api/quotes/:id/answer', async (req, res, params, query, afterRelease, shopId) => {
    const ctx = await currentSession(req);
    const body = await readJsonBody(req);
    if (!['phone', 'in_shop'].includes(body.via)) return badRequest(res, "via must be 'phone' or 'in_shop'");
    const result = await answerAndAddToOrder({
      quoteId: Number(params.id), decisions: body.decisions, via: body.via, loginId: ctx?.login?.id ?? null,
    });
    // An answer from a call: the customer is sent what was agreed, at once
    // (dq-record-answer; Jack, 22 Oct). In the shop they were there. A fault
    // here is logged; the answer is saved either way.
    if (result.ok && body.via === 'phone') {
      try {
        const jobId = result.quote.workshop_job_id;
        // A customer who gets nothing keeps the link they have (fresh review),
        // as Bike ready does: checked before a link is issued.
        const owner = await db.prepare('SELECT customer_id FROM workshop_jobs WHERE id = ?').get(jobId);
        if (!owner?.customer_id || (await whyNotQueued('your_answers', owner.customer_id))) return sendQuoteResult(res, result);
        const messageLinkText = await messageLink(() => issueJobLink(req, jobId, shopId));
        const { customerId, vars } = await jobMessageVars(jobId, shopId, messageLinkText);
        const lines = await db.prepare('SELECT description, decision FROM workshop_quote_lines WHERE workshop_quote_id = ? ORDER BY id').all(result.quote.id);
        const { total } = await db.prepare(
          "SELECT sum(quantity * unit_amount) AS total FROM workshop_quote_lines WHERE workshop_quote_id = ? AND decision = 'approved'"
        ).get(result.quote.id);
        const list = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]);
        const yes = lines.filter((l) => l.decision === 'approved').map((l) => l.description);
        const no = lines.filter((l) => l.decision === 'declined').map((l) => l.description);
        vars['What was agreed'] = [
          yes.length ? `Going ahead: ${list(yes)}, £${Number(total).toFixed(2)}.` : 'Going ahead: just the booked work.',
          no.length ? `No thanks: ${list(no)}.` : null,
        ].filter(Boolean).join(' ');
        if (customerId) await queueMessage({ customerId, jobId, key: 'your_answers', vars, loginId: ctx?.login?.id ?? null });
      } catch (err) {
        console.error(`Quote ${result.quote.id}'s Your answers message couldn't be queued`, err);
      }
    }
    sendQuoteResult(res, result);
  });

  // ---------- Notes with the shop (decisions 3 and 7; ac-inbox) ----------
  // screens: diary
  route('GET', '/api/job-notes/conversations', async (req, res, params, query) => {
    sendJson(res, 200, await noteConversations(query.get('filter') === 'needs-reply' ? 'needs-reply' : 'all'));
  });

  // screens: diary
  route('GET', '/api/workshop-jobs/:id/notes', async (req, res, params) => {
    const job = await db.prepare('SELECT id FROM workshop_jobs WHERE id = ?').get(Number(params.id));
    if (!job) return notFound(res, 'Job not found');
    sendJson(res, 200, await jobNotes(job.id));
  });

  // A staff reply, saved on the job; the customer is told with Reply from the
  // shop, the way they chose (pretend for now). A customer who gets nothing
  // keeps the link they have, as Bike ready.
  // screens: diary
  route('POST', '/api/workshop-jobs/:id/notes', async (req, res, params, query, afterRelease, shopId) => {
    const ctx = await currentSession(req);
    const job = await db.prepare(
      `SELECT w.id, w.customer_id, w.job_date, w.custody_state, c.name AS customer_name,
              to_char(w.collected_at AT TIME ZONE COALESCE((SELECT time_zone FROM workshop_settings LIMIT 1), 'Europe/London'), 'YYYY-MM-DD') AS collected_on
         FROM workshop_jobs w LEFT JOIN customers c ON c.id = w.customer_id WHERE w.id = ?`
    ).get(Number(params.id));
    if (!job) return notFound(res, 'Job not found');
    const body = await readJsonBody(req);
    const text = cleanNote(body?.text);
    if (!text) return badRequest(res, NOTE_WORDS);
    await addNote({ jobId: job.id, fromCustomer: false, loginId: ctx?.login?.id ?? null, text });
    let message;
    try {
      // A page that has closed (fresh review): no text with a link that doesn't work.
      const closed = linkExpiry({ jobDate: job.job_date, custodyState: job.custody_state, collectedOn: job.collected_on }, await currentShopToday()).expired;
      const why = !job.customer_id ? 'no_customer' : closed ? 'closed' : await whyNotQueued('shop_reply', job.customer_id);
      if (why) {
        const who = job.customer_name ?? 'The customer';
        message = { status: 'not_sent', reason: why === 'no_customer' ? 'This job has no customer.' : why === 'closed' ? `${who}’s booking page has closed.` : notSent(why, 'Reply from the shop', who) };
      } else {
        const messageLinkText = await messageLink(() => issueJobLink(req, job.id, shopId));
        const { customerId, customerName, vars } = await jobMessageVars(job.id, shopId, messageLinkText);
        // The drawn text puts its own full stop after the reply, so the reply's own goes.
        vars['The shop’s reply'] = text.replace(/\.+$/, '');
        const queued = await queueMessage({ customerId, jobId: job.id, key: 'shop_reply', vars, loginId: ctx?.login?.id ?? null });
        message = queued.skipped
          ? { status: 'not_sent', reason: notSent(queued.skipped, 'Reply from the shop', customerName) }
          : { status: 'sent', channel: queued.channel, to: queued.to, pretend: true };
      }
    } catch (err) {
      console.error(`A reply on job ${job.id} was saved but its message couldn't be queued`, err);
      message = { status: 'not_sent', reason: 'The message could not be queued.' };
    }
    sendJson(res, 201, { notes: await jobNotes(job.id), message });
  });

  // ---------- Deleting a job, and its attachments ----------
  route('DELETE', '/api/workshop-jobs/:id', async (req, res, params) => {
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM workshop_jobs WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Job not found');
    // Jack, 18 Oct (docs/decisions/2026-10-18-attachments-and-delete.md): not
    // while money has been paid on its order or the bike is in the shop. The
    // reply says which, so the job page can say "Settle up first".
    //
    // The check and every write run in one transaction, under the job's booking
    // lock and with the job's orders locked first - the same order a payment takes
    // them (order, then job), so the two cannot deadlock. A payment already in
    // flight finishes first and the delete then sees it; one that arrives later
    // finds the order unlinked and pays an order with no job. Without this, a
    // payment landing between the check and the writes left a paid order cut
    // loose from a deleted job.
    let attachments = [];
    let out;
    await db.exec('BEGIN');
    try {
      await db.prepare('SELECT id FROM sale_documents WHERE workshop_job_id = ? ORDER BY id FOR UPDATE').all(id);
      out = await withJobBookingLock(id, [], async (job) => {
        // Any paid order linked to the job counts (a job can have more than one).
        const paid = Boolean(await db.prepare("SELECT 1 AS paid FROM sale_documents WHERE workshop_job_id = ? AND status = 'converted' LIMIT 1").get(id));
        const inShop = job.custody_state === 'in_shop';
        if (paid || inShop) {
          return {
            status: 409,
            body: {
              error: `Settle up first: ${paid && inShop ? 'refund what was paid and hand the bike back' : paid ? 'refund what was paid' : 'hand the bike back'}, then delete.`,
              code: 'settle_first', paid, inShop,
            },
          };
        }
        // The attachments row is ON DELETE CASCADE, but that only removes the DB
        // record - the file on disk needs its own cleanup (after the commit) or it
        // just sits there forever with nothing pointing at it.
        attachments = await db.prepare('SELECT storage_key FROM workshop_job_attachments WHERE workshop_job_id = ?').all(id);
        await db.prepare('UPDATE sale_documents SET workshop_job_id = NULL WHERE workshop_job_id = ?').run(id);
        // The capacity hold references this job, so it has to go first or the delete
        // fails on the foreign key. Deleted rather than released: a released hold is
        // a record of a slot the shop gave back, and there is no longer a booking for
        // it to be a record of.
        await db.prepare('DELETE FROM workshop_capacity_holds WHERE workshop_job_id = ?').run(id);
        // Its quotes and print tasks point at it with no cascade, so they go first
        // too (fresh review: a job with a quote couldn't be deleted at all).
        await db.prepare('DELETE FROM workshop_quote_lines WHERE workshop_quote_id IN (SELECT id FROM workshop_quotes WHERE workshop_job_id = ?)').run(id);
        await db.prepare('DELETE FROM workshop_quotes WHERE workshop_job_id = ?').run(id);
        await db.prepare('DELETE FROM workshop_print_tasks WHERE workshop_job_id = ?').run(id);
        await undoJobMessages(id);
        await db.prepare('DELETE FROM workshop_jobs WHERE id = ?').run(id);
        return undefined;
      });
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK').catch(() => {});
      throw err;
    }
    if (out?.gone) return notFound(res, 'Job not found');
    if (out) return sendJson(res, out.status, out.body);
    await Promise.all(attachments.map((a) => unlink(path.join(UPLOADS_DIR, a.storage_key)).catch(() => {})));
    sendJson(res, 200, { ok: true });
  });

  route('GET', '/api/workshop-jobs/:jobId/attachments', async (req, res, params) => {
    const jobId = Number(params.jobId);
    const job = await db.prepare('SELECT id FROM workshop_jobs WHERE id = ?').get(jobId);
    if (!job) return notFound(res, 'Job not found');
    const rows = await db
      .prepare('SELECT * FROM workshop_job_attachments WHERE workshop_job_id = ? ORDER BY uploaded_at DESC')
      .all(jobId);
    sendJson(res, 200, rows.map(serializeAttachment));
  });

  route('POST', '/api/workshop-jobs/:jobId/attachments', async (req, res, params) => {
    const jobId = Number(params.jobId);
    const job = await db.prepare('SELECT id FROM workshop_jobs WHERE id = ?').get(jobId);
    if (!job) return notFound(res, 'Job not found');

    let body;
    try {
      body = await readJsonBody(req, MAX_ATTACHMENT_BODY_BYTES);
    } catch (err) {
      return badRequest(res, err.message === 'Payload too large' ? 'That file is too large (max 15MB).' : 'Invalid request body');
    }
    if (!body.dataBase64) return badRequest(res, 'No file data received');
    const originalName = String(body.filename || 'attachment').trim().slice(0, 200) || 'attachment';
    const contentType = String(body.contentType || 'application/octet-stream').trim().slice(0, 100);

    let buffer;
    try {
      buffer = Buffer.from(body.dataBase64, 'base64');
    } catch {
      return badRequest(res, 'Could not decode file data');
    }
    if (!buffer.length) return badRequest(res, 'That file is empty');
    if (buffer.length > MAX_ATTACHMENT_BYTES) return badRequest(res, 'That file is too large (max 15MB).');
    // A JPEG, PNG or WebP loses where it was taken, when and on what (CX-2,
    // photo-metadata.js); any other file is saved as it was sent.
    const cleaned = removePhotoDetails(buffer);
    if (cleaned.error) return badRequest(res, 'That picture couldn’t be read. Try adding it again.');
    buffer = cleaned.buffer;

    const storageKey = randomBytes(24).toString('hex');
    await writeFile(path.join(UPLOADS_DIR, storageKey), buffer);
    const info = await db
      .prepare(
        `INSERT INTO workshop_job_attachments (workshop_job_id, storage_key, original_name, content_type, size_bytes)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(jobId, storageKey, originalName, contentType, buffer.length);
    const row = await db.prepare('SELECT * FROM workshop_job_attachments WHERE id = ?').get(info.lastInsertRowid);
    sendJson(res, 201, serializeAttachment(row));
  });

  route('GET', '/api/workshop-jobs/:jobId/attachments/:id', async (req, res, params) => {
    const attachment = await db
      .prepare('SELECT * FROM workshop_job_attachments WHERE id = ? AND workshop_job_id = ?')
      .get(Number(params.id), Number(params.jobId));
    if (!attachment) return notFound(res, 'Attachment not found');
    const filePath = path.join(UPLOADS_DIR, attachment.storage_key);
    if (!existsSync(filePath)) return notFound(res, 'Attachment not found');
    // RFC 5987 filename* carries the real (possibly non-ASCII) name; the
    // plain filename= is a plain-ASCII fallback for older clients, with
    // anything that would break the quoted string stripped out.
    const asciiFallback = attachment.original_name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
    res.writeHead(200, {
      'Content-Type': attachment.content_type || 'application/octet-stream',
      'Content-Length': attachment.size_bytes,
      'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(attachment.original_name)}`,
      'Cache-Control': 'no-store',
    });
    createReadStream(filePath).pipe(res);
  });

  route('DELETE', '/api/workshop-jobs/:jobId/attachments/:id', async (req, res, params) => {
    const attachment = await db
      .prepare('SELECT * FROM workshop_job_attachments WHERE id = ? AND workshop_job_id = ?')
      .get(Number(params.id), Number(params.jobId));
    if (!attachment) return notFound(res, 'Attachment not found');
    await db.prepare('DELETE FROM workshop_job_attachments WHERE id = ?').run(attachment.id);
    await unlink(path.join(UPLOADS_DIR, attachment.storage_key)).catch(() => {});
    sendJson(res, 200, { ok: true });
  });
}
