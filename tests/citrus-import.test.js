// Bringing products and stock across from Citrus Lime, the server
// (openspec/changes/citrus-import-products; Moving from Citrus Lime decisions 2,
// 3 and 9; mv-progress, mv-summary). Every file is made up, laid out by the
// report's real column names (docs/superpowers/specs/2026-10-05-citrus-lime-exports.md).
// Shimano brake pads B05S-RX at £28.00 are the drawings'; the rest is placeholder.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { bringBatch, readNextFile } from '../server/move/bring-across.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { staffLogin } from './helpers/till.js';
import { deleteTestShop } from './helpers/testShop.js';
import { xlsxOf, zipOf } from './helpers/xlsx.js';

let server;
let owner;
let jo;
before(async () => {
  // The test drives the rounds itself; the server's own timer stays out of the way.
  // The helper keeps the timer out of the way: these tests drive the reading and the batches.
  server = await startLiveServer();
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
// This shop only: going round every shop in the shared test database takes minutes.
const finish = async () => {
  while (await readNextFile(owner.shop.id));
  while (await inShop(() => bringBatch()));
};
const productBy = (sku) => inShop(() => prepare('SELECT * FROM products WHERE sku = ?').get(sku));
const fileIn = async (id) => (await staff('/api/move')).body.files.find((f) => f.id === id);
const num = (over) => ({ state: 'done', rowsIn: 0, rowsSame: 0, rowsSkipped: 0, rowsLook: 0, stockIn: 0, stockLook: 0, ...over });
const counts = (f) => ({ state: f.state, rowsIn: f.rowsIn, rowsSame: f.rowsSame, rowsSkipped: f.rowsSkipped, rowsLook: f.rowsLook, stockIn: f.stockIn, stockLook: f.stockLook });
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

test('a send only stores the file and replies; then it\'s recognised, under its title, and its products come across with their figures', async () => {
  const pads = line();
  const sku = pads[4];
  const res = await send(priceList(pads), { name: 'Price List.xlsx' });
  assert.equal(res.status, 202, JSON.stringify(res.body));
  assert.deepEqual({ report: res.body.report, fileName: res.body.fileName, state: res.body.state }, { report: null, fileName: 'Price List.xlsx', state: 'reading' });
  assert.equal(await productBy(sku), undefined, 'nothing comes across until the background round');

  await finish();
  const p = await productBy(sku);
  assert.deepEqual(
    { name: p.name, category: p.category, price: Number(p.price), cost: Number(p.cost), vat: p.vat_rate_bp, supplier: p.supplier, min: p.low_stock_threshold, qty: p.stock_qty, active: p.active, online: p.show_online },
    { name: 'Shimano brake pads', category: 'Drivetrain › Derailleurs', price: 28, cost: 14, vat: 2000, supplier: '[Supplier]', min: 2, qty: 6, active: 1, online: false }
  );
  const f = await fileIn(res.body.id);
  assert.equal(f.report, 'price_list');
  assert.deepEqual(counts(f), num({ rowsIn: 1, stockIn: 1 }));
  assert.equal(f.rowsTotal, 1);
  const held = await inShop(() => prepare('SELECT count(*)::int AS n FROM move_file_bytes WHERE file_id = ?').get(f.id));
  assert.equal(held.n, 0, 'the file itself goes once it\'s read');
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
  assert.equal(again.status, 202);
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
  assert.deepEqual(counts(await fileIn(res.body.id)), num({ rowsSame: 1 }), 'left alone isn\'t counted as brought across');
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
  assert.deepEqual(counts(f), num({ rowsIn: 1, rowsLook: 10, stockIn: 1, stockLook: 10 }));
  assert.deepEqual((await whyOf(f.id)).map((r) => r.why), ['No product code', 'No description', 'No price', 'The price isn’t a number Wheelhouse can use', 'The price isn’t a number Wheelhouse can use', 'The cost isn’t a number Wheelhouse can use', 'The VAT rate isn’t 0, 5 or 20%', 'The stock isn’t a whole number', 'The reorder level isn’t a whole number', 'The price isn’t a number Wheelhouse can use']);
  assert.equal((await productBy(good[4])).stock_qty, 6);
});

test('every other figure is taken as Excel keeps it: 20% as 0.2, thousands commas, empty cost and reorder level, off sale', async () => {
  const fraction = line({ 'Tax Rate': 0.2 });
  const words = line({ 'Tax Rate': '5%', Price: '1,234.50', 'Store Cost': null, 'Min (Reorder Point)': null, Active: 'No', Department: null, Category: null });
  await send(priceList(fraction, words));
  await finish();
  assert.equal((await productBy(fraction[4])).vat_rate_bp, 2000);
  const p = await productBy(words[4]);
  assert.deepEqual({ vat: p.vat_rate_bp, price: Number(p.price), cost: Number(p.cost), min: p.low_stock_threshold, active: p.active, category: p.category }, { vat: 500, price: 1234.5, cost: 0, min: 3, active: 0, category: 'Uncategorised' });
});

test('a second store\'s rows need a look and the first store\'s stock stands, and Stock levels knows', async () => {
  const pads = line();
  const other = [...pads];
  other[0] = '[Shop 2]';
  other[10] = 99;
  const res = await send(priceList(pads, other));
  await finish();
  assert.equal((await productBy(pads[4])).stock_qty, 6);
  assert.deepEqual((await whyOf(res.body.id)).map((r) => r.why), ['Stock at [Shop 2]: one shop’s stock comes across for now']);
  assert.deepEqual(counts(await fileIn(res.body.id)), num({ rowsIn: 1, rowsLook: 1, stockIn: 1, stockLook: 1 }));
});

test('a second shop\'s own file is compared with the first shop ever sent: flagged, not mixed in', async () => {
  const theirs = line({ Store: '[Shop 2]', 'Qty On Hand': 40 });
  const res = await send(priceList(theirs));
  await finish();
  assert.equal(await productBy(theirs[4]), undefined);
  assert.deepEqual((await whyOf(res.body.id)).map((r) => r.why), ['Stock at [Shop 2]: one shop’s stock comes across for now']);
  assert.deepEqual(counts(await fileIn(res.body.id)), num({ rowsLook: 1, stockLook: 1 }));
});

test('odd prices aren\'t prices: £, a comma, 12,50, 0x10, 1e3, and commas in the wrong place', async () => {
  const odd = ['£', ',', '12,50', '0x10', '1e3', '£12.50', '1,23,456', '1,2345', ' ', 'Infinity', '.', '-'];
  const lines = odd.map((Price) => line({ Price }));
  const res = await send(priceList(...lines));
  await finish();
  // A cell of only a space reads as empty.
  const whys = (await whyOf(res.body.id)).map((r) => r.why);
  assert.equal(whys.length, odd.length);
  assert.ok(whys.every((w) => w === 'The price isn’t a number Wheelhouse can use' || w === 'No price'), JSON.stringify(whys));
  for (const l of lines) assert.equal(await productBy(l[4]), undefined);
  const stock = line({ 'Qty On Hand': '1e3' });
  const cost = line({ 'Store Cost': '0x10' });
  const rate = line({ 'Tax Rate': '2e1' });
  const fine = line({ Price: '1,234,567.50', 'Qty On Hand': '1,000' });
  const res2 = await send(priceList(stock, cost, rate, fine));
  await finish();
  assert.deepEqual((await whyOf(res2.body.id)).map((r) => r.why), ['The stock isn’t a whole number', 'The cost isn’t a number Wheelhouse can use', 'The VAT rate isn’t 0, 5 or 20%']);
  const p = await productBy(fine[4]);
  assert.deepEqual({ price: Number(p.price), qty: p.stock_qty }, { price: 1234567.5, qty: 1000 });
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
  assert.deepEqual(counts(f), num({ rowsIn: 1 }));
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
  assert.deepEqual(counts(f), num({ rowsIn: 1, rowsSame: 1, rowsLook: 3 }));
  assert.deepEqual((await whyOf(res.body.id)).map((r) => r.why), ['This product already has a different barcode', 'Another product has this barcode', 'No barcode']);
});

test('a row\'s data is emptied once it\'s in, and only the columns used are ever kept', async () => {
  const head = [...HEAD, 'Item Notes'];
  const res = await send(xlsxOf([head, [...line(), '[Private note]'], [...line({ Price: null }), '[Private note]']]));
  await finish();
  const rows = await inShop(() => prepare('SELECT state, data FROM move_rows WHERE file_id = ? ORDER BY id').all(res.body.id));
  assert.deepEqual(rows[0], { state: 'in', data: {} });
  assert.equal(rows[1].state, 'look');
  assert.equal(rows[1].data['Description'], 'Shimano brake pads');
  assert.ok(!JSON.stringify(rows).includes('Private note'));
});

test('a restart picks up where it stopped: a batch that fails leaves its rows waiting and nothing half done', async () => {
  const pads = line();
  const res = await send(priceList(pads));
  await readNextFile(owner.shop.id);
  // A database that fails the whole batch part-way: nothing of the batch stays.
  await assert.rejects(inShop(async () => {
    await prepare('SELECT 1').get();
    await bringBatch({ afterRows: () => { throw new Error('stopped here'); } });
  }), /stopped here/);
  assert.equal(await productBy(pads[4]), undefined);
  assert.equal((await inShop(() => prepare('SELECT state FROM move_rows WHERE file_id = ?').get(res.body.id))).state, 'waiting');
  await finish();
  assert.equal((await productBy(pads[4])).stock_qty, 6);
  assert.equal((await staff(`/api/products/${(await productBy(pads[4])).id}`)).body.history.length, 1);
});

test('a row that fails unexpectedly needs a look, and the rest come across', async () => {
  const odd = line();
  const good = line();
  const res = await send(priceList(odd, good));
  await readNextFile(owner.shop.id);
  await inShop(() => bringBatch({ beforeRow: async (row) => { if (row.data['Item Lookup Code'] === odd[4]) await prepare('SELECT 1/0').get(); } }));
  await finish();
  assert.equal(await productBy(odd[4]), undefined);
  assert.equal((await productBy(good[4])).stock_qty, 6);
  assert.deepEqual((await whyOf(res.body.id)).map((r) => r.why), ['Wheelhouse couldn’t bring this row across']);
  assert.deepEqual(counts(await fileIn(res.body.id)), num({ rowsIn: 1, rowsLook: 1, stockIn: 1, stockLook: 1 }));
});

test('a row caught by a deadlock isn\'t failed: it stays waiting, then comes across', async () => {
  const pads = line();
  const res = await send(priceList(pads));
  await readNextFile(owner.shop.id);
  const deadlock = () => { throw Object.assign(new Error('deadlock'), { code: '40P01' }); };
  await inShop(() => bringBatch({ beforeRow: deadlock }));
  assert.equal((await inShop(() => prepare('SELECT state FROM move_rows WHERE file_id = ?').get(res.body.id))).state, 'waiting');
  await finish();
  assert.equal((await productBy(pads[4])).stock_qty, 6);
});

test('half a character in a file name or a cell doesn\'t stop the file, and a missing one can\'t be read', async () => {
  const half = line({ Description: 'Shimano\ud800 brake pads' });
  const res = await staff('/api/move/files', { method: 'POST', body: { fileName: 'a\ud800.xlsx', dataBase64: priceList(half).toString('base64'), requestKey: key() } });
  assert.equal(res.status, 202, JSON.stringify(res.body));
  await finish();
  assert.equal((await productBy(half[4])).name, 'Shimano\ufffd brake pads');
  const none = zipOf({ 'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>&#x110000;</t></is></c></row></sheetData></worksheet>' });
  const bad = await send(none);
  assert.equal(bad.status, 202);
  await finish();
  assert.equal((await fileIn(bad.body.id)).state, 'cant_read');
});

test('a stray nothing-character in a cell or a file name doesn\'t stop the file', async () => {
  const pads = line({ Description: 'Shimano\u0000 brake pads' });
  const res = await send(priceList(pads), { name: 'a\u0000.xlsx' });
  assert.equal(res.status, 202, JSON.stringify(res.body));
  await finish();
  assert.equal((await productBy(pads[4])).name, 'Shimano brake pads');
});

test('a file that can\'t be read says so, keeps nothing of it, and goes when asked; one that\'s being read can\'t', async () => {
  for (const file of [Buffer.from('hello'), xlsxOf([['Some', 'Other', 'Report'], ['1', '2', '3']]), xlsxOf([['Item Lookup Code', 'Serial Number'], ['B05S-RX', '[Serial]']]), xlsxOf([HEAD])]) {
    const res = await send(file);
    assert.equal(res.status, 202, JSON.stringify(res.body));
    const reading = await staff(`/api/move/files/${res.body.id}`, { method: 'DELETE' });
    assert.equal(reading.status, 404, 'still being read');
    await finish();
    const f = await fileIn(res.body.id);
    assert.equal(f.state, 'cant_read');
    assert.equal(f.report, null);
    const kept = await inShop(() => prepare('SELECT (SELECT count(*)::int FROM move_rows WHERE file_id = ?) AS rows, (SELECT count(*)::int FROM move_file_bytes WHERE file_id = ?) AS bytes').get(f.id, f.id));
    assert.deepEqual(kept, { rows: 0, bytes: 0 });
    assert.equal((await staff(`/api/move/files/${f.id}`, { method: 'DELETE' })).status, 200);
    assert.equal(await fileIn(f.id), undefined);
  }
  const brought = await send(priceList(line()));
  await finish();
  assert.equal((await staff(`/api/move/files/${brought.body.id}`, { method: 'DELETE' })).status, 404, 'one that came across stays');
});

test('a send that\'s too big is refused at once, and a shop can\'t queue without limit', async () => {
  const big = await send(Buffer.alloc(31 * 1024 * 1024, 1));
  assert.equal(big.status, 422);
  assert.equal(big.body.code, 'cant_read');
  const sent = [];
  for (let i = 0; i < 12; i += 1) sent.push(await send(Buffer.from('hello')));
  assert.ok(sent.slice(0, 10).every((r) => r.status === 202), JSON.stringify(sent.map((r) => r.status)));
  assert.equal(sent[11].status, 429);
  assert.equal(sent[11].body.code, 'busy');
  await finish();
});

test('only the Owner can send a file or see how they\'re getting on, and no file name is too long', async () => {
  assert.equal((await staff('/api/move', {}, jo)).status, 403);
  assert.equal((await send(priceList(line()), { who: jo })).status, 403);
  assert.equal((await staffRequest(server.baseUrl, '', '/api/move')).status, 401);
  const long = await send(priceList(line()), { name: `${'a'.repeat(400)}.xlsx` });
  assert.equal(long.status, 202);
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
    assert.equal(res.status, 202, JSON.stringify(res.body));
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

// An upload that has sent its headers and part of its body, then goes quiet.
function stalledUpload(who) {
  const url = new URL('/api/move/files', server.baseUrl);
  const req = httpRequest({ host: url.hostname, port: url.port, path: url.pathname, method: 'POST', headers: { cookie: who.cookie, 'content-type': 'application/json', 'content-length': 1_000_000 } });
  const ended = new Promise((resolve) => { req.on('error', resolve); req.on('close', resolve); });
  req.write('{"fileName":"a.xlsx",');
  return { stop: async () => { req.destroy(); await ended; } };
}
const pause = (ms) => new Promise((r) => { setTimeout(r, ms); });

test('a stalled upload at one shop doesn\'t turn away another shop; at its own shop it does, until it ends', async () => {
  const other = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  try {
    const stalled = stalledUpload(owner);
    await pause(300);
    const theirs = await staffRequest(server.baseUrl, other.cookie, '/api/move/files', { method: 'POST', body: { fileName: 'a.xlsx', dataBase64: priceList(line()).toString('base64'), requestKey: key() } });
    assert.equal(theirs.status, 202, JSON.stringify(theirs.body));
    const mine = await send(priceList(line()));
    assert.equal(mine.status, 429, 'one at a time at a shop');
    assert.equal(mine.body.code, 'busy');
    await stalled.stop();
    await pause(200);
    assert.equal((await send(Buffer.from('hello'))).status, 202, 'free again once it ends');
    await finish();
  } finally {
    await deleteTestShop(other.shop.id);
  }
});

test('storing a very large file never holds the move files for long, so a deletion waiting on them isn\'t turned away', async () => {
  const rows = ['Alias,ILC'];
  for (let i = 0; i < 100_000; i += 1) rows.push(`[Barcode ${i}],[Code ${i}]`);
  const res = await send(Buffer.from(`${rows.join('\n')}\n`), { name: 'big.csv' });
  assert.equal(res.status, 202);
  let stored = false;
  const storing = readNextFile(owner.shop.id).then(() => { stored = true; });
  const client = await pool.connect();
  let probes = 0;
  try {
    while (!stored) {
      // What a deletion does: the move files, in order, waiting at most 0.8 seconds.
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
      await client.query("SET LOCAL lock_timeout = '800ms'");
      await client.query('SELECT id FROM move_files ORDER BY id FOR UPDATE');
      await client.query('COMMIT');
      probes += 1;
      await pause(20);
    }
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
  await storing;
  assert.ok(probes > 3, `the lock was tried while it stored: ${probes}`);
  const f = await fileIn(res.body.id);
  assert.deepEqual({ state: f.state, rowsTotal: f.rowsTotal }, { state: 'bringing', rowsTotal: 100_000 });
  // These rows find no product: leave none waiting for the other tests.
  await inShop(() => prepare("UPDATE move_rows SET state = 'look', why = 'x' WHERE file_id = ?").run(f.id));
  await inShop(() => prepare("UPDATE move_files SET state = 'done' WHERE id = ?").run(f.id));
});

test('stopped part-way through storing, it starts again with no row twice', async () => {
  const pads = line();
  const res = await send(priceList(pads, line(), line()));
  await assert.rejects(readNextFile(owner.shop.id, { afterChunk: () => { throw new Error('stopped here'); } }), /stopped here/);
  const f = await fileIn(res.body.id);
  assert.equal(f.state, 'reading', 'still to be read');
  assert.equal(f.report, null);
  await finish();
  const after2 = await fileIn(res.body.id);
  assert.deepEqual({ state: after2.state, rowsTotal: after2.rowsTotal, rowsIn: after2.rowsIn }, { state: 'done', rowsTotal: 3, rowsIn: 3 });
  const held = await inShop(() => prepare('SELECT (SELECT count(*)::int FROM move_rows WHERE file_id = ?) AS rows, (SELECT count(*)::int FROM move_file_bytes WHERE file_id = ?) AS bytes').get(f.id, f.id));
  assert.deepEqual(held, { rows: 3, bytes: 0 });
});

test('a test server doesn\'t pick up files by itself unless it\'s asked to', async () => {
  const res = await send(priceList(line()));
  await pause(3000);
  assert.equal((await fileIn(res.body.id)).state, 'reading');
  await finish();
});
