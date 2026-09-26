import { apiMutate } from '@/lib/api/client.ts';
import type { BookingBody } from './details-rules.ts';

/**
 * Sending the booking (d5): POST /api/portal/:shopSlug/bookings, and turning a
 * held photo into the bare base64 the server wants (server/booking-photos.js:
 * no data: prefix, no line breaks). Read with arrayBuffer and btoa rather
 * than FileReader, which the component tests (Node) don't have.
 * Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
 */
export type BookingReply = {
  id: number;
  reference: string;
  privateLink: string;
  services: { name: string; price: number | null }[];
  totalPrice: number | null;
};

export const bookingsPath = (shopSlug: string) => `/api/portal/${encodeURIComponent(shopSlug)}/bookings`;

export const sendBooking = (shopSlug: string, body: BookingBody) => apiMutate<BookingReply>(bookingsPath(shopSlug), body);

// String.fromCharCode takes its bytes as arguments; a whole 10 MB photo at
// once would pass the engine's argument limit.
const CHUNK = 0x8000;

export async function photoBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}
