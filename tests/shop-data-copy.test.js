// Your data › Download everything, the server (openspec/changes/your-data-download;
// set-data-export; Jack's 10 Nov answers): the Owner takes one zip of spreadsheets
// holding the shop's customers, sales and refunds, stock and workshop jobs. Only the
// Owner, only the shop's own rows; nothing is written.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, firstShopIsBolton } from './helpers/staff.js';
import { staffLogin, registerTill } from './helpers/till.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let bolton;

const staff = (p, options, who = owner) => staffRequest(server.baseUrl, who.cookie, p, options);
const inShop = (fn, shop = owner) => runWithShop(shop.shop.id, fn);

async function download(cookie = owner.cookie) {
  const res = await fetch(`${server.baseUrl}/api/settings/your-data/download`, { headers: cookie ? { cookie } : {} });
  return { res, body: Buffer.from(await res.arrayBuffer()) };
}

// The zip's files, read back by `unzip`.
function filesOf(buffer, t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'wh-shop-data-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'copy.zip');
  writeFileSync(file, buffer);
  const names = execFileSync('unzip', ['-Z1', file], { encoding: 'utf8' }).trim().split('\n');
  return Object.fromEntries(names.map((n) => [n, execFileSync('unzip', ['-p', file, n], { encoding: 'utf8' })]));
}

// A spreadsheet's rows as objects by its header, quoted cells read back as written.
function rowsOf(csv) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const text = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\r' && text[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; } else cell += ch;
  }
  const [cols, ...lines] = rows;
  return lines.map((l) => Object.fromEntries(l.map((v, i) => [cols[i], v])));
}

async function filesFor(t) {
  const { res, body } = await download();
  assert.equal(res.status, 200, body.toString());
  return filesOf(body, t);
}

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
  bolton = await firstShopIsBolton(owner);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  await server?.stop();
});

test('the Owner gets one zip named after the shop and its day, holding the four spreadsheets', async (t) => {
  const { res, body } = await download();
  assert.equal(res.status, 200, body.toString());
  assert.equal(res.headers.get('content-type'), 'application/zip');
  const name = `${owner.shop.name} data 2026-09-01.zip`;
  assert.equal(res.headers.get('content-disposition'), `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  const files = filesOf(body, t);
  assert.deepEqual(Object.keys(files).sort(), ['Customers.csv', 'Sales and refunds.csv', 'Stock.csv', 'Workshop jobs.csv']);
  for (const content of Object.values(files)) assert.ok(content.startsWith('﻿'), 'each starts with the UTF-8 mark');
});

test('a shop name with ’ in it still downloads, the whole name kept for the browser', async (t) => {
  const jacks = await staffSignup(server.baseUrl, { shopName: 'Jack’s "Bikes"' });
  t.after(() => deleteTestShop(jacks.shop.id));
  const { res, body } = await download(jacks.cookie);
  assert.equal(res.status, 200, body.toString());
  const header = res.headers.get('content-disposition');
  assert.equal(decodeURIComponent(header.split("filename*=UTF-8''")[1]), `${jacks.shop.name} data 2026-09-01.zip`);
  assert.match(header, /^attachment; filename="Jack_s _Bikes_ [^"]* data 2026-09-01\.zip"; /);
  // A new shop with no sales still gets each list, its header row only.
  const files = filesOf(body, t);
  assert.equal(rowsOf(files['Sales and refunds.csv']).length, 0);
  assert.ok(files['Sales and refunds.csv'].startsWith('\uFEFFDate,Kind,Receipt'));
});

test('a staff member is refused, and nobody signed in is refused', async () => {
  const sam = await staffLogin(owner.shop.id);
  const refused = await download(sam.cookie);
  assert.equal(refused.res.status, 403);
  assert.equal(JSON.parse(refused.body.toString()).error, "Only the shop's owner can download the shop's data");
  const nobody = await download(null);
  assert.equal(nobody.res.status, 401);
});

test('Customers: one row per customer, with groups, company details and their yes to messages', async (t) => {
  const maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: 'maya@example.test', phone: '07700 900 142' } })).body;
  const firm = (await staff('/api/customers', { method: 'POST', body: { name: 'Bolton Couriers Ltd', email: 'accounts@example.test' } })).body;
  await inShop(async () => {
    await prepare(`UPDATE customers SET address = '[address]', postcode = '[postcode]', update_channel = 'sms', service_reminders = true,
      review_requests = false, marketing_permission = true, reminders_said_yes_at = '2026-08-20T10:00:00Z', reminders_said_yes_via = 'booking',
      notes = 'Prefers mornings', created_at = '2026-09-01T09:00:00Z' WHERE id = ?`).run(maya.id);
    await prepare("UPDATE customers SET is_company = true, contact_name = '[contact name]', vat_number = '[VAT number]', invoice_email = 'invoices@example.test' WHERE id = ?").run(firm.id);
    const group = (await prepare("INSERT INTO customer_groups (name, discount_percent) VALUES ('Club riders', 10) RETURNING id").get()).id;
    await prepare('INSERT INTO customer_group_members (customer_id, group_id) VALUES (?, ?)').all(maya.id, group);
    await prepare("INSERT INTO store_credit_entries (customer_id, change_pence, kind) VALUES (?, 1250, 'added')").run(maya.id);
    await prepare("INSERT INTO account_entries (customer_id, change_pence, kind) VALUES (?, 4000, 'opening')").run(firm.id);
  });
  const rows = rowsOf((await filesFor(t))['Customers.csv']);
  const m = rows.find((r) => r.Name === 'Maya Patel');
  assert.equal(m.Email, 'maya@example.test');
  assert.equal(m.Mobile, '07700 900 142');
  assert.equal(m.Postcode, '[postcode]');
  assert.equal(m.Company, 'No');
  assert.equal(m['Customer groups'], 'Club riders');
  assert.equal(m['Job updates by'], 'Text');
  assert.equal(m['Service reminders'], 'Yes');
  assert.equal(m['Review requests'], 'No');
  assert.equal(m['Offers and news'], 'Yes');
  assert.equal(m['Said yes to reminders'], '2026-08-20 11:00, at booking');
  assert.equal(m['Store credit (£)'], '12.50');
  assert.equal(m['Owed on account (£)'], '');
  assert.equal(m.Notes, 'Prefers mornings');
  assert.equal(m.Added, '2026-09-01');
  const f = rows.find((r) => r.Name === 'Bolton Couriers Ltd');
  assert.equal(f.Company, 'Yes');
  assert.equal(f['Contact name'], '[contact name]');
  assert.equal(f['VAT number'], '[VAT number]');
  assert.equal(f['Send invoices to'], 'invoices@example.test');
  assert.equal(f['Owed on account (£)'], '40.00');
});

test('Customers: a deleted, a removed and a merged-away customer have no row; the kept record carries what was merged in', async (t) => {
  const gone = (await staff('/api/customers', { method: 'POST', body: { name: 'Deleted Person' } })).body;
  const kept = (await staff('/api/customers', { method: 'POST', body: { name: 'Kept Record' } })).body;
  const away = (await staff('/api/customers', { method: 'POST', body: { name: 'Merged Away' } })).body;
  const removed = (await staff('/api/customers', { method: 'POST', body: { name: 'Removed From List' } })).body;
  await staff(`/api/customers/${removed.id}`, { method: 'DELETE' });
  await inShop(async () => {
    await prepare("UPDATE customers SET deleted_at = now(), name = '' WHERE id = ?").run(gone.id);
    await prepare('UPDATE customers SET merged_into_id = ? WHERE id = ?').run(kept.id, away.id);
    await prepare("INSERT INTO store_credit_entries (customer_id, change_pence, kind) VALUES (?, 500, 'added')").run(away.id);
  });
  const rows = rowsOf((await filesFor(t))['Customers.csv']);
  assert.equal(rows.filter((r) => r.Name === 'Merged Away').length, 0);
  assert.equal(rows.filter((r) => r.Name === 'Removed From List').length, 0, 'one removed from the list has no row, as on Customers');
  assert.equal(rows.filter((r) => r.Name === '' || r.Name === 'Deleted Person').length, 0);
  assert.equal(rows.find((r) => r.Name === 'Kept Record')['Store credit (£)'], '5.00');
});

test('a name a spreadsheet would read as a formula is written as text', async (t) => {
  await staff('/api/customers', { method: 'POST', body: { name: '=HYPERLINK("x")' } });
  const csv = (await filesFor(t))['Customers.csv'];
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`), 'written with a leading quote mark');
});

test('Stock: one row per active product at each site, money in pounds with two decimals', async (t) => {
  const second = (await staff('/api/sites', { method: 'POST', body: { name: '[site name]', code: 'S' } })).body;
  await inShop(async () => {
    const pads = (await prepare(
      `INSERT INTO products (name, sku, barcode, category, supplier, price, cost, vat_rate_bp, low_stock_threshold, active, size, colour)
       VALUES ('Shimano brake pads B05S-RX', 'B05S-RX', '4524667000000', 'Brakes', '[supplier]', 12.99, 6.5, 2000, 4, 1, NULL, NULL) RETURNING id`
    ).get()).id;
    await prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, 7), (?, ?, 2)').all(bolton.id, pads, second.id, pads);
    await prepare("INSERT INTO products (name, sku, price, active) VALUES ('[product switched off]', 'OFF-1', 1, 0)").run();
  });
  const rows = rowsOf((await filesFor(t))['Stock.csv']).filter((r) => r.SKU === 'B05S-RX');
  assert.equal(rows.length, 2);
  const atBolton = rows.find((r) => r.Shop === 'Bolton');
  assert.equal(atBolton.Product, 'Shimano brake pads B05S-RX');
  assert.equal(atBolton.Barcode, '4524667000000');
  assert.equal(atBolton.Category, 'Brakes');
  assert.equal(atBolton.Supplier, '[supplier]');
  assert.equal(atBolton['Price (£)'], '12.99');
  assert.equal(atBolton['Cost (£)'], '6.50');
  assert.equal(atBolton['VAT rate (%)'], '20');
  assert.equal(atBolton.Quantity, '7');
  assert.equal(atBolton['Reorder level'], '4');
  assert.equal(rows.find((r) => r.Shop === '[site name]').Quantity, '2');
  const all = rowsOf((await filesFor(t))['Stock.csv']);
  assert.equal(all.filter((r) => r.SKU === 'OFF-1').length, 0, 'a product switched off has no row');
});

test("another shop's customers and products never appear", async (t) => {
  await staffRequest(server.baseUrl, other.cookie, '/api/customers', { method: 'POST', body: { name: 'Elsewhere Customer' } });
  await inShop(() => prepare("INSERT INTO products (name, sku, price, active) VALUES ('Elsewhere product', 'ELSE-1', 1, 1)").run(), other);
  const files = await filesFor(t);
  assert.ok(!files['Customers.csv'].includes('Elsewhere Customer'));
  assert.ok(!files['Stock.csv'].includes('ELSE-1'));
});

// ---- Sales and refunds (group 2; answers 3 and 4) ----

let maya;
let jo;
let till;
async function salesSetup() {
  if (maya) return;
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: 'maya.sales@example.test' } })).body;
  const made = await registerTill(server.baseUrl, owner);
  till = { ...made.till, site: made.site };
  jo = await inShop(async () => (await prepare("INSERT INTO employees (name, is_cashier) VALUES ('Jo Taylor', 1) RETURNING id").get()).id);
}
const salesRows = async (t) => rowsOf((await filesFor(t))['Sales and refunds.csv']);

async function tillSale({ at, receipt, lines, customerId = null, payments = [['card', null]] }) {
  return inShop(async () => {
    const total = lines.reduce((n, l) => n + l.qty * l.each, 0);
    const vat = lines.reduce((n, l) => n + (l.vat ?? 0), 0);
    const sale = (await prepare(
      `INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, employee_id, customer_id, till_clock_at, total_pence, vat_pence, made_offline)
       VALUES (gen_random_uuid(), ?, ?, ?, ?, ?, ?, ?, ?, false) RETURNING id`
    ).get(till.id, till.site.id, receipt, jo, customerId, at, total, vat)).id;
    for (const l of lines) {
      await prepare('INSERT INTO till_sale_lines (till_sale_id, description, qty, unit_price_pence, line_total_pence, vat_rate_bp, vat_pence) VALUES (?, ?, ?, ?, ?, 2000, ?) RETURNING id')
        .get(sale, l.what, l.qty, l.each, l.qty * l.each, l.vat ?? 0);
    }
    for (const [method, pence] of payments) {
      await prepare('INSERT INTO till_sale_payments (till_sale_id, method, amount_pence) VALUES (?, ?, ?) RETURNING id').get(sale, method, pence ?? total);
    }
    return sale;
  });
}

test('Sales: a till sale of two items is two rows sharing its date, receipt, till, who served and total, with VAT per line', async (t) => {
  await salesSetup();
  await tillSale({ at: '2026-08-21T09:15:00Z', receipt: 7, customerId: maya.id, lines: [
    { what: 'Shimano brake pads B05S-RX', qty: 2, each: 1299, vat: 433 },
    { what: '[product name]', qty: 1, each: 500, vat: 83 },
  ] });
  const rows = (await salesRows(t)).filter((r) => r.Receipt === `${till.code}-0007`);
  assert.equal(rows.length, 2);
  for (const r of rows) {
    assert.equal(r.Date, '2026-08-21 10:15', 'in the shop’s time zone');
    assert.equal(r.Kind, 'Sale');
    assert.equal(r.Shop, 'Bolton');
    assert.equal(r.Till, till.code);
    assert.equal(r['Served by'], 'Jo Taylor');
    assert.equal(r.Customer, 'Maya Patel');
    assert.equal(r['Sale total (£)'], '30.98');
    assert.equal(r['Paid by'], 'Card');
  }
  const pads = rows.find((r) => r.Item === 'Shimano brake pads B05S-RX');
  assert.deepEqual([pads.Quantity, pads['Price each (£)'], pads['Line total (£)'], pads['VAT (£)']], ['2', '12.99', '25.98', '4.33']);
  assert.equal(rows.find((r) => r.Item === '[product name]')['VAT (£)'], '0.83');
});

test('Sales: an older-record sale has empty VAT, receipt, shop and till, not 0; a collected repair’s sale is there once', async (t) => {
  await salesSetup();
  const bike = (await staff(`/api/customers/${maya.id}/bikes`, { method: 'POST', body: { make: 'Trek', model: 'Domane AL 3' } })).body;
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-09-05', customerId: maya.id, bikeId: bike.id } })).body;
  await inShop(async () => {
    const sale = (await prepare(
      `INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, customer_id, cashier_id, note)
       VALUES ('2026-08-20T10:00:00Z', 45, 45, 'Cash', 45, ?, ?, '[older sale]') RETURNING id`
    ).get(maya.id, jo)).id;
    await prepare("INSERT INTO sale_items (sale_id, name, unit_price, qty, line_total, line_type) VALUES (?, 'Standard service', 45, 1, 45, 'labour') RETURNING id").get(sale);
    await prepare("INSERT INTO sale_payments (sale_id, tender_type, amount) VALUES (?, 'Cash', 45) RETURNING id").get(sale);
    await prepare(`INSERT INTO sale_documents (kind, status, subtotal, total, converted_sale_id, workshop_job_id, customer_id)
                   VALUES ('order', 'converted', 45, 45, ?, ?, ?) RETURNING id`).get(sale, job.id, maya.id);
  });
  const rows = (await salesRows(t)).filter((r) => r.Item === 'Standard service' && r.Date === '2026-08-20 11:00');
  assert.equal(rows.length, 1, 'once');
  const r = rows[0];
  assert.deepEqual([r.Receipt, r['VAT (£)'], r.Shop, r.Till], ['', '', '', '']);
  assert.deepEqual([r['Line total (£)'], r['Sale total (£)'], r['Paid by'], r['Served by']], ['45.00', '45.00', 'Cash', 'Jo Taylor']);
});

test('Sales: an online deposit refund and a Shopify refund are minus rows marked Refund; oldest first', async (t) => {
  await salesSetup();
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: '[refunded booking]', jobDate: '2026-09-06', customerId: maya.id } })).body;
  await inShop(async () => {
    await prepare(`INSERT INTO online_payments (provider, provider_ref, amount_pence, status, request_key_hash, job_id, created_at, refunded_at, refund_reason)
                   VALUES ('pretend', 'ref-1', 2000, 'refunded', 'k-' || gen_random_uuid(), ?, '2026-08-18T09:00:00Z', '2026-08-19T09:00:00Z', 'Cancelled by the shop') RETURNING id`).get(job.id);
    const pads = (await prepare("INSERT INTO products (name, sku, price, active) VALUES ('Shimano brake pads B05S-RX', 'B05S-RX-S', 12.99, 1) RETURNING id").get()).id;
    await prepare("INSERT INTO stock_movements (product_id, change_qty, type, note, shopify_refund_id, created_at) VALUES (?, 1, 'return', 'Shopify refund #555', '555', '2026-08-19T12:00:00Z') RETURNING id").get(pads);
  });
  const rows = await salesRows(t);
  const deposit = rows.find((r) => r.Kind === 'Refund' && r.Refunded.includes(job.reference));
  assert.equal(deposit.Date, '2026-08-19 10:00');
  assert.equal(deposit.Item, 'Deposit paid online');
  assert.equal(deposit['Line total (£)'], '-20.00');
  assert.equal(deposit['Sale total (£)'], '-20.00');
  assert.equal(deposit.Customer, 'Maya Patel');
  assert.equal(deposit.Refunded, `Online deposit for job ${job.reference}`);
  const shopify = rows.find((r) => r.Kind === 'Refund' && r.Refunded === 'Shopify refund #555');
  assert.equal(shopify.Item, 'Shimano brake pads B05S-RX');
  assert.equal(shopify.Quantity, '-1');
  assert.equal(shopify['Line total (£)'], '', 'Wheelhouse records no amount for a Shopify refund');
  const dates = rows.map((r) => r.Date);
  assert.deepEqual(dates, [...dates].sort(), 'oldest first');
});

test('Sales: a deleted customer’s sale keeps its row, with the customer empty', async (t) => {
  await salesSetup();
  const gone = (await staff('/api/customers', { method: 'POST', body: { name: 'Sam Leaving' } })).body;
  await tillSale({ at: '2026-08-22T09:00:00Z', receipt: 8, customerId: gone.id, lines: [{ what: '[item]', qty: 1, each: 300 }] });
  await inShop(() => prepare("UPDATE customers SET name = '', deleted_at = now(), active = 0 WHERE id = ?").run(gone.id));
  const r = (await salesRows(t)).find((x) => x.Receipt === `${till.code}-0008`);
  assert.equal(r.Customer, '');
  assert.equal(r['Line total (£)'], '3.00');
});

// ---- Workshop jobs (group 2; answer 6) ----

test('Workshop jobs: one row per job with its customer, bike, services, dates, stage, mechanic, amounts, deposit and staff notes', async (t) => {
  await salesSetup();
  const bike = (await staff(`/api/customers/${maya.id}/bikes`, { method: 'POST', body: { make: 'Trek', model: 'FX 2' } })).body;
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-09-07', customerId: maya.id, bikeId: bike.id } })).body;
  await inShop(async () => {
    const mech = (await prepare("INSERT INTO employees (name, is_mechanic) VALUES ('Alex Mechanic', 1) RETURNING id").get()).id;
    const svc = (await prepare("INSERT INTO workshop_services (name, price, price_pence) VALUES ('Standard service', 45, 4500) RETURNING id").get()).id;
    await prepare('INSERT INTO workshop_job_services (workshop_job_id, service_id, booked_price, booked_price_pence, position) VALUES (?, ?, 45, 4500, 0) RETURNING workshop_job_id').get(job.id, svc);
    await prepare(`UPDATE workshop_jobs SET mechanic_id = ?, notes = 'Rear hub is worn', booked_in_at = '2026-09-07T08:30:00Z',
                   custody_state = 'collected', collected_at = '2026-09-08T16:00:00Z', work_state = 'complete' WHERE id = ?`).run(mech, job.id);
    const quote = (await prepare("INSERT INTO workshop_quotes (workshop_job_id, revision, state) VALUES (?, 1, 'approved') RETURNING id").get(job.id)).id;
    await prepare("INSERT INTO workshop_quote_lines (workshop_quote_id, kind, description, quantity, unit_amount, unit_amount_pence, decision) VALUES (?, 'part', 'Rear hub', 1, 30, 3000, 'approved') RETURNING id").get(quote);
    const sale = (await prepare("INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, customer_id) VALUES ('2026-09-08T16:00:00Z', 75, 75, 'Cash', 75, ?) RETURNING id").get(maya.id)).id;
    await prepare("INSERT INTO sale_documents (kind, status, subtotal, total, converted_sale_id, workshop_job_id, customer_id) VALUES ('order', 'converted', 75, 75, ?, ?, ?) RETURNING id").get(sale, job.id, maya.id);
    await prepare(`INSERT INTO online_payments (provider, provider_ref, amount_pence, status, request_key_hash, job_id)
                   VALUES ('pretend', 'ref-2', 1000, 'taken', 'k-' || gen_random_uuid(), ?) RETURNING id`).get(job.id);
  });
  const r = rowsOf((await filesFor(t))['Workshop jobs.csv']).find((x) => x.Job === job.reference);
  assert.equal(r.Customer, 'Maya Patel');
  assert.equal(r.Bike, 'Trek FX 2');
  assert.equal(r.Services, 'Standard service');
  assert.equal(r['Booked in'], '2026-09-07 09:30');
  assert.equal(r.Due, '2026-09-07');
  assert.equal(r['Where it’s up to'], 'Collected');
  assert.equal(r.Mechanic, 'Alex Mechanic');
  assert.equal(r['Quoted (£)'], '30.00');
  assert.equal(r['Final (£)'], '75.00');
  assert.equal(r['Deposit (£)'], '10.00');
  assert.equal(r.Collected, '2026-09-08 17:00');
  assert.equal(r['Staff notes'], 'Rear hub is worn');
});

test('Workshop jobs: a job not yet in has no booked-in, final or collected; a deleted customer’s job keeps its row', async (t) => {
  await salesSetup();
  const gone = (await staff('/api/customers', { method: 'POST', body: { name: 'Pat Gone' } })).body;
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: '[a booking]', jobDate: '2026-09-09', customerId: gone.id } })).body;
  await inShop(async () => {
    await prepare("UPDATE customers SET name = '', deleted_at = now(), active = 0 WHERE id = ?").run(gone.id);
  });
  const r = rowsOf((await filesFor(t))['Workshop jobs.csv']).find((x) => x.Job === job.reference);
  assert.deepEqual([r.Customer, r['Booked in'], r['Final (£)'], r.Collected, r['Quoted (£)']], ['', '', '', '', '']);
  assert.equal(r['Where it’s up to'], 'Expected');
});

test("another shop's sales and jobs never appear", async (t) => {
  const theirs = (await staffRequest(server.baseUrl, other.cookie, '/api/workshop-jobs', { method: 'POST', body: { title: '[their job]', jobDate: '2026-09-09' } })).body;
  const files = await filesFor(t);
    assert.ok(!files['Workshop jobs.csv'].includes('[their job]'));
});

// Left out from Citrus Lime (group 4; Jack's 10 Nov answer 1): the import's rows the owner left
// out, a fifth spreadsheet only while there are any, with how many in GET /api/settings/your-data.
async function leftOutShop(t) {
  const shop = await staffSignup(server.baseUrl, { shopName: 'Left Out Cycles' });
  t.after(() => deleteTestShop(shop.shop.id));
  const file = (name, report) => runWithShop(shop.shop.id, () => prepare(
    "INSERT INTO move_files (file_name, report, state) VALUES (?, ?, 'done') RETURNING id"
  ).get(name, report));
  const row = (fileId, state, data, why = null) => runWithShop(shop.shop.id, () => prepare(
    'INSERT INTO move_rows (file_id, state, data, why) VALUES (?, ?, ?::jsonb, ?)'
  ).run(fileId, state, JSON.stringify(data), why));
  return { shop, file, row };
}

test('Left out from Citrus Lime: a fifth spreadsheet with the file, why, and Citrus Lime’s own columns; emptied rows and other states are not in it', async (t) => {
  const { shop, file, row } = await leftOutShop(t);
  const people = await file('Customers.csv', 'customers');
  const prices = await file('Price list.csv', 'price_list');
  await row(people.id, 'left_out', { Name: '[Customer name]', Email: '[email]' }, 'No name');
  await row(prices.id, 'left_out', { Description: '[Product]', 'Retail Price': '[price]' }, 'No price');
  await row(people.id, 'left_out', {}, null);
  await row(people.id, 'look', { Name: '[Another]' }, 'Looks like the same person');
  await row(people.id, 'in', { Name: '[In]' });

  const { res, body } = await download(shop.cookie);
  assert.equal(res.status, 200, body.toString());
  const files = filesOf(body, t);
  assert.deepEqual(Object.keys(files).sort(), ['Customers.csv', 'Left out from Citrus Lime.csv', 'Sales and refunds.csv', 'Stock.csv', 'Workshop jobs.csv']);
  const csv = files['Left out from Citrus Lime.csv'];
  assert.ok(csv.startsWith('﻿File,Why'), csv.slice(0, 40));
  const rows = rowsOf(csv);
  assert.deepEqual(rows, [
    { File: 'Customers.csv', Why: 'No name', Name: '[Customer name]', Email: '[email]', Description: '', 'Retail Price': '' },
    { File: 'Price list.csv', Why: 'No price', Name: '', Email: '', Description: '[Product]', 'Retail Price': '[price]' },
  ]);

  const count = await staffRequest(server.baseUrl, shop.cookie, '/api/settings/your-data');
  assert.equal(count.status, 200, JSON.stringify(count.body));
  assert.deepEqual(count.body, { leftOut: 2 });
});

test('Left out from Citrus Lime: none left out, no fifth file and a count of 0; staff are refused the count', async () => {
  const count = await staff('/api/settings/your-data');
  assert.equal(count.status, 200, JSON.stringify(count.body));
  assert.deepEqual(count.body, { leftOut: 0 });
  const worker = await staffLogin(owner.shop.id);
  const refused = await staffRequest(server.baseUrl, worker.cookie, '/api/settings/your-data');
  assert.equal(refused.status, 403);
});
