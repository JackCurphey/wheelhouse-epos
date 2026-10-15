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

/** Plain words for a refused move or quote action, or null when the message isn't one of those. */
export function plainWords(message: string): string | null {
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
