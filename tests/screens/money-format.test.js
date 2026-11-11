// Money shown with the thousands comma (Jack, 11 Nov: "£184,320.00" everywhere in the app
// except the old one). One helper, en-GB grouping; typed boxes and spreadsheets stay plain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { penceText, penceInput, poundsText } from '../../src/lib/money.ts';

test('pence show with the thousands comma, to the penny', () => {
  assert.equal(penceText(0), '£0.00');
  assert.equal(penceText(5), '£0.05');
  assert.equal(penceText(99999), '£999.99');
  assert.equal(penceText(100000), '£1,000.00');
  assert.equal(penceText(123450), '£1,234.50');
  assert.equal(penceText(18432000), '£184,320.00');
  assert.equal(penceText(100000000), '£1,000,000.00');
  assert.equal(penceText(2147483648), '£21,474,836.48', 'a figure past 32 bits stays exact');
});

test('something that is not whole pence, or is negative, is empty, never e+ or NaN', () => {
  for (const bad of [-1, 1.5, NaN, Infinity, 1e300]) assert.equal(penceText(bad), '', String(bad));
});

test('pounds (as a till or a quote holds them) show the same way', () => {
  assert.equal(poundsText(1234.5), '£1,234.50');
  assert.equal(poundsText(12.5), '£12.50');
  assert.equal(poundsText(0.29), '£0.29');
  assert.equal(poundsText(1000), '£1,000.00');
  assert.equal(poundsText(184320), '£184,320.00');
});

test('a typed box takes plain pounds and pence with no comma, so it can be edited and read back', () => {
  assert.equal(penceInput(123450), '1234.50');
  assert.equal(penceInput(5), '0.05');
  assert.equal(penceInput(18432000), '184320.00');
});

// The screens' own formatters all use it: each shows £1,234.50 where it used to show £1234.50.
import { pounds as bookPounds } from '../../src/screens/book/money.ts';
import { formatMoney } from '../../src/screens/book/service-selection.ts';
import { money as tillMoney } from '../../src/screens/till/rules.ts';

test('the booking pages: a deposit in pence, and a price in pounds with pence only when there are any', () => {
  assert.equal(bookPounds(123450), '£1,234.50');
  assert.equal(bookPounds(1300), '£13.00');
  assert.equal(formatMoney(1200), '£1,200');
  assert.equal(formatMoney(1234.5), '£1,234.50');
  assert.equal(formatMoney(80), '£80');
  assert.equal(formatMoney(22.5), '£22.50');
});

test('the till and the stock take', async () => {
  assert.equal(tillMoney(1234.5), '£1,234.50');
  assert.equal(tillMoney(0.1 + 0.2), '£0.30');
  const { pounds: stockTakePounds, atCost } = await import(new URL('../../.test-build/screens/stock-take/stock-take-bits.js', import.meta.url).href);
  assert.equal(stockTakePounds(-123450), '£1,234.50');
  assert.equal(atCost(123450), '£1,234.50 over, at cost');
});

test('stock lists and the reports tables', async () => {
  const { money } = await import(new URL('../../.test-build/screens/stock/stock-bits.js', import.meta.url).href);
  assert.equal(money(123450), '£1,234.50');
  const reports = await import(new URL('../../.test-build/screens/reports/reports-format.js', import.meta.url).href);
  assert.equal(reports.money(18432000), '£184,320.00');
  assert.equal(reports.differenceText(-123450), '−£1,234.50');
  assert.equal(reports.compareWords(123450, 'last week', 'money'), 'Up £1,234.50 on last week');
});

test('the booking details summary shows a spending limit with the comma too', async () => {
  const { summaryLines } = await import(new URL('../../.test-build/screens/book/details-rules.js', import.meta.url).href);
  const services = { shopName: 'North Street Cycles', showPrices: false, full: [], categories: [], uncategorised: [{ id: 1, name: 'Standard service', price: 80, minutes: 60 }] };
  const lines = summaryLines(services, { limitOn: true, limitText: '1500', serviceIds: [1] }, 'Mon 5 Oct, 10:00');
  assert.ok(lines.includes('Extra work: go ahead if the whole bill is no more than £1,500'), JSON.stringify(lines));
  assert.ok(summaryLines(services, { limitOn: true, limitText: '200', serviceIds: [1] }, 'x').includes('Extra work: go ahead if the whole bill is no more than £200'));
});

test('a figure that is not a number shows nothing, not a lone minus sign', () => {
  assert.equal(poundsText(-Infinity), '');
  assert.equal(poundsText(NaN), '');
});
