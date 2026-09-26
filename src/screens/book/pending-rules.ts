import type { BookingLink, BookingStage } from './pending-query.ts';
import { dayLabel } from './date-rules.ts';
import { formatFrom, formatMoney } from './service-selection.ts';

/**
 * The pending screen's rules: the words for each stage, and the summary lines
 * built from the private link's reply. The screen only calls these.
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

/** "From £T", when the shop shows prices and every service had one. */
export function totalLine(link: BookingLink): string | null {
  return link.totalPrice === null ? null : formatFrom(link.totalPrice);
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
