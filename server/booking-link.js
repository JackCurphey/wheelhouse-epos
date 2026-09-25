// The private booking link's pure parts. The code is shown to the customer once;
// only its hash is stored. Spec:
// docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md
import { randomBytes, createHash } from 'node:crypto';

const LINK_DAYS = 30;

export function newLinkCode() {
  return randomBytes(32).toString('hex');
}

// SHA-256 rather than a slow password hash: the code is 256 random bits, so
// there is nothing for a slow hash to protect against.
export function hashLinkCode(code) {
  return createHash('sha256').update(code).digest('hex');
}

export function linkPath(shopSlug, code) {
  return `/book/${shopSlug}/booking/${code}`;
}

// Both dates are YYYY-MM-DD. Worked out from job_date at read time, so moving a
// booking moves its link's expiry with it.
export function isLinkExpired(jobDate, today) {
  const last = new Date(`${jobDate}T00:00:00Z`);
  if (Number.isNaN(last.getTime())) return true;
  last.setUTCDate(last.getUTCDate() + LINK_DAYS);
  return today > last.toISOString().slice(0, 10);
}

const BOOKING_STAGES = {
  pending: 'awaiting_confirmation',
  reschedule_requested: 'change_requested',
  declined: 'declined',
  expired: 'request_expired',
  cancelled: 'cancelled',
};

// One key for where the booking is up to; the page chooses the words.
export function bookingStage({ booking_state, custody_state, work_state }) {
  if (booking_state !== 'scheduled') return BOOKING_STAGES[booking_state];
  if (custody_state === 'collected') return 'collected';
  if (custody_state === 'in_shop') return work_state === 'complete' ? 'ready_to_collect' : 'in_workshop';
  return 'confirmed';
}
