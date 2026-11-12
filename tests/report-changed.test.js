// "Change what's shown" and the changed report, the server
// (openspec/changes/reports-your-own, design 2 to 6; rp-change, rp-changed).
// The clock is pinned to Thursday 17 September 2026, so "this week" is Mon 14 to
// Sun 20 and "the same days last week" is Mon 7 to Thu 10.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare, pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, firstShopIsBolton } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { fitFor } from '../server/lib/report-changed.js';

let server;
let owner;
let other;
let jo;

const as = (who) => (path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const changed = (query, who = owner) => as(who)(`/api/reports/changed?${query}`);
const byLabel = (rows) => Object.fromEntries(rows.map((r) => [r.label, r]));

// A shop's products and sales. Times are UTC at midday, the same day in the shop (British Summer Time).
async function seed(shop, joId) {
  const inShop = (fn) => runWithShop(shop.shop.id, fn);
  const one = (sql, ...args) => inShop(() => prepare(sql).get(...args));
  const run = (sql, ...args) => inShop(() => prepare(sql).run(...args));
  const { site, till } = await inShop(async () => {
    const siteRow = await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get();
    const tillRow = await prepare('INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, ?, ?, ?) RETURNING id').get(siteRow.id, 'B1', 'Till 1', randomUUID());
    return { site: siteRow, till: tillRow };
  });
  const category = async (name, parent) => {
    const path = parent ? `${parent.path} › ${name}` : name;
    const row = await one('INSERT INTO product_categories (parent_id, name, path) VALUES (?, ?, ?) RETURNING id, path', parent?.id ?? null, name, path);
    return row;
  };
  const accessories = await category('Accessories');
  const drivetrain = await category('Drivetrain');
  const chains = await category('Chains', drivetrain);
  const product = (name, cat, supplier) => one('INSERT INTO products (name, category, supplier, price) VALUES (?, ?, ?, 1) RETURNING id', name, cat.path, supplier);
  const bottle = await product('Water bottle', accessories, 'Acme');
  const pump = await product('Track pump', accessories, '');
  const chain = await product('Chain 11-speed', chains, 'Shimano UK');
  let receipt = 0;
  const oldSale = async (at, { subtotal, total, method, cash = 0, card = 0, cashier = null, lines = [] }) => {
    const sale = await one(
      'INSERT INTO sales (created_at, cashier_id, subtotal, discount, total, payment_method, cash_amount, card_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
      at, cashier, subtotal, subtotal - total, total, method, cash, card
    );
    for (const l of lines) {
      await run('INSERT INTO sale_items (sale_id, product_id, name, unit_price, qty, line_total, line_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
        sale.id, l.product ?? null, l.name, l.total / l.qty, l.qty, l.total, l.type ?? 'product');
    }
  };
  const tillSale = async (at, { total, employee = null, lines = [], pays }) => {
    const sale = await one(
      `INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, employee_id, made_offline, till_clock_at, total_pence, vat_pence)
       VALUES (?, ?, ?, ?, ?, false, ?, ?, 0) RETURNING id`,
      randomUUID(), till.id, site.id, ++receipt, employee, at, total
    );
    for (const l of lines) {
      await run('INSERT INTO till_sale_lines (till_sale_id, product_id, description, qty, unit_price_pence, line_total_pence, vat_rate_bp, vat_pence) VALUES (?, ?, ?, ?, ?, ?, 0, 0)',
        sale.id, l.product ?? null, l.name, l.qty, l.pence / l.qty, l.pence);
    }
    for (const [method, pence] of pays) await run('INSERT INTO till_sale_payments (till_sale_id, method, amount_pence) VALUES (?, ?, ?)', sale.id, method, pence);
  };
  return { bottle, pump, chain, oldSale, tillSale, joId };
}

before(async () => {
  server = await startLiveServer({ env: { WHEELHOUSE_TEST_CLOCK: '2026-09-17T11:00:00Z' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  await firstShopIsBolton(owner);
  other = await staffSignup(server.baseUrl, { shopName: 'Other Cycles' });
  const made = await as(owner)('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  const joEmployee = await runWithShop(owner.shop.id, () => prepare("SELECT id FROM employees WHERE name = 'Jo Taylor'").get());

  const s = await seed(owner, joEmployee.id);
  // Tue 15: Jo, cash, a chain (£20) and two bottles (£10) with £1 off the whole sale: the £29 shares as £19.33 and £9.67.
  await s.oldSale('2026-09-15T10:00:00Z', {
    subtotal: 30, total: 29, method: 'Cash', cash: 29, cashier: joEmployee.id,
    lines: [{ product: s.chain.id, name: 'Chain 11-speed', qty: 1, total: 20 }, { product: s.bottle.id, name: 'Water bottle', qty: 2, total: 10 }],
  });
  // Wed 16: a labour line, paid £10 cash and £5 card.
  await s.oldSale('2026-09-16T10:00:00Z', {
    subtotal: 15, total: 15, method: 'Split', cash: 10, card: 5,
    lines: [{ name: 'Fit tyre', qty: 1, total: 15, type: 'labour' }],
  });
  // Tue 15: an old sale with no lines kept, only its total.
  await s.oldSale('2026-09-15T12:00:00Z', { subtotal: 7, total: 7, method: 'Cash', cash: 7 });
  // Thu 17: the till, Jo, a bottle and two pumps, paid £5 cash and £15 card.
  await s.tillSale('2026-09-17T09:00:00Z', {
    total: 2000, employee: joEmployee.id, pays: [['cash', 500], ['card', 1500]],
    lines: [{ product: s.bottle.id, name: 'Water bottle', qty: 1, pence: 800 }, { product: s.pump.id, name: 'Track pump', qty: 2, pence: 1200 }],
  });
  // Thu 17: the till, a typed-in item with no product, by card.
  await s.tillSale('2026-09-17T10:00:00Z', { total: 400, pays: [['card', 400]], lines: [{ name: 'Valve adaptor', qty: 1, pence: 400 }] });
  // The same days last week: a bottle on Tue 8.
  await s.tillSale('2026-09-08T10:00:00Z', { total: 800, pays: [['card', 800]], lines: [{ product: s.bottle.id, name: 'Water bottle', qty: 1, pence: 800 }] });

  // Another shop's bottle this week, which must never count.
  const t = await seed(other, null);
  await t.tillSale('2026-09-15T10:00:00Z', { total: 77700, pays: [['card', 77700]], lines: [{ product: t.bottle.id, name: 'Water bottle', qty: 1, pence: 77700 }] });
});

after(async () => {
  for (const s of [owner, other]) if (s) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

test('Takings by Day adds up to the Sales report\'s Takings for the same period', async () => {
  const res = await changed('base=sales&measure=takings&split=day&period=this-week');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const sales = (await as(owner)('/api/reports/sales?period=this-week')).body;
  assert.equal(sales.figures.takings.pence, 7500);
  assert.equal(res.body.total.takingsPence, sales.figures.takings.pence);
  assert.equal(res.body.rows.reduce((n, r) => n + (r.takingsPence ?? 0), 0), sales.figures.takings.pence);
  assert.equal(res.body.title, 'Sales: takings by day');
  assert.deepEqual(res.body.rows.map((r) => r.key), ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20']);
  const by = Object.fromEntries(res.body.rows.map((r) => [r.key, r]));
  assert.equal(by['2026-09-15'].takingsPence, 2900 + 700);
  assert.equal(by['2026-09-18'].notReached, true);
});

test('Takings by Category shares a whole-sale discount in proportion and still adds up', async () => {
  const res = await changed('base=sales&measure=takings&split=category&period=this-week');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const rows = byLabel(res.body.rows);
  // The chain's £20 and the bottles' £10 of a £29 sale: £19.33 and £9.67.
  assert.equal(rows.Drivetrain.takingsPence, 1933);
  assert.equal(rows.Accessories.takingsPence, 967 + 800 + 1200);
  assert.equal(rows.Labour.takingsPence, 1500);
  assert.equal(rows['No product'].takingsPence, 400 + 700, 'a typed-in item and an old sale kept only as a total');
  assert.equal(res.body.rows.reduce((n, r) => n + r.takingsPence, 0), 7500);
  assert.equal(res.body.total.takingsPence, 7500);
});

test('Items sold by Product counts quantities and shows Takings beside them', async () => {
  const res = await changed('base=sales&measure=items&split=product&period=this-week');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const rows = byLabel(res.body.rows);
  assert.deepEqual([rows['Water bottle'].value, rows['Water bottle'].takingsPence], [3, 967 + 800]);
  assert.equal(rows['Track pump'].value, 2);
  assert.equal(rows['Chain 11-speed'].value, 1);
  assert.equal(rows.Labour.value, 1);
  assert.equal(res.body.title, 'Sales: items sold by product');
  assert.deepEqual(res.body.columns, ['Product', 'Items sold', 'Takings']);
  assert.equal(res.body.total.value, 3 + 2 + 1 + 1 + 1);
  // The most sold first.
  assert.equal(res.body.rows[0].label, 'Water bottle');
});

test('Payment type counts a Split sale\'s cash under Cash and its card under Card', async () => {
  const res = await changed('base=takings&measure=takings&split=payment&period=this-week');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const rows = byLabel(res.body.rows);
  assert.equal(rows.Cash.takingsPence, 2900 + 1000 + 700 + 500);
  assert.equal(rows.Card.takingsPence, 500 + 1500 + 400);
  assert.equal(res.body.total.takingsPence, 7500);
  assert.equal(res.body.title, 'Takings and cash-ups: takings by payment type');
});

test('with no choices, each report opens on what it already shows', async () => {
  const sales = await changed('base=sales&period=this-week');
  assert.deepEqual([sales.body.measure, sales.body.split], ['takings', 'day']);
  const takings = await changed('base=takings&period=this-week');
  assert.deepEqual([takings.body.measure, takings.body.split], ['takings', 'payment']);
});

test('Only counts everything under a category, and Labour is its own choice', async () => {
  const drivetrain = await changed('base=sales&measure=takings&split=product&only=Drivetrain&period=this-week');
  assert.equal(drivetrain.status, 200, JSON.stringify(drivetrain.body));
  assert.deepEqual(drivetrain.body.rows.map((r) => [r.label, r.takingsPence]), [['Chain 11-speed', 1933]]);
  assert.equal(drivetrain.body.total.label, 'Total, Drivetrain only');
  const both = await changed('base=sales&measure=takings&split=category&only=Labour&only=Accessories&period=this-week');
  assert.deepEqual(both.body.rows.map((r) => r.label).sort(), ['Accessories', 'Labour']);
  assert.equal(both.body.total.takingsPence, 1500 + 967 + 800 + 1200);
  assert.equal(both.body.total.label, 'Total, Accessories and Labour only');
});

test('the title and the line under it say what it was changed from, what it is limited to, and the period', async () => {
  const res = await changed('base=sales&measure=items&split=product&only=Accessories&period=this-week');
  assert.equal(res.body.title, 'Sales: items sold by product');
  assert.equal(res.body.line, 'Changed from Sales · Accessories only · So far: Mon 14 – Thu 17 September, against the same days last week');
  assert.equal(res.body.total.label, 'Total, Accessories only');
  assert.equal(res.body.what, 'Sales: items sold by product · Accessories only');
  const supplier = await changed('base=sales&measure=takings&split=product&supplier=Acme&period=this-week');
  assert.deepEqual(supplier.body.rows.map((r) => r.label), ['Water bottle']);
  assert.equal(supplier.body.line, 'Changed from Sales · Acme only · So far: Mon 14 – Thu 17 September, against the same days last week');
});

test('the panel lists the top-level categories and Labour, and the suppliers typed on products that sold', async () => {
  const res = await changed('base=sales&period=this-week');
  assert.deepEqual(res.body.choices.only.map((c) => c.value), ['Accessories', 'Drivetrain', 'Labour']);
  assert.deepEqual(res.body.choices.suppliers.map((c) => c.value), ['', 'Acme', 'Shimano UK']);
  assert.equal(res.body.choices.suppliers[0].label, 'Any supplier');
});

test('each row is compared with the same row in the period before, and the total with everything before', async () => {
  const res = await changed('base=sales&measure=takings&split=product&period=this-week');
  const bottle = byLabel(res.body.rows)['Water bottle'];
  assert.equal(bottle.beforeValue, 800);
  assert.equal(res.body.figures.beforeValue, 800);
  assert.equal(res.body.figures.value, 7500);
});

test('Week groups days into weeks from Monday', async () => {
  const res = await changed('base=sales&measure=takings&split=week&period=last-12-months');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const by = Object.fromEntries(res.body.rows.map((r) => [r.key, r]));
  assert.equal(by['2026-09-14'].takingsPence, 7500);
  assert.equal(by['2026-09-07'].takingsPence, 800);
  assert.equal(by['2026-09-14'].label, 'Week of 14 Sep');
});

test('what fits with what: each greyed choice has its reason', async () => {
  const fromSales = (await changed('base=sales&period=this-week')).body.choices;
  const why = (group, value) => group.find((c) => c.value === value).why;
  assert.equal(why(fromSales.measure, 'jobs'), 'workshop only — choose it from the Workshop report');
  assert.equal(why(fromSales.measure, 'hours'), 'workshop only');
  assert.equal(why(fromSales.measure, 'margin'), 'costs aren’t kept on sales yet');
  assert.equal(why(fromSales.split, 'shop'), 'one shop until a second one is added');
  assert.equal(why(fromSales.split, 'day'), undefined);
  const items = (await changed('base=sales&measure=items&split=product&period=this-week')).body.choices;
  assert.equal(why(items.split, 'payment'), 'payments aren’t split by item');
  const withOnly = (await changed('base=sales&measure=takings&split=day&only=Accessories&period=this-week')).body.choices;
  assert.equal(why(withOnly.split, 'payment'), 'payments aren’t split by item');
  const year = (await changed('base=sales&period=last-12-months')).body.choices;
  assert.equal(why(year.split, 'day'), 'too many days — choose Week');
  const long = (await changed('base=sales&period=dates&from=2026-06-01&to=2026-09-01')).body.choices;
  assert.equal(why(long.split, 'day'), 'too many days — choose Week');
  const short = (await changed('base=sales&period=dates&from=2026-08-01&to=2026-09-01')).body.choices;
  assert.equal(why(short.split, 'day'), undefined);
});

test('a combination that does not fit is refused with its reason', async () => {
  const cases = [
    ['measure=items&split=payment', 'payments aren’t split by item'],
    ['measure=takings&split=payment&only=Accessories', 'payments aren’t split by item'],
    ['measure=jobs', 'workshop only — choose it from the Workshop report'],
    ['measure=hours', 'workshop only'],
    ['measure=margin', 'costs aren’t kept on sales yet'],
    ['split=shop', 'one shop until a second one is added'],
  ];
  for (const [query, reason] of cases) {
    const res = await changed(`base=sales&period=this-week&${query}`);
    assert.equal(res.status, 400, query);
    assert.equal(res.body.error, reason, query);
  }
  const year = await changed('base=sales&measure=takings&split=day&period=last-12-months');
  assert.equal(year.status, 400);
  assert.equal(year.body.error, 'too many days — choose Week');
  assert.equal((await changed('base=sales&measure=nonsense')).status, 400);
  assert.equal((await changed('base=nonsense')).status, 400);
});

test('the choices come back for any selection, normalised to one that fits', async () => {
  const res = await as(owner)('/api/reports/changed/choices?base=sales&measure=items&split=payment&period=this-week');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.selection.measure, 'items');
  assert.notEqual(res.body.selection.split, 'payment', 'payments aren\'t split by item, so the split moves to one that fits');
  assert.equal(res.body.choices.split.find((c) => c.value === 'payment').why, 'payments aren’t split by item');
});

test('Margin is not offered at all to someone who can\'t see costs', () => {
  const noCosts = fitFor({ base: 'sales', measure: 'takings', split: 'day', only: [], supplier: '', period: 'this-week', days: 7 }, { canSeeCosts: false });
  assert.equal(noCosts.measure.some((c) => c.value === 'margin'), false);
  const withCosts = fitFor({ base: 'sales', measure: 'takings', split: 'day', only: [], supplier: '', period: 'this-week', days: 7 }, { canSeeCosts: true });
  assert.equal(withCosts.measure.find((c) => c.value === 'margin').why, 'costs aren’t kept on sales yet');
});

test('only the shop\'s owner can see a changed report, and another shop\'s sales never count', async () => {
  for (const path of ['/api/reports/changed?base=sales', '/api/reports/changed.csv?base=sales', '/api/reports/changed/choices?base=sales']) {
    const staff = await as(jo)(path);
    assert.equal(staff.status, 403, path);
    assert.equal(staff.body.error, "Only the shop's owner can see reports");
  }
  const mine = await changed('base=sales&measure=takings&split=product&period=this-week');
  assert.equal(mine.body.total.takingsPence, 7500, 'the other shop\'s £777 is not in it');
});

test('the download is the table as shown, made as part 1\'s downloads are', async () => {
  const res = await fetch(`${server.baseUrl}/api/reports/changed.csv?base=sales&measure=items&split=product&only=Accessories&period=this-week`, { headers: { cookie: owner.cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  assert.match(res.headers.get('content-disposition'), /^attachment; filename="sales-changed-.+-2026-09-14-to-2026-09-17\.csv"$/);
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  const lines = new TextDecoder().decode(bytes.slice(3)).trim().split(/\r?\n/);
  assert.equal(lines[0], 'Product,Items sold,Takings');
  assert.equal(lines[1], 'Water bottle,3,17.67');
  assert.equal(lines.at(-1), '"Total, Accessories only",5,29.67');
});

test('a category that has gone is left out, and the report shows what is left', async () => {
  const res = await changed('base=sales&measure=takings&split=product&only=Accessories&only=Gone&period=this-week');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.only, ['Accessories']);
  assert.match(res.body.line, /^Changed from Sales · Accessories only · /);
});

test('a supplier typed with a stray space still matches the chip that lists it', async () => {
  await runWithShop(owner.shop.id, () => prepare("UPDATE products SET supplier = 'Acme ' WHERE name = 'Track pump'").run());
  try {
    const res = await changed('base=sales&measure=takings&split=product&supplier=Acme&period=this-week');
    assert.deepEqual(res.body.rows.map((r) => r.label).sort(), ['Track pump', 'Water bottle']);
  } finally {
    await runWithShop(owner.shop.id, () => prepare("UPDATE products SET supplier = '' WHERE name = 'Track pump'").run());
  }
});

test('a supplier chosen that sold nothing in the period is still listed, so a chip is chosen', async () => {
  const res = await changed('base=sales&measure=takings&split=day&supplier=Ghost&period=this-week');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(res.body.choices.suppliers.some((c) => c.value === 'Ghost'));
});

test('a split left empty in the address counts as not asked', async () => {
  const res = await changed('base=sales&measure=takings&split=&period=last-12-months');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.split, 'week');
});

test('Takings sits beside any measure that is not Takings', async () => {
  const res = await changed('base=sales&measure=items&split=day&period=this-week');
  assert.deepEqual(res.body.columns, ['Day', 'Items sold', 'Takings']);
});

test('the same choices on a later date open on the latest period: a saved This week shows the new week', async () => {
  const { changedReport } = await import('../server/lib/report-changed.js');
  const query = () => new URLSearchParams('base=sales&measure=takings&split=day&period=this-week');
  const [thisWeek, nextWeek] = await runWithShop(owner.shop.id, async () => [
    await changedReport(query(), '2026-09-17', { canSeeCosts: true }),
    await changedReport(query(), '2026-09-24', { canSeeCosts: true }),
  ]);
  assert.equal(thisWeek.period.from, '2026-09-14');
  assert.equal(nextWeek.period.from, '2026-09-21');
  assert.equal(nextWeek.period.label, 'So far: Mon 21 – Thu 24 September');
});
