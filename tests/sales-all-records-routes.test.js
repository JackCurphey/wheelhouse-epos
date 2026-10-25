// Step B of sales in pence (openspec/changes/wp-1-6-sales-in-pence, task 3.3):
// the dashboard's today figures, GET /api/sales, GET /api/sales/:id and
// GET /api/customers/:id/sales read the all_sales view, so a sale counts once
// wherever it was recorded (old record or the new till). An id with no
// `source` still means the old record. The live server's clock is 07:00 UK
// time on 1 Sep 2026, so the shop's day is 23:00Z 31 Aug to 23:00Z 1 Sep.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let customerId;
let jo;
let oldToday; // £10.00 at 08:00Z on 1 Sep, paid in cash, with one labour line
let tillToday; // £25.00 at 09:00Z on 1 Sep, card, receipt 7, with one line
let tillOffline; // £9.00 made on 30 Aug's till clock, arrived 1 Sep
let sameNumber; // an old sale and a till sale with one number

const inShop = (fn) => runWithShop(owner.shop.id, fn);
const staff = (path) => staffRequest(server.baseUrl, owner.cookie, path);

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Both Records Cycles' });
  await inShop(async () => {
    customerId = (await prepare("INSERT INTO customers (name) VALUES ('Sam Rider') RETURNING id").get()).id;
    jo = (await prepare("INSERT INTO employees (name, is_cashier) VALUES ('Jo Taylor', 1) RETURNING id").get()).id;
    const site = await prepare("INSERT INTO sites (name, code) VALUES ('Bolton', 'B') RETURNING id").get();
    const till = await prepare('INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, ?, ?, ?) RETURNING id')
      .get(site.id, 'B1', 'Till 1', randomUUID());
    oldToday = (await prepare(
      `INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, customer_id, cashier_id)
       VALUES ('2026-09-01T08:00:00Z', 10, 10, 'Cash', 10, ?, ?) RETURNING id`
    ).get(customerId, jo)).id;
    await prepare("INSERT INTO sale_items (sale_id, name, unit_price, qty, line_total, line_type) VALUES (?, 'Labour', 10, 1, 10, 'labour')").run(oldToday);
    const makeTill = async ({ id = null, clockAt, receivedAt = clockAt, pence, offline = false, customer = null, employee = null, receipt = 7 }) => {
      const sale = (await prepare(
        `INSERT INTO till_sales (id, client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, received_at, total_pence, vat_pence, customer_id, employee_id)
         VALUES (COALESCE(?::int, nextval('till_sales_id_seq')::int), ?, ?, ?, ?, ?, ?, ?, ?, 417, ?, ?) RETURNING id`
      ).get(id, randomUUID(), till.id, site.id, receipt, offline, clockAt, receivedAt, pence, customer, employee)).id;
      await prepare("INSERT INTO till_sale_lines (till_sale_id, description, qty, unit_price_pence, line_total_pence, vat_rate_bp, vat_pence) VALUES (?, 'Pump', 1, ?, ?, 2000, 417)").run(sale, pence, pence);
      await prepare("INSERT INTO till_sale_payments (till_sale_id, method, amount_pence) VALUES (?, 'card', ?)").run(sale, pence);
      return sale;
    };
    tillToday = await makeTill({ clockAt: '2026-09-01T09:00:00Z', pence: 2500, customer: customerId, employee: jo });
    tillOffline = await makeTill({ clockAt: '2026-08-30T15:00:00Z', receivedAt: '2026-09-01T06:00:00Z', pence: 900, offline: true, receipt: 8 });
    // The same number in both records; ids are global, so one nothing else uses.
    sameNumber = 2_000_000 + Math.floor(Math.random() * 1_000_000);
    await prepare("INSERT INTO sales (id, created_at, subtotal, total, payment_method) VALUES (?, '2026-09-01T10:00:00Z', 3, 3, 'Cash')").run(sameNumber);
    await makeTill({ id: sameNumber, clockAt: '2026-09-01T10:30:00Z', pence: 700, receipt: 9 });
  });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

test('the dashboard counts old and till sales on the shop\'s day, and sums them in pounds', async () => {
  const res = await staff('/api/dashboard');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  // today: old £10 + till £25 + old £3 + till £7 (the offline £9 is 30 Aug)
  assert.equal(res.body.todayCount, 4);
  assert.equal(res.body.todayTotal, 45);
  assert.equal(res.body.todayTotalPence, 4500);
});

test('the dashboard\'s top sellers include what the till sold', async () => {
  const res = await staff('/api/dashboard');
  const byName = Object.fromEntries(res.body.topToday.map((r) => [r.name, r]));
  assert.equal(Number(byName['Labour'].revenue), 10);
  assert.equal(Number(byName.Pump.qty), 2); // £25 and £7, today only
  assert.equal(Number(byName.Pump.revenue), 32);
});

test('the sales list holds both records, newest first, each saying which it is', async () => {
  const res = await staff('/api/sales');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const mine = res.body.filter((s) => [oldToday, tillToday, tillOffline].includes(s.id) || s.id === sameNumber);
  assert.deepEqual(res.body.map((s) => `${s.source}:${s.id}`), [
    `till:${sameNumber}`, `old:${sameNumber}`, `till:${tillToday}`, `old:${oldToday}`, `till:${tillOffline}`,
  ]);
  assert.equal(mine.length, 5);
  const till = res.body.find((s) => s.source === 'till' && s.id === tillToday);
  assert.equal(till.totalPence, 2500);
  assert.equal(till.total, 25);
  assert.equal(till.vatPence, 417);
  assert.equal(till.receiptNumber, 7);
  assert.equal(till.customerName, 'Sam Rider');
  assert.equal(till.cashierName, 'Jo Taylor');
  assert.equal(till.paymentMethod, 'Card');
  const old = res.body.find((s) => s.source === 'old' && s.id === oldToday);
  assert.equal(old.totalPence, 1000);
  assert.equal(old.total, 10);
  assert.equal(old.paymentMethod, 'Cash');
  assert.equal(old.cashAmount, 10);
});

test('the sales list filters by day, customer and staff member across both records', async () => {
  const day = await staff('/api/sales?date=2026-08-30');
  assert.deepEqual(day.body.map((s) => `${s.source}:${s.id}`), [`till:${tillOffline}`]);
  const today = await staff('/api/sales?date=today');
  assert.equal(today.body.length, 4);
  const byCustomer = await staff(`/api/sales?customerId=${customerId}`);
  assert.deepEqual(byCustomer.body.map((s) => `${s.source}:${s.id}`), [`till:${tillToday}`, `old:${oldToday}`]);
  const byStaff = await staff(`/api/sales?cashierId=${jo}`);
  assert.deepEqual(byStaff.body.map((s) => `${s.source}:${s.id}`), [`till:${tillToday}`, `old:${oldToday}`]);
});

test('a sale by id with no source is the old record, even when a till sale has the same number', async () => {
  const res = await staff(`/api/sales/${sameNumber}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.source, 'old');
  assert.equal(res.body.total, 3);
  const withItems = await staff(`/api/sales/${oldToday}`);
  assert.equal(withItems.body.items[0].name, 'Labour');
});

test('?source=till gives the till sale, with its lines and payments in pence', async () => {
  const res = await staff(`/api/sales/${sameNumber}?source=till`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.source, 'till');
  assert.equal(res.body.totalPence, 700);
  assert.equal(res.body.receiptNumber, 9);
  assert.deepEqual(res.body.items.map((i) => ({ name: i.name, qty: i.qty, lineTotalPence: i.lineTotalPence, vatRateBp: i.vatRateBp })),
    [{ name: 'Pump', qty: 1, lineTotalPence: 700, vatRateBp: 2000 }]);
  assert.deepEqual(res.body.payments, [{ method: 'card', amountPence: 700 }]);
  // The old app's receipt window reads these pound fields (review): a till sale has no
  // discount (its lines add up to its total), and its card payment is the card amount.
  assert.deepEqual(
    { subtotal: res.body.subtotal, discount: res.body.discount, cashAmount: res.body.cashAmount, cardAmount: res.body.cardAmount, vatPence: res.body.vatPence },
    { subtotal: 7, discount: 0, cashAmount: 0, cardAmount: 7, vatPence: 417 }
  );
  assert.deepEqual(res.body.extraPayments, []);
});

test('an unknown source is a 400, and a till sale that isn\'t there is a 404', async () => {
  assert.equal((await staff(`/api/sales/${oldToday}?source=shopify`)).status, 400);
  assert.equal((await staff('/api/sales/2147000000?source=till')).status, 404);
  assert.equal((await staff('/api/sales/2147000000')).status, 404);
});

test('a customer\'s sales hold both records', async () => {
  const res = await staff(`/api/customers/${customerId}/sales`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.map((s) => `${s.source}:${s.id}`), [`till:${tillToday}`, `old:${oldToday}`]);
});
