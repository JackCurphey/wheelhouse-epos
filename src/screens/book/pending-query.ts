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
  services: { name: string; price: number | null }[];
  totalPrice: number | null;
};

export const bookingLinkPath = (shopSlug: string, code: string) =>
  `/api/portal/${encodeURIComponent(shopSlug)}/booking-links/${encodeURIComponent(code)}`;

export function useBookingLink(shopSlug: string, code: string) {
  return useQuery({
    queryKey: ['portal', shopSlug, 'booking-link', code],
    queryFn: () => apiGet<BookingLink>(bookingLinkPath(shopSlug, code)),
  });
}
