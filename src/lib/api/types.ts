/**
 * Response shapes, one definition per API shape. Each mirrors a serializer on
 * the server (server/server.js, server/routes/, server/workshop/) - when the two
 * disagree, the server is right and this file is the bug.
 */

/** One day of a job (serializePart in server/routes/workshop.js). */
export type JobPart = {
  id: number;
  position: number;
  date: string;
  startTime: string;
  endTime: string;
  mechanicId: number | null;
  mechanicName: string | null;
};

/** serializeWorkshopJob. The three `*State` fields are what screens drive
 * from; `status` is the derived legacy field kept for the old app. */
export type JobDeposit = {
  pence: number;
  paidAt: string | null;
  state: 'paid' | 'refunded' | 'kept';
  refundedAt: string | null;
  refundReason: string | null;
  refundedBy: string | null;
  noShowAt: string | null;
  noShowBy: string | null;
};

export type WorkshopJob = {
  id: number;
  title: string;
  customerId: number | null;
  customerName?: string | null;
  bikeId: number | null;
  bikeLabel?: string | null;
  mechanicId: number | null;
  mechanicName?: string | null;
  jobDate: string;
  /** Null for a job with no set time (the diary's "No time" row). */
  startTime: string | null;
  endTime: string | null;
  status: string;
  reference: string;
  bookingState: string;
  /** The bike's colour, for the bike tag. */
  bikeColour?: string | null;
  /** An online booking confirmed straight away, until staff open it (auto-confirm). */
  newOnline?: boolean;
  /** While a time the shop offered waits for the customer: the day and time first asked for, and the offer's message. */
  offer?: { fromDate: string | null; fromTime: string | null; message: string | null } | null;
  /** The job's planned length in minutes: given when made (an online booking's
   * services' total), else its times'; null when it has neither. */
  plannedMinutes: number | null;
  // Whole pounds the whole bill may come to, or null to ask first (Workshop day 41).
  spendLimit: number | null;
  /** Where a bike in the shop is kept (storage slots); null when none. */
  storageSlotId: number | null;
  storageSlotName: string | null;
  /** The deposit the booking took (deposit-diary-server design 2): paid, refunded or kept, with when, why and who. */
  deposit: JobDeposit | null;
  /** Marked Didn't come, when (deposit-diary-server design 4). */
  noShowAt: string | null;
  custodyState: string;
  workState: string;
  /** Echoed on every action; see jobAction in client.ts. */
  version: number;
  /** A customer's change request: the time they asked for, or null. */
  requested?: { jobDate: string; startTime: string | null; endTime: string | null; mechanicId: number | null } | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  cancellationSeenAt?: string | null;
  /** The job's current quote (its latest revision), or null (journey 4). */
  // When it was sent, and when its one reminder went while it still waits ("No answer yet").
  quote?: { id: number; state: string; revision: number; sentAt?: string | null; reminderSentAt?: string | null } | null;
  /** Each day the job is worked, in order; part 1 is the job's own date (migration 037). */
  parts?: JobPart[];
  /** What the customer wrote when booking online, if anything. */
  customerDescription?: string | null;
  notes: string | null;
  /** Who signed the finished work off, and when (Jack, 16 Oct): null until finished, and again once reopened. */
  signedOffBy?: number | null;
  signedOffByName?: string | null;
  signedOffAt?: string | null;
  orderId: number | null;
  orderStatus: string | null;
  /** Totalled in SQL. No screen adds money up. */
  orderTotal: number | null;
  createdAt: string;
  updatedAt: string;
};

/** The body of every error response. `code` is sent on 409s only.
 * `reused_key`: a booking's request key was sent again with different details. */
export type ApiErrorBody = {
  error: string;
  code?: 'stale' | 'illegal' | 'capacity' | 'reused_key' | 'settle_first' | 'pair';
};

/** WP-0.2, added to the online booking's body (POST /api/portal/:shopSlug/bookings).
 * Made once when the customer presses Send and repeated on every retry of that
 * booking, so the server accepts it once: a retry gets 200 and the booking
 * already made and the same private link as the first reply. 32-128
 * letters, digits, `-` or `_`; `crypto.randomUUID()` fits.
 * Spec: docs/superpowers/specs/2026-10-05-wp-0-2-booking-bugs-server.md */
export type BookingRequestKey = { requestKey?: string };
