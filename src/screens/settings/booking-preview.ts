import type { BookingLink } from '@/screens/book/pending-query.ts';
import { dropOffLine } from '@/screens/book/pending-rules.ts';
import { formatMoney } from '@/screens/book/service-selection.ts';

/**
 * Preview what the customer sees (Jack, 19 Oct, docs/decisions/2026-10-19-booking-preview.md;
 * drawn as bk-settings-preview): the drawings' example booking (Maya Patel's
 * Trek Domane AL 3, Standard service, Thursday 17 September at 11:30), worded
 * with the shop's own saved settings, using the booking page's own rules.
 */
export type PreviewSettings = {
  bookingMode?: string; timedLeadMinutes?: number; dropoffWindowStart?: string; dropoffWindowEnd?: string;
  confirmationNote?: string; showPricesOnline?: boolean;
};

const BOOKED = '11:30';
const DAY = 'Thursday 17 September';

function minus(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const at = Math.max(0, h * 60 + m - minutes);
  return `${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`;
}
const toMinutes = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };

export function previewLines(s: PreviewSettings) {
  const wholeDay = s.bookingMode === 'dropoff';
  const by = minus(BOOKED, s.timedLeadMinutes ?? 0);
  const dropOff = wholeDay
    ? (s.dropoffWindowStart && s.dropoffWindowEnd ? { from: s.dropoffWindowStart, to: s.dropoffWindowEnd } : null)
    : { by, booked: BOOKED, leadMinutes: toMinutes(BOOKED) - toMinutes(by) };
  const link = { bike: { make: 'Trek', model: 'Domane AL 3' }, dropOff } as unknown as BookingLink;
  return {
    heading: `See you on ${DAY}, Maya`,
    arrival: [dropOffLine(link), s.confirmationNote].filter(Boolean).join(' '),
    // Prices as the booking page writes them ("£65"), so the two match.
    service: s.showPricesOnline ? `Standard service · ${formatMoney(65)}` : 'Standard service',
    bike: 'Trek Domane AL 3 · green',
    when: wholeDay ? DAY : `${DAY}, ${BOOKED}`,
  };
}
