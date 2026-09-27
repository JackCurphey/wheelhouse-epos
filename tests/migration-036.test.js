// Migration 036 (Release 2 offline core): sites, registered tills, staff PINs
// and check-ins, till sales in whole pence with VAT per line, and the
// attention list. Spec:
// docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

let shopA;
let shopB;

before(async () => {
  shopA = await createTestShop();
  shopB = await createTestShop();
});

after(async () => {
  if (shopA) await deleteTestShop(shopA.id);
  if (shopB) await deleteTestShop(shopB.id);
  await pool.end();
});

const column = async (table, name) => (await pool.query(
  'SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
  [table, name]
)).rows[0];

test('new columns on existing tables', async () => {
  assert.equal((await column('employees', 'pin_hash')).data_type, 'text');
  const vat = await column('products', 'vat_rate_bp');
  assert.equal(vat.data_type, 'integer');
  assert.equal(vat.is_nullable, 'NO');
  assert.equal(vat.column_default, '2000');
  assert.equal((await column('customers', 'client_id')).data_type, 'uuid');
});

test('money columns on till tables are whole pence', async () => {
  for (const [table, name] of [
    ['till_sales', 'total_pence'], ['till_sales', 'vat_pence'],
    ['till_sale_lines', 'unit_price_pence'], ['till_sale_lines', 'line_total_pence'],
    ['till_sale_lines', 'vat_pence'], ['till_sale_payments', 'amount_pence'],
  ]) {
    assert.equal((await column(table, name)).data_type, 'integer', `${table}.${name}`);
  }
});

// One site 'B' per shop, reused, so a second till in the same shop fails (or
// not) on the tills table alone - never on a duplicate site.
async function seedTill(shopId, code = 'B1') {
  return runWithShop(shopId, async () => {
    const existing = await prepare("SELECT id FROM sites WHERE code = 'B'").get();
    const site = existing ? existing.id : (await prepare("INSERT INTO sites (name, code) VALUES ('Bolton', 'B')").run()).lastInsertRowid;
    const till = (await prepare(
      "INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, ?, 'Till', ?)"
    ).run(site, code, randomUUID())).lastInsertRowid;
    return { site, till };
  });
}

test('a sale client_id is recorded once per shop', async () => {
  const { site, till } = await seedTill(shopA.id);
  const clientId = randomUUID();
  const insert = () => runWithShop(shopA.id, () => prepare(
    `INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, total_pence, vat_pence)
     VALUES (?, ?, ?, 1, false, now(), 100, 17)`
  ).run(clientId, till, site));
  await insert();
  await assert.rejects(insert, /duplicate key/);
});

test('till codes are unique within a shop but not across shops', async () => {
  await seedTill(shopB.id, 'X1');
  await assert.rejects(() => seedTill(shopB.id, 'X1'), /duplicate key/);
  await seedTill(shopA.id, 'X1');
});

test('till tables are isolated per shop', async () => {
  await seedTill(shopA.id, 'Z9');
  const seen = await runWithShop(shopB.id, () => prepare("SELECT * FROM tills WHERE code = 'Z9'").all());
  assert.equal(seen.length, 0);
  for (const table of ['sites', 'tills', 'staff_checkins', 'till_sales', 'till_sale_lines', 'till_sale_payments', 'till_attention']) {
    const { rows: [r] } = await pool.query(
      'SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1', [table]
    );
    assert.deepEqual(r, { relrowsecurity: true, relforcerowsecurity: true }, table);
  }
});

test('attention kinds are a closed list', async () => {
  await assert.rejects(() => runWithShop(shopA.id, () => prepare(
    "INSERT INTO till_attention (kind, detail) VALUES ('made_up', 'x')"
  ).run()), /check constraint/);
});
