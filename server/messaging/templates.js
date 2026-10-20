// Wheelhouse's wording for each automatic message, and filling in its tap-ins
// (the messages engine, Jack 20 Oct, docs/decisions/2026-10-20-messages-engine.md;
// owner setup 14). A shop can reword or switch off any of them
// (message_templates); null means Wheelhouse's.
//
// The booking wordings are Jack's approved ones (docs/decisions/2026-10-20-booking-messages.md);
// Quote to approve is the Q9 draft; Bike ready is owner setup 23's.
import { prepare } from '../db.js';

const BOOKING = ['Customer’s first name', 'Bike', 'Service', 'Booked day and time', 'Shop name', 'Link to the booking', 'Job number'];

export const TEMPLATES = {
  quote_to_approve: {
    name: 'Quote to approve',
    when: 'When a job needs the customer’s OK',
    wording: 'Hi [Customer’s first name], [Shop name] has a quote for more work on your [Bike]. See it and say yes or no to each part: [Link to the quote] — no app or sign-in needed. Your repair · [Job number].',
    subject: 'A quote to approve — [Shop name]',
    tapIns: ['Customer’s first name', 'Bike', 'Shop name', 'Link to the quote', 'Job number'],
  },
  bike_ready: {
    name: 'Bike ready',
    when: 'When a job is marked ready',
    wording: 'Hi [Customer’s first name], your [Bike] is ready to collect from [Shop name]. [Amount to pay] to pay on collection. See what we did: [Link to the job]. Job [Job number]. We’re open [Opening hours].',
    subject: 'Your bike is ready — [Shop name]',
    tapIns: ['Customer’s first name', 'Bike', 'Job number', 'Amount to pay', 'Link to the job', 'Shop name', 'Opening hours'],
  },
  request_received: {
    name: 'Request received',
    when: 'When a booking request is sent',
    wording: 'Hi [Customer’s first name], [Shop name] has your request for a [Service] on your [Bike], [Booked day and time]. We’ll let you know when it’s confirmed. See your booking: [Link to the booking] — no app or sign-in needed. Your repair · [Job number].',
    subject: 'Your booking request — [Shop name]',
    tapIns: BOOKING,
  },
  booking_confirmed: {
    name: 'Booking confirmed',
    when: 'When a booking is accepted, or confirmed straight away',
    wording: 'Hi [Customer’s first name], your [Service] at [Shop name] is booked for [Booked day and time]. [When to drop off] [Your note on the confirmation] See or change your booking: [Link to the booking] — no app or sign-in needed. Your repair · [Job number].',
    subject: 'Booking confirmed — [Shop name]',
    tapIns: [...BOOKING, 'When to drop off', 'Your note on the confirmation'],
  },
  time_offered: {
    name: 'New time offered',
    when: 'When the shop suggests another time',
    wording: 'Hi [Customer’s first name], [Shop name] can’t do [Booked day and time] and suggests [Suggested day and time] instead. “[The shop’s message]” Accept it or cancel your request: [Link to the booking]. Your repair · [Job number].',
    subject: 'Another time for your booking — [Shop name]',
    tapIns: [...BOOKING, 'Suggested day and time', 'The shop’s message'],
  },
  request_declined: {
    name: 'Request declined',
    when: 'When the shop can’t fit a booking in',
    wording: 'Hi [Customer’s first name], sorry — [Shop name] can’t fit in your [Service] on [Booked day and time]. “[The shop’s message]” Choose another date: [Link to the booking]. Your repair · [Job number].',
    subject: 'About your booking request — [Shop name]',
    tapIns: [...BOOKING, 'The shop’s message'],
  },
  date_change_answered: {
    name: 'Date change answered',
    when: 'When the shop accepts or declines a new date',
    wording: 'Hi [Customer’s first name], [Shop name] has moved your [Service] to [New day and time]. [When to drop off] See your booking: [Link to the booking]. Your repair · [Job number].',
    subject: 'Your new date — [Shop name]',
    tapIns: [...BOOKING, 'New day and time', 'When to drop off'],
  },
  booking_cancelled: {
    name: 'Booking cancelled',
    when: 'When a booking is cancelled',
    wording: 'Hi [Customer’s first name], your [Service] at [Shop name] on [Booked day and time] is cancelled. There’s nothing to pay or refund. Book another time: [Link to the booking]. Your repair · [Job number].',
    subject: 'Booking cancelled — [Shop name]',
    tapIns: BOOKING,
  },
};

/** The messages something sends today, so Settings › Messages lists only these (stage 1 drawing gaps 7). */
export const LIVE_KEYS = ['quote_to_approve', 'bike_ready'];

/**
 * Fills each [Tap-in] from `vars`; one with nothing to fill is left out and
 * the spacing around it tidied, so a customer never sees brackets. Only the
 * gap a left-out tap-in leaves is tidied: the shop's own words and the values
 * filled in (a "Wait...", a link) are never changed (fresh review).
 */
const GAP = '\u0000';
export function render(wording, vars) {
  return wording
    .replace(/\[([^\]]+)\]/g, (_, name) => {
      const value = vars[name];
      return value === undefined || value === null || value === '' ? GAP : String(value).replaceAll(GAP, '');
    })
    .replace(new RegExp(`“${GAP}”`, 'g'), GAP)
    .replace(new RegExp(`[ \\t]*${GAP}[ \\t]*`, 'g'), GAP)
    // A gap between two marks keeps the second ("See:" + gap + "." → "See.").
    .replace(new RegExp(`[.,!?:;]${GAP}+(?=[.,!?:;])`, 'g'), '')
    // A gap before a mark goes ("Hi" + gap + "," → "Hi,").
    .replace(new RegExp(`${GAP}+(?=[.,!?:;])`, 'g'), '')
    .replace(new RegExp(`^${GAP}+|${GAP}+$`, 'g'), '')
    .replace(new RegExp(`${GAP}+`, 'g'), ' ')
    .trim();
}

/** One message as this shop has it: on/off, its wording and subject (its own or Wheelhouse's). Inside runWithShop. */
export async function templateFor(key) {
  const base = TEMPLATES[key];
  if (!base) throw new Error(`unknown message: ${key}`);
  const row = await prepare('SELECT enabled, wording, subject FROM message_templates WHERE key = ?').get(key);
  return {
    key,
    ...base,
    enabled: row ? row.enabled : true,
    wording: row?.wording ?? base.wording,
    subject: row?.subject ?? base.subject,
    changed: Boolean(row && (!row.enabled || row.wording !== null || row.subject !== null)),
  };
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const time = (hhmm) => hhmm.replace(/^0(\d)/, '$1');
/**
 * The [Opening hours] tap-in: Monday first, days in a row with the same hours
 * run together ("Mon to Fri 9:00 to 18:00, Sat 9:00 to 16:00"). Takes
 * openingHoursFor's list of { weekday, open, close }.
 */
export function formatOpeningHours(days) {
  const sorted = [...days].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7));
  const runs = [];
  for (const d of sorted) {
    const last = runs.at(-1);
    const prev = last?.days.at(-1);
    if (last && last.open === d.open && last.close === d.close && (prev.weekday + 1) % 7 === d.weekday && d.weekday !== 1) last.days.push(d);
    else runs.push({ open: d.open, close: d.close, days: [d] });
  }
  return runs.map(({ open, close, days: run }) => {
    const first = DAY[run[0].weekday];
    const last = DAY[run.at(-1).weekday];
    const names = run.length === 1 ? first : run.length === 2 ? `${first} and ${last}` : `${first} to ${last}`;
    return `${names} ${time(open)} to ${time(close)}`;
  }).join(', ');
}
