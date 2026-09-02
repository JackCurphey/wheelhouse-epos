// tests/customer-auth-guest.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { resolveGuestCustomer, CustomerAuthError } from '../server/customer-auth.js';

test('resolveGuestCustomer creates a new customer when no phone match exists', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const customer = await resolveGuestCustomer({ name: 'Alex Guest', phone: '07700900001' });
      assert.equal(customer.name, 'Alex Guest');
      assert.equal(customer.phone, '07700900001');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

// Superseded by DS-7. This used to assert the opposite - that a repeat guest
// reuses their existing customers row - which was real deduplication, but it
// was reached by trusting an unverified phone number typed into a public
// form. Duplicate rows a shop can merge are the accepted cost of not letting
// a stranger attach themselves to someone else's record.
test('resolveGuestCustomer never reuses an existing customer on phone alone', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const first = await resolveGuestCustomer({ name: 'Sam Regular', phone: '07700900002' });
      const second = await resolveGuestCustomer({ name: 'Sam Regular', phone: '07700900002' });
      assert.notEqual(second.id, first.id);

      const rows = await prepare('SELECT id FROM customers WHERE phone = ?').all('07700900002');
      assert.equal(rows.length, 2, 'each guest booking gets its own customer row');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('resolveGuestCustomer does not match a customer with the same phone in a different shop', async () => {
  const shopA = await createTestShop();
  const shopB = await createTestShop();
  try {
    const customerA = await runWithShop(shopA.id, () =>
      resolveGuestCustomer({ name: 'Cross Shop', phone: '07700900003' })
    );
    const customerB = await runWithShop(shopB.id, () =>
      resolveGuestCustomer({ name: 'Cross Shop', phone: '07700900003' })
    );
    assert.notEqual(customerB.id, customerA.id);
  } finally {
    await deleteTestShop(shopA.id);
    await deleteTestShop(shopB.id);
  }
});

test('resolveGuestCustomer requires a name', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await assert.rejects(
        () => resolveGuestCustomer({ name: '', phone: '07700900004' }),
        CustomerAuthError
      );
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('resolveGuestCustomer requires a phone number', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await assert.rejects(
        () => resolveGuestCustomer({ name: 'No Phone', phone: '' }),
        CustomerAuthError
      );
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test.after(async () => {
  await pool.end();
});
