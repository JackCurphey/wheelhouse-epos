import { ApiError } from '@/lib/api/client.ts';

/**
 * A refusal from the shop, in plain words (Jack, 15 Oct, issue 190). The
 * server explains a move it can't make in its own terms ("cannot book_in a
 * job that is in_shop; from here you can collect"); the job page says why
 * from where the job now is. The sentences are logged in
 * decided-while-building.md for Jack to overrule.
 */

/** Where the job is, said the way staff would say it. One per state, across the three machines. */
const WHERE: Record<string, string> = {
  // The bike
  expected: "The bike isn't here yet.",
  in_shop: 'The bike is already here.',
  collected: 'The bike has already been collected.',
  // The work
  not_started: "The work hasn't started yet.",
  in_progress: 'The work has already started.',
  waiting_parts: 'The job is waiting for parts.',
  on_hold: 'The job is on hold.',
  complete: 'The work is already finished.',
  // The booking
  pending: "This is still a booking request. Accept it first.",
  scheduled: 'The booking is already confirmed.',
  reschedule_requested: 'The customer has asked to change this booking. Answer their request first.',
  declined: 'This booking was declined.',
  expired: 'This booking expired.',
  cancelled: 'This booking was cancelled.',
};

/** A quote's state, finishing "This quote …". */
const QUOTE: Record<string, string> = {
  draft: 'is still a draft',
  sent: 'has been sent',
  partly_approved: 'has been answered',
  approved: 'has been approved',
  declined: 'has been declined',
  superseded: 'has been replaced by a newer one',
  expired: 'has expired',
  withdrawn: 'has been withdrawn',
};
const QUOTE_VERB: Record<string, string> = { revised: 'changed', sent: 'sent', withdrawn: 'withdrawn' };

/** An order that is no longer open, by its status. */
const ORDER: Record<string, string> = {
  converted: "This job has been paid for, so its work and parts can't change.",
  cancelled: "This job's order was cancelled, so its work and parts can't change.",
};

/**
 * The work and parts, days and diary moves' refusals the server words for
 * itself (issue 190 C, the rest; Jack, 15 Oct). Messages already in plain
 * English, such as the diary's rule refusals, aren't here and show as sent.
 */
const OTHER: Record<string, string> = {
  'A labour line needs a description': 'The work needs a description.',
  'A labour line needs a price of zero or more': 'The work needs a price of £0.00 or more.',
  'Duration must be a positive number of minutes': 'The work needs a time of at least 1 minute.',
  'Each item needs a valid productId and positive qty': 'Each part needs a quantity of 1 or more.',
  'That day of the job was not found': 'That day has already been removed.',
  'Job not found': 'This job no longer exists.',
  'Mechanic not found or inactive': 'That mechanic is no longer working here. Choose another.',
  'This job is complete - reopen it before making changes.': 'The work is already finished. Reopen the job to change it.',
};

/** Plain words for a refusal the server words for itself, or null when the message is already plain. */
export function plainWords(message: string): string | null {
  if (OTHER[message]) return OTHER[message];
  const order = /^This (?:order|job's order) is already (\w+)$/.exec(message);
  if (order && ORDER[order[1]]) return ORDER[order[1]];
  if (/^Service \d+ not found or inactive$/.test(message)) return 'That service is no longer offered. Choose another.';
  if (/^Product \d+ not found or inactive$/.test(message)) return 'That product is no longer sold. Choose another.';
  const move = /^cannot \S+ a job that is (\w+);/.exec(message);
  if (move) return WHERE[move[1]] ?? null;
  if (message === 'this quote has already been answered') return 'This quote has already been answered.';
  const closed = /^a quote that is (\w+) is not open for (?:an answer|decisions)$/.exec(message);
  if (closed && QUOTE[closed[1]]) return `This quote ${QUOTE[closed[1]]}, so it can't be answered.`;
  const quote = /^a quote that is (\w+) cannot be (\w+)$/.exec(message);
  if (quote) {
    const [, state, verb] = quote;
    if (state === 'sent' && verb === 'revised') return 'This quote has been sent. Withdraw it before changing it.';
    if (QUOTE[state] && QUOTE_VERB[verb]) return `This quote ${QUOTE[state]}, so it can't be ${QUOTE_VERB[verb]}.`;
  }
  return null;
}

/** What to show for a failed request: plain words where there are some, else the shop's own, else a connection message. */
export function refusalText(err: unknown): string {
  if (err instanceof ApiError) return plainWords(err.message) ?? err.message;
  return "Couldn't reach the server — try again.";
}

/** As refusalText, but a stale refusal says someone else changed the job first. */
export function jobRefusalText(err: unknown): string {
  if (err instanceof ApiError && err.code === 'stale') return 'This job changed while you were looking at it.';
  return refusalText(err);
}
