// Cycle to Work's lines in Today's Needs attention (openspec/changes/cycle-to-work,
// task 10.1; decisions 1, 3 and 5; drawn in opening.mjs `today`, as
// op-today-c2w, cw-today and cw-today-held). Each kind of line has its own
// function; `c2wTodayLines` puts them together, only while "On Today" is on in
// Settings. The Owner only, as all of Needs attention is until roles (design 7).
//
// The kinds still to come each add a function here and a line to
// `c2wTodayLines`: "no certificate yet" (cw-today, with pull request 6) and
// "[Provider] payment is [n] days late" (with pull requests 7 and 8).
import { prepare } from '../db.js';
import { ORDER_SELECT, shopDay } from './orders.js';

// A hold that reached its date with nobody choosing (UX walk-through 5 M3):
// still held, before the certificate, asking someone to choose. The list's own
// rule ("hold ended — choose", nextFor), the longest ended first.
export async function holdsEnded(today) {
  const rows = await prepare(`${ORDER_SELECT}
    WHERE o.stage IN ('quote', 'waiting') AND o.hold_until IS NOT NULL AND o.hold_until < ?::date
    ORDER BY o.hold_until, o.id`).all(today);
  return rows.map((r) => ({ kind: 'c2w_hold_ended', orderId: r.id, customerName: r.customer_name, bike: r.bike_name, holdUntil: r.hold_until_day }));
}

export async function c2wTodayLines() {
  // No settings row yet is the default: on.
  const settings = await prepare('SELECT today_lines FROM c2w_settings').get();
  if (settings && !settings.today_lines) return [];
  const today = await shopDay();
  return [...(await holdsEnded(today))];
}
