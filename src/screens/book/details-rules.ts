import type { PillOption } from '@/components/ui/pill-group';
import { ApiError } from '@/lib/api/client.ts';
import type { Answer, BookingDraft } from './draft.tsx';
import type { ServicesResponse } from './services-query.ts';
import type { AvailabilityResponse, PortalMechanic } from './date-query.ts';
import { chosenServices, formatFrom } from './service-selection.ts';
import { cleanAnswers } from './problem-rules.ts';
import { dayLabel } from './date-rules.ts';

/**
 * The details screen's rules, kept apart from the screen so they can be tested
 * directly: the field messages, the summary, the request body built from the
 * draft and a fresh copy of /services, and where a refusal sends the customer.
 * The screen only calls these. The server applies the same field rules
 * (server/booking-request.js).
 * Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
 */

export type UpdateChannel = NonNullable<BookingDraft['updateChannel']>;
export type ContactField = 'name' | 'phone' | 'email' | 'terms';
export type FieldProblem = { field: ContactField; message: string };
export type DropoffWindow = { start: string; end: string };
/** Carried in the router's navigation state to the screen a refusal sends the customer to. */
export type SendRefusalState = { timeTaken?: true; questionsChanged?: string };
export type RefusalRoute = { to: 'date' } | { to: 'problem'; message: string } | { to: 'stay'; message: string };

export type BookingBody = {
  serviceIds?: number[];
  notSure?: true;
  answers?: Answer[];
  bikeNote?: string;
  description?: string;
  photos: { dataBase64: string }[];
  jobDate: string;
  mechanicId: number;
  startTime?: string;
  guestName: string;
  guestPhone: string;
  email?: string;
  updateChannel: UpdateChannel;
  termsAccepted: true;
};

export const DEFAULT_CHANNEL: UpdateChannel = 'sms';
export const CHANNEL_OPTIONS: PillOption[] = [
  { value: 'sms', label: 'Text message' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
];
export const FIELD_MESSAGES: Record<ContactField, string> = {
  name: 'Please enter your name',
  phone: 'Please enter your mobile number',
  email: 'Please enter a valid email address',
  terms: 'Please accept the booking terms',
};
// Not in the spec: d3's approved wording for the pinned summary, reused (Jack approves).
export const CHECK_ANSWERS = 'Please check the answers marked above';
export const PHOTOS_QUESTION = 'Your photos were cleared - add them again, or send without them?';
export const TIME_TAKEN_MESSAGE = 'Sorry, that time was booked while you were filling in your details - please choose another';
export const TOO_MANY_REQUESTS = 'Too many booking requests from this network - please try again later.';
export const SEND_FAILED = "We couldn't send your booking - please check your connection and try again";

// The server's 400 refusals carry no code, so these are matched on the start
// of its message (server/server.js, the booking route). The spec's list:
const TIME_GONE = ['That time is no longer available', "That's too soon for the shop", 'That date has passed'];
// Not in the spec's list, but each means the date screen's choice has gone
// stale since it was made (spec decision 4: "a time gone at sending returns
// the customer to date"). Jack approves on the PR; delete this list to
// follow the spec's list alone.
const STALE_CHOICE = [
  'That mechanic is unavailable at that time',
  'This shop takes drop-offs on that day',
  'A start time is required',
  'Please choose a mechanic',
];
const QUESTIONS_CHANGED = 'The questions for this service have changed';
// The server's own required-question refusal (server/service-questions.js
// ~122): a required question left unanswered, e.g. after the shop renamed a
// choice and cleanAnswers (problem-rules.ts) dropped the old one. It means the
// same thing to the customer as QUESTIONS_CHANGED - the questions have moved
// on since problem - so it is routed the same way, with the server's own
// message shown on the problem screen.
const REQUIRED_QUESTION = 'Please answer: ';

export const channelOf = (draft: BookingDraft): UpdateChannel => draft.updateChannel ?? DEFAULT_CHANNEL;

export const emailLabel = (channel: UpdateChannel) => (channel === 'email' ? 'Email' : 'Email (optional)');

/** The server's own test (server/booking-request.js). */
export const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+$/.test(s);

const blank = (s: string | undefined) => (s ?? '').trim() === '';

/** Every field's problem, in screen order; empty when Request booking can go on. */
export function fieldErrors(draft: BookingDraft): FieldProblem[] {
  const problems: FieldProblem[] = [];
  if (blank(draft.name)) problems.push({ field: 'name', message: FIELD_MESSAGES.name });
  if (blank(draft.phone)) problems.push({ field: 'phone', message: FIELD_MESSAGES.phone });
  const email = (draft.email ?? '').trim();
  if ((channelOf(draft) === 'email' && !email) || (email && !looksLikeEmail(email))) {
    problems.push({ field: 'email', message: FIELD_MESSAGES.email });
  }
  if (draft.termsAccepted !== true) problems.push({ field: 'terms', message: FIELD_MESSAGES.terms });
  return problems;
}

/** The chosen services' names in list order, or "Not sure". */
export function serviceNames(services: ServicesResponse, draft: BookingDraft): string {
  if (draft.notSure) return 'Not sure';
  return chosenServices(services, draft.serviceIds ?? []).map((s) => s.name).join(', ');
}

/** "From £T" when the shop shows prices and every chosen service has one; summed in pence. */
export function priceText(services: ServicesResponse, draft: BookingDraft): string | null {
  if (draft.notSure || !services.showPrices) return null;
  const chosen = chosenServices(services, draft.serviceIds ?? []);
  if (chosen.length === 0 || chosen.some((s) => s.price === null)) return null;
  const pence = chosen.reduce((sum, s) => sum + Math.round((s.price as number) * 100), 0);
  return formatFrom(pence / 100);
}

/** The drop-off window on that day, whether or not the day still has room. */
export function dropoffWindowOn(availability: AvailabilityResponse, date: string): DropoffWindow | undefined {
  const day = availability.days.find((d) => d.date === date);
  return day?.mode === 'dropoff' ? day.dropoffWindow : undefined;
}

/**
 * The day and time as the date screen's summary shows them. A timed day has a
 * start time and names the mechanic once /mechanics is known; a drop-off day
 * stores no start time and shows its window once that day's availability is
 * known. Until then (or if either fails to load) the line is shorter, never
 * wrong.
 */
export function whenText(draft: BookingDraft, mechanics: PortalMechanic[] = [], dropoff?: DropoffWindow): string {
  if (!draft.date) return '';
  const day = dayLabel(draft.date);
  if (draft.startTime) {
    const name = mechanics.find((m) => m.id === draft.mechanicId)?.name;
    return name ? `${day}, ${draft.startTime} with ${name}` : `${day}, ${draft.startTime}`;
  }
  return dropoff ? `${day}, drop off ${dropoff.start}–${dropoff.end}` : day;
}

/** The summary at the top of the details screen: services, day and time, price when shown, bike note when given. */
export function summaryLines(services: ServicesResponse, draft: BookingDraft, when: string): string[] {
  const bikeNote = draft.bikeNote?.trim() || null;
  return [serviceNames(services, draft), when, priceText(services, draft), bikeNote].filter((l): l is string => !!l);
}

/**
 * The request body. `services` is the copy read just before sending, so the
 * answers are cleaned against the shop's questions as they are now. `photos`
 * is each held photo as bare base64. The details guard (hasDate) guarantees a
 * date and a real mechanic; a start time is sent only on a timed day.
 */
export function bookingBody(services: ServicesResponse, draft: BookingDraft, photos: string[]): BookingBody {
  const bikeNote = draft.bikeNote?.trim();
  const description = draft.description?.trim();
  const email = draft.email?.trim();
  return {
    ...(draft.notSure
      ? { notSure: true as const }
      : { serviceIds: draft.serviceIds ?? [], answers: cleanAnswers(services, draft) }),
    ...(bikeNote ? { bikeNote } : {}),
    ...(description ? { description } : {}),
    photos: photos.map((dataBase64) => ({ dataBase64 })),
    jobDate: draft.date as string,
    mechanicId: draft.mechanicId as number,
    ...(draft.startTime ? { startTime: draft.startTime } : {}),
    guestName: (draft.name ?? '').trim(),
    guestPhone: (draft.phone ?? '').trim(),
    ...(email ? { email } : {}),
    updateChannel: channelOf(draft),
    termsAccepted: true,
  };
}

/** Where a failed send leaves the customer. Anything that isn't an answer from the server is a lost connection. */
export function refusalRoute(error: unknown): RefusalRoute {
  if (!(error instanceof ApiError)) return { to: 'stay', message: SEND_FAILED };
  if (error.status === 429) return { to: 'stay', message: TOO_MANY_REQUESTS };
  if (error.code === 'capacity') return { to: 'date' };
  // A reply that never carried the server's own words - a proxy or gateway's
  // page (a 502/413 HTML page, say), or any 5xx, which the server's own
  // refusals never are - is shown as a lost connection, not "request failed
  // with 502" or whatever the gateway's page said.
  if (error.status >= 500 || !error.hasServerMessage) return { to: 'stay', message: SEND_FAILED };
  const starts = (list: string[]) => list.some((prefix) => error.message.startsWith(prefix));
  if (error.status === 400 && starts([...TIME_GONE, ...STALE_CHOICE])) return { to: 'date' };
  if (error.status === 400 && (error.message.startsWith(QUESTIONS_CHANGED) || error.message.startsWith(REQUIRED_QUESTION))) {
    return { to: 'problem', message: error.message };
  }
  return { to: 'stay', message: error.message };
}
