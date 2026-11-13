// An online order's number, given when it is paid (openspec/changes/website-buy-online,
// design, decided while planning 2), as server/workshop/references.js gives a job's.
//
// Per shop, from 1, as Cycle to Work's quotes count. The counter lives on the
// shop's Online orders settings row (migration 154). One statement makes the
// row if it isn't there yet and counts up, so two orders paid at once wait on
// the row and can't both take the same number; a SELECT followed by an UPDATE
// would let them. Numbers are spent, never returned: a number already emailed
// to a customer is never given to another order.
import { prepare } from '../db.js';

// No source names the prefix yet; it stays bracketed until Jack does.
const PREFIX = '[prefix]';

/** The shop's next order number. Run it in the payment's transaction, inside runWithShop. */
export async function nextOrderNumber() {
  const row = await prepare(
    `INSERT INTO online_order_settings (next_order_number) VALUES (2)
     ON CONFLICT (shop_id) DO UPDATE SET next_order_number = online_order_settings.next_order_number + 1
     RETURNING next_order_number - 1 AS taken`
  ).get();
  if (!row) throw new Error('no shop in context - nextOrderNumber must run inside runWithShop');
  return row.taken;
}

/** How the number shows: "[prefix]-" and the number. */
export const orderReference = (number) => `${PREFIX}-${number}`;
