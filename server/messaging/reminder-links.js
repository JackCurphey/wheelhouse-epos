// A service reminder's booking link (openspec/changes/finish-account design 4;
// ac-reminder-landing; account and reminders decision 2; Jack, 9 Nov, answer 4):
// a code, made with the reminder, that opens Book a repair on "When?" with the
// bike and service chosen and the customer's details filled in, partly hidden.
// It never signs anyone in. No expiry while the customer's record exists
// (question 10). Only the code's hash is kept, as for the stop page's codes.
// Inside the shop's runWithShop, so another shop's code is never found.
import { prepare } from '../db.js';
import { newLinkCode, hashLinkCode } from '../booking-link.js';

const CODE_SHAPE = /^[0-9a-f]{64}$/;
export const EXPIRED = 'This reminder’s link has expired. Choose your bike and service to book.';

export const reminderBookPath = (shopSlug, code) => `/book/${shopSlug}/from-reminder/${code}`;
// The link inside a reminder's words, found again when it goes (its text is written afresh then).
export const REMINDER_LINK = /https?:\/\/\S*?\/from-reminder\/[0-9a-f]{64}/;

/** A new code for this customer, bike and service; returns the code itself, kept nowhere. */
export async function makeReminderBookCode({ customerId, bikeId = null, serviceId = null, jobId = null }) {
  const code = newLinkCode();
  await prepare('INSERT INTO reminder_book_codes (code_hash, customer_id, bike_id, service_id, job_id) VALUES (?, ?, ?, ?, ?)')
    .run(hashLinkCode(code), customerId, bikeId, serviceId, jobId);
  return code;
}

/** The full link, with a fresh code. */
export async function reminderBookLink(base, shopSlug, what) {
  return `${base}${reminderBookPath(shopSlug, await makeReminderBookCode(what))}`;
}

/** The code's row, while its customer is still a live record here; null otherwise. */
export async function reminderCode(code) {
  if (typeof code !== 'string' || !CODE_SHAPE.test(code)) return null;
  return prepare(
    `SELECT r.customer_id, r.bike_id, r.service_id, c.name, c.phone
       FROM reminder_book_codes r JOIN customers c ON c.id = r.customer_id
      WHERE r.code_hash = ? AND c.active = 1 AND c.deleted_at IS NULL AND c.merged_into_id IS NULL`
  ).get(hashLinkCode(code));
}

// "Maya P.": the first name and the last name's first letter, as drawn.
export function maskedName(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  return words.length > 1 ? `${words[0]} ${words.at(-1)[0].toUpperCase()}.` : words[0];
}
// "07700 ••• 142": the mobile's first five and last three digits, as drawn.
export function maskedPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? `${digits.slice(0, 5)} ••• ${digits.slice(-3)}` : null;
}

/**
 * What the booking page fills in: the service (when still bookable online)
 * and the bike (when still theirs), each null otherwise, and the details,
 * partly hidden. Null for a code that doesn't work.
 */
export async function reminderLinkView(code) {
  const row = await reminderCode(code);
  if (!row) return null;
  const service = row.service_id
    ? await prepare('SELECT id, name FROM workshop_services WHERE id = ? AND active = 1 AND bookable_online = 1').get(row.service_id)
    : null;
  const bike = row.bike_id
    ? await prepare('SELECT id, make, model, colour FROM customer_bikes WHERE id = ? AND customer_id = ? AND active = 1').get(row.bike_id, row.customer_id)
    : null;
  const bikeLabel = bike ? [[bike.make, bike.model].filter(Boolean).join(' ').trim(), bike.colour?.trim()].filter(Boolean).join(' · ') : null;
  return {
    serviceId: service?.id ?? null,
    serviceName: service?.name ?? null,
    bikeId: bike?.id ?? null,
    bikeLabel: bikeLabel || null,
    details: { name: maskedName(row.name), phone: maskedPhone(row.phone) },
  };
}
