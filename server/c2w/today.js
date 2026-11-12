// Cycle to Work's lines in Today's Needs attention (openspec/changes/cycle-to-work,
// task 10.1; decisions 1, 3 and 5; drawn in opening.mjs `today`, as
// op-today-c2w, cw-today and cw-today-held). Each kind of line has its own
// function; `c2wTodayLines` puts them together, only while "On Today" is on in
// Settings. The Owner only, as all of Needs attention is until roles (design 7).
//
// The kind still to come adds a function here and a line to `c2wTodayLines`:
// "[Provider] payment is [n] days late" (with pull requests 7 and 8).
import { prepare } from '../db.js';
import { shopToday } from '../clock.js';
import { ORDER_SELECT, shopTimeZone } from './orders.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFrom = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

// A hold that reached its date with nobody choosing (UX walk-through 5 M3):
// still held, before the certificate, asking someone to choose. The list's own
// rule ("hold ended — choose", nextFor), the longest ended first.
export async function holdsEnded(today) {
  const rows = await prepare(`${ORDER_SELECT}
    WHERE o.stage IN ('quote', 'waiting') AND o.hold_until IS NOT NULL AND o.hold_until < ?::date
    ORDER BY o.hold_until, o.id`).all(today);
  return rows.map((r) => ({ kind: 'c2w_hold_ended', orderId: r.id, customerName: r.customer_name, bike: r.bike_name, holdUntil: r.hold_until_day }));
}

// A quote still without its certificate (cw-today; decision 5): a quote or
// waiting order given Settings' "No certificate after" days ago or more, the
// list's own rule (decided while building, 12 Nov, item 7), counted in the
// shop's days. An order whose hold ended is left to that line, which says
// "no certificate yet" too, so each order has one line. Oldest first.
export async function noCertificate(today, tz, days) {
  if (!days) return [];
  const rows = await prepare(`${ORDER_SELECT}
    WHERE o.stage IN ('quote', 'waiting') AND NOT (o.hold_until IS NOT NULL AND o.hold_until < ?::date)
    ORDER BY o.quote_given_at, o.id`).all(today);
  return rows
    .map((r) => ({ r, quotedDays: daysFrom(shopToday(tz, new Date(r.quote_given_at)), today) }))
    .filter(({ quotedDays }) => quotedDays >= days)
    .map(({ r, quotedDays }) => ({
      kind: 'c2w_no_certificate', orderId: r.id, customerName: r.customer_name, bike: r.bike_name, quotedDays,
      holdUntil: r.hold_until_day,
    }));
}

export async function c2wTodayLines() {
  // No settings row yet is the default: on.
  const settings = await prepare('SELECT today_lines, no_certificate_days FROM c2w_settings').get();
  if (settings && !settings.today_lines) return [];
  const tz = await shopTimeZone();
  const today = shopToday(tz);
  return [...(await noCertificate(today, tz, settings?.no_certificate_days)), ...(await holdsEnded(today))];
}
