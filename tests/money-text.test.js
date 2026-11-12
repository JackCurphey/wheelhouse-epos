// Money in the server's own words (receipts, emails, text messages, refusals) with the
// thousands comma (Jack, 11 Nov 2026: "£1,234.50" everywhere in the app except the old one).
// Spreadsheet files stay plain numbers, so Excel reads them as numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { penceText, poundsText, wholePoundsText } from '../server/lib/money-text.js';
import { receiptText } from '../server/receipts.js';
import { money } from '../server/workshop/job-messages.js';
import { pounds as customerPounds } from '../server/lib/customer-money.js';
import { penceToPounds } from '../server/lib/pence.js';
import { csvOf } from '../server/lib/csv.js';

test('pence and pounds read with the thousands comma, to the penny', () => {
  assert.equal(penceText(123450), '£1,234.50');
  assert.equal(penceText(99999), '£999.99');
  assert.equal(penceText(100000), '£1,000.00');
  assert.equal(penceText(18432000), '£184,320.00');
  assert.equal(penceText(2147483648), '£21,474,836.48', 'past 32 bits it stays exact');
  assert.equal(penceText(-123450), '−£1,234.50');
  assert.equal(penceText(5), '£0.05');
  assert.equal(poundsText(1234.5), '£1,234.50');
  assert.equal(poundsText(0.29), '£0.29');
  assert.equal(wholePoundsText(1500), '£1,500');
  assert.equal(wholePoundsText(200), '£200');
  // Nothing that isn't a figure reads as one: not £NaN, not a lone sign.
  for (const bad of [NaN, undefined, null, 'abc', Infinity]) {
    assert.equal(wholePoundsText(bad), '', String(bad));
    assert.equal(penceText(bad), '', String(bad));
  }
});

test('a receipt, in its email and its text, shows a big sale with the comma', () => {
  const text = receiptText({
    heading: 'Receipt', number: 'B1-0042', at: '2026-09-01T10:05:00Z', shop: { name: 'North Street Cycles', address: null, phone: null, vatNumber: null },
    lines: [{ name: 'Road bike', qty: 2, unitPence: 123450, totalPence: 246900 }], vatLines: [{ ratePercent: 20, pence: 41150 }],
    totalPence: 246900, payments: [{ how: 'card', pence: 246900 }],
  });
  assert.ok(text.includes('Road bike 2 × £1,234.50  £2,469.00'), text);
  assert.ok(text.includes('Total (includes VAT)  £2,469.00'));
  assert.ok(text.includes('VAT at 20%  £411.50'));
  assert.ok(text.includes('Paid by card  £2,469.00'));
});

test('a text message or email amount (a quote, what is left to pay) shows with the comma', () => {
  assert.equal(money(1234.5), '£1,234.50');
  assert.equal(money(12.5), '£12.50');
  assert.equal(customerPounds(123450), '£1,234.50', 'a customer\'s balance in the statement email and the refusals');
});

test('spreadsheet files and plain figures stay plain numbers', () => {
  assert.equal(penceToPounds(123450), '1234.50');
  assert.equal(csvOf([['Takings', penceToPounds(123450)]]).replace('﻿', ''), 'Takings,1234.50\r\n');
});
