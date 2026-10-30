// Privacy requests and deleting a customer's details (openspec/changes/
// delete-account; Jack's 30 Oct answer 3; ac-delete, cs-privacy,
// cs-privacy-delete). Runs in the request's shop, so row-level security keeps
// everything to that shop. Dates are the shop's, worked out by the database.
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { prepare, dbExec } from './db.js';
import { wipedAnswers, wipedNotes, wipedTitle, REMOVED } from './workshop/booking-notes.js';
import { UPLOADS_DIR } from './lib/uploads.js';

export const shopZone = async () => (await prepare('SELECT time_zone FROM workshop_settings LIMIT 1').get())?.time_zone || 'Europe/London';

// Open: neither done nor cancelled.
const OPEN = 'r.done_at IS NULL AND r.cancelled_at IS NULL';
// Asked on, and one calendar month on (UK data protection), in the shop's days.
const ASKED_ON = "to_char((r.asked_at AT TIME ZONE ?)::date, 'YYYY-MM-DD')";
const DUE_BY = "to_char((r.asked_at AT TIME ZONE ?)::date + interval '1 month', 'YYYY-MM-DD')";

/** The customer's open deletion request, as the account shows it, or null. */
export async function openDeletion(customerId) {
  const zone = await shopZone();
  const row = await prepare(
    `SELECT ${ASKED_ON} AS "askedOn", ${DUE_BY} AS "finishBy" FROM privacy_requests r
      WHERE r.customer_id = ? AND r.kind = 'delete' AND ${OPEN}`
  ).get(zone, zone, customerId);
  return row ? { askedOn: row.askedOn, finishBy: row.finishBy } : null;
}

/**
 * What holds a deletion back: a bike still in the workshop (coverage walks
 * answers 4 and 5), for the customer and any record merged into theirs.
 */
export async function inTheWay(customerId) {
  return (await prepare(
    `SELECT w.id AS "jobId", w.reference FROM workshop_jobs w
      WHERE w.custody_state = 'in_shop' AND w.customer_id = ANY(?::int[])
      ORDER BY w.id`
  ).all(await chainIds(customerId))).map((r) => ({ jobId: r.jobId, reference: r.reference }));
}

/**
 * The customer and every record merged into theirs, however far back (a
 * record merged into one that was then merged into theirs; review).
 */
export async function chainIds(customerId) {
  return (await prepare(
    `WITH RECURSIVE chain AS (
       SELECT id FROM customers WHERE id = ?
       UNION SELECT c.id FROM customers c JOIN chain ON c.merged_into_id = chain.id
     ) SELECT id FROM chain ORDER BY id`
  ).all(customerId)).map((r) => r.id);
}

/** The shop's list (cs-privacy): open first, oldest asked first; then done, newest first. */
export async function listRequests() {
  const zone = await shopZone();
  const rows = await prepare(
    `SELECT r.id, r.customer_id, r.kind, r.source, c.deleted_at IS NULL AS named, c.name,
            ${ASKED_ON} AS asked_on, ${DUE_BY} AS due_by,
            (r.done_at IS NULL AND (r.asked_at AT TIME ZONE ?)::date + interval '1 month' < (now() AT TIME ZONE ?)::date) AS overdue,
            to_char((r.done_at AT TIME ZONE ?)::date, 'YYYY-MM-DD') AS done_on
       FROM privacy_requests r LEFT JOIN customers c ON c.id = r.customer_id
      WHERE r.cancelled_at IS NULL
      ORDER BY (r.done_at IS NULL) DESC,
               CASE WHEN r.done_at IS NULL THEN r.asked_at END ASC,
               r.done_at DESC, r.id DESC`
  ).all(zone, zone, zone, zone, zone);
  const requests = [];
  for (const r of rows) {
    const open = r.done_on === null;
    requests.push({
      id: r.id,
      reference: `PR-${r.id}`,
      customerId: r.customer_id,
      // A deleted customer's request shows by its reference only (answer 3.6).
      name: r.named && r.customer_id !== null ? r.name : null,
      kind: r.kind,
      source: r.source,
      askedOn: r.asked_on,
      dueBy: r.due_by,
      overdue: Boolean(r.overdue),
      doneOn: r.done_on,
      inTheWay: open && r.kind === 'delete' && r.customer_id !== null ? await inTheWay(r.customer_id) : [],
    });
  }
  return { requests, openCount: requests.filter((r) => r.doneOn === null).length };
}

export async function openCount() {
  return Number((await prepare(`SELECT count(*) AS n FROM privacy_requests r WHERE ${OPEN}`).get()).n);
}

/** The open deletion request on a customer's page (ac-customer-delete), or null. */
export async function deletionOnPage(customerId) {
  const zone = await shopZone();
  const row = await prepare(
    `SELECT ${ASKED_ON} AS asked_on, ${DUE_BY} AS due_by, r.source FROM privacy_requests r
      WHERE r.customer_id = ? AND r.kind = 'delete' AND ${OPEN}`
  ).get(zone, zone, customerId);
  return row ? { askedOn: row.asked_on, dueBy: row.due_by, source: row.source, inTheWay: await inTheWay(customerId) } : null;
}

const refuse = (status, code, error, extra = {}) => ({ ok: false, status, body: { error, code, ...extra } });
// Another write holding what the deletion needs for too long, or the two
// waiting on each other: tried once more, then "try again" (review). The
// deletion gives up any lock it waits on for more than 0.8 seconds, before the
// database's own deadlock check (1 second) would cancel the other side, so a
// mechanic's save or a till payment is never the one cancelled (second review).
const BUSY = new Set(['40P01', '55P03']);
const LOCK_WAIT = '800ms';

/**
 * Delete a customer's details from their open deletion request (design 5).
 * One transaction, every row locked before anything is written, in the
 * order the rest of the app takes them: the merge records naming them (as
 * Undo takes its merge first), the customer (so no new merge into them can
 * start, and a sale or booking for them waits), every record merged into
 * theirs however far back, their sign-ins, their jobs, then the request.
 * Returns the files of the photos they sent, to remove once the save is in.
 */
export async function deleteCustomerDetails(requestId) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await deleteOnce(requestId);
    } catch (err) {
      if (!BUSY.has(err.code)) throw err;
      // Logged, so a lock taken in the wrong order shows up rather than hiding behind the retry.
      console.warn(`Privacy request ${requestId}: deletion tried again after ${err.code}`);
      if (attempt >= 2) return refuse(503, 'busy', 'Something else is changing this customer just now. Try again.');
      // A moment for the other save to finish first.
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

async function deleteOnce(requestId) {
  await dbExec('BEGIN');
  try {
    await prepare(`SET LOCAL lock_timeout = '${LOCK_WAIT}'`).run();
    const asked = await prepare('SELECT customer_id, kind FROM privacy_requests WHERE id = ?').get(requestId);
    if (!asked || asked.kind !== 'delete' || asked.customer_id === null) {
      await dbExec('ROLLBACK');
      return refuse(404, 'not_found', 'Request not found');
    }
    const who = asked.customer_id;
    const lockMerges = async (ids) => prepare('SELECT id FROM customer_merges WHERE kept_id = ANY(?::int[]) OR other_id = ANY(?::int[]) ORDER BY id FOR UPDATE').all(ids, ids);
    const first = await chainIds(who);
    await lockMerges(first);
    // Their jobs before their record, as a job's own routes lock the job and
    // then write for the customer (Mark ready queues Bike ready; review of
    // #590-#592); then read again once both are held.
    await prepare('SELECT id FROM workshop_jobs WHERE customer_id = ANY(?::int[]) ORDER BY id FOR UPDATE').all(first);
    await prepare('SELECT id FROM customers WHERE id = ? FOR UPDATE').get(who);
    // Read again now they're held: a merge that finished while we waited is in.
    const ids = await chainIds(who);
    await lockMerges(ids);
    await prepare('SELECT id FROM customers WHERE id = ANY(?::int[]) ORDER BY id FOR UPDATE').all(ids);
    await prepare('SELECT id FROM customer_logins WHERE customer_id = ANY(?::int[]) ORDER BY id FOR UPDATE').all(ids);
    await prepare('SELECT id FROM workshop_jobs WHERE customer_id = ANY(?::int[]) ORDER BY id FOR UPDATE').all(ids);
    const req = await prepare('SELECT * FROM privacy_requests WHERE id = ? FOR UPDATE').get(requestId);
    if (req.done_at !== null || req.cancelled_at !== null) {
      await dbExec('ROLLBACK');
      return refuse(409, 'not_open', 'That request has already been dealt with.');
    }
    if (req.customer_id !== who) {
      await dbExec('ROLLBACK');
      return refuse(409, 'changed', 'That customer has just changed. Try again.');
    }
    const blocking = await inTheWay(who);
    if (blocking.length) {
      await dbExec('ROLLBACK');
      return refuse(409, 'in_the_way', 'Can be deleted once the bike is collected.', { inTheWay: blocking });
    }

    // Their emails, for the sign-in codes sent to them.
    const emails = (await prepare(
      `SELECT lower(email) AS email FROM customers WHERE id = ANY(?::int[]) AND email <> ''
       UNION SELECT lower(email) FROM customer_logins WHERE customer_id = ANY(?::int[])`
    ).all(ids, ids)).map((r) => r.email);
    const jobs = (await prepare('SELECT id FROM workshop_jobs WHERE customer_id = ANY(?::int[])').all(ids)).map((j) => j.id);
    const sales = (await prepare('SELECT id FROM sales WHERE customer_id = ANY(?::int[])').all(ids)).map((s) => s.id);

    // Answer 3.5: their merges (each holds a name).
    await prepare('DELETE FROM customer_merges WHERE kept_id = ANY(?::int[]) OR other_id = ANY(?::int[])').run(ids, ids);
    // Answer 3.3: their messages, and the photos they sent with bookings.
    await prepare('DELETE FROM job_notes WHERE customer_id = ANY(?::int[]) OR workshop_job_id = ANY(?::int[])').run(ids, jobs);
    const files = (await prepare(
      'DELETE FROM workshop_job_attachments WHERE from_customer AND workshop_job_id = ANY(?::int[]) RETURNING storage_key'
    ).all(jobs)).map((a) => a.storage_key);
    // Answer 3.4: every message the shop sent them, waiting ones included,
    // and receipts for their sales.
    await prepare('DELETE FROM customer_messages WHERE customer_id = ANY(?::int[]) OR sale_id = ANY(?::int[])').run(ids, sales);
    // Their online account, and what hung off it.
    await prepare('DELETE FROM customer_sessions WHERE customer_login_id IN (SELECT id FROM customer_logins WHERE customer_id = ANY(?::int[]))').run(ids);
    await prepare('DELETE FROM customer_logins WHERE customer_id = ANY(?::int[])').run(ids);
    if (emails.length) await prepare('DELETE FROM pretend_signin_codes WHERE lower(email) = ANY(?::text[])').run(emails);
    await prepare('DELETE FROM reminder_stop_codes WHERE customer_id = ANY(?::int[])').run(ids);
    await prepare('DELETE FROM shop_message_stops WHERE customer_id = ANY(?::int[])').run(ids);
    await prepare('DELETE FROM customer_group_members WHERE customer_id = ANY(?::int[])').run(ids);
    await prepare('DELETE FROM customer_not_duplicates WHERE first_id = ANY(?::int[]) OR second_id = ANY(?::int[])').run(ids, ids);
    // The till's alerts about them name them (review).
    // The till's alerts about them name them, as the alert's own record or
    // the one it matched (an alert from before the matched column, by its
    // words; review of #590-#592).
    await prepare(
      `UPDATE till_attention SET detail = 'Customer details deleted'
        WHERE customer_id = ANY(?::int[]) OR matched_customer_id = ANY(?::int[])
           OR (kind = 'possible_duplicate_customer' AND substring(detail from 'customer ([0-9]+)$')::int = ANY(?::int[]))`
    ).run(ids, ids, ids);
    // Their booking links stop working (review of #590-#592).
    await prepare('UPDATE workshop_jobs SET link_token_hash = NULL WHERE customer_id = ANY(?::int[])').run(ids);
    // Answer 4 ("Wipe their words"): what they wrote when booking becomes
    // "[removed]" on each job and the order made with it; what staff typed,
    // the work and the money stay.
    const worded = await prepare(
      `SELECT w.id, w.title, w.notes, w.customer_description, w.customer_bike_note, w.question_answers,
              d.id AS order_id, d.title AS order_title, d.note AS order_note
         FROM workshop_jobs w LEFT JOIN sale_documents d ON d.workshop_job_id = w.id AND d.kind = 'order'
        WHERE w.customer_id = ANY(?::int[])
          AND (w.customer_description IS NOT NULL OR w.customer_bike_note IS NOT NULL OR w.question_answers IS NOT NULL)`
    ).all(ids);
    for (const j of worded) {
      const said = { bikeNote: j.customer_bike_note, questionAnswers: j.question_answers, description: j.customer_description };
      await prepare(
        `UPDATE workshop_jobs SET title = ?, notes = ?, customer_description = ?, customer_bike_note = ?, question_answers = ?::jsonb, updated_at = now()
          WHERE id = ?`
      ).run(
        wipedTitle(j.title, j.customer_description), wipedNotes(j.notes, said),
        j.customer_description ? REMOVED : j.customer_description, j.customer_bike_note ? REMOVED : j.customer_bike_note,
        j.question_answers === null ? null : JSON.stringify(wipedAnswers(j.question_answers)), j.id,
      );
      if (j.order_id) {
        await prepare('UPDATE sale_documents SET title = ?, note = ?, updated_at = now() WHERE id = ?')
          .run(wipedTitle(j.order_title, j.customer_description), wipedNotes(j.order_note, said), j.order_id);
      }
    }
    // Answer 3.2: their bikes stay as bare rows, for the kept jobs.
    await prepare(
      `UPDATE customer_bikes SET make = '', model = '', colour = '', serial_number = '', notes = '', active = 0, updated_at = now()
        WHERE customer_id = ANY(?::int[])`
    ).run(ids);
    // Answer 3.1: the records stay, with nothing that identifies them.
    await prepare(
      `UPDATE customers SET name = '', email = '', phone = '', notes = '', address = NULL, postcode = NULL,
              is_company = false, contact_name = NULL, vat_number = NULL, invoice_email = NULL,
              update_channel = NULL, service_reminders = false, review_requests = false, marketing_permission = false,
              reminders_said_yes_at = NULL, reminders_said_yes_via = NULL, email_from_customer = false,
              active = 0, deleted_at = now(), updated_at = now()
        WHERE id = ANY(?::int[])`
    ).run(ids);
    // Answer 3.6: the request stays, done, with its reference.
    await prepare('UPDATE privacy_requests SET done_at = now() WHERE id = ?').run(requestId);
    await dbExec('COMMIT');
    return { ok: true, files };
  } catch (err) {
    await dbExec('ROLLBACK').catch(() => {});
    throw err;
  }
}

/** Remove the files of the photos a deletion took, once its save is in. */
export async function removeFiles(files) {
  await Promise.all(files.map((key) => unlink(path.join(UPLOADS_DIR, key)).catch((err) => {
    // Logged, so a photo left on disk is known about (review of #590-#592); already gone is fine.
    if (err.code !== 'ENOENT') console.error(`Deleting a customer's details: the photo file ${key} couldn't be removed`, err);
  })));
}
