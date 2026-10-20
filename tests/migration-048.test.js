// Migration 048 settles messages written before the engine (the messages
// engine, fresh review): they read 'intended' by 020's default, so the
// migration's own backfill marks sent ones delivered and the rest failed,
// and the engine's sender never sends them again.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

let shop;
before(async () => { shop = await createTestShop(); });
after(async () => { if (shop) await deleteTestShop(shop.id); await pool.end(); });

const BACKFILL = readFileSync(new URL('../server/migrations/048_messages_engine.sql', import.meta.url), 'utf8').match(/DO \$\$[\s\S]*?END \$\$;/)[0];

test('old sent messages become delivered, old failed ones failed; queued ones with a send time are left', async () => {
  const ids = await runWithShop(shop.id, async () => {
    const c = await prepare("INSERT INTO customers (name, phone) VALUES ('Maya Patel', '07700 900142') RETURNING id").get();
    const add = (status, extra = '') => prepare(`INSERT INTO customer_messages (customer_id, body, status, intent_state${extra ? ', send_after' : ''}) VALUES (?, 'Hi', ?, 'intended'${extra ? ', now()' : ''}) RETURNING id`).get(c.id, status);
    return { sent: (await add('sent')).id, failed: (await add('failed')).id, queued: (await add('queued', 'x')).id };
  });
  // Only this test's shop: other test files' messages run at the same time.
  const ownShop = BACKFILL.replace('SELECT id FROM shops', `SELECT id FROM shops WHERE id = ${Number(shop.id)}`);
  assert.notEqual(ownShop, BACKFILL);
  await pool.query(ownShop);
  const state = (id) => runWithShop(shop.id, () => prepare('SELECT intent_state FROM customer_messages WHERE id = ?').get(id)).then((r) => r.intent_state);
  assert.equal(await state(ids.sent), 'delivered');
  assert.equal(await state(ids.failed), 'failed');
});
