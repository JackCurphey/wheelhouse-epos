// A booking's deposit, worked out from the price shown (Jack, 24 Oct,
// docs/decisions/2026-10-24-morning-questions.md answer 1;
// openspec/changes/deposit-settings design 4). Pure: prices in pence, or null
// when not known.
import test from 'node:test';
import assert from 'node:assert/strict';
import { depositPence, poundsToPence } from '../server/workshop/deposit.js';
import { paymentsProvider } from '../server/payments/provider.js';

const PERCENT = { depositOn: true, depositKind: 'percent', depositPercent: 20, depositFixedPence: null, depositUnknownPence: null, paymentsConnected: true };

test('off, or no payment provider: no deposit', () => {
  assert.equal(depositPence({ ...PERCENT, depositOn: false }, [6500]), null);
  assert.equal(depositPence({ ...PERCENT, paymentsConnected: false }, [6500]), null);
});

test('a percentage of several services, added first', () => {
  assert.equal(depositPence(PERCENT, [6500, 1250]), 1550);
});

test('rounded to the nearest penny, half up', () => {
  assert.equal(depositPence({ ...PERCENT, depositPercent: 15 }, [3333]), 500); // 499.95
  assert.equal(depositPence({ ...PERCENT, depositPercent: 15 }, [3330]), 500); // 499.5
  assert.equal(depositPence({ ...PERCENT, depositPercent: 15 }, [3329]), 499); // 499.35
});

test('a fixed amount, never more than the price', () => {
  const fixed = { ...PERCENT, depositKind: 'fixed', depositFixedPence: 2000 };
  assert.equal(depositPence(fixed, [6500]), 2000);
  assert.equal(depositPence(fixed, [1250]), 1250);
});

test('a price not known takes the shop’s amount for that, or none', () => {
  assert.equal(depositPence({ ...PERCENT, depositUnknownPence: 1000 }, [6500, null]), 1000);
  assert.equal(depositPence(PERCENT, [null]), null);
  assert.equal(depositPence({ ...PERCENT, depositUnknownPence: 1000 }, []), 1000, 'no service at all is a price not known');
});

test('switched on before How much is filled in: nothing', () => {
  assert.equal(depositPence({ ...PERCENT, depositPercent: null }, [6500]), null);
  assert.equal(depositPence({ ...PERCENT, depositKind: 'fixed', depositFixedPence: null }, [6500]), null);
});

test('a free booking takes nothing', () => {
  assert.equal(depositPence(PERCENT, [0]), null);
  assert.equal(depositPence({ ...PERCENT, depositKind: 'fixed', depositFixedPence: 2000 }, [0]), null);
});

test('today’s prices are pounds: turned into pence exactly', () => {
  assert.equal(poundsToPence(65), 6500);
  assert.equal(poundsToPence('12.50'), 1250);
  assert.equal(poundsToPence(0.29), 29);
  assert.equal(poundsToPence(null), null);
});

test('the provider: none unless the pretend one is asked for, whatever NODE_ENV is', () => {
  const was = { p: process.env.PAYMENTS_PROVIDER, n: process.env.NODE_ENV };
  try {
    for (const n of ['development', 'production', undefined]) {
      if (n === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = n;
      delete process.env.PAYMENTS_PROVIDER;
      assert.equal(paymentsProvider(), 'none', `left out, with NODE_ENV ${n}`);
      process.env.PAYMENTS_PROVIDER = 'stripe-not-yet';
      assert.equal(paymentsProvider(), 'none', 'an unknown one is none');
      process.env.PAYMENTS_PROVIDER = 'pretend';
      assert.equal(paymentsProvider(), 'pretend');
    }
  } finally {
    if (was.p === undefined) delete process.env.PAYMENTS_PROVIDER; else process.env.PAYMENTS_PROVIDER = was.p;
    if (was.n === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = was.n;
  }
});
