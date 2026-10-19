import type { BookingLink, BookingStage } from './pending-query.ts';
import { dayLabel } from './date-rules.ts';
import { formatFrom, formatMoney } from './service-selection.ts';

/**
 * The pending screen's rules: the words for each stage, and the summary lines
 * built from the booking link's reply. The screen only calls these.
 * Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
 */
export const STAGE_TEXT: Record<BookingStage, string> = {
  awaiting_confirmation: 'Awaiting shop confirmation',
  confirmed: 'Confirmed',
  in_workshop: 'In the workshop',
  ready_to_collect: 'Ready to collect',
  collected: 'Collected',
  change_requested: 'Change requested',
  declined: 'Declined',
  cancelled: 'Cancelled',
  request_expired: 'Request expired',
};

export const statusText = (stage: BookingStage) => STAGE_TEXT[stage];

export const NOT_FOUND = "We can't find that booking";
export const EXPIRED = 'This link has expired';
// Not in the spec (Jack approves): the heading for any other failure, above "Try again".
export const LOAD_FAILED = "We couldn't load this booking";
export const COPIED_MS = 2000;

/** "Monday 5 October, 09:30"; a drop-off booking has no start time, so the day alone. */
export function whenLine(link: BookingLink): string {
  const day = dayLabel(link.jobDate);
  return link.startTime ? `${day}, ${link.startTime}` : day;
}

/** Each booked service, with its booked price when the shop shows prices. */
export function serviceLines(link: BookingLink): { name: string; price: string | null }[] {
  return link.services.map((s) => ({ name: s.name, price: s.price === null ? null : formatMoney(s.price) }));
}

/**
 * "From £T", when the shop shows prices, every service had one, and there
 * are two or more services (Jack, 26 Sep: a single service already shows its
 * own price on its line, so the total would only repeat it).
 */
export function totalLine(link: BookingLink): string | null {
  if (link.totalPrice === null || link.services.length < 2) return null;
  return formatFrom(link.totalPrice);
}

/**
 * Each answered question as the staff notes word it (server/server.js
 * answerNoteLine): the choice or "I'm not sure", then " - " and any typed
 * words; words alone when there was no choice. Unanswered questions are left out.
 */
export function answerLines(link: BookingLink): { wording: string; answer: string }[] {
  const lines: { wording: string; answer: string }[] = [];
  for (const a of link.answers) {
    const picked = a.answer === null ? null : typeof a.answer === 'object' ? "I'm not sure" : a.answer;
    const words = a.text || null;
    const answer = picked && words ? `${picked} - ${words}` : picked ?? words;
    if (answer) lines.push({ wording: a.wording, answer });
  }
  return lines;
}

/** Until d6 adds changing and cancelling online. */
export const contactLine = (shopName: string) => `Need to change or cancel? Contact ${shopName}`;

// How long before the booking, as people say it (Jack, 19 Oct: "half an hour before").
function leadWords(minutes: number): string {
  if (minutes === 30) return 'half an hour';
  if (minutes === 60) return 'an hour';
  if (minutes === 90) return 'an hour and a half';
  if (minutes % 60 === 0) return `${minutes / 60} hours`;
  return `${minutes} minutes`;
}

/**
 * When to drop the bike off, once the booking stands (Jack, 19 Oct,
 * docs/decisions/2026-10-19-retire-old-workshop-settings.md answers 3 and 7;
 * drawn in bk-confirmed and bk-when-dropoff), or null.
 */
export function dropOffLine(link: BookingLink): string | null {
  const d = link.dropOff;
  if (!d) return null;
  const bike = link.bike ? [link.bike.make, link.bike.model].filter(Boolean).join(' ') || 'bike' : 'bike';
  if ('from' in d) return `Drop your ${bike} off between ${d.from} and ${d.to}.`;
  if (d.leadMinutes <= 0) return `Drop your ${bike} off at your booking time, ${d.booked}.`;
  return `Drop your ${bike} off by ${d.by}, ${leadWords(d.leadMinutes)} before your booking at ${d.booked}.`;
}

// The confirmed page, to its drawing (Jack, 19 Oct; drawn as bk-page).
const bikeName = (link: Pick<BookingLink, 'bike'>) => (link.bike ? [link.bike.make, link.bike.model].filter(Boolean).join(' ') : '');

/** "Trek Domane AL 3 · Standard service": the bike, else "Your bike"; the one service, "[first] and [n] more", or "Repair". */
export function pageHeading(link: Pick<BookingLink, 'bike' | 'services'>): string {
  const [first, ...rest] = link.services;
  const work = !first ? 'Repair' : rest.length ? `${first.name} and ${rest.length} more` : first.name;
  return `${bikeName(link) || 'Your bike'} · ${work}`;
}

/** The Bike row: make and model, else the customer's own words about the bike, else none. */
export function bikeRow(link: Pick<BookingLink, 'bike' | 'bikeNote'>): string | null {
  return bikeName(link) || link.bikeNote || null;
}
