// Cycle to Work's lines in Today's Needs attention (openspec/changes/cycle-to-work,
// task 10.1; decisions 1, 3 and 5; drawn in opening.mjs `today`, as
// op-today-c2w, cw-today and cw-today-held). Each kind of line has its own
// function; `c2wTodayLines` puts them together, only while "On Today" is on in
// Settings. The Owner only, as all of Needs attention is until roles (design 7).
//
import { prepare } from '../db.js';
import { shopToday } from '../clock.js';
import { ORDER_SELECT, shopTimeZone } from './orders.js';
import { owedOrders } from './money.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFrom = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

// A hold that ended: still held, before the certificate, past its date. The
// list's own rule ("hold ended — choose", nextFor); `?` is the shop's today.
const HOLD_ENDED = "o.stage IN ('quote', 'waiting') AND o.hold_until IS NOT NULL AND o.hold_until < ?::date";

// A hold that reached its date with nobody choosing (UX walk-through 5 M3),
// asking someone to choose, the longest ended first.
export async function holdsEnded(today) {
  const rows = await prepare(`${ORDER_SELECT}
    WHERE ${HOLD_ENDED}
    ORDER BY o.hold_until, o.id`).all(today);
  return rows.map((r) => ({ kind: 'c2w_hold_ended', orderId: r.id, customerName: r.customer_name, bike: r.bike_name, holdUntil: r.hold_until_day }));
}

// A quote still without its certificate (cw-today; decision 5): a quote or
// waiting order given Settings' "No certificate after" days ago or more, the
// list's own rule (decided while building, 12 Nov, item 7), counted in the
// shop's days. An order whose hold ended is left to that line, which says
// "no certificate yet" too, so each order has one line. Oldest first.
// Hold longer takes the line away (cw-today-held): it comes back when the
// same days have passed since the hold was last lengthened, still saying
// when the quote was given (decided while building, 12 Nov, PR 10b item 6).
export async function noCertificate(today, tz, days) {
  if (!days) return [];
  // A Hold longer that was undone doesn't count (cw-today-held).
  const rows = await prepare(`SELECT x.*, (SELECT max(e.created_at) FROM c2w_order_events e
      WHERE e.order_id = x.id AND e.kind = 'hold_longer'
        AND NOT EXISTS (SELECT 1 FROM c2w_order_events u WHERE u.order_id = e.order_id
          AND u.kind = 'hold_longer_undone' AND u.detail->>'undid' = e.id::text)) AS held_longer_at
    FROM (${ORDER_SELECT} WHERE o.stage IN ('quote', 'waiting') AND NOT (${HOLD_ENDED})) x
    ORDER BY x.quote_given_at, x.id`).all(today);
  const daysSince = (t) => daysFrom(shopToday(tz, new Date(t)), today);
  return rows
    .map((r) => ({ r, quotedDays: daysSince(r.quote_given_at) }))
    .filter(({ r, quotedDays }) => quotedDays >= days && (!r.held_longer_at || daysSince(r.held_longer_at) >= days))
    .map(({ r, quotedDays }) => ({
      kind: 'c2w_no_certificate', orderId: r.id, customerName: r.customer_name, bike: r.bike_name, quotedDays,
      holdUntil: r.hold_until_day,
    }));
}

// A collected bike the provider hasn't paid for by the date it was expected
// ("[Provider] payment is [n] days late", op-today-c2w; decision 3): the Owed
// page's own rule, oldest expected first. A part-paid bike is still owed, so
// still late; one due today is not late yet.
export async function paymentsLate(tz) {
  return (await owedOrders(tz))
    .filter((o) => o.lateDays !== null)
    .map((o) => ({
      kind: 'c2w_payment_late', orderId: o.id, providerName: o.providerName, customerName: o.customerName,
      collectedOn: o.collectedOn, expectedPence: o.expectedPence, expectedBy: o.expectedBy, lateDays: o.lateDays,
    }));
}

export async function c2wTodayLines() {
  // No settings row yet is the default: on.
  const settings = await prepare('SELECT today_lines, no_certificate_days FROM c2w_settings').get();
  if (settings && !settings.today_lines) return [];
  const tz = await shopTimeZone();
  const today = shopToday(tz);
  return [...(await noCertificate(today, tz, settings?.no_certificate_days)), ...(await holdsEnded(today)), ...(await paymentsLate(tz))];
}
