// Notes with the shop (decisions 3 and 7; openspec/changes/notes-with-the-shop):
// a conversation on a job, the customer's notes from their booking page and
// staff replies. A conversation needs a reply while its newest note is the
// customer's. Runs inside the request's shop context.
import { prepare } from '../db.js';

const NOTE_MAX = 1000;
export const NOTE_WORDS = 'Write a note of up to 1,000 letters.';

/** The note's words, trimmed, or null when it's empty, too long or not words. */
export function cleanNote(text) {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  return t && t.length <= NOTE_MAX ? t : null;
}

export async function addNote({ jobId, fromCustomer, loginId = null, text }) {
  return prepare(
    'INSERT INTO job_notes (workshop_job_id, from_customer, login_id, body) VALUES (?, ?, ?, ?) RETURNING id, created_at'
  ).get(jobId, fromCustomer, loginId, text);
}

/**
 * A job's notes, oldest first. For the customer, a staff note is from the
 * shop, with its writer's name only when the shop shows who signed off to
 * customers (as quotes, Jack, 22 Oct).
 */
export async function jobNotes(jobId, { forCustomer = false } = {}) {
  const rows = await prepare(
    `SELECT n.id, n.from_customer, n.body, n.created_at, l.name AS staff_name
       FROM job_notes n LEFT JOIN logins l ON l.id = n.login_id
      WHERE n.workshop_job_id = ? ORDER BY n.id`
  ).all(jobId);
  let shopName = null;
  let shows = true;
  if (forCustomer) {
    shopName = (await prepare('SELECT name FROM shops WHERE id = current_setting(\'app.current_shop_id\')::int').get())?.name ?? null;
    shows = (await prepare('SELECT show_sign_off_to_customers FROM workshop_settings LIMIT 1').get())?.show_sign_off_to_customers === 1;
  }
  return rows.map((r) => ({
    id: r.id,
    fromCustomer: r.from_customer,
    from: r.from_customer ? (forCustomer ? 'You' : null)
      : forCustomer ? (shows && r.staff_name ? `${r.staff_name}, ${shopName}` : shopName) : r.staff_name ?? null,
    text: r.body,
    at: new Date(r.created_at).toISOString(),
  }));
}

/** One row per job with notes, newest note first; `needsReply` while the customer spoke last. */
export async function conversations(filter) {
  const rows = await prepare(
    `SELECT DISTINCT ON (n.workshop_job_id) n.workshop_job_id, n.from_customer, n.body, n.created_at,
            j.reference, c.name AS customer_name, trim(b.make || ' ' || b.model) AS bike_label
       FROM job_notes n
       JOIN workshop_jobs j ON j.id = n.workshop_job_id
       LEFT JOIN customers c ON c.id = j.customer_id
       LEFT JOIN customer_bikes b ON b.id = j.bike_id
      ORDER BY n.workshop_job_id, n.id DESC`
  ).all();
  const items = rows
    .map((r) => ({
      jobId: r.workshop_job_id,
      customerName: r.customer_name ?? null,
      bikeLabel: r.bike_label || null,
      reference: r.reference ?? null,
      lastText: r.body,
      lastAt: new Date(r.created_at).toISOString(),
      needsReply: r.from_customer,
    }))
    .sort((a, b) => Number(b.needsReply) - Number(a.needsReply) || b.lastAt.localeCompare(a.lastAt)); // waiting first (decision 7), then newest
  const needing = items.filter((i) => i.needsReply);
  return { items: filter === 'needs-reply' ? needing : items, count: needing.length };
}
