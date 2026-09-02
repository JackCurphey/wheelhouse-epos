// Guest booking - someone booking without a portal account.
//
// Covers the third exposure in D11 (task DS-7): a guest is resolved to a
// customers row by phone number alone, so typing a number that happens to
// belong to an existing customer attaches the booking to that person's
// record - and, through it, their history. A phone number typed into a
// public form is not proof of identity.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { resolveGuestCustomer } from '../server/customer-auth.js';

test('a guest booking does not attach to an existing customer on phone alone', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const { lastInsertRowid: existingId } = await prepare(
        'INSERT INTO customers (name, phone, updated_at) VALUES (?, ?, now())'
      ).run('Existing Customer', '07700900123');

      const guest = await resolveGuestCustomer({
        name: 'Someone Else',
        phone: '07700900123',
      });

      assert.notEqual(guest.id, existingId, 'guest was attached to an existing customer record');
      assert.equal(guest.name, 'Someone Else');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test.after(async () => {
  await pool.end();
});
