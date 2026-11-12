// Cycle to Work orders outside the Cycle to Work pages (openspec/changes/cycle-to-work,
// task 10.2; UX walk-through 5 M5): the header search (cs-search-c2w) and a
// customer's history (cs-page-c2w, cs-page-c2w-collected), both in customer.mjs.
import { prepare } from '../db.js';
import { ORDER_SELECT, QUOTE_PREFIX } from './orders.js';

const iso = (t) => (t ? new Date(t).toISOString() : null);
// Open until the bike is collected (cs-page-c2w: "Open now"; collected, "Earlier").
const OPEN = ['quote', 'waiting', 'certificate', 'ready'];

// By the customer's name, the quote number (with or without its "CW-") or the
// certificate number, newest first. `text` is the search's ILIKE pattern.
export async function findOrders(text, limit) {
  const rows = await prepare(`${ORDER_SELECT}
    WHERE c.name ILIKE ? ESCAPE '\\' OR ('${QUOTE_PREFIX}' || o.quote_number) ILIKE ? ESCAPE '\\' OR o.certificate_number ILIKE ? ESCAPE '\\'
    ORDER BY o.id DESC LIMIT ${Number(limit)}`).all(text, text, text);
  return rows.map((r) => ({
    id: r.id, customerName: r.customer_name, bike: r.bike_name, stage: r.stage, quoteRef: `${QUOTE_PREFIX}${r.quote_number}`,
    holdUntil: r.hold_until_day, certificateNumber: r.certificate_number ?? null,
  }));
}

// How many orders each of these customers has (cs-search-c2w: "1 Cycle to Work order").
export async function orderCounts(customerIds) {
  if (!customerIds.length) return new Map();
  const rows = await prepare('SELECT customer_id, count(*)::int AS n FROM c2w_orders WHERE customer_id = ANY(?::int[]) GROUP BY customer_id').all(customerIds);
  return new Map(rows.map((r) => [r.customer_id, r.n]));
}

// A customer's orders for their history. An open one is dated by its quote; a
// collected one by its collection, else its quote.
export async function customerOrders(customerId) {
  const rows = await prepare(`${ORDER_SELECT} WHERE o.customer_id = ? ORDER BY o.id`).all(customerId);
  return rows.map((r) => {
    const open = OPEN.includes(r.stage);
    return {
      kind: 'c2w_order', id: r.id, stage: r.stage, open, quoteRef: `${QUOTE_PREFIX}${r.quote_number}`, bike: r.bike_name, providerName: r.provider_name,
      holdUntil: r.hold_until_day, certificateNumber: r.certificate_number ?? null, collectedAt: iso(r.collected_at),
      at: iso(open ? r.quote_given_at : r.collected_at ?? r.quote_given_at),
    };
  });
}
