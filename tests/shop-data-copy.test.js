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
import { staffLogin } from './helpers/till.js';
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

test('Customers: a deleted and a merged-away customer have no row; the kept record carries what was merged in', async (t) => {
  const gone = (await staff('/api/customers', { method: 'POST', body: { name: 'Deleted Person' } })).body;
  const kept = (await staff('/api/customers', { method: 'POST', body: { name: 'Kept Record' } })).body;
  const away = (await staff('/api/customers', { method: 'POST', body: { name: 'Merged Away' } })).body;
  await inShop(async () => {
    await prepare("UPDATE customers SET deleted_at = now(), name = '' WHERE id = ?").run(gone.id);
    await prepare('UPDATE customers SET merged_into_id = ? WHERE id = ?').run(kept.id, away.id);
    await prepare("INSERT INTO store_credit_entries (customer_id, change_pence, kind) VALUES (?, 500, 'added')").run(away.id);
  });
  const rows = rowsOf((await filesFor(t))['Customers.csv']);
  assert.equal(rows.filter((r) => r.Name === 'Merged Away').length, 0);
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

test('Sales and refunds and Workshop jobs come with their header rows', async (t) => {
  const files = await filesFor(t);
  for (const name of ['Sales and refunds.csv', 'Workshop jobs.csv']) {
    const lines = files[name].replace(/^﻿/, '').split('\r\n').filter(Boolean);
    assert.ok(lines.length >= 1, `${name} has a header row`);
  }
});
