// The header search (openspec/changes/header-search; staff-search; app map
// review 2; Jack, 24 Oct, answer 7): jobs and customers matching what was
// typed, five of each, for the search on every staff page. Orders and
// products join as they're built.
import { prepare } from '../db.js';
import { currentSession } from '../lib/session.js';
import { sendJson } from '../lib/http.js';

const LIMIT = 5;
// What was typed, matched as plain text: a % or _ is just that character.
const like = (text) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export function register(route) {
  // screens: staff-search
  route('GET', '/api/search', async (req, res, params, query) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const q = (query.get('q') ?? '').trim().slice(0, 100);
    if (q.length < 2) return sendJson(res, 200, { jobs: [], customers: [] });
    const text = like(q);
    // A phone number however it was typed: "07700 900142" or "07700900142";
    // not the numbers in a job number or a name (review).
    const digits = /[a-z]/i.test(q) ? '' : q.replace(/\D/g, '');
    const phone = digits.length >= 4 ? `%${digits}%` : null;
    const jobs = await prepare(
      `SELECT w.id, w.reference, w.title, w.job_date, w.start_time, w.booking_state, w.custody_state, w.work_state,
              c.name AS customer_name, NULLIF(trim(coalesce(b.make, '') || ' ' || coalesce(b.model, '')), '') AS bike_label
         FROM workshop_jobs w
         LEFT JOIN customers c ON c.id = w.customer_id
         LEFT JOIN customer_bikes b ON b.id = w.bike_id
        WHERE w.reference ILIKE ? ESCAPE '\\' OR c.name ILIKE ? ESCAPE '\\' OR c.phone ILIKE ? ESCAPE '\\'
           OR (?::text IS NOT NULL AND regexp_replace(coalesce(c.phone, ''), '\\D', '', 'g') LIKE ?::text)
           OR (coalesce(b.make, '') || ' ' || coalesce(b.model, '')) ILIKE ? ESCAPE '\\'
        ORDER BY (w.reference ILIKE ? ESCAPE '\\') DESC, w.job_date DESC NULLS LAST, w.id DESC
        LIMIT ${LIMIT}`
    ).all(text, text, text, phone, phone, text, q.replace(/[\\%_]/g, (c) => `\\${c}`));
    const customers = await prepare(
      `SELECT id, name, phone, email FROM customers
        WHERE active = 1 AND (name ILIKE ? ESCAPE '\\' OR email ILIKE ? ESCAPE '\\' OR phone ILIKE ? ESCAPE '\\'
              OR replace(upper(coalesce(postcode, '')), ' ', '') LIKE ? ESCAPE '\\'
              OR (?::text IS NOT NULL AND regexp_replace(coalesce(phone, ''), '\\D', '', 'g') LIKE ?::text))
        ORDER BY (name ILIKE ? ESCAPE '\\') DESC, name, id
        LIMIT ${LIMIT}`
    ).all(text, text, text, like(q.replace(/\s+/g, '').toUpperCase()), phone, phone, `${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    sendJson(res, 200, {
      jobs: jobs.map((j) => ({
        id: j.id, reference: j.reference, title: j.title, jobDate: j.job_date, startTime: j.start_time,
        bookingState: j.booking_state, custodyState: j.custody_state, workState: j.work_state,
        customerName: j.customer_name ?? null, bikeLabel: j.bike_label ?? null,
      })),
      customers: customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone || null, email: c.email || null })),
    });
  });
}
