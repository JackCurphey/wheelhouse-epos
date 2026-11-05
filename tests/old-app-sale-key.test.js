// The old till sends a request key too (openspec/changes/sale-request-key, design 5).
// public/app.js has no modules and no browser test drives it, so its two payment
// functions are taken from the file and run with everything around them stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const fn = (name) => {
  const at = src.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `${name} is in app.js`);
  const start = src.lastIndexOf('\n', at) + 1;
  return src.slice(start, src.indexOf('\n}\n', at) + 3);
};
const line = (start) => {
  const at = src.indexOf(start);
  assert.ok(at >= 0, `${start} is in app.js`);
  return src.slice(at, src.indexOf('\n', at));
};

// A till of its own: `api` answers as each test says, and what's sent is kept.
function till() {
  const make = new Function('answers', 'sent', `
    ${line('let tillSaleKey = null;')}
    ${line('const orderSaleKey = ')}
    ${fn('saleKeyFollowsBasket')}
    ${line('const newSaleKey = ')}
    let cart = [{ productId: 1, price: 28, qty: 1 }];
    let activeCashierId = 21, discount = 0, cashTendered = '', cardAmount = '', extraTenders = [], tillCustomerId = null, receiptSale = null;
    let activeOrderId = 40;
    const location = {}, showToast = () => {}, openModal = () => {}, renderTill = () => {};
    const cartTotal = () => 28, resolvePaymentAmounts = () => ({ cashAmount: 0, cardAmount: 28 });
    const document = { getElementById: () => ({ disabled: false, textContent: '' }) };
    const api = async (path, { body } = {}) => {
      if (path.endsWith('/convert') || path === '/api/sales') sent.push({ path, requestKey: body.requestKey, cashTendered: body.cashTendered });
      if (path.endsWith('/convert') || path === '/api/sales') {
        const next = answers.shift();
        if (next instanceof Error) throw next;
      }
      return { id: 501 };
    };
    ${fn('completeSale')}
    ${fn('completeOrderFulfillment')}
    return {
      completeSale, completeOrderFulfillment,
      retype: (v) => { cashTendered = v; },
      refill: () => { cart = [{ productId: 1, price: 28, qty: 1 }]; },
      emptyBasket: () => { cart = []; saleKeyFollowsBasket(); },
      useOrder: (id) => { activeOrderId = id; },
    };
  `);
  const answers = [];
  const sent = [];
  return { ...make(answers, sent), answers, sent };
}
const lost = () => new Error('Failed to fetch');
const reused = () => Object.assign(new Error('This sale was already recorded'), { status: 409, code: 'reused_key' });

test('a key is long enough for the server', () => {
  assert.match(line('const newSaleKey = '), /new Uint8Array\(24\)/, '48 characters; the server asks for at least 32');
});

test('a lost answer, then pressing again, sends the same key', async () => {
  const t = till();
  t.answers.push(lost());
  await t.completeSale();
  await t.completeSale();
  assert.equal(t.sent.length, 2);
  assert.ok(t.sent[0].requestKey.length >= 32);
  assert.equal(t.sent[1].requestKey, t.sent[0].requestKey);
});

test('a lost answer, the cash retyped, and refused: the next press still has the same key, so no second sale', async () => {
  const t = till();
  t.answers.push(lost());
  await t.completeSale();
  t.retype('40');
  t.answers.push(reused());
  await t.completeSale();
  await t.completeSale();
  assert.deepEqual(t.sent.map((s) => s.requestKey), Array(3).fill(t.sent[0].requestKey));
});

test('the key goes with the basket: emptied, the next sale has a new one', async () => {
  const t = till();
  t.answers.push(lost());
  await t.completeSale();
  t.emptyBasket();
  t.refill();
  await t.completeSale();
  assert.notEqual(t.sent[1].requestKey, t.sent[0].requestKey);
});

test('a sale that goes through leaves the next with a new key', async () => {
  const t = till();
  await t.completeSale();
  t.refill();
  await t.completeSale();
  assert.notEqual(t.sent[1].requestKey, t.sent[0].requestKey);
});

test('an order has its own key: a sale’s can’t stick to it, and another order gets another', async () => {
  const t = till();
  t.answers.push(lost());
  await t.completeSale();
  t.answers.push(lost());
  await t.completeOrderFulfillment();
  await t.completeOrderFulfillment();
  const [saleSend, orderSend, orderAgain] = t.sent;
  assert.notEqual(orderSend.requestKey, saleSend.requestKey);
  assert.equal(orderAgain.requestKey, orderSend.requestKey, 'kept for that order');
  t.refill();
  t.useOrder(41);
  await t.completeOrderFulfillment();
  assert.notEqual(t.sent[3].requestKey, orderSend.requestKey);
});

test('the basket being emptied by any route clears the key, where the basket is drawn', () => {
  assert.match(fn('renderCart'), /saleKeyFollowsBasket\(\)/);
});

test('an order’s Convert box keeps its own key across retries', () => {
  assert.match(src, /let convertKey = null;\n\s+convertBtn\.addEventListener/);
  const at = src.indexOf('convertKey ??= newSaleKey();');
  assert.match(src.slice(at, at + 200), /requestKey: convertKey/);
});
