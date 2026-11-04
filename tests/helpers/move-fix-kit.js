// What the Fix and Ask us to help tests share (openspec/changes/citrus-import-fix):
// one server and shop for the file, made-up files, and the routes. Every file is made
// up. Brake pads and Maya are the drawings'; the rest is placeholder. The server's
// clock is pinned to 1 Sep 2026.
import { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import '../../server/load-env.js';
import { pool, runWithShop, prepare } from '../../server/db.js';
import { bringBatch, readNextFile } from '../../server/move/bring-across.js';
import { deleteCustomerDetails } from '../../server/privacy-requests.js';
import { startLiveServer } from './liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './staff.js';
import { deleteTestShop } from './testShop.js';
import { xlsxOf } from './xlsx.js';

export { bringBatch, readNextFile, prepare, staffRequest, staffSignup, staffFreshCookie, deleteTestShop };

export let server;
export let owner;
before(async () => {
  server = await startLiveServer({ env: { WH_MOVE_TICK_MS: '3600000', TRUST_PROXY: '1' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
});
after(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
    await pool.end();
  }
});

export const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
export const key = () => randomBytes(24).toString('hex');
export const send = (file) => staff('/api/move/files', { method: 'POST', body: { fileName: 'export.xlsx', dataBase64: file.toString('base64'), requestKey: key() } });
export const inShop = (fn) => runWithShop(owner.shop.id, fn);
// With a limit, so a fault that keeps rows going round fails here instead of hanging.
export const finish = async () => {
  const stopAt = Date.now() + 20_000;
  const inTime = () => assert.ok(Date.now() < stopAt, 'it never finished: rows are going round');
  while (await readNextFile(owner.shop.id)) inTime();
  while (await inShop(() => bringBatch())) inTime();
};
export const bring = async (file) => {
  const res = await send(file);
  assert.equal(res.status, 202, JSON.stringify(res.body));
  await finish();
  return res.body.id;
};
export const fileIn = async (id) => (await staff('/api/move')).body.files.find((f) => f.id === id);
export const rowsOf = (fileId) => inShop(() => prepare('SELECT * FROM move_rows WHERE file_id = ? ORDER BY id').all(fileId));
export const looks = async () => (await staff('/api/move/look')).body.rows;
export const lookIn = async (fileId) => {
  const ids = new Set((await rowsOf(fileId)).map((r) => r.id));
  return (await looks()).filter((r) => ids.has(r.id));
};
export const oneLook = async (fileId) => {
  const rows = await lookIn(fileId);
  assert.equal(rows.length, 1, JSON.stringify(rows));
  return rows[0];
};
export const fix = (row, fields = {}, { decided, requestKey = key(), seen = row.seen } = {}) => staff(`/api/move/rows/${row.id}/fix`, {
  method: 'POST', body: { seen, fields: { ...row.fields, ...fields }, ...(decided ? { decided } : {}), requestKey },
});
export const leaveOut = (row, { requestKey = key(), seen = row.seen } = {}) => staff(`/api/move/rows/${row.id}/leave-out`, { method: 'POST', body: { seen, requestKey } });
// Every row is in exactly one state, so what the file says can be checked against the rows.
export async function countsRight(fileId) {
  const f = await fileIn(fileId);
  const rows = await rowsOf(fileId);
  const of = (state) => rows.filter((r) => r.state === state).length;
  assert.deepEqual(
    { total: f.rowsTotal, in: f.rowsIn, same: f.rowsSame, skipped: f.rowsSkipped, look: f.rowsLook, leftOut: f.rowsLeftOut },
    { total: rows.length, in: of('in'), same: of('same'), skipped: of('skipped'), look: of('look'), leftOut: of('left_out') }
  );
  return f;
}

export const PRICE_HEAD = ['Store', 'Department', 'Supplier', 'Item Lookup Code', 'Description', 'Store Cost', 'Price', 'Tax Rate', 'Qty On Hand'];
export const code = () => `B05S-${key().slice(0, 8)}`;
export const priceList = (...rows) => xlsxOf([['Price List - Store Level'], PRICE_HEAD, ...rows.map((r) => PRICE_HEAD.map((h) => r[h] ?? null))]);
export const pads = (over = {}) => ({ Store: '[Shop]', Department: 'Brakes', Supplier: '[Supplier]', 'Item Lookup Code': code(), Description: 'Shimano brake pads', 'Store Cost': 14, Price: 28, 'Tax Rate': 20, 'Qty On Hand': 6, ...over });
export const barcodes = (...rows) => xlsxOf([['ILC', 'Alias', 'Description'], ...rows.map((r) => [r.ILC, r.Alias, r.Description ?? null])]);
export const CUSTOMER_HEAD = ['Account Number', 'Total Sales', 'First Name', 'Last Name', 'Address', 'Address 2', 'City', 'County', 'Postcode', 'Country', 'Email', 'Phone', 'GDPR Consent', 'GDPR Consent Date'];
let n = 0;
export const newPhone = () => { n += 1; return `07700 9${String(n).padStart(5, '0')}`; };
export const person = (over = {}) => {
  n += 1;
  const v = { 'Account Number': `A${n}-${key().slice(0, 6)}`, 'Total Sales': 99, 'First Name': 'Maya', 'Last Name': `Person${n}x${key().slice(0, 4)}`, Address: '[Address]', City: '[City]', Postcode: '[Postcode]', Email: `maya${n}.${key().slice(0, 6)}@example.test`, Phone: newPhone(), 'GDPR Consent': 'No', ...over };
  return { v, row: CUSTOMER_HEAD.map((h) => v[h] ?? null), name: `${v['First Name']} ${v['Last Name']}` };
};
export const customers = (...people) => xlsxOf([['Top Customers'], CUSTOMER_HEAD, ...people.map((p) => p.row)]);
export const BIKE_HEAD = ['Description', 'Serial Number', 'Date Created', 'Customer Name', 'Email Address', 'Mobile Number', 'Phone Number'];
export const bikes = (...rows) => xlsxOf([BIKE_HEAD, ...rows.map((r) => BIKE_HEAD.map((h) => r[h] ?? null))]);
export const byAccount = (account) => inShop(() => prepare('SELECT * FROM customers WHERE citrus_account = ?').get(account));
export const bySku = (sku) => inShop(() => prepare('SELECT * FROM products WHERE sku = ?').get(sku));
export const customersWith = (email) => inShop(() => prepare('SELECT * FROM customers WHERE lower(email) = lower(?)').all(email));
export const historyOf = (productId) => inShop(() => prepare('SELECT change_qty, note, login_id FROM stock_movements WHERE product_id = ? ORDER BY id').all(productId));

export async function deleted(customerId) {
  return inShop(async () => {
    const req = (await prepare("SELECT id FROM privacy_requests WHERE customer_id = ? AND kind = 'delete' AND done_at IS NULL").get(customerId))
      ?? (await prepare("INSERT INTO privacy_requests (customer_id, kind, source) VALUES (?, 'delete', 'shop') RETURNING id").get(customerId));
    return deleteCustomerDetails(req.id);
  });
}
// A customer who came across, then had their details deleted, with what they were.
export async function aDeletedCustomer(over = {}) {
  const p = person(over);
  await bring(customers(p));
  const c = await byAccount(p.v['Account Number']);
  await deleted(c.id);
  return { p, id: c.id };
}
// A row needing a look because it shares a deleted customer's email.
export async function aSharedRow(over = {}) {
  const gone = await aDeletedCustomer();
  const son = person({ Email: gone.p.v.Email, ...over });
  const fileId = await bring(customers(son));
  return { gone, son, fileId, row: await oneLook(fileId) };
}

// A browser of its own, signed in as the Owner, keeping the cookies it's given.
export const browser = () => {
  const jar = new Map();
  let own = null;
  const sendIt = async (path, { method = 'GET', body } = {}, loginId = owner.loginId) => {
    own ??= await staffFreshCookie(loginId);
    const cookie = [own, ...[...jar].filter(([, v]) => v).map(([k, v]) => `${k}=${v}`)].join('; ');
    const res = await fetch(`${server.baseUrl}${path}`, { method, headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const at = pair.indexOf('=');
      jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return { send: sendIt, post: (path, b) => sendIt(path, { method: 'POST', body: b }) };
};
let site;
export const aSite = async () => { site ??= (await staff('/api/sites', { method: 'POST', body: { name: 'Bolton', code: 'B' } })).body; return site; };
export const body = (row, extra = {}) => ({ seen: row.seen, fields: row.fields, requestKey: key(), ...extra });
