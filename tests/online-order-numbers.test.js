// An online order's number (openspec/changes/website-buy-online, task 1.5;
// design, decided while planning 2): the shop's own count, from 1, one up each
// time, never reused, shown as [prefix]- and the number until Jack names the
// prefix. Two orders paid at once get different numbers.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, runWithShop, prepare, dbExec } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { nextOrderNumber, orderReference } from '../server/online-orders/numbers.js';

after(() => pool.end());

async function freshShop(t) {
  const shop = await createTestShop();
  t.after(() => deleteTestShop(shop.id));
  return shop;
}
const take = (shop) => runWithShop(shop.id, () => nextOrderNumber());

test('each shop counts its own orders from 1, one up each time', async (t) => {
  const a = await freshShop(t);
  const b = await freshShop(t);
  assert.equal(await take(a), 1, 'the first takes 1, with no settings row made yet');
  assert.equal(await take(a), 2);
  assert.equal(await take(b), 1, 'another shop counts on its own');
  assert.equal(await take(a), 3);
  assert.equal(orderReference(3), '[prefix]-3');
});

test('a number is never given again, even once its order is gone', async (t) => {
  const shop = await freshShop(t);
  const n = await take(shop);
  await runWithShop(shop.id, async () => {
    const site = (await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get())?.id
      ?? (await prepare("INSERT INTO sites (name, code) VALUES ('[Shop]', 'S') RETURNING id").get()).id;
    const made = await prepare(
      `INSERT INTO online_orders (site_id, name, email, total_pence, card_pence, order_code, request_key_hash, number, paid_at, stage)
       VALUES (?, 'Maya Patel', 'maya@example.test', 2800, 2800, ?, ?, ?, now(), 'to_get_ready') RETURNING id`
    ).get(site, `[code ${shop.id}]`, `[key ${shop.id}]`, n);
    await prepare('DELETE FROM online_orders WHERE id = ?').run(made.id);
  });
  assert.equal(await take(shop), n + 1);
});

test('two orders paid at once get different numbers', async (t) => {
  const shop = await freshShop(t);
  // The shop's row already there, as it is after its first order: a first
  // order waits on the new row anyway, which would hide a read-then-write.
  assert.equal(await take(shop), 1);
  let held;
  const holding = new Promise((resolve) => { held = resolve; });
  let letGo;
  const gate = new Promise((resolve) => { letGo = resolve; });
  // The first takes its number inside a payment's transaction and holds it open.
  const first = runWithShop(shop.id, async () => {
    await dbExec('BEGIN');
    try {
      const n = await nextOrderNumber();
      held();
      await gate;
      await dbExec('COMMIT');
      return n;
    } catch (err) {
      await dbExec('ROLLBACK').catch(() => {});
      throw err;
    }
  });
  await holding;
  // The second asks while the first is still open, then the first commits.
  const second = take(shop);
  await new Promise((resolve) => setTimeout(resolve, 200));
  letGo();
  const numbers = await Promise.all([first, second]);
  assert.deepEqual(numbers, [2, 3]);
  assert.equal(await take(shop), 4);
});
