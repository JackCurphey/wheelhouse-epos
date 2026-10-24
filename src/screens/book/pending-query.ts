import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';

/**
 * The private booking link, read back without sign-in
 * (GET /api/portal/:shopSlug/booking-links/:code, server/server.js;
 * stage from server/booking-link.js bookingStage). 404 when the code finds
 * nothing, 410 once the link has expired. Services and the total carry prices
 * only when the shop shows prices online. Answers are the frozen copy taken
 * at booking: the wording as asked, the answer (a choice or typed text,
 * { notSure: true }, or null) and, for a choice question, any typed words.
 * Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
 */
export type BookingStage =
  | 'awaiting_confirmation'
  | 'time_offered'
  | 'confirmed'
  | 'in_workshop'
  | 'ready_to_collect'
  | 'collected'
  | 'change_requested'
  | 'declined'
  | 'cancelled'
  | 'request_expired';

export type LinkAnswer = { wording: string; answer: string | { notSure: true } | null; text?: string };

export type BookingLink = {
  reference: string;
  shopName: string;
  jobDate: string;
  startTime: string;
  description: string | null;
  bikeNote: string | null;
  answers: LinkAnswer[];
  bike: { make: string | null; model: string | null } | null;
  stage: BookingStage;
  photoCount: number;
  /** Who signed the job off, once ready, if the shop shows it (mechanic sign-off piece 3). */
  checkedBy?: string | null;
  /** When to drop the bike off, once the booking stands (Jack, 19 Oct): a set time's, or the whole day's window. */
  dropOff?: { by: string; booked: string; leadMinutes: number } | { from: string; to: string } | null;
  // The shop's additional note, once the booking stands (Jack, 19 Oct).
  confirmationNote?: string | null;
  /** Whether the customer can still cancel online (piece 12; Jack, 19 Oct: Cancel booking). */
  canCancel?: boolean;
  /** Whether the customer can still change the date online, the change they asked for, and whether the shop declined the last one (piece 12; Jack, 20 Oct). */
  canChange?: boolean;
  /** A time the shop offered, and where the customer first asked (Jack, 20 Oct, offer another time). */
  offer?: { fromDate: string; fromTime: string; message: string | null } | null;
  canAccept?: boolean;
  /** What the shop told the customer when it declined (Jack, 20 Oct). */
  declineMessage?: string | null;
  requested?: { jobDate: string; startTime: string; mechanicId: number } | null;
  changeDeclined?: boolean;
  services: { name: string; price: number | null }[];
  totalPrice: number | null;
  /** The deposit the booking took, and when it's free to cancel until in the shop's time (deposit-booking-page). */
  deposit?: {
    pence: number;
    cancelUntil: { date: string; time: string } | null;
    /** Paid, refunded (or on its way back), or kept; and whether cancelling now would refund it (deposit-refunds). */
    state?: 'paid' | 'refunded' | 'kept';
    refundable?: boolean;
  } | null;
  /** Once the bike is in (pull request 359; booking page stages): how far it is, its times, the shop, and the money (figures null with Show prices off). */
  workState?: string;
  bookedInAt?: string | null;
  collectedAt?: string | null;
  expectedReady?: { date: string; time: string | null } | null;
  shop?: { address: string | null; phone: string | null; openingHours: string | null };
  work?: { name: string; price: number | null }[];
  declined?: { name: string; price: number | null }[];
  /** The job's checklist once the work is finished (cp-summary; Jack, 22 Oct): every item and what the mechanic found. */
  checklist?: { name: string; items: { name: string; done: boolean; note: string | null }[] } | null;
  toPay?: number | null;
  nothingToPay?: boolean;
  paid?: { at: string; amount: number | null } | null;
};

/** The 410 reply's details (pull request 359): which job, why, and the shop. */
export type ExpiredLink = { reference?: string; reason?: 'collected' | 'never_came_in'; shop?: { name: string; address: string | null; phone: string | null } };

export const bookingLinkPath = (shopSlug: string, code: string) =>
  `/api/portal/${encodeURIComponent(shopSlug)}/booking-links/${encodeURIComponent(code)}`;

export function useBookingLink(shopSlug: string, code: string) {
  return useQuery({
    queryKey: ['portal', shopSlug, 'booking-link', code],
    queryFn: () => apiGet<BookingLink>(bookingLinkPath(shopSlug, code)),
  });
}
