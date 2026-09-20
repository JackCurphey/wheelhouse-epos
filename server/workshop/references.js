// The reference printed on the bike tag and quoted to the customer.
//
// Per shop, not global: a customer reading WH-1042 on their tag would otherwise
// be reading how many jobs every shop on the system has taken between them.
// 1000 so the first one reads WH-1000 rather than WH-1.
//
// The counter advances in the same UPDATE that reads it, so two concurrent
// creations serialise on the shops row and cannot both take the same number. A
// SELECT followed by an UPDATE would let them. Numbers are consumed, never
// returned: a deleted job's reference stays spent, because a tag may already be
// printed and stuck to a bike.
import { prepare } from '../db.js';

export async function allocateReference() {
  const row = await prepare(
    `UPDATE shops SET next_job_number = next_job_number + 1
     WHERE id = current_setting('app.current_shop_id')::int
     RETURNING next_job_number - 1 AS allocated`
  ).get();
  if (!row) throw new Error('no shop in context - allocateReference must run inside runWithShop');
  return `WH-${row.allocated}`;
}
