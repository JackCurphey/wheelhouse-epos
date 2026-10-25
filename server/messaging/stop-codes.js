// "Stop these" for service reminders (openspec/changes/stop-reminders; account
// and reminders decision 6; Jack's answer 5 of 25 Oct): a code that stops one
// kind of reminder for one customer, with no sign-in and no expiry. Opening it
// changes nothing; a press stops them, another turns them back on as a yes
// from the stop page. Only the code's hash is kept. Inside the shop's
// runWithShop, so another shop's code is never found.
import { prepare } from '../db.js';
import { newLinkCode, hashLinkCode } from '../booking-link.js';

const CODE_SHAPE = /^[0-9a-f]{64}$/;

/** A new code for this customer's service reminders. */
export async function makeStopCode(customerId, kind = 'service_reminders') {
  const code = newLinkCode();
  await prepare('INSERT INTO reminder_stop_codes (code_hash, customer_id, kind) VALUES (?, ?, ?)').run(hashLinkCode(code), customerId, kind);
  return code;
}

export const stopPath = (shopSlug, code) => `/book/${shopSlug}/stop/${code}`;

/** The full link to the shop's stop page, with a fresh code. */
export async function stopLink(base, shopSlug, customerId) {
  return `${base}${stopPath(shopSlug, await makeStopCode(customerId))}`;
}

async function customerFor(code) {
  if (typeof code !== 'string' || !CODE_SHAPE.test(code)) return null;
  return prepare(
    `SELECT c.id, c.service_reminders FROM reminder_stop_codes s JOIN customers c ON c.id = s.customer_id
      WHERE s.code_hash = ? AND s.kind = 'service_reminders'`
  ).get(hashLinkCode(code));
}

/** Whether this code's reminders are on; null for a code that doesn't work. */
export async function stopView(code) {
  const c = await customerFor(code);
  return c ? { on: c.service_reminders } : null;
}

/** Stops them (stop true) or turns them back on, as a yes from the stop page; null for a code that doesn't work. */
export async function setStopped(code, stop) {
  const c = await customerFor(code);
  if (!c) return null;
  if (stop) {
    await prepare('UPDATE customers SET service_reminders = false WHERE id = ?').run(c.id);
  } else {
    await prepare(
      "UPDATE customers SET service_reminders = true, reminders_said_yes_at = now(), reminders_said_yes_via = 'stop_page' WHERE id = ?"
    ).run(c.id);
  }
  return { on: !stop };
}
