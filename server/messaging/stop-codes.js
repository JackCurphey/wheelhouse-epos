// "Stop these" for service reminders (openspec/changes/stop-reminders; account
// and reminders decision 6; Jack's answer 5 of 25 Oct): a code that stops one
// kind of reminder for one customer, with no sign-in and no expiry. Opening it
// changes nothing; a press stops them, another turns them back on as a yes
// from the stop page. Only the code's hash is kept. Inside the shop's
// runWithShop, so another shop's code is never found. A code for one of the
// shop's own messages stops just that message for that customer (Jack's
// answer 2 of 26 Oct; openspec/changes/own-messages-server design 7).
import { prepare } from '../db.js';
import { newLinkCode, hashLinkCode } from '../booking-link.js';

const CODE_SHAPE = /^[0-9a-f]{64}$/;

/** A new code for this customer's service reminders, or another kind; an own message names which. */
export async function makeStopCode(customerId, kind = 'service_reminders', shopMessageId = null) {
  const code = newLinkCode();
  await prepare('INSERT INTO reminder_stop_codes (code_hash, customer_id, kind, shop_message_id) VALUES (?, ?, ?, ?)').run(hashLinkCode(code), customerId, kind, shopMessageId);
  return code;
}

export const stopPath = (shopSlug, code) => `/book/${shopSlug}/stop/${code}`;

/** The full link to the shop's stop page, with a fresh code for this kind. */
export async function stopLink(base, shopSlug, customerId, kind = 'service_reminders', shopMessageId = null) {
  return `${base}${stopPath(shopSlug, await makeStopCode(customerId, kind, shopMessageId))}`;
}

// The customer's answer each kind stops (review-requests design 6).
const COLUMN = { service_reminders: 'service_reminders', review_requests: 'review_requests' };

async function customerFor(code) {
  if (typeof code !== 'string' || !CODE_SHAPE.test(code)) return null;
  return prepare(
    `SELECT c.id, s.kind, s.shop_message_id, c.service_reminders, c.review_requests, m.name AS message_name,
            NOT EXISTS (SELECT 1 FROM shop_message_stops st WHERE st.shop_message_id = s.shop_message_id AND st.customer_id = c.id) AS own_on
       FROM reminder_stop_codes s JOIN customers c ON c.id = s.customer_id
       LEFT JOIN shop_messages m ON m.id = s.shop_message_id
      WHERE s.code_hash = ?`
  ).get(hashLinkCode(code));
}

/** Whether this code's reminders are on; null for a code that doesn't work. */
export async function stopView(code) {
  const c = await customerFor(code);
  if (!c) return null;
  return c.kind === 'own_message' ? { kind: c.kind, on: c.own_on, name: c.message_name } : { kind: c.kind, on: c[COLUMN[c.kind]] };
}

/** Stops them (stop true) or turns them back on, as a yes from the stop page; null for a code that doesn't work. */
export async function setStopped(code, stop) {
  const c = await customerFor(code);
  if (!c) return null;
  if (c.kind === 'own_message') {
    if (stop) {
      await prepare('INSERT INTO shop_message_stops (shop_message_id, customer_id) VALUES (?, ?) ON CONFLICT DO NOTHING RETURNING customer_id').run(c.shop_message_id, c.id);
    } else {
      await prepare('DELETE FROM shop_message_stops WHERE shop_message_id = ? AND customer_id = ?').run(c.shop_message_id, c.id);
    }
    return { kind: c.kind, on: !stop, name: c.message_name };
  }
  const column = COLUMN[c.kind];
  if (stop) {
    await prepare(`UPDATE customers SET ${column} = false WHERE id = ?`).run(c.id);
  } else {
    await prepare(
      `UPDATE customers SET ${column} = true, reminders_said_yes_at = now(), reminders_said_yes_via = 'stop_page' WHERE id = ?`
    ).run(c.id);
  }
  return { kind: c.kind, on: !stop };
}
