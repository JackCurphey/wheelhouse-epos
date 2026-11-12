// Cycle to Work orders outside the Cycle to Work pages (openspec/changes/cycle-to-work,
// task 10.2; UX walk-through 5 M5): the header search (cs-search-c2w) and a
// customer's history (cs-page-c2w, cs-page-c2w-collected), both in customer.mjs.
import { prepare } from '../db.js';
import { ORDER_SELECT, QUOTE_PREFIX, nextFor, shopDay } from './orders.js';

const iso = (t) => (t ? new Date(t).toISOString() : null);
// Open until the bike is collected (cs-page-c2w: "Open now"; collected, "Earlier").
const OPEN = ['quote', 'waiting', 'certificate', 'ready'];
// The list's own rule for "Hold ended [date] — choose" (nextFor, on the shop's day).
const holdEnded = (r, today) => nextFor(r, null, today) === 'choose';

// By the customer's name, the quote number (with or without its "CW-") or the
// certificate number; an exact number first, then newest first, as the jobs
// search puts an exact job number first. A removed customer's orders aren't
// found, as their bikes aren't. `text` is the search's ILIKE pattern; `q` what
// was typed, escaped for LIKE.
export async function findOrders(text, q, limit) {
  const today = await shopDay();
  const rows = await prepare(`${ORDER_SELECT}
    WHERE c.active = 1 AND (c.name ILIKE ? ESCAPE '\\' OR ('${QUOTE_PREFIX}' || o.quote_number) ILIKE ? ESCAPE '\\' OR o.certificate_number ILIKE ? ESCAPE '\\')
    ORDER BY coalesce(o.quote_number::text = ? OR ('${QUOTE_PREFIX}' || o.quote_number) ILIKE ? ESCAPE '\\' OR o.certificate_number ILIKE ? ESCAPE '\\', false) DESC, o.id DESC
    LIMIT ${Number(limit)}`).all(text, text, text, q, q, q);
  return rows.map((r) => ({
    id: r.id, customerName: r.customer_name, customerId: r.customer_id, bike: r.bike_name, stage: r.stage, quoteRef: `${QUOTE_PREFIX}${r.quote_number}`,
    holdUntil: r.hold_until_day, holdEnded: holdEnded(r, today), certificateNumber: r.certificate_number ?? null,
  }));
}

// The customers of these orders, as the search lists customers: a quote or
// certificate number finds its customer too (cs-search-c2w).
export async function customersOf(ids) {
  if (!ids.length) return [];
  return prepare('SELECT id, name, phone, email FROM customers WHERE active = 1 AND id = ANY(?::int[]) ORDER BY name, id').all(ids);
}

// How many open orders each of these customers has, leaving out cancelled and
// closed ones (cs-search-c2w: "1 Cycle to Work order").
export async function orderCounts(customerIds) {
  if (!customerIds.length) return new Map();
  const rows = await prepare(`SELECT customer_id, count(*)::int AS n FROM c2w_orders
    WHERE customer_id = ANY(?::int[]) AND stage NOT IN ('cancelled', 'closed') GROUP BY customer_id`).all(customerIds);
  return new Map(rows.map((r) => [r.customer_id, r.n]));
}

// A customer's orders for their history. An open one is dated by its quote; a
// collected one by its collection, else its quote.
export async function customerOrders(customerId) {
  const today = await shopDay();
  const rows = await prepare(`${ORDER_SELECT} WHERE o.customer_id = ? ORDER BY o.id`).all(customerId);
  return rows.map((r) => {
    const open = OPEN.includes(r.stage);
    return {
      kind: 'c2w_order', id: r.id, stage: r.stage, open, quoteRef: `${QUOTE_PREFIX}${r.quote_number}`, bike: r.bike_name, providerName: r.provider_name,
      holdUntil: r.hold_until_day, holdEnded: holdEnded(r, today), certificateNumber: r.certificate_number ?? null, collectedAt: iso(r.collected_at),
      at: iso(open ? r.quote_given_at : r.collected_at ?? r.quote_given_at),
    };
  });
}
