// Notes with the shop (decisions 3 and 7; openspec/changes/notes-with-the-shop):
// a conversation on a job, the customer's notes from their booking page and
// staff replies. A conversation needs a reply while its newest note is the
// customer's. Runs inside the request's shop context.
//
// From 26 Oct, one conversation per customer (day answers 2 and 8;
// openspec/changes/ask-the-shop-server design 1): a row is a note on a repair
// (its job) or a general message (its customer). A repair note's customer is
// its job's, read through the job.
import { prepare } from '../db.js';

const NOTE_MAX = 1000;
export const NOTE_WORDS = 'Write a note of up to 1,000 letters.';
export const MESSAGE_WORDS = 'Write a message of up to 1,000 letters.';

/** The note's words, trimmed, or null when it's empty, too long or not words. */
export function cleanNote(text) {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  return t && t.length <= NOTE_MAX ? t : null;
}

/** A note on a repair (`jobId`), or a general message in a customer's conversation (`customerId`). */
export async function addNote({ jobId = null, customerId = null, fromCustomer, loginId = null, text }) {
  return prepare(
    'INSERT INTO job_notes (workshop_job_id, customer_id, from_customer, login_id, body) VALUES (?, ?, ?, ?, ?) RETURNING id, created_at'
  ).get(jobId, customerId, fromCustomer, loginId, text);
}

// How the customer sees who wrote for the shop: the shop, with the staff
// member's name only when the shop shows who signed off (as quotes, Jack, 22 Oct).
async function shopVoice() {
  const shopName = (await prepare('SELECT name FROM shops WHERE id = current_setting(\'app.current_shop_id\')::int').get())?.name ?? null;
  const shows = (await prepare('SELECT show_sign_off_to_customers FROM workshop_settings LIMIT 1').get())?.show_sign_off_to_customers === 1;
  return { shopName, from: (staffName) => (shows && staffName ? `${staffName}, ${shopName}` : shopName) };
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
  const voice = forCustomer ? await shopVoice() : null;
  return rows.map((r) => ({
    id: r.id,
    fromCustomer: r.from_customer,
    from: r.from_customer ? (forCustomer ? 'You' : null)
      : forCustomer ? voice.from(r.staff_name) : r.staff_name ?? null,
    text: r.body,
    at: new Date(r.created_at).toISOString(),
  }));
}

// A row's customer: its own for a general message, its job's for a repair note.
const WITH_CUSTOMER = `SELECT n.*, coalesce(n.customer_id, j.customer_id) AS conversation_customer_id
  FROM job_notes n LEFT JOIN workshop_jobs j ON j.id = n.workshop_job_id`;
const bikeLabel = (r) => r.bike_label || null;
const aboutOf = (r, { bike = true } = {}) => (r.workshop_job_id === null ? null
  : bike ? { jobId: r.workshop_job_id, reference: r.reference ?? null, bikeLabel: bikeLabel(r) }
    : { jobId: r.workshop_job_id, reference: r.reference ?? null });

/**
 * A customer's one conversation with the shop, oldest first: their general
 * messages, their notes on each of their repairs (`about` the repair) and the
 * shop's replies (ask-the-shop-server design 2 and 4). For the customer, the
 * shop's messages are from the shop, as on the repair page.
 */
export async function customerConversation(customerId, { forCustomer = false } = {}) {
  const rows = await prepare(
    `SELECT n.id, n.workshop_job_id, n.from_customer, n.body, n.created_at, l.name AS staff_name,
            j.reference, NULLIF(trim(concat_ws(' ', b.make, b.model)), '') AS bike_label
       FROM (${WITH_CUSTOMER}) n
       LEFT JOIN logins l ON l.id = n.login_id
       LEFT JOIN workshop_jobs j ON j.id = n.workshop_job_id
       LEFT JOIN customer_bikes b ON b.id = j.bike_id
      WHERE n.conversation_customer_id = ?
      ORDER BY n.created_at, n.id`
  ).all(customerId);
  const voice = forCustomer ? await shopVoice() : null;
  const items = rows.map((r) => ({
    id: r.id,
    fromCustomer: r.from_customer,
    from: r.from_customer ? (forCustomer ? 'You' : null) : forCustomer ? voice.from(r.staff_name) : r.staff_name ?? null,
    text: r.body,
    at: new Date(r.created_at).toISOString(),
    about: aboutOf(r, { bike: !forCustomer }),
  }));
  return forCustomer ? { shopName: voice.shopName, items } : items;
}

/**
 * The staff inbox, one row per customer with any message or repair note
 * (Jack, 26 Oct, day answers 8.2): the newest message, and `about` its repair
 * (null for a general message). Needs a reply while the customer spoke last;
 * waiting first, then newest. A note on a job with no customer is in no
 * conversation; it stays on the job's own page.
 */
export async function customerConversations(filter) {
  const rows = await prepare(
    `SELECT DISTINCT ON (n.conversation_customer_id) n.conversation_customer_id AS customer_id, n.workshop_job_id,
            n.from_customer, n.body, n.created_at, c.name AS customer_name,
            j.reference, NULLIF(trim(concat_ws(' ', b.make, b.model)), '') AS bike_label
       FROM (${WITH_CUSTOMER}) n
       JOIN customers c ON c.id = n.conversation_customer_id
       LEFT JOIN workshop_jobs j ON j.id = n.workshop_job_id
       LEFT JOIN customer_bikes b ON b.id = j.bike_id
      ORDER BY n.conversation_customer_id, n.created_at DESC, n.id DESC`
  ).all();
  const items = rows
    .map((r) => ({
      customerId: r.customer_id,
      customerName: r.customer_name ?? null,
      lastText: r.body,
      lastAt: new Date(r.created_at).toISOString(),
      needsReply: r.from_customer,
      about: aboutOf(r),
    }))
    .sort((a, b) => Number(b.needsReply) - Number(a.needsReply) || b.lastAt.localeCompare(a.lastAt));
  const needing = items.filter((i) => i.needsReply);
  return { items: filter === 'needs-reply' ? needing : items, count: needing.length };
}
