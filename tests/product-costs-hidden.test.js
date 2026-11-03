// Staff aren't sent what the shop pays for stock, and hiding a cost never
// overwrites it (openspec/changes/product-costs-hidden; Reports and accounts
// decisions 5 and 9; stock decision 11). Every reply is read as text and looked
// through for the cost, so a figure under any name counts. The cost is a number
// only this test needs, chosen so it can't turn up by chance.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { buildSnapshot } from '../server/till/snapshot.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

const COST = 71823.57;
const SHOWS_COST = /7182357|71823\.57/;

let server;
let owner;
let jo;
before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  owner.site = (await staffRequest(server.baseUrl, owner.cookie, '/api/sites', { method: 'POST', body: { name: 'Bolton', code: 'B' } })).body;
  owner.pin = await withPin(owner.cookie);
  owner.supplierId = await inShop(async () => (await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier]', 'mock_csv', '{}', now())").run()).lastInsertRowid);
  await inShop(() => prepare('UPDATE shops SET stock_adjust_today_over_pence = 1 WHERE id = ?').run(owner.shop.id));
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const cookie = await staffFreshCookie(made.body.loginId);
  jo = { cookie, pin: await withPin(cookie) };
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

function inShop(fn) { return runWithShop(owner.shop.id, fn); }
async function withPin(cookie) {
  const offer = await staffRequest(server.baseUrl, cookie, '/api/your-settings/till-pin/offer', { method: 'POST' });
  assert.equal((await staffRequest(server.baseUrl, cookie, '/api/your-settings/till-pin', { method: 'POST', body: { pin: offer.body.pin } })).status, 200);
  return offer.body.pin;
}

// A browser of its own, signed in as someone, keeping the cookies it's given.
function browser(signIn) {
  const jar = new Map();
  return async function send(path, { method = 'GET', body } = {}) {
    const cookie = [signIn, ...[...jar].filter(([, v]) => v).map(([k, v]) => `${k}=${v}`)].join('; ');
    const res = await fetch(`${server.baseUrl}${path}`, {
      method, headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const at = pair.indexOf('=');
      jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* the download is a spreadsheet */ }
    return { status: res.status, text, body: json };
  };
}
const POST = (body = {}) => ({ method: 'POST', body });
const PUT = (body) => ({ method: 'PUT', body });

let tills = 0;
async function ownersComputer(kind, checkInPin) {
  const send = browser(await staffFreshCookie(owner.loginId));
  tills += 1;
  const made = kind === 'till'
    ? await send('/api/till-setup', POST({ siteId: owner.site.id, number: tills }))
    : await send('/api/till-setup/workshop', POST({ siteId: owner.site.id, name: `[Bench ${tills}]` }));
  assert.equal(made.status, 201, made.text);
  if (checkInPin) assert.equal((await send('/api/till-checkin', POST({ pin: checkInPin }))).status, 201);
  return send;
}

// Who's at the computer, and whether they're told.
const PEOPLE = [
  ['the Owner on their own computer', true, async () => browser(owner.cookie)],
  ['the Owner, checked in at their till', true, () => ownersComputer('till', owner.pin)],
  ['the Owner, checked in on a workshop computer', true, () => ownersComputer('workshop', owner.pin)],
  ['Jo Taylor, signed in as herself', false, async () => browser(jo.cookie)],
  ['the Owner’s till with nobody checked in', false, () => ownersComputer('till')],
  ['the Owner’s till with Jo Taylor checked in', false, () => ownersComputer('till', jo.pin)],
  ['a workshop computer with nobody checked in', false, () => ownersComputer('workshop')],
  ['a workshop computer with Jo Taylor checked in', false, () => ownersComputer('workshop', jo.pin)],
];

let n = 0;
const product = ({ cost = COST, stock = 0 } = {}) => inShop(async () => {
  n += 1;
  return (await prepare('INSERT INTO products (sku, name, category, price, cost, stock_qty, low_stock_threshold, description, updated_at) VALUES (?, ?, ?, 28, ?, ?, 3, ?, now())')
    .run(`B05S-RX-${n}`, `Shimano brake pads ${n}`, 'Brakes', cost, stock, '')).lastInsertRowid;
});
const costOf = (id) => inShop(async () => (await prepare('SELECT cost FROM products WHERE id = ?').get(id)).cost);
const linesOf = (orderId) => inShop(() => prepare('SELECT product_id, unit_cost FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id').all(orderId));
const ordersCount = () => inShop(async () => (await prepare('SELECT count(*)::int AS n FROM purchase_orders').get()).n);
const catalogueItem = () => inShop(async () => {
  n += 1;
  return (await prepare("INSERT INTO supplier_catalogue_items (supplier_id, supplier_sku, name, price, stock_qty, status) VALUES (?, ?, ?, ?, 0, 'new')")
    .run(owner.supplierId, `[Supplier code ${n}]`, `[Catalogue item ${n}]`, COST)).lastInsertRowid;
});
const asOwner = () => browser(owner.cookie);

// A count of one product, one under what's expected, so its value at cost is the cost.
async function countOneUnder() {
  const send = asOwner();
  const id = await product({ stock: 2 });
  n += 1;
  const started = await send('/api/stock-takes', POST({ kind: 'area', target: `[Area ${n}]` }));
  assert.equal(started.status, 201, started.text);
  assert.equal((await send(`/api/stock-takes/${started.body.id}/join`, POST())).status, 200);
  const counted = await send(`/api/stock-takes/${started.body.id}/counts`, POST({ productId: id, qty: 1 }));
  assert.equal(counted.status, 200, counted.text);
  return started.body.id;
}

function says(sees, reply, what) {
  assert.equal(SHOWS_COST.test(reply.text), sees, `${what} (${reply.status}): ${reply.text.slice(0, 300)}`);
}
// A refusal tells nobody anything, so it says nothing about the rule.
function saysOrRefuses(sees, reply, what) {
  if (reply.status === 403) return;
  says(sees, reply, what);
}
const answered = (reply, what) => assert.ok(reply.status < 300, `${what} (${reply.status}): ${reply.text.slice(0, 300)}`);

for (const [who, sees, computer] of PEOPLE) {
  test(`reading: ${who} ${sees ? 'is' : 'isn’t'} sent a product’s cost`, async () => {
    const id = await product({ stock: 1 });
    const send = await computer();
    says(sees, await send('/api/products'), 'the list');
    says(sees, await send(`/api/products?search=${encodeURIComponent('Shimano')}`), 'search');
    says(sees, await send('/api/products?all=1'), 'the list with inactive products');
    says(sees, await send(`/api/products/${id}`), 'a product’s page');
    says(sees, await send('/api/dashboard'), 'the dashboard’s low stock');
    await catalogueItem();
    says(sees, await send('/api/catalogue-items'), 'a supplier’s catalogue');
  });

  test(`writing: what ${who} is answered with follows the same rule`, async () => {
    const send = await computer();
    const id = await product({ stock: 1 });
    const saved = await send(`/api/products/${id}`, PUT({ description: '[Description]' }));
    answered(saved, 'a save');
    says(sees, saved, 'a save');
    const adjusted = await send(`/api/products/${id}/stock`, POST({ change: 1, type: 'adjustment', reason: 'found' }));
    answered(adjusted, 'an adjustment');
    says(sees, adjusted, 'an adjustment');
    const imported = await send(`/api/catalogue-items/${await catalogueItem()}/import`, POST({ price: 28, category: 'Brakes' }));
    answered(imported, 'an import');
    says(sees, imported, 'an import');
    assert.equal(await costOf(imported.body.id), COST, 'the supplier’s price is still the cost');
  });

  test(`a count: ${who} ${sees ? 'is' : 'isn’t'} sent its value at cost`, async () => {
    const take = await countOneUnder();
    const send = await computer();
    const check = await send(`/api/stock-takes/${take}/check`);
    saysOrRefuses(sees, check, 'its check');
    const download = await send(`/api/stock-takes/${take}/download`);
    saysOrRefuses(sees, download, 'its download');
    if (check.status < 300) {
      assert.equal(check.body.productsDiffering, 1, 'the rest of the check stays');
      assert.equal(check.body.rows[0].difference, -1);
      assert.equal(download.status, 200);
      assert.ok(download.text.includes('Shimano brake pads'), download.text);
      assert.equal(download.text.includes('At cost'), sees, download.text);
    }
    const applied = await send(`/api/stock-takes/${take}/apply`, POST());
    saysOrRefuses(sees, applied, 'what Apply answers');
    if (applied.status >= 300) assert.equal((await asOwner()(`/api/stock-takes/${take}/apply`, POST())).status, 200);
    says(sees, await send('/api/stock-takes'), 'Finished counts');
    saysOrRefuses(sees, await send(`/api/stock-takes/${take}/check`), 'an applied count’s check');
    // Undone, and its value gone with it, so the next person's hub starts clean.
    assert.equal((await asOwner()(`/api/stock-takes/${take}/undo`, POST())).status, 200);
  });

  test(`Today: ${who} ${sees ? 'is' : 'isn’t'} sent a big adjustment’s value at cost`, async () => {
    const id = await product({ stock: 1 });
    const adjusted = await asOwner()(`/api/products/${id}/stock`, POST({ change: 1, type: 'adjustment', reason: 'found' }));
    assert.equal(adjusted.status, 200, adjusted.text);
    const send = await computer();
    const today = await send('/api/needs-attention');
    saysOrRefuses(sees, today, 'Needs attention');
    if (today.status < 300) {
      const line = today.body.items.find((i) => i.kind === 'stock_adjusted' && i.productId === id);
      assert.ok(line, 'the line still shows');
      assert.equal(line.change, 1);
    }
    await inShop(() => prepare('UPDATE stock_movements SET seen_at = now() WHERE product_id = ?').run(id));
  });

  test(`a save: ${who} ${sees ? 'can change' : 'can’t change'} a cost, and nobody’s save without one touches it`, async () => {
    const id = await product();
    const send = await computer();
    for (const without of [{}, { cost: null }, { cost: '' }, { cost: '   ' }, { cost: 'none' }]) {
      const saved = await send(`/api/products/${id}`, PUT({ description: '[Description]', ...without }));
      answered(saved, JSON.stringify(without));
      assert.equal(await costOf(id), COST, `saved with ${JSON.stringify(without)}`);
    }
    const { description } = await inShop(() => prepare('SELECT description FROM products WHERE id = ?').get(id));
    assert.equal(description, '[Description]', 'the save itself went through');
    assert.equal((await send(`/api/products/${id}`, PUT({ cost: 5 }))).status, 200);
    assert.equal(await costOf(id), sees ? 5 : COST, 'a new figure');
    assert.equal((await send(`/api/products/${id}`, PUT({ cost: 0 }))).status, 200);
    assert.equal(await costOf(id), sees ? 0 : COST, 'a figure of nothing');
  });

  test(`adding a product: ${who}’s starts with ${sees ? 'the cost typed' : 'none, whatever is sent'}`, async () => {
    const send = await computer();
    n += 1;
    const made = await send('/api/products', POST({ name: '[Product]', sku: `[Code ${n}]`, category: 'Brakes', price: 28, cost: COST }));
    assert.equal(made.status, 201, made.text);
    says(sees, made, 'the reply');
    assert.equal(await costOf(made.body.id), sees ? COST : 0);
  });
}

test('the till’s own snapshot, kept on the till for selling offline, has no cost', async () => {
  await product();
  const snapshot = await inShop(() => buildSnapshot({ id: 0, code: 'B1', name: '[Till]', site_id: owner.site.id }));
  assert.ok(snapshot.products.length > 0);
  assert.ok(!SHOWS_COST.test(JSON.stringify(snapshot)));
  assert.ok(snapshot.products.every((p) => !('cost' in p)));
});

// ---- A new order ----

const order = (send, items, extra = {}) => send('/api/purchase-orders', POST({ supplierId: owner.supplierId, items, ...extra }));

for (const [who, computer] of [
  ['the Owner’s till with Jo Taylor checked in', () => ownersComputer('till', jo.pin)],
  ['the Owner’s till with nobody checked in', () => ownersComputer('till')],
]) {
  for (const [sent, line] of [['0', { unitCost: 0 }], ['nothing', {}], ['null', { unitCost: null }], ['a figure', { unitCost: 3 }], ['nonsense', { unitCost: 'none' }]]) {
    test(`a new order at ${who}, sending ${sent} as the cost: the line holds the product’s cost, not £0`, async () => {
      const id = await product();
      const send = await computer();
      const made = await order(send, [{ productId: id, qty: 2, ...line }]);
      assert.equal(made.status, 201, made.text);
      assert.ok(!SHOWS_COST.test(made.text), made.text);
      assert.ok(!('unitCost' in made.body.items[0]));
      assert.deepEqual((await linesOf(made.body.id)).map((l) => l.unit_cost), [COST]);
      assert.equal(await costOf(id), COST, 'the product’s own cost is untouched');
    });
  }

  test(`changing a draft at ${who} keeps the cost its line already had`, async () => {
    const id = await product();
    const added = await product({ cost: 2.5 });
    const made = await order(asOwner(), [{ productId: id, qty: 1, unitCost: 19.99 }]);
    assert.equal(made.status, 201, made.text);
    const send = await computer();
    const saved = await send(`/api/purchase-orders/${made.body.id}`, PUT({ items: [{ productId: id, qty: 3, unitCost: 0 }, { productId: added, qty: 1 }] }));
    assert.equal(saved.status, 200, saved.text);
    assert.deepEqual((await linesOf(made.body.id)).map((l) => [l.product_id, l.unit_cost]), [[id, 19.99], [added, 2.5]]);
  });

  test(`a line with no cost at ${who}: it saves as a draft, and can’t be marked as ordered`, async () => {
    const id = await product({ cost: 0 });
    const send = await computer();
    const already = await ordersCount();
    const refused = await order(send, [{ productId: id, qty: 1 }], { markOrdered: true });
    assert.equal(refused.status, 400, refused.text);
    assert.match(refused.body.error, /no cost/i);
    assert.equal(await ordersCount(), already, 'nothing was written');
    const draft = await order(send, [{ productId: id, qty: 1 }]);
    assert.equal(draft.status, 201, draft.text);
    assert.equal(draft.body.status, 'draft');
    const marked = await send(`/api/purchase-orders/${draft.body.id}/mark-ordered`, POST());
    assert.equal(marked.status, 400, marked.text);
    assert.match(marked.body.error, /no cost/i);
    const { status } = await inShop(() => prepare('SELECT status FROM purchase_orders WHERE id = ?').get(draft.body.id));
    assert.equal(status, 'draft');
  });

  test(`a line with a cost at ${who} can be marked as ordered, at that cost`, async () => {
    const id = await product();
    const made = await order(await computer(), [{ productId: id, qty: 1 }], { markOrdered: true });
    assert.equal(made.status, 201, made.text);
    assert.equal(made.body.status, 'ordered');
    assert.deepEqual((await linesOf(made.body.id)).map((l) => l.unit_cost), [COST]);
  });
}

for (const [who, computer] of [
  ['Jo Taylor, signed in as herself', async () => browser(jo.cookie)],
  ['a workshop computer with nobody checked in', () => ownersComputer('workshop')],
]) {
  test(`${who} can’t order stock at all: nothing is written`, async () => {
    const id = await product();
    const send = await computer();
    const already = await ordersCount();
    const refused = await order(send, [{ productId: id, qty: 1, unitCost: 0 }]);
    assert.equal(refused.status, 403, refused.text);
    assert.equal(await ordersCount(), already);
  });
}

test('the Owner’s order: a cost typed is kept; none sent is the product’s; £0 sent on purpose is £0', async () => {
  const id = await product();
  const send = asOwner();
  const typed = await order(send, [{ productId: id, qty: 1, unitCost: 19.99 }]);
  assert.equal(typed.status, 201, typed.text);
  assert.equal(typed.body.items[0].unitCost, 19.99);
  assert.deepEqual((await linesOf(typed.body.id)).map((l) => l.unit_cost), [19.99]);
  const none = await order(send, [{ productId: id, qty: 1 }]);
  assert.equal(none.status, 201, none.text);
  assert.deepEqual((await linesOf(none.body.id)).map((l) => l.unit_cost), [COST]);
  const zero = await order(send, [{ productId: id, qty: 1, unitCost: 0 }]);
  assert.deepEqual((await linesOf(zero.body.id)).map((l) => l.unit_cost), [0]);
  const nonsense = await order(send, [{ productId: id, qty: 1, unitCost: 'none' }]);
  assert.equal(nonsense.status, 400, 'nonsense from the Owner is still refused');
});

test('the Owner can still mark as ordered a draft with no cost, as before', async () => {
  const id = await product({ cost: 0 });
  const send = asOwner();
  const draft = await order(send, [{ productId: id, qty: 1 }]);
  assert.equal((await send(`/api/purchase-orders/${draft.body.id}/mark-ordered`, POST())).status, 200);
});
