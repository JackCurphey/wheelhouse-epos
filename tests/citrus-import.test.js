// Bringing products and stock across from Citrus Lime, the server
// (openspec/changes/citrus-import-products; Moving from Citrus Lime decisions 2,
// 3 and 9; mv-progress, mv-summary). Every file is made up, laid out by the
// report's real column names (docs/superpowers/specs/2026-10-05-citrus-lime-exports.md).
// Shimano brake pads B05S-RX at £28.00 are the drawings'; the rest is placeholder.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { bringAcrossRound } from '../server/move/bring-across.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { staffLogin } from './helpers/till.js';
import { deleteTestShop } from './helpers/testShop.js';
import { xlsxOf } from './helpers/xlsx.js';

let server;
let owner;
let jo;
before(async () => {
  // The test drives the rounds itself; the server's own timer stays out of the way.
  server = await startLiveServer({ env: { WH_MOVE_TICK_MS: '3600000' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  jo = await staffLogin(owner.shop.id);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options, who = owner) => staffRequest(server.baseUrl, who.cookie, path, options);
const key = () => randomBytes(24).toString('hex');
const send = (file, { name = 'export.xlsx', requestKey = key(), who = owner } = {}) =>
  staff('/api/move/files', { method: 'POST', body: { fileName: name, dataBase64: file.toString('base64'), requestKey } }, who);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const finish = async () => { for (let i = 0; i < 5; i += 1) await bringAcrossRound(); };
const productBy = (sku) => inShop(() => prepare('SELECT * FROM products WHERE sku = ?').get(sku));
const fileIn = async (id) => (await staff('/api/move')).body.files.find((f) => f.id === id);
const whyOf = (fileId) => inShop(() => prepare("SELECT why FROM move_rows WHERE file_id = ? AND state = 'look' ORDER BY id").all(fileId));

const HEAD = ['Store', 'Department', 'Category', 'Supplier', 'Item Lookup Code', 'Description', 'Store Cost', 'Price', 'Tax Rate', 'Min (Reorder Point)', 'Qty On Hand', 'Active'];
let n = 0;
const code = (base = 'B05S-RX') => { n += 1; return `${base}-${n}`; };
const line = (over = {}) => {
  const v = { Store: '[Shop]', Department: 'Drivetrain', Category: 'Derailleurs', Supplier: '[Supplier]', 'Item Lookup Code': code(), Description: 'Shimano brake pads', 'Store Cost': 14, Price: 28, 'Tax Rate': 20, 'Min (Reorder Point)': 2, 'Qty On Hand': 6, Active: 'Yes', ...over };
  return HEAD.map((h) => v[h]);
};
const priceList = (...lines) => xlsxOf([['Price List - Store Level'], HEAD, ...lines]);
const barcodes = (...lines) => xlsxOf([['Alias', 'ILC', 'Description'], ...lines]);

test('a price list under a title is recognised, waits, then its products come across with their figures', async () => {
  const pads = line();
  const sku = pads[4];
  const res = await send(priceList(pads), { name: 'Price List.xlsx' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual({ report: res.body.report, fileName: res.body.fileName, state: res.body.state, rowsTotal: res.body.rowsTotal, rowsIn: res.body.rowsIn }, { report: 'price_list', fileName: 'Price List.xlsx', state: 'bringing', rowsTotal: 1, rowsIn: 0 });
  assert.equal(await productBy(sku), undefined, 'nothing comes across until the background round');

  await finish();
  const p = await productBy(sku);
  assert.deepEqual(
    { name: p.name, category: p.category, price: Number(p.price), cost: Number(p.cost), vat: p.vat_rate_bp, supplier: p.supplier, min: p.low_stock_threshold, qty: p.stock_qty, active: p.active, online: p.show_online },
    { name: 'Shimano brake pads', category: 'Drivetrain › Derailleurs', price: 28, cost: 14, vat: 2000, supplier: '[Supplier]', min: 2, qty: 6, active: 1, online: false }
  );
  const f = await fileIn(res.body.id);
  assert.deepEqual({ state: f.state, rowsIn: f.rowsIn, rowsLook: f.rowsLook, stockIn: f.stockIn }, { state: 'done', rowsIn: 1, rowsLook: 0, stockIn: 1 });
});

test('stock has one history line saying it came from Citrus Lime, under the sender; none for zero', async () => {
  const six = line();
  const none = line({ 'Qty On Hand': 0 });
  const below = line({ 'Qty On Hand': -2 });
  await send(priceList(six, none, below));
  await finish();
  const padsId = (await productBy(six[4])).id;
  const { history } = (await staff(`/api/products/${padsId}`)).body;
  assert.equal(history.length, 1);
  assert.deepEqual({ type: history[0].type, change: history[0].change, note: history[0].note, who: history[0].who }, { type: 'intake', change: 6, note: 'Brought across from Citrus Lime', who: 'Jack Lewis' });
  assert.equal((await staff(`/api/products/${(await productBy(none[4])).id}`)).body.history.length, 0);
  assert.equal((await productBy(below[4])).stock_qty, -2, 'below zero stays, for Today to ask for a count');
});

test('a retried send counts once, and the same key with another file is refused', async () => {
  const requestKey = key();
  const pads = line();
  const file = priceList(pads);
  const first = await send(file, { requestKey });
  const again = await send(file, { requestKey });
  assert.equal(again.status, 201);
  assert.equal(again.body.id, first.body.id);
  assert.equal((await send(priceList(line()), { requestKey })).status, 409);
  await finish();
  assert.equal((await productBy(pads[4])).stock_qty, 6);
});

test('the same file again changes nothing, and what was changed in Wheelhouse stays', async () => {
  const pads = line();
  await send(priceList(pads));
  await finish();
  const p = await productBy(pads[4]);
  const changed = await staff(`/api/products/${p.id}`, { method: 'PUT', body: { name: 'Shimano brake pads', sku: pads[4], price: 30, category: 'Brakes' } });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  const res = await send(priceList(pads));
  await finish();
  const after2 = await productBy(pads[4]);
  assert.deepEqual({ price: Number(after2.price), category: after2.category, qty: after2.stock_qty }, { price: 30, category: 'Brakes', qty: 6 });
  assert.deepEqual({ rowsIn: (await fileIn(res.body.id)).rowsIn, stockIn: (await fileIn(res.body.id)).stockIn }, { rowsIn: 1, stockIn: 0 });
  assert.equal((await staff(`/api/products/${p.id}`)).body.history.length, 1);
});

test('rows that don\'t fit wait with their reason, and the rest come across', async () => {
  const good = line();
  const res = await send(priceList(
    line({ 'Item Lookup Code': null }),
    line({ Description: null }),
    line({ Price: null }),
    line({ Price: 'free' }),
    line({ Price: -1 }),
    line({ 'Store Cost': 'n/a' }),
    line({ 'Tax Rate': 17.5 }),
    line({ 'Qty On Hand': 1.5 }),
    line({ 'Min (Reorder Point)': -1 }),
    line({ Price: 1000000000 }),
    good
  ));
  await finish();
  const f = await fileIn(res.body.id);
  assert.deepEqual({ state: f.state, rowsIn: f.rowsIn, rowsLook: f.rowsLook }, { state: 'done', rowsIn: 1, rowsLook: 10 });
  assert.deepEqual((await whyOf(f.id)).map((r) => r.why), ['No product code', 'No description', 'No price', 'The price isn’t a number Wheelhouse can use', 'The price isn’t a number Wheelhouse can use', 'The cost isn’t a number Wheelhouse can use', 'The VAT rate isn’t 0, 5 or 20%', 'The stock isn’t a whole number', 'The reorder level isn’t a whole number', 'The price isn’t a number Wheelhouse can use']);
  assert.equal((await productBy(good[4])).stock_qty, 6);
});

test('every other figure is taken as Excel keeps it: 20% as 0.2, £ and commas, empty cost and reorder level, off sale', async () => {
  const fraction = line({ 'Tax Rate': 0.2 });
  const words = line({ 'Tax Rate': '5%', Price: '£1,234.50', 'Store Cost': null, 'Min (Reorder Point)': null, Active: 'No', Department: null, Category: null });
  await send(priceList(fraction, words));
  await finish();
  assert.equal((await productBy(fraction[4])).vat_rate_bp, 2000);
  const p = await productBy(words[4]);
  assert.deepEqual({ vat: p.vat_rate_bp, price: Number(p.price), cost: Number(p.cost), min: p.low_stock_threshold, active: p.active, category: p.category }, { vat: 500, price: 1234.5, cost: 0, min: 3, active: 0, category: 'Uncategorised' });
});

test('a second store\'s rows need a look and the first store\'s stock stands', async () => {
  const pads = line();
  const other = [...pads];
  other[0] = '[Shop 2]';
  other[10] = 99;
  const res = await send(priceList(pads, other));
  await finish();
  assert.equal((await productBy(pads[4])).stock_qty, 6);
  assert.deepEqual((await whyOf(res.body.id)).map((r) => r.why), ['Stock at [Shop 2]: one shop’s stock comes across for now']);
});

test('barcodes join their products, whichever file came first', async () => {
  const pads = line();
  const list = await send(barcodes(['4524667000001', pads[4], 'Shimano brake pads']));
  await finish();
  assert.deepEqual((await whyOf(list.body.id)).map((r) => r.why), ['The product isn’t in the products file']);
  await send(priceList(pads));
  await finish();
  assert.equal((await productBy(pads[4])).barcode, '4524667000001');
  const f = await fileIn(list.body.id);
  assert.deepEqual({ state: f.state, rowsIn: f.rowsIn, rowsLook: f.rowsLook }, { state: 'done', rowsIn: 1, rowsLook: 0 });
});

test('a barcode another product has, or a second barcode, needs a look and changes nothing', async () => {
  const a = line();
  const b = line();
  await send(priceList(a, b));
  await finish();
  const res = await send(barcodes(['[Barcode 1]', a[4]], ['[Barcode 1]', a[4]], ['[Barcode 2]', a[4]], ['[Barcode 1]', b[4]], [null, b[4]]));
  await finish();
  assert.equal((await productBy(a[4])).barcode, '[Barcode 1]');
  assert.equal((await productBy(b[4])).barcode, null);
  const f = await fileIn(res.body.id);
  assert.deepEqual({ rowsIn: f.rowsIn, rowsLook: f.rowsLook }, { rowsIn: 2, rowsLook: 3 });
  assert.deepEqual((await whyOf(res.body.id)).map((r) => r.why), ['This product already has a different barcode', 'Another product has this barcode', 'No barcode']);
});

test('a row\'s data is emptied once it\'s in, and only the columns used are ever kept', async () => {
  const head = [...HEAD, 'Item Notes'];
  const res = await send(xlsxOf([head, [...line(), '[Private note]'], [...line({ Price: null }), '[Private note]']]));
  const kept = await inShop(() => prepare('SELECT data FROM move_rows WHERE file_id = ? ORDER BY id').all(res.body.id));
  assert.ok(!JSON.stringify(kept).includes('Private note'));
  await finish();
  const rows = await inShop(() => prepare('SELECT state, data FROM move_rows WHERE file_id = ? ORDER BY id').all(res.body.id));
  assert.deepEqual(rows[0], { state: 'in', data: {} });
  assert.equal(rows[1].state, 'look');
  assert.equal(rows[1].data['Description'], 'Shimano brake pads');
});

test('a restart picks up where it stopped: a batch that fails leaves its rows waiting and nothing half done', async () => {
  const pads = line();
  const res = await send(priceList(pads));
  // A database that fails the whole batch part-way: nothing of the batch stays.
  await assert.rejects(inShop(async () => {
    await prepare('SELECT 1').get();
    const { bringBatch } = await import('../server/move/bring-across.js');
    await bringBatch({ afterRows: () => { throw new Error('stopped here'); } });
  }), /stopped here/);
  assert.equal(await productBy(pads[4]), undefined);
  assert.equal((await inShop(() => prepare('SELECT state FROM move_rows WHERE file_id = ?').get(res.body.id))).state, 'waiting');
  await finish();
  assert.equal((await productBy(pads[4])).stock_qty, 6);
  assert.equal((await staff(`/api/products/${(await productBy(pads[4])).id}`)).body.history.length, 1);
});

test('a row that fails unexpectedly needs a look, and the rest of the file comes across', async () => {
  const odd = line();
  const good = line();
  const res = await send(priceList(odd, good));
  const { bringBatch } = await import('../server/move/bring-across.js');
  await inShop(() => bringBatch({ beforeRow: async (row) => { if (row.data['Item Lookup Code'] === odd[4]) await prepare('SELECT 1/0').get(); } }));
  await finish();
  assert.equal(await productBy(odd[4]), undefined);
  assert.equal((await productBy(good[4])).stock_qty, 6);
  assert.deepEqual((await whyOf(res.body.id)).map((r) => r.why), ['Wheelhouse couldn’t bring this row across']);
});

test('a stray nothing-character in a cell or a file name doesn\'t stop the file', async () => {
  const pads = line({ Description: 'Shimano\u0000 brake pads' });
  const res = await send(priceList(pads), { name: 'a\u0000.xlsx' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  await finish();
  assert.equal((await productBy(pads[4])).name, 'Shimano brake pads');
});

test('a file that can\'t be read is refused and nothing is kept', async () => {
  const before2 = (await staff('/api/move')).body.files.length;
  for (const file of [Buffer.from('hello'), xlsxOf([['Some', 'Other', 'Report'], ['1', '2', '3']]), xlsxOf([['Item Lookup Code', 'Serial Number'], ['B05S-RX', '[Serial]']]), xlsxOf([HEAD])]) {
    const res = await send(file);
    assert.equal(res.status, 422, JSON.stringify(res.body));
    assert.equal(res.body.code, 'cant_read');
  }
  assert.equal((await staff('/api/move')).body.files.length, before2);
});

test('only the Owner can send a file or see how they\'re getting on, and no file name is too long', async () => {
  assert.equal((await staff('/api/move', {}, jo)).status, 403);
  assert.equal((await send(priceList(line()), { who: jo })).status, 403);
  assert.equal((await staffRequest(server.baseUrl, '', '/api/move')).status, 401);
  const long = await send(priceList(line()), { name: `${'a'.repeat(400)}.xlsx` });
  assert.equal(long.status, 201);
  assert.ok(long.body.fileName.length <= 200);
});

test('on the Owner\'s sign-in, with someone else checked in on that computer, it\'s refused', async () => {
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${key().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const theirs = await staffFreshCookie(made.body.loginId);
  const offer = await staffRequest(server.baseUrl, theirs, '/api/your-settings/till-pin/offer', { method: 'POST' });
  assert.equal((await staffRequest(server.baseUrl, theirs, '/api/your-settings/till-pin', { method: 'POST', body: { pin: offer.body.pin } })).status, 200);
  const signIn = await staffFreshCookie(owner.loginId);
  const checkin = await fetch(`${server.baseUrl}/api/till-checkin`, { method: 'POST', headers: { cookie: signIn, 'content-type': 'application/json' }, body: JSON.stringify({ pin: offer.body.pin }) });
  assert.equal(checkin.status, 201);
  const checkedIn = `${signIn}; ${checkin.headers.getSetCookie()[0].split(';')[0]}`;
  assert.equal((await staffRequest(server.baseUrl, checkedIn, '/api/move')).status, 403);
  assert.equal((await staffRequest(server.baseUrl, signIn, '/api/move')).status, 200, 'the Owner alone is fine');
});

test('with the timer running, a sent file comes across by itself, and the next one wakes it', async () => {
  const quick = await startLiveServer({ env: { WH_MOVE_TICK_MS: '100' } });
  const sendAndWait = async () => {
    const pads = line();
    const res = await staffRequest(quick.baseUrl, owner.cookie, '/api/move/files', { method: 'POST', body: { fileName: 'a.xlsx', dataBase64: priceList(pads).toString('base64'), requestKey: key() } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    let product;
    for (let i = 0; i < 300 && !product; i += 1) {
      await new Promise((r) => { setTimeout(r, 100); });
      product = await productBy(pads[4]);
    }
    return product?.stock_qty;
  };
  try {
    assert.equal(await sendAndWait(), 6, 'the look at the start, or the send');
    // The look at the start is over by now, so only the send can wake it.
    await new Promise((r) => { setTimeout(r, 2000); });
    assert.equal(await sendAndWait(), 6, 'the send');
  } finally {
    await quick.stop();
  }
});
