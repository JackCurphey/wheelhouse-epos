// The header search (openspec/changes/header-search; staff-search; app map
// review 2; Jack, 24 Oct, answer 7): jobs and customers matching what was
// typed, five of each, for the search on every staff page; bikes by make and
// model or frame number (openspec/changes/bike-search; Jack's answer of 15
// Oct, not-drawn pages 7 and 8). Cycle to Work orders by name, quote or certificate number (cs-search-c2w).
// Other orders and products join as they're built.
import { prepare } from '../db.js';
import { currentSession } from '../lib/session.js';
import { sendJson } from '../lib/http.js';
import { customersOf, findOrders, orderCounts } from '../c2w/elsewhere.js';

const LIMIT = 5;
// What was typed, matched as plain text: a % or _ is just that character.
const like = (text) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export function register(route) {
  // screens: staff-search
  route('GET', '/api/search', async (req, res, params, query) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const q = (query.get('q') ?? '').trim().slice(0, 100);
    if (q.length < 2) return sendJson(res, 200, { jobs: [], customers: [], bikes: [], c2wOrders: [] });
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
    // A frame number starting with what was typed comes first; a removed bike,
    // or a removed customer's, isn't found.
    const bikes = await prepare(
      `SELECT b.id, b.make, b.model, b.colour, b.serial_number, b.customer_id, c.name AS customer_name
         FROM customer_bikes b JOIN customers c ON c.id = b.customer_id
        WHERE b.active = 1 AND c.active = 1
          AND ((coalesce(b.make, '') || ' ' || coalesce(b.model, '')) ILIKE ? ESCAPE '\\' OR b.serial_number ILIKE ? ESCAPE '\\')
        ORDER BY (b.serial_number ILIKE ? ESCAPE '\\') DESC, b.make, b.model, b.id
        LIMIT ${LIMIT}`
    ).all(text, text, `${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    // Cycle to Work orders by name, quote or certificate number, and how many
    // each customer found has (cs-search-c2w; UX walk-through 5 M5). An
    // order's customer joins Customers once, after those found by name.
    const c2wOrders = await findOrders(text, q.replace(/[\\%_]/g, (c) => `\\${c}`), LIMIT);
    const byName = new Set(customers.map((c) => c.id));
    const more = await customersOf([...new Set(c2wOrders.map((o) => o.customerId))].filter((id) => !byName.has(id)));
    customers.push(...more.slice(0, Math.max(0, LIMIT - customers.length)));
    const c2wCounts = await orderCounts(customers.map((c) => c.id));
    sendJson(res, 200, {
      c2wOrders,
      jobs: jobs.map((j) => ({
        id: j.id, reference: j.reference, title: j.title, jobDate: j.job_date, startTime: j.start_time,
        bookingState: j.booking_state, custodyState: j.custody_state, workState: j.work_state,
        customerName: j.customer_name ?? null, bikeLabel: j.bike_label ?? null,
      })),
      customers: customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone || null, email: c.email || null, c2wOrders: c2wCounts.get(c.id) ?? 0 })),
      bikes: bikes.map((b) => ({
        id: b.id, make: b.make || '', model: b.model || '', colour: b.colour || '', serialNumber: b.serial_number || '',
        customerId: b.customer_id, customerName: b.customer_name,
      })),
    });
  });
}
