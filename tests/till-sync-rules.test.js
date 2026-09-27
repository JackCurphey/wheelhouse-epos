// tests/till-sync-rules.test.js
// The sync rules that need no database: which errors are passing conditions
// (retry) and which unique-violations mean "already held" (duplicate).
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §8, §11
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { isTransient, isOwnDuplicate, saleProblem, processSyncItems } from '../server/till/sync.js';

after(async () => { await pool.end(); });

const pgError = (code, constraint) => Object.assign(new Error(`pg ${code}`), { code, constraint });

test('deadlocks, serialization failures, cancelled statements and lost connections are transient', () => {
  for (const code of ['40P01', '40001', '57014', '08006', '08003', '08000']) {
    assert.equal(isTransient(pgError(code)), true, code);
  }
  for (const code of ['23505', '22003', '23503', undefined]) {
    assert.equal(isTransient(pgError(code)), false, String(code));
  }
  assert.equal(isTransient(null), false);
});

test('a unique-violation is a duplicate only on the client_id key of the table the item writes', () => {
  assert.equal(isOwnDuplicate('sale', pgError('23505', 'till_sales_shop_id_client_id_key')), true);
  assert.equal(isOwnDuplicate('checkin', pgError('23505', 'staff_checkins_shop_id_client_id_key')), true);
  assert.equal(isOwnDuplicate('customer', pgError('23505', 'idx_customers_client_id')), true);
  // Right code, wrong table's key, or some other unique rule: not a duplicate.
  assert.equal(isOwnDuplicate('sale', pgError('23505', 'staff_checkins_shop_id_client_id_key')), false);
  assert.equal(isOwnDuplicate('customer', pgError('23505', 'till_sales_shop_id_client_id_key')), false);
  assert.equal(isOwnDuplicate('sale', pgError('23505', 'idx_till_attention_open_stock')), false);
  assert.equal(isOwnDuplicate('sale', pgError('23505', undefined)), false);
  assert.equal(isOwnDuplicate('sale', pgError('23503', 'till_sales_shop_id_client_id_key')), false);
});

test('a null line or payment is a reason, not a crash', () => {
  const base = {
    receiptNumber: 1, tillClockAt: '2026-09-01T09:30:00.000Z',
    lines: [{ description: 'Tube', qty: 1, unitPricePence: 100, vatRateBp: 2000 }],
    payments: [{ method: 'cash', amountPence: 100 }],
  };
  assert.equal(saleProblem({ ...base, lines: [null] }), 'Every line must be an object');
  assert.equal(saleProblem({ ...base, lines: ['x'] }), 'Every line must be an object');
  assert.equal(saleProblem({ ...base, payments: [null] }), 'Every payment must be an object');
});

test('an item whose checks themselves throw fails alone and the batch carries on', async () => {
  const exploding = { kind: 'sale', clientId: randomUUID(), get receiptNumber() { throw new Error('boom'); } };
  const bad = { kind: 'checkin', clientId: randomUUID(), employeeId: 'x' };
  const results = await processSyncItems({ id: 1, code: 'B1' }, [exploding, bad]);
  assert.equal(results[0].status, 'failed');
  assert.ok(results[0].reason);
  assert.equal(results[1].status, 'failed');
});
