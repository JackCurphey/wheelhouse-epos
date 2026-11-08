// The restock list (openspec/changes/restock-list; rs-restock, rs-restock-customers, rs-hub;
// receiving decision 2, walk-through 3 M1 and M7; Jack's 27 Oct answer 2 and 4 Nov answer 10):
// what's running low, selling fast or waited for by a job, by supplier, with a suggested count;
// downloaded for a supplier's basket or added to an order. The Owner's, until roles.
// Real example data from the drawings: Shimano brake pads B05S-RX, job WH-1042 for Maya Patel.
// Everything else is a bracketed placeholder.

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let jo;
let supplierId;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl, { shopName: '[Other shop]' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = await staffFreshCookie(made.body.loginId);
  await runWithShop(owner.shop.id, async () => {
    supplierId = (await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier]', 'mock_csv', '{}', now())").run()).lastInsertRowid;
  });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const asOwner = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const asJo = (path, options) => staffRequest(server.baseUrl, jo, path, options);
const inShop = (fn, shop = owner.shop) => runWithShop(shop.id, fn);

// A product of its own for each test, so tests don't see each other's.
async function product({ name = '[Product]', supplier = '[Supplier]', stock = 10, low = 3, active = 1, barcode = null, shop = owner.shop } = {}) {
  const sku = `[Supplier code]-${randomUUID().slice(0, 6)}`;
  const id = await inShop(async () => (await prepare(
    'INSERT INTO products (sku, name, category, price, cost, stock_qty, low_stock_threshold, supplier, active, barcode, updated_at) VALUES (?, ?, ?, 28, 12.5, ?, ?, ?, ?, ?, now())'
  ).run(sku, name, 'Parts', stock, low, supplier, active, barcode)).lastInsertRowid, shop);
  return { id, sku, name };
}
// Sales, as the till and online write them: a stock line of type sale or till_sale, so many
// days ago.
async function sold(productId, qty, daysAgo, type = 'sale') {
  await inShop(() => prepare(
    `INSERT INTO stock_movements (product_id, change_qty, type, note, created_at) VALUES (?, ?, ?, '', now() - (? || ' days')::interval)`
  ).run(productId, -qty, type, String(daysAgo)));
}
// An open job with its order's product lines.
async function job({ customer = 'Maya Patel', date = '2026-09-19', ref = `WH-${1000 + Math.floor(Math.random() * 8000)}`, lines = [], booking = 'scheduled', work = 'not_started' } = {}) {
  return inShop(async () => {
    const customerId = (await prepare('INSERT INTO customers (name) VALUES (?)').run(customer)).lastInsertRowid;
    const jobId = (await prepare(
      'INSERT INTO workshop_jobs (title, customer_id, job_date, reference, booking_state, work_state) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('[Job]', customerId, date, ref, booking, work)).lastInsertRowid;
    const docId = (await prepare(
      "INSERT INTO sale_documents (kind, subtotal, discount, total, note, title, workshop_job_id, status, updated_at) VALUES ('order', 0, 0, 0, '', '', ?, 'open', now())"
    ).run(jobId)).lastInsertRowid;
    for (const [productId, qty] of lines) {
      await prepare('INSERT INTO sale_document_items (document_id, product_id, name, unit_price, qty, line_total) VALUES (?, ?, ?, 28, ?, ?)').run(docId, productId, '[Product]', qty, 28 * qty);
    }
    return { id: jobId, ref };
  });
}
const list = async (as = asOwner) => {
  const res = await as('/api/restock');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
};
const lineFor = (body, productId) => body.groups.flatMap((g) => g.lines.map((l) => ({ ...l, group: g }))).find((l) => l.productId === productId);

test('running low: at or under the low-stock level, below zero included; off sale left out', async () => {
  const pads = await product({ name: 'Shimano brake pads', stock: 2, low: 3 });
  const below = await product({ stock: -2, low: 3 });
  const plenty = await product({ stock: 4, low: 3 });
  const noLevel = await product({ stock: 0, low: 0 });
  const offSale = await product({ stock: 1, low: 3, active: 0 });
  const body = await list();
  assert.equal(body.days, 28);
  const p = lineFor(body, pads.id);
  assert.ok(p, 'the pads are on it');
  assert.equal(p.low, true);
  assert.equal(p.stock, 2);
  assert.equal(p.sku, pads.sku);
  assert.equal(p.group.supplier, '[Supplier]');
  assert.equal(p.group.supplierId, supplierId);
  assert.equal(lineFor(body, below.id)?.low, true);
  assert.equal(lineFor(body, plenty.id), undefined);
  assert.equal(lineFor(body, noLevel.id), undefined);
  assert.equal(lineFor(body, offSale.id), undefined);
});

test('selling fast: at least 3 in 28 days and twice the usual over the 24 weeks before', async () => {
  // Low-stock levels of 0, so only selling fast can put them on; 1 in stock, so 28 days' sales
  // like the last need more.
  const fast = await product({ stock: 1, low: 0 });
  await sold(fast.id, 4, 3);
  await sold(fast.id, 2, 10, 'till_sale');
  await sold(fast.id, 6, 60); // 6 in the 24 weeks before: 1 per 28 days
  const steady = await product({ stock: 1, low: 0 });
  await sold(steady.id, 4, 5);
  await sold(steady.id, 24, 90); // 4 per 28 days
  const few = await product({ stock: 1, low: 0 });
  await sold(few.id, 2, 2);
  const old = await product({ stock: 1, low: 0 });
  await sold(old.id, 9, 200); // before both windows
  const body = await list();
  const f = lineFor(body, fast.id);
  assert.ok(f, 'selling fast is on it');
  assert.equal(f.fast, true);
  assert.equal(f.low, false);
  assert.equal(f.sold, 6);
  assert.equal(lineFor(body, steady.id), undefined);
  assert.equal(lineFor(body, few.id), undefined);
  assert.equal(lineFor(body, old.id), undefined);
  const covered = await product({ stock: 40, low: 0 });
  await sold(covered.id, 6, 3);
  assert.equal(lineFor(await list(), covered.id), undefined, 'selling fast, but the stock covers it: nothing to reorder');
});

test('the suggested count: low-stock level, plus 28 days’ sales, less stock and on order; at least 1', async () => {
  const pads = await product({ name: 'Shimano brake pads', stock: 2, low: 3 });
  await sold(pads.id, 4, 7);
  assert.equal(lineFor(await list(), pads.id).suggested, 5);

  const order = await asOwner('/api/purchase-orders', { method: 'POST', body: { supplierId, items: [{ productId: pads.id, qty: 2 }] } });
  assert.equal(order.status, 201, JSON.stringify(order.body));
  assert.equal(lineFor(await list(), pads.id).suggested, 3, 'a draft still to come counts as on order');

  const more = await asOwner(`/api/purchase-orders/${order.body.id}`, { method: 'PUT', body: { items: [{ productId: pads.id, qty: 9 }] } });
  assert.equal(more.status, 200, JSON.stringify(more.body));
  assert.equal(lineFor(await list(), pads.id), undefined, 'ordered enough: off the list');
});

test('For customers: a job’s part there isn’t the stock for, until it’s ordered for that job', async () => {
  const pads = await product({ name: 'Shimano brake pads', stock: 0, low: 0 });
  const maya = await job({ customer: 'Maya Patel', date: '2026-09-19', lines: [[pads.id, 1]] });
  const body = await list();
  const l = lineFor(body, pads.id);
  assert.ok(l, 'the pads are on it for the job');
  assert.equal(l.low, false);
  assert.equal(l.fast, false);
  assert.equal(l.suggested, 0);
  assert.deepEqual(l.jobs, [{ jobId: maya.id, ref: maya.ref, customer: 'Maya Patel', promised: '2026-09-19', qty: 1 }]);

  const added = await asOwner('/api/restock/add-to-order', { method: 'POST', body: { supplierId, lines: [{ productId: pads.id, qty: 1, forJobId: maya.id }] } });
  assert.equal(added.status, 200, JSON.stringify(added.body));
  assert.equal(lineFor(await list(), pads.id), undefined, 'ordered for the job: off the list');
});

test('stock goes to the earlier job first; finished, cancelled and pending jobs don’t count', async () => {
  const part = await product({ stock: 1, low: 0 });
  const later = await job({ customer: '[Customer]', date: '2026-09-25', lines: [[part.id, 1]] });
  await job({ customer: '[Customer 2]', date: '2026-09-20', lines: [[part.id, 1]] });
  await job({ date: '2026-09-18', lines: [[part.id, 3]], work: 'complete' });
  await job({ date: '2026-09-18', lines: [[part.id, 3]], booking: 'cancelled' });
  await job({ date: '2026-09-18', lines: [[part.id, 3]], booking: 'pending' });
  const l = lineFor(await list(), part.id);
  assert.deepEqual(l.jobs.map((j) => [j.jobId, j.qty]), [[later.id, 1]]);
});

test('a job and a low product together: stock the job takes isn’t counted twice', async () => {
  const pads = await product({ stock: 2, low: 3 });
  await job({ lines: [[pads.id, 1]] });
  const l = lineFor(await list(), pads.id);
  // The job takes 1 of the 2; the shop's own is 1; 3 + 0 − 1 = 2. The job isn't short.
  assert.equal(l.suggested, 2);
  assert.deepEqual(l.jobs, []);
});

test('a job’s part already coming on a plain order line isn’t asked for again', async () => {
  const pads = await product({ stock: 0, low: 0 });
  await job({ lines: [[pads.id, 1]] });
  const order = await asOwner('/api/purchase-orders', { method: 'POST', body: { supplierId, items: [{ productId: pads.id, qty: 5 }] } });
  assert.equal(order.status, 201, JSON.stringify(order.body));
  assert.equal(lineFor(await list(), pads.id), undefined, 'the 5 coming cover the job');
});

test('a job waiting for a part taken off sale still shows it', async () => {
  const gone = await product({ stock: 0, low: 3, active: 0 });
  const j = await job({ lines: [[gone.id, 2]] });
  const l = lineFor(await list(), gone.id);
  assert.ok(l, 'still on For customers');
  assert.equal(l.low, false, 'off sale: not low');
  assert.deepEqual(l.jobs.map((x) => [x.jobId, x.qty]), [[j.id, 2]]);
});

test('suppliers matched by name, ignoring capitals and spaces; an unknown name its own group; none under No supplier', async () => {
  const a = await product({ supplier: '  [supplier] ', stock: 0 });
  const b = await product({ supplier: '[Supplier 9]', stock: 0 });
  const c = await product({ supplier: '', stock: 0 });
  const body = await list();
  assert.equal(lineFor(body, a.id).group.supplierId, supplierId);
  assert.equal(lineFor(body, a.id).group.supplier, '[Supplier]');
  assert.equal(lineFor(body, b.id).group.supplierId, null);
  assert.equal(lineFor(body, b.id).group.supplier, '[Supplier 9]');
  assert.equal(lineFor(body, c.id).group.supplier, 'No supplier');
  assert.equal(body.groups.at(-1).supplier, 'No supplier', 'No supplier last');
});

test('the hub’s counts', async () => {
  const body = await list();
  for (const k of ['low', 'fast', 'customers']) assert.ok(Number.isInteger(body.counts[k]), k);
  const lines = body.groups.flatMap((g) => g.lines);
  assert.equal(body.counts.low, lines.filter((l) => l.low).length);
  assert.equal(body.counts.fast, lines.filter((l) => l.fast).length);
  assert.equal(body.counts.customers, lines.filter((l) => l.jobs.length).length);
});

test('Add to an order: makes a draft, then adds to it; a job stays on its line', async () => {
  const sup = await inShop(async () => (await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES (?, 'mock_csv', '{}', now())").run(`[Supplier ${randomUUID().slice(0, 4)}]`)).lastInsertRowid);
  const pads = await product({ name: 'Shimano brake pads', stock: 0 });
  const maya = await job({ lines: [[pads.id, 1]] });
  const first = await asOwner('/api/restock/add-to-order', { method: 'POST', body: { supplierId: sup, lines: [{ productId: pads.id, qty: 1, forJobId: maya.id }, { productId: pads.id, qty: 4 }] } });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const again = await asOwner('/api/restock/add-to-order', { method: 'POST', body: { supplierId: sup, lines: [{ productId: pads.id, qty: 2 }] } });
  assert.equal(again.body.orderId, first.body.orderId, 'the same draft');
  const order = (await asOwner(`/api/purchase-orders/${first.body.orderId}`)).body;
  assert.equal(order.status, 'draft');
  assert.equal(order.supplierId, sup);
  assert.deepEqual(order.items.map((i) => [i.productId, i.qtyOrdered, i.forJob?.ref ?? null]), [[pads.id, 1, maya.ref], [pads.id, 6, null]]);
  assert.equal(order.items[0].forJob.id, maya.id);

  // Editing the draft keeps the job on its line.
  const put = await asOwner(`/api/purchase-orders/${first.body.orderId}`, { method: 'PUT', body: { items: order.items.map((i) => ({ productId: i.productId, qty: i.qtyOrdered + 1 })) } });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.deepEqual(put.body.items.map((i) => [i.qtyOrdered, i.forJob?.ref ?? null]), [[2, maya.ref], [7, null]]);
});

test('Add to an order checks what it’s sent', async () => {
  const pads = await product({ stock: 0 });
  const otherJob = await inShop(async () => (await prepare("INSERT INTO workshop_jobs (title, job_date) VALUES ('[Job]', '2026-09-19')").run()).lastInsertRowid, other.shop);
  const bad = [
    [{ supplierId: 999999, lines: [{ productId: pads.id, qty: 1 }] }, 'Supplier not found'],
    [{ supplierId, lines: [] }, 'Tick something to add'],
    [{ supplierId, lines: [{ productId: pads.id, qty: 0 }] }, 'Each item needs a valid productId and positive qty'],
    [{ supplierId, lines: [{ productId: pads.id, qty: 100001 }] }, 'A line can order at most 100000'],
    [{ supplierId, lines: [{ productId: pads.id, qty: 1, forJobId: otherJob }] }, 'Job not found'],
  ];
  for (const [body, words] of bad) {
    const res = await asOwner('/api/restock/add-to-order', { method: 'POST', body });
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(res.body.error, words);
  }
});

test('the basket file: Supplier code, Quantity, Product, Barcode; a formula-looking name guarded', async () => {
  const pads = await product({ name: 'Shimano brake pads', stock: 0, barcode: '[barcode]' });
  const odd = await product({ name: '=[Product]', stock: 0 });
  const res = await fetch(`${server.baseUrl}/api/restock/download`, {
    method: 'POST',
    headers: { cookie: owner.cookie, 'content-type': 'application/json', origin: server.baseUrl },
    body: JSON.stringify({ supplier: '[Supplier]', lines: [{ productId: pads.id, qty: 5 }, { productId: odd.id, qty: 1 }] }),
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/csv/);
  assert.match(res.headers.get('content-disposition'), /^attachment; filename="restock-supplier-\d{4}-\d{2}-\d{2}\.csv"$/);
  const rows = (await res.text()).replace(/^﻿/, '').trim().split(/\r?\n/);
  assert.equal(rows[0], 'Supplier code,Quantity,Product,Barcode');
  assert.equal(rows[1], `${pads.sku},5,Shimano brake pads,[barcode]`);
  assert.ok(rows[2].startsWith(`${odd.sku},1,'=`), rows[2]);
});

test('new since last opened: counted per person, cleared by seen and by a download', async () => {
  const seen = await asOwner('/api/restock/seen', { method: 'POST', body: {} });
  assert.equal(seen.status, 200, JSON.stringify(seen.body));
  assert.equal((await list()).newCount, 0);
  const a = await product({ stock: 0 });
  const forJob = await product({ stock: 0, low: 0 });
  await job({ lines: [[forJob.id, 1]] });
  const body = await list();
  assert.equal(body.newCount, 2);
  assert.equal(body.newForJobs, 1);
  const res = await fetch(`${server.baseUrl}/api/restock/download`, {
    method: 'POST',
    headers: { cookie: owner.cookie, 'content-type': 'application/json', origin: server.baseUrl },
    body: JSON.stringify({ supplier: '[Supplier]', lines: [{ productId: a.id, qty: 1 }] }),
  });
  assert.equal(res.status, 200);
  await res.text();
  assert.equal((await list()).newCount, 0);
});

test('Today: new on the restock list until it’s opened, and again when something new comes on', async () => {
  const restockNew = async () => {
    const res = await asOwner('/api/needs-attention');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.items.filter((i) => i.kind === 'restock_new');
  };
  await asOwner('/api/restock/seen', { method: 'POST', body: {} });
  assert.deepEqual(await restockNew(), []);
  await product({ stock: 0 });
  const forJob = await product({ stock: 0, low: 0 });
  await job({ lines: [[forJob.id, 1]] });
  assert.deepEqual(await restockNew(), [{ kind: 'restock_new', count: 2, forJobs: 1 }]);
  await asOwner('/api/restock/seen', { method: 'POST', body: {} });
  assert.deepEqual(await restockNew(), []);
  await product({ stock: 1 });
  assert.deepEqual(await restockNew(), [{ kind: 'restock_new', count: 1, forJobs: 0 }]);
});

test('only the Owner: Jo is refused on every route', async () => {
  const pads = await product({ stock: 0 });
  for (const [path, options] of [
    ['/api/restock', undefined],
    ['/api/restock/seen', { method: 'POST', body: {} }],
    ['/api/restock/download', { method: 'POST', body: { supplier: '[Supplier]', lines: [{ productId: pads.id, qty: 1 }] } }],
    ['/api/restock/add-to-order', { method: 'POST', body: { supplierId, lines: [{ productId: pads.id, qty: 1 }] } }],
  ]) {
    const res = await asJo(path, options);
    assert.equal(res.status, 403, path);
    assert.equal(res.body.error, "Only the shop's owner can order stock", path);
  }
});

test('another business’s products, jobs and orders never come into it', async () => {
  const theirs = await product({ stock: 0, shop: other.shop });
  const body = await list();
  assert.equal(lineFor(body, theirs.id), undefined);
  const add = await asOwner('/api/restock/add-to-order', { method: 'POST', body: { supplierId, lines: [{ productId: theirs.id, qty: 1 }] } });
  assert.equal(add.status, 400);
  const theirList = await staffRequest(server.baseUrl, other.cookie, '/api/restock');
  assert.equal(theirList.status, 200);
  assert.equal(theirList.body.groups.flatMap((g) => g.lines).some((l) => l.name === 'Shimano brake pads'), false);
});
