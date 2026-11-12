// Cycle to Work orders and quotes (openspec/changes/cycle-to-work, tasks
// 3.1–3.7; drawings cw-list, cw-new, cw-quote, cw-email in
// docs/design/user-journeys/generator/c2w.mjs). The drawings leave prices,
// days and numbers bracketed, so the amounts here are made-up test values.
//
// The server clock is pinned to 1 Sep 2026 (WHEELHOUSE_TEST_CLOCK).
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedProduct } from './helpers/till.js';

let server;
let owner;
let jo;
let other;
let provider;
let bike;
let lock;
let maya;
let away;
let site;
const as = (who) => (p, options) => staffRequest(server.baseUrl, who.cookie, p, options);
const own = (p, options) => as(owner)(p, options);
const inShop = (fn, shop = owner.shop.id) => runWithShop(shop, fn);
const tag = () => randomUUID().slice(0, 8);

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl);
  const made = await own('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${tag()}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  const set = await own('/api/c2w/settings', { method: 'PUT', body: { holdDays: 7, remindDays: 2, quoteValidDays: 30, howToApply: '[How to apply]' } });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  provider = (await own('/api/c2w/providers', { method: 'POST', body: { name: '[Provider]', commissionKind: 'percent', commissionValue: 500 } })).body.provider;
  bike = await seedProduct(owner.shop.id, { name: '[Bike] · [Size]', price: '1000.00', stock: 100 });
  lock = await seedProduct(owner.shop.id, { name: '[Lock]', price: '40.00', stock: 5 });
  maya = (await own('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: `maya-${tag()}@example.test` } })).body;
  // The bike is in stock at the shop; "away" is a bike with none here (cw-new-not-in-stock).
  site = await inShop(async () => (await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get()).id);
  await inShop(async () => prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, 100) RETURNING product_id').get(site, bike));
  away = await seedProduct(owner.shop.id, { name: '[Bike] · [Size]', price: '1000.00', stock: 0 });
});
after(async () => {
  for (const shop of [owner, other]) if (shop) await deleteTestShop(shop.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const quote = (body = {}, who = owner) => as(who)('/api/c2w/orders', {
  method: 'POST', body: { customerId: maya.id, providerId: provider.id, productId: bike, accessoryIds: [], ...body },
});
// A till of its own at the shop, signed in as the Owner, with nobody checked in.
async function tillNobodyIn() {
  const jar = new Map();
  const own = await staffFreshCookie(owner.loginId);
  const send = async (path, body) => {
    const cookie = [own, ...[...jar].map(([k, v]) => `${k}=${v}`)].join('; ');
    const res = await fetch(`${server.baseUrl}${path}`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      jar.set(pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1));
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  assert.equal((await send('/api/till-setup', { siteId: site, number: 9 })).status, 201);
  return send;
}
const order = async (id, who = owner) => (await as(who)(`/api/c2w/orders/${id}`)).body.order;
const raw = (id) => inShop(async () => prepare('SELECT * FROM c2w_orders WHERE id = ?').get(id));
const events = (id) => inShop(async () => prepare('SELECT kind FROM c2w_order_events WHERE order_id = ? ORDER BY id').all(id));

// ---------- 3.1 ----------

test('3.1 a quote makes the order at “Quote given” with the next quote number; two at once get different numbers', async () => {
  const a = await quote();
  assert.equal(a.status, 201, JSON.stringify(a.body));
  assert.equal(a.body.order.stage, 'quote');
  const b = await quote();
  assert.equal(b.body.order.quoteNumber, a.body.order.quoteNumber + 1);
  assert.match(b.body.order.quoteRef, /^CW-\d+$/);
  const [c, d] = await Promise.all([quote(), quote()]);
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.equal(d.status, 201, JSON.stringify(d.body));
  assert.notEqual(c.body.order.quoteNumber, d.body.order.quoteNumber);
  assert.equal((await raw(a.body.order.id)).customer_code.length, 64, 'a long private code for the customer’s link');
});

// ---------- 3.2 ----------

test('3.2 valid-until and hold-until come from Settings; the total includes accessories; “Don’t hold this one” sets no hold', async () => {
  const held = (await quote({ accessoryIds: [lock] })).body.order;
  assert.deepEqual([held.validUntil, held.holdUntil, held.holdWanted], ['2026-10-01', '2026-09-08', true]);
  assert.equal(held.totalPence, 104000, 'the bike and the lock');
  assert.deepEqual(held.accessories.map((a) => [a.productId, a.name, a.pricePence]), [[lock, '[Lock]', 4000]]);
  const unheld = (await quote({ hold: false })).body.order;
  assert.deepEqual([unheld.holdUntil, unheld.holdWanted, unheld.totalPence], [null, false, 100000]);
  // Not in stock here: nothing to hold, whatever the tick says (cw-new-not-in-stock, decision H5).
  const notHere = (await quote({ productId: away })).body.order;
  assert.deepEqual([notHere.holdUntil, notHere.inStock], [null, false]);
  assert.equal(held.inStock, true);
  // A shop that hasn't set its days yet is asked to, not given a quote with no dates.
  const elsewhere = (await staffRequest(server.baseUrl, other.cookie, '/api/c2w/settings')).body;
  assert.equal(elsewhere.settings.quoteValidDays, null);
  const theirs = (await staffRequest(server.baseUrl, other.cookie, '/api/c2w/providers', { method: 'POST', body: { name: '[Provider]' } })).body.provider;
  const theirBike = await seedProduct(other.shop.id, { name: '[Bike]', price: '900.00' });
  const theirCustomer = (await staffRequest(server.baseUrl, other.cookie, '/api/customers', { method: 'POST', body: { name: '[Customer]' } })).body;
  const refused = await staffRequest(server.baseUrl, other.cookie, '/api/c2w/orders', { method: 'POST', body: { customerId: theirCustomer.id, providerId: theirs.id, productId: theirBike, accessoryIds: [] } });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, 'settings_needed');
  // Another shop's bike, customer or provider is never found.
  const crossed = await quote({ productId: theirBike });
  assert.equal(crossed.status, 400, JSON.stringify(crossed.body));
  assert.equal((await quote({ customerId: theirCustomer.id })).status, 400);
  assert.equal((await quote({ providerId: theirs.id })).status, 400);
  // The refused quote took no number: the shop's first quote is still number 1.
  assert.equal((await staffRequest(server.baseUrl, other.cookie, '/api/c2w/settings', { method: 'PUT', body: { holdDays: 7, quoteValidDays: 30 } })).status, 200);
  const first = await staffRequest(server.baseUrl, other.cookie, '/api/c2w/orders', { method: 'POST', body: { customerId: theirCustomer.id, providerId: theirs.id, productId: theirBike, accessoryIds: [] } });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal(first.body.order.quoteNumber, 1);
  // A customer merged into another is no longer one to quote.
  const gone = (await own('/api/customers', { method: 'POST', body: { name: '[Customer]' } })).body;
  await inShop(async () => prepare('UPDATE customers SET active = 0, merged_into_id = ? WHERE id = ?').run(maya.id, gone.id));
  assert.equal((await quote({ customerId: gone.id })).status, 400);
});

// ---------- 3.3 and 3.4 ----------

test('3.3 each step adds a “What’s happened” line saying who and when; nothing edits or removes one', async () => {
  const made = (await quote()).body.order;
  const applied = await own(`/api/c2w/orders/${made.id}/applied`, { method: 'POST', body: { appliedOn: '2026-09-01', employer: '[Employer]', reference: '[reference]' } });
  assert.equal(applied.status, 200, JSON.stringify(applied.body));
  assert.equal(applied.body.order.stage, 'waiting');
  const seen = await order(made.id);
  assert.deepEqual(seen.events.map((e) => [e.kind, e.by]), [['quote_given', 'Jack Lewis'], ['held', 'Jack Lewis'], ['applied', 'Jack Lewis']]);
  assert.ok(seen.events.every((e) => !Number.isNaN(Date.parse(e.at))));
  assert.deepEqual(seen.events[2].detail, { appliedOn: '2026-09-01', employer: '[Employer]', reference: '[reference]' });
  assert.equal(seen.applicationReference, '[reference]');
  for (const method of ['PUT', 'DELETE']) {
    const r = await own(`/api/c2w/orders/${made.id}/events`, { method, body: {} });
    assert.equal(r.status, 404, `${method} on the history isn’t a route`);
  }
  // The quote line keeps the closing sentence it was given with.
  assert.match(seen.events[0].detail.closing, /^We’re holding your bike until /);
  // Applied before the quote was given is refused.
  const later = (await quote()).body.order;
  assert.equal((await own(`/api/c2w/orders/${later.id}/applied`, { method: 'POST', body: { appliedOn: '2026-08-31' } })).status, 400);
});

test('3.4 a step not allowed from the order’s stage is refused and changes nothing', async () => {
  const made = (await quote()).body.order;
  await own(`/api/c2w/orders/${made.id}/applied`, { method: 'POST', body: {} });
  const before = await raw(made.id);
  const again = await own(`/api/c2w/orders/${made.id}/applied`, { method: 'POST', body: { reference: '[another]' } });
  assert.equal(again.status, 409);
  assert.equal(again.body.code, 'wrong_stage');
  assert.deepEqual(await raw(made.id), before);
  assert.equal((await events(made.id)).length, 3, 'quote given, held, applied');
});

// ---------- 3.5 ----------

test('3.5 the list groups orders by stage, gives the top counts and the sidebar count, and the owed total only to someone who can see costs', async () => {
  const at = async (fields) => {
    const id = (await quote()).body.order.id;
    const sets = Object.keys(fields).map((k) => `${k} = ?`).join(', ');
    await inShop(async () => prepare(`UPDATE c2w_orders SET ${sets} WHERE id = ?`).run(...Object.values(fields), id));
    return id;
  };
  assert.equal((await own('/api/c2w/settings', { method: 'PUT', body: { holdDays: 7, remindDays: 2, quoteValidDays: 30, howToApply: '[How to apply]', noCertificateDays: 14 } })).status, 200);
  const before = (await own('/api/c2w/orders')).body;
  const ending = await at({ hold_until: '2026-09-02' });
  const ended = await at({ hold_until: '2026-08-30' });
  const ready = await at({ stage: 'certificate', hold_until: null, held_at: null, product_id: away });
  const heldCertificate = await at({ stage: 'certificate', hold_until: '2026-09-20' });
  const inStockUnheld = await at({ stage: 'certificate', hold_until: null, hold_wanted: false });
  const stale = await at({ quote_given_at: '2026-08-10T10:00:00Z', hold_until: '2026-09-20' });
  const late = await at({ stage: 'collected', hold_until: null, expected_pence: 95000, expected_by: '2026-08-31', collected_at: '2026-08-01T10:00:00Z' });
  const paid = await at({ stage: 'paid', hold_until: null, paid_pence: 95000, paid_on: '2026-08-20' });
  const oldPaid = await at({ stage: 'paid', hold_until: null, paid_pence: 95000, paid_on: '2026-07-01' });
  const list = (await own('/api/c2w/orders')).body;
  const ids = (group) => list.groups[group].map((o) => o.id);
  assert.ok(ids('waiting').includes(ending) && ids('waiting').includes(ended));
  assert.ok(ids('certificate').includes(ready));
  assert.ok(ids('collected').includes(late));
  assert.ok(ids('paid').includes(paid));
  assert.ok(!Object.values(list.groups).flat().some((o) => o.id === oldPaid), 'paid more than 30 days ago drops off');
  assert.equal(list.groups.waiting.find((o) => o.id === ended).next, 'choose');
  assert.equal(list.groups.certificate.find((o) => o.id === ready).next, 'order');
  assert.notEqual(list.groups.certificate.find((o) => o.id === heldCertificate).next, 'order', 'a held bike is never ordered');
  assert.notEqual(list.groups.certificate.find((o) => o.id === inStockUnheld).next, 'order', 'nor one in stock left unheld');
  const grew = (k) => list.counts[k] - before.counts[k];
  assert.deepEqual([grew('holdEndingSoon'), grew('holdEnded'), grew('readyToOrder'), grew('noCertificate'), grew('paymentLate')], [1, 1, 1, 1, 1]);
  assert.equal(list.count - before.count, 5);
  assert.equal(list.counts.owedPence - before.counts.owedPence, 95000);
  assert.equal((await own('/api/c2w/count')).body.count, list.count);
  const row = list.groups.waiting.find((o) => o.id === ending);
  assert.deepEqual([row.customerName, row.providerName, row.bike], ['Maya Patel', '[Provider]', '[Bike] · [Size]']);
  const hers = (await as(jo)('/api/c2w/orders')).body;
  assert.equal(hers.count, list.count);
  assert.ok(!('owedPence' in hers.counts) && !('owedLate' in hers.counts), 'no money owed for someone who can’t see costs');
  // Staff still see what's expected (decision H3); never the commission.
  const seen = await order(late, jo);
  assert.deepEqual([seen.expectedPence, seen.expectedBy], [95000, '2026-08-31']);
  assert.ok(!('commissionValue' in seen) && !('commissionPence' in seen));
});

// ---------- 3.6 ----------

test('3.6 the quote document follows the order, and Email queues it', async () => {
  const made = (await quote({ accessoryIds: [lock] })).body.order;
  const doc = (await own(`/api/c2w/orders/${made.id}/quote`)).body.quote;
  assert.match(doc.shop.name, /^North Street Cycles( |$)/, 'the shop’s own name');
  assert.equal(doc.quoteRef, made.quoteRef);
  assert.deepEqual([doc.customerName, doc.providerName, doc.givenOn, doc.validUntil], ['Maya Patel', '[Provider]', '2026-09-01', '2026-10-01']);
  assert.deepEqual(doc.items.map((i) => [i.name, i.pricePence]), [['[Bike] · [Size]', 100000], ['[Lock]', 4000]]);
  assert.equal(doc.totalPence, 104000);
  assert.equal(doc.closing, 'We’re holding your bike until 8 September 2026. This quote is valid until 1 October 2026. Once your certificate reaches us, it’s yours to collect.');
  assert.equal(doc.howToApply, '[How to apply]');
  const unheld = (await quote({ hold: false })).body.order;
  assert.equal((await own(`/api/c2w/orders/${unheld.id}/quote`)).body.quote.closing, 'This quote is valid until 1 October 2026.');
  const notHere = (await quote({ productId: away })).body.order;
  assert.equal((await own(`/api/c2w/orders/${notHere.id}/quote`)).body.quote.closing,
    '[Bike] · [Size] isn’t in stock. We’ll order it once your certificate reaches us, and let you know when it arrives. This quote is valid until 1 October 2026.');
  // A till with nobody checked in emails nothing: the line would name no one.
  const till = await tillNobodyIn();
  const nobody = await till(`/api/c2w/orders/${made.id}/email-quote`, {});
  assert.deepEqual([nobody.status, nobody.body.code], [409, 'check_in_first']);

  assert.equal((await own(`/api/c2w/orders/${made.id}/email-quote`, { method: 'POST', body: { email: 'not an address' } })).status, 400);
  const sent = await own(`/api/c2w/orders/${made.id}/email-quote`, { method: 'POST', body: {} });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  const msg = await inShop(async () => prepare("SELECT * FROM customer_messages WHERE customer_id = ? AND template_key = 'c2w_quote' ORDER BY id DESC LIMIT 1").get(maya.id));
  assert.deepEqual([msg.subject, msg.to_address, msg.channel, msg.status], ['Your Cycle to Work quote', maya.email, 'email', 'queued']);
  assert.ok(msg.body.startsWith(`Hi Maya, here’s your quote ${made.quoteRef} for [Bike] · [Size], for your Cycle to Work scheme through [Provider].`), msg.body);
  assert.ok(msg.body.includes('We’re holding your bike until 8 September 2026. This quote is valid until 1 October 2026. We’ll let you know as soon as your certificate reaches us.'), msg.body);
  assert.ok(msg.body.includes('How to apply: [How to apply]'), msg.body);
  assert.deepEqual((await events(made.id)).map((e) => e.kind), ['quote_given', 'held', 'quote_emailed']);
  // Five an hour for one customer, then it waits.
  for (let i = 0; i < 4; i += 1) await own(`/api/c2w/orders/${made.id}/email-quote`, { method: 'POST', body: {} });
  const tooMany = await own(`/api/c2w/orders/${made.id}/email-quote`, { method: 'POST', body: {} });
  assert.equal(tooMany.status, 429);
  assert.match(tooMany.body.error, /Cycle to Work quotes/);
});

// ---------- 3.7 ----------

test('3.7 a retired provider can’t be picked; merging customers moves their orders to the kept one, and Undo moves them back', async () => {
  const retiring = (await own('/api/c2w/providers', { method: 'POST', body: { name: '[Old provider]' } })).body.provider;
  await own(`/api/c2w/providers/${retiring.id}/retire`, { method: 'POST', body: {} });
  const refused = await quote({ providerId: retiring.id });
  assert.equal(refused.status, 400);
  assert.equal(refused.body.code, 'retired_provider');

  const twin = (await own('/api/customers', { method: 'POST', body: { name: 'Maya P.' } })).body;
  const theirs = (await quote({ customerId: twin.id })).body.order;
  const merged = await own(`/api/customers/${maya.id}/merge`, { method: 'POST', body: { otherId: twin.id, keep: {} } });
  assert.equal(merged.status, 200, JSON.stringify(merged.body));
  assert.equal((await raw(theirs.id)).customer_id, maya.id);
  const undone = await own(`/api/customer-merges/${merged.body.id}/undo`, { method: 'POST', body: {} });
  assert.equal(undone.status, 200, JSON.stringify(undone.body));
  assert.equal((await raw(theirs.id)).customer_id, twin.id);
});
