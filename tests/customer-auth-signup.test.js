// tests/customer-auth-signup.test.js
//
// Found in the 21 Oct review: signing up on the booking portal with the email
// of a customer the shop already had on file attached the new login to that
// customer's row, with no check the person owns the address. Anyone who knew a
// customer's email could sign up and then read that customer's bikes and
// bookings and act on their quotes. Same reasoning as resolveGuestCustomer's
// phone rule (DS-7): a new row the shop can merge, never someone else's record.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { signupCustomer } from '../server/customer-auth.js';

test('signing up with the email of a customer already on file does not take over their record', async () => {
  const shop = await createTestShop();
  try {
    const existing = await runWithShop(shop.id, async () => {
      const info = await prepare('INSERT INTO customers (name, email, updated_at) VALUES (?, ?, ?)').run('Maya Patel', 'maya@example.com', new Date().toISOString());
      return info.lastInsertRowid;
    });
    const { customer, login } = await signupCustomer({ shopSlug: shop.slug, email: 'Maya@Example.com', password: 'a-long-password', name: 'Someone Else' });
    assert.notEqual(customer.id, existing, 'the new login was attached to the existing customer');
    assert.equal(login.customer_id, customer.id);
    assert.equal(customer.name, 'Someone Else');
    // The shop's own record is untouched.
    const kept = await runWithShop(shop.id, () => prepare('SELECT name FROM customers WHERE id = ?').get(existing));
    assert.equal(kept.name, 'Maya Patel');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('signing up with a new email still makes one customer for the login', async () => {
  const shop = await createTestShop();
  try {
    const { customer, login } = await signupCustomer({ shopSlug: shop.slug, email: 'new@example.com', password: 'a-long-password', name: 'New Person' });
    assert.equal(login.customer_id, customer.id);
    assert.equal(customer.email, 'new@example.com');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test.after(async () => { await pool.end(); });
