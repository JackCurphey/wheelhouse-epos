// Printing a receipt (Jack, 18 Oct, docs/decisions/2026-10-18-print-receipt.md;
// drawn as till-receipt-paper in docs/design/user-journeys/generator/till.mjs):
// the shop's name, "Sale [n]" and its barcode, when, the job and bike, the
// lines, any discounts, the total and how it was paid. No VAT line yet
// (answer 2). printReceipt prints only the receipt.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const RECEIPT = new URL('../../.test-build/screens/till/receipt.js', import.meta.url).href;
let uninstall;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  uninstall?.();
});

const JOB_SALE = {
  id: 601, createdAt: '2026-10-06T10:45:00.000Z', subtotal: 111, discount: 0, groupDiscountAmount: 0, groupDiscountName: '', total: 111,
  paymentMethod: 'Card', cashAmount: 0, cardAmount: 111, cashTendered: null, extraPayments: [],
  items: [
    { id: 1, name: 'Standard service', qty: 1, unitPrice: 65, lineTotal: 65 },
    { id: 2, name: 'Shimano brake pads', qty: 1, unitPrice: 28, lineTotal: 28 },
    { id: 3, name: 'Fit & adjust brakes', qty: 1, unitPrice: 18, lineTotal: 18 },
  ],
};
const TILL_SALE = {
  ...JOB_SALE, id: 602, subtotal: 74, discount: 4, total: 70, paymentMethod: 'Split', cashAmount: 20, cardAmount: 50,
  items: [
    { id: 4, name: 'Shimano brake pads', qty: 2, unitPrice: 28, lineTotal: 56 },
    { id: 5, name: 'Fit & adjust brakes', qty: 1, unitPrice: 18, lineTotal: 18 },
  ],
};
const text = (el) => el.textContent.replace(/\s+/g, ' ');

async function render(props) {
  uninstall = installDom('http://localhost/workshop/till');
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  const { ReceiptPaper } = await importFresh(RECEIPT);
  const ui = rtl.render(createElement(ReceiptPaper, props));
  return ui.getByRole('article', { name: 'Receipt' });
}

test('a job\'s receipt: the shop, the sale, the job and bike, the lines, the total and how it was paid', async () => {
  const paper = await render({ sale: JOB_SALE, shopName: 'North Street Cycles', job: { reference: 'WH-1042', bikeLabel: 'Trek Domane AL 3' } });
  const t = text(paper);
  for (const want of ['North Street Cycles', 'Sale 601', '6 Oct 2026 · 11:45', 'WH-1042 · Trek Domane AL 3', 'Standard service£65.00', 'Shimano brake pads£28.00', 'Fit & adjust brakes£18.00', 'Total£111.00', 'Paid by card£111.00']) {
    assert.ok(t.includes(want), `missing "${want}" in: ${t}`);
  }
  // No VAT line until VAT is recorded on the sale (answer 2), and no cash row.
  assert.equal(/VAT/.test(t), false);
  assert.equal(/Paid by cash/.test(t), false);
  // A barcode of the sale number, drawn as bars.
  const bars = paper.querySelector('svg[aria-label="Barcode for sale 601"]');
  assert.ok(bars !== null);
  assert.ok(bars.querySelectorAll('rect').length > 10);
});

test('a till sale: quantities, the discount, and cash and card each with its amount', async () => {
  const paper = await render({ sale: { ...TILL_SALE, groupDiscountAmount: 0 }, shopName: 'North Street Cycles' });
  const t = text(paper);
  for (const want of ['Shimano brake pads 2 × £28.00£56.00', 'Discount−£4.00', 'Total£70.00', 'Paid by cash£20.00', 'Paid by card£50.00']) {
    assert.ok(t.includes(want), `missing "${want}" in: ${t}`);
  }
  assert.equal(/WH-/.test(t), false);
});

test('a customer group discount shows with its name', async () => {
  const paper = await render({ sale: { ...JOB_SALE, discount: 2, groupDiscountAmount: 8.1, groupDiscountName: 'Blue Light (10%)', total: 100.9, cardAmount: 100.9 }, shopName: 'North Street Cycles' });
  const t = text(paper);
  assert.ok(t.includes('Blue Light (10%)−£8.10'), t);
  assert.ok(t.includes('Discount−£2.00'), t);
});

// Fresh review: a tender the shop added (the old app's extra payments) is
// printed with its own name, so the payments add up to the total.
test('an extra payment prints as Paid by its own name', async () => {
  const paper = await render({ sale: { ...JOB_SALE, cardAmount: 100, extraPayments: [{ tenderType: 'Gift card', amount: 11 }] }, shopName: 'North Street Cycles' });
  const t = text(paper);
  assert.ok(t.includes('Paid by card£100.00'), t);
  assert.ok(t.includes('Paid by Gift card£11.00'), t);
});

// Fresh review: the receipt stays in place after the print box returns (a
// browser that prints afterwards would otherwise get a blank page); the next
// print replaces it, so only one receipt is ever there.
test('printReceipt puts only the receipt on the page being printed, and the next print replaces it', async () => {
  uninstall = installDom('http://localhost/workshop/till');
  const { printReceipt } = await importFresh(RECEIPT);
  let seen = null;
  window.print = () => { seen = document.getElementById('wh-print')?.textContent ?? null; };
  printReceipt({ sale: JOB_SALE, shopName: 'North Street Cycles' });
  assert.ok(seen !== null && seen.includes('Sale 601') && seen.includes('Total£111.00'), String(seen));
  assert.ok(document.getElementById('wh-print').textContent.includes('Sale 601'));
  printReceipt({ sale: TILL_SALE, shopName: 'North Street Cycles' });
  assert.ok(seen.includes('Sale 602') && !seen.includes('Sale 601'), seen);
  assert.equal(document.querySelectorAll('#wh-print article').length, 1);
});

// The mechanic sign-off, piece 3 (Jack, 18 Oct; drawn as till-receipt-paper-checked):
// with the shop's setting on, "Checked by [name]" under the job and bike.
test('a job’s receipt can say who checked it, under the job and bike', async () => {
  const paper = await render({ sale: JOB_SALE, shopName: 'North Street Cycles', job: { reference: 'WH-1042', bikeLabel: 'Trek Domane AL 3', checkedBy: 'Alex Morgan' } });
  assert.ok(text(paper).includes('WH-1042 · Trek Domane AL 3Checked by Alex MorganStandard service'), text(paper));
});

test('with no one to name, the receipt names no staff', async () => {
  const paper = await render({ sale: JOB_SALE, shopName: 'North Street Cycles', job: { reference: 'WH-1042', bikeLabel: 'Trek Domane AL 3', checkedBy: null } });
  assert.equal(/Checked by/.test(text(paper)), false);
});
