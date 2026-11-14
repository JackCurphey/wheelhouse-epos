// The six Cycle to Work messages (openspec/changes/cycle-to-work, task 9.1;
// decision 2026-10-02-cycle-to-work-review point 6, made six by Jack on 12 Nov,
// docs/decisions/2026-11-12-cycle-to-work-defaults-taken.md item 3; wording drawn on
// cw-texts-certificate, cw-texts-hold, cw-texts-cancelled and cw-messages in
// docs/design/user-journeys/generator/c2w.mjs and setup.mjs).
// "Your hold ends on [date]" isn't drawn: its wording is the default taken
// (spec-c2w.md question 6). Amounts here are made-up test values.
//
// The server clock is pinned to 1 Sep 2026 (WHEELHOUSE_TEST_CLOCK). Sending is
// pretend in tests, so a message's link is "[link]".
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedProduct } from './helpers/till.js';
import { queueHoldEndings } from '../server/c2w/messages.js';
import { TEMPLATES, render } from '../server/messaging/templates.js';
import { sendDueForShop } from '../server/messaging/engine.js';

let server;
let owner;
let provider;
let site;
let pump;
const own = (p, options) => staffRequest(server.baseUrl, owner.cookie, p, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const tag = () => randomUUID().slice(0, 8);
const post = (p, body) => own(p, { method: 'POST', body });

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const set = await own('/api/c2w/settings', { method: 'PUT', body: { holdDays: 7, remindDays: 2, quoteValidDays: 30 } });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  provider = (await own('/api/c2w/providers', { method: 'POST', body: { name: '[Provider]' } })).body.provider;
  site = await inShop(async () => (await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get()).id);
  pump = await seedProduct(owner.shop.id, { name: '[Pump]', price: '20.00' });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

// Each test has its own Maya, so her messages are only that test's.
const newMaya = async () => (await own('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: `maya-${tag()}@example.test` } })).body;
// A £1,000 bike with frame numbers, `frames` of them in stock at the shop's site:
// one size of a bike with sizes, so the messages name it "[Bike] · [Size]" as drawn,
// unless `sized` is false.
async function framedBike(frames, { sized = true } = {}) {
  const id = await seedProduct(owner.shop.id, { name: '[Bike]', price: '1000.00', stock: frames });
  await inShop(async () => {
    if (sized) {
      const group = await prepare("INSERT INTO product_groups (name) VALUES ('[Bike]') RETURNING id").get();
      await prepare("UPDATE products SET group_id = ?, size = '[Size]' WHERE id = ?").run(group.id, id);
    }
    await prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, ?) RETURNING product_id').get(site, id, frames);
    for (let i = 0; i < frames; i += 1) {
      const key = `[FRAME-${tag()}]`;
      await prepare('INSERT INTO stock_frames (product_id, site_id, frame_number, frame_key) VALUES (?, ?, ?, ?) RETURNING id').get(id, site, key, key);
    }
  });
  return id;
}
const quote = async (maya, productId, body = {}) => {
  const res = await own('/api/c2w/orders', { method: 'POST', body: { customerId: maya.id, providerId: provider.id, productId, accessoryIds: [], ...body } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.order;
};
const certify = (id, body) => post(`/api/c2w/orders/${id}/certificate`, { number: '[certificate number]', ...body });
// Maya's automatic messages, oldest first.
const messagesTo = (maya) => inShop(() => prepare(
  "SELECT template_key, body, intent_state, channel FROM customer_messages WHERE customer_id = ? AND template_key LIKE 'c2w\\_%' AND template_key <> 'c2w_quote' ORDER BY id",
).all(maya.id));
const switchOff = async (key) => {
  const res = await own(`/api/message-templates/${key}`, { method: 'PUT', body: { enabled: false } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
};
const switchOn = (key) => own(`/api/message-templates/${key}`, { method: 'PUT', body: { enabled: true } });

test('9.1 Your bike is put aside: sent when a quote holds the bike, with the date it is held until', async () => {
  const maya = await newMaya();
  const made = await quote(maya, await framedBike(1));
  const [m, ...more] = await messagesTo(maya);
  assert.deepEqual(more, []);
  assert.equal(m.template_key, 'c2w_put_aside');
  assert.equal(m.intent_state, 'intended', 'waits for Undo, like every automatic message');
  assert.equal(m.body, `Hi Maya, we’re now holding [Bike] · [Size] for you until 8 September 2026. Quote ${made.quoteRef}. See your Cycle to Work bike: [link]`);
});

test('9.1 a bike without sizes is named on its own', async () => {
  const maya = await newMaya();
  await quote(maya, await framedBike(1, { sized: false }));
  assert.match((await messagesTo(maya))[0].body, /holding \[Bike\] for you until/);
});

test('9.1 Your bike is put aside: nothing when the bike isn’t held (not in stock, or Don’t hold)', async () => {
  const maya = await newMaya();
  await quote(maya, await framedBike(0));
  await quote(maya, await framedBike(1), { hold: false });
  assert.deepEqual(await messagesTo(maya), []);
});

test('9.1 Your bike is put aside: sent again when the hold is made longer (cw-texts-hold)', async () => {
  const maya = await newMaya();
  const made = await quote(maya, await framedBike(1));
  const res = await post(`/api/c2w/orders/${made.id}/hold-longer`, {});
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const sent = await messagesTo(maya);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].template_key, 'c2w_put_aside');
  // The first, still in its minute, gives way to the new date: one message, not two.
  assert.deepEqual(sent.map((m) => m.intent_state), ['undone', 'intended']);
  assert.equal(sent[1].body, `Hi Maya, we’re now holding [Bike] · [Size] for you until 15 September 2026. Quote ${made.quoteRef}. See your Cycle to Work bike: [link]`);
});

test('9.1 Certificate received: the bike still needs getting ready (cw-texts-certificate)', async () => {
  const maya = await newMaya();
  const made = await quote(maya, await framedBike(1));
  assert.equal((await certify(made.id, { amountPence: 100000 })).status, 200);
  const m = (await messagesTo(maya)).at(-1);
  assert.equal(m.template_key, 'c2w_certificate');
  assert.equal(m.body, 'Hi Maya, your Cycle to Work certificate has reached us. We’re getting [Bike] · [Size] ready and we’ll text you when you can collect it. See your Cycle to Work bike: [link]');
});

test('9.1 Certificate received: for less, the order kept, says what’s left to pay', async () => {
  const maya = await newMaya();
  const made = await quote(maya, await framedBike(1), { accessoryIds: [pump] });
  const res = await certify(made.id, { amountPence: 90000, difference: 'keep' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const m = (await messagesTo(maya)).at(-1);
  assert.equal(m.template_key, 'c2w_certificate_less');
  assert.equal(m.body, 'Hi Maya, your certificate for £900.00 has reached us. You pay £120.00 when you collect. See your Cycle to Work bike: [link]');
});

test('9.1 Certificate received with the bike ready: one message, Ready to collect', async () => {
  const maya = await newMaya();
  const made = await quote(maya, await framedBike(1));
  assert.equal((await certify(made.id, { amountPence: 100000, ready: true })).status, 200);
  const sent = (await messagesTo(maya)).filter((m) => m.template_key !== 'c2w_put_aside');
  assert.deepEqual(sent.map((m) => m.template_key), ['c2w_ready']);
  assert.equal(sent[0].body, `Hi Maya, your Cycle to Work certificate has reached us and [Bike] · [Size] is ready to collect. Quote ${made.quoteRef}. See your Cycle to Work bike: [link]`);
});

test('9.1 Ready to collect: sent on Mark ready, and stopped by its Undo while it is still waiting', async () => {
  const maya = await newMaya();
  const made = await quote(maya, await framedBike(1));
  assert.equal((await certify(made.id, { amountPence: 100000 })).status, 200);
  // Another customer's Ready to collect, also waiting: Maya's Undo leaves it alone.
  const other = await newMaya();
  const theirs = await quote(other, await framedBike(1));
  assert.equal((await certify(theirs.id, { amountPence: 100000 })).status, 200);
  assert.equal((await post(`/api/c2w/orders/${theirs.id}/ready`, {})).status, 200);
  assert.equal((await post(`/api/c2w/orders/${made.id}/ready`, {})).status, 200);
  let ready = (await messagesTo(maya)).filter((m) => m.template_key === 'c2w_ready');
  assert.deepEqual(ready.map((m) => m.intent_state), ['intended']);
  assert.equal((await post(`/api/c2w/orders/${made.id}/ready/undo`, {})).status, 200);
  ready = (await messagesTo(maya)).filter((m) => m.template_key === 'c2w_ready');
  assert.deepEqual(ready.map((m) => m.intent_state), ['undone']);
  // The certificate message isn't stopped by the Undo.
  assert.equal((await messagesTo(maya)).find((m) => m.template_key === 'c2w_certificate').intent_state, 'intended');
  assert.deepEqual((await messagesTo(other)).filter((m) => m.template_key === 'c2w_ready').map((m) => m.intent_state), ['intended']);
});

test('9.1 Ready to collect: sent when an ordered-in bike is booked in after the certificate', async () => {
  const maya = await newMaya();
  const bike = await framedBike(0);
  const made = await quote(maya, bike);
  assert.equal((await certify(made.id, { amountPence: 100000 })).status, 200);
  const { bookedInForOrder } = await import('../server/c2w/orders.js');
  const frame = await inShop(async () => (await prepare("INSERT INTO stock_frames (product_id, site_id, frame_number, frame_key) VALUES (?, ?, '[FRAME-B]', ?) RETURNING id").get(bike, site, `[FRAME-${tag()}]`)).id);
  await inShop(() => bookedInForOrder(made.id, frame, site, { employeeId: null, name: 'Jack Lewis' }));
  const ready = (await messagesTo(maya)).filter((m) => m.template_key === 'c2w_ready');
  assert.equal(ready.length, 1);
  assert.match(ready[0].body, /is ready to collect/);
});

test('9.1 booked in before the certificate only puts the bike aside: no Ready to collect', async () => {
  const maya = await newMaya();
  const bike = await framedBike(0);
  const made = await quote(maya, bike);
  const { bookedInForOrder } = await import('../server/c2w/orders.js');
  const frame = await inShop(async () => (await prepare("INSERT INTO stock_frames (product_id, site_id, frame_number, frame_key) VALUES (?, ?, '[FRAME-C]', ?) RETURNING id").get(bike, site, `[FRAME-${tag()}]`)).id);
  await inShop(() => bookedInForOrder(made.id, frame, site, { employeeId: null, name: 'Jack Lewis' }));
  assert.deepEqual((await messagesTo(maya)).map((m) => m.template_key), []);
});

test('9.1 Your hold ends on [date]: sent once, the shop’s reminder days before the hold ends', async () => {
  const maya = await newMaya();
  const made = await quote(maya, await framedBike(1));
  const now = new Date('2026-09-01T10:00:00Z');
  await inShop(() => queueHoldEndings(now));
  assert.equal((await messagesTo(maya)).filter((m) => m.template_key === 'c2w_hold_ending').length, 0, 'ends 8 Sep: not yet');
  // Two days before (Settings: remind 2 days before).
  await inShop(() => prepare("UPDATE c2w_orders SET hold_until = '2026-09-03' WHERE id = ?").run(made.id));
  await inShop(() => queueHoldEndings(now));
  await inShop(() => queueHoldEndings(now));
  const ending = (await messagesTo(maya)).filter((m) => m.template_key === 'c2w_hold_ending');
  assert.equal(ending.length, 1, 'once for that date');
  assert.equal(ending[0].body, `Hi Maya, your hold on [Bike] · [Size] ends on 3 September 2026. Quote ${made.quoteRef}. See your Cycle to Work bike: [link]`);
  // Held longer, to a date that comes round again: a new reminder for the new date.
  await inShop(() => prepare("UPDATE c2w_orders SET hold_until = '2026-09-02' WHERE id = ?").run(made.id));
  await inShop(() => queueHoldEndings(now));
  assert.equal((await messagesTo(maya)).filter((m) => m.template_key === 'c2w_hold_ending').length, 2);
});

test('9.1 Your hold ends on [date]: not for a hold already ended, a released bike, or a certificate order', async () => {
  const maya = await newMaya();
  const ended = await quote(maya, await framedBike(1));
  const released = await quote(maya, await framedBike(1));
  const certified = await quote(maya, await framedBike(1));
  assert.equal((await post(`/api/c2w/orders/${released.id}/release`, {})).status, 200);
  assert.equal((await certify(certified.id, { amountPence: 100000 })).status, 200);
  await inShop(() => prepare("UPDATE c2w_orders SET hold_until = '2026-08-31' WHERE id = ?").run(ended.id));
  await inShop(() => queueHoldEndings(new Date('2026-09-01T10:00:00Z')));
  assert.equal((await messagesTo(maya)).filter((m) => m.template_key === 'c2w_hold_ending').length, 0);
});

// The sender's own round runs the hold-ending check. It uses the real clock, so
// the hold here ends tomorrow by the database's date. This runs before the tests
// below that also call the sender, as the check runs at most once a minute.
test('9.1 Your hold ends on [date]: the sender’s round checks for it', async () => {
  const maya = await newMaya();
  const made = await quote(maya, await framedBike(1));
  await inShop(() => prepare('UPDATE c2w_orders SET hold_until = CURRENT_DATE + 1 WHERE id = ?').run(made.id));
  await sendDueForShop(owner.shop.id);
  assert.equal((await messagesTo(maya)).filter((m) => m.template_key === 'c2w_hold_ending').length, 1);
});

// Due now: as if its minute had passed.
const dueNow = (maya) => inShop(() => prepare("UPDATE customer_messages SET send_after = now() - interval '1 second' WHERE customer_id = ? AND intent_state = 'intended'").run(maya.id));

test('9.1 Your bike is put aside: not sent once the bike is released within its minute', async () => {
  const maya = await newMaya();
  const made = await quote(maya, await framedBike(1));
  assert.equal((await post(`/api/c2w/orders/${made.id}/release`, {})).status, 200);
  await dueNow(maya);
  await sendDueForShop(owner.shop.id);
  // Put aside is undone, and nor is she told "no longer put aside" about a put-aside she never heard of.
  assert.deepEqual((await messagesTo(maya)).map((m) => [m.template_key, m.intent_state]), [['c2w_put_aside', 'undone']]);
  // A bike still held is told as usual.
  const kept = await newMaya();
  await quote(kept, await framedBike(1));
  await dueNow(kept);
  await sendDueForShop(owner.shop.id);
  assert.deepEqual((await messagesTo(kept)).map((m) => [m.template_key, m.intent_state]), [['c2w_put_aside', 'delivered']]);
});

test('9.1 Your hold ends on [date]: not sent once the bike is released within its minute', async () => {
  const maya = await newMaya();
  const made = await quote(maya, await framedBike(1));
  await inShop(() => prepare("UPDATE c2w_orders SET hold_until = '2026-09-03' WHERE id = ?").run(made.id));
  await inShop(() => queueHoldEndings(new Date('2026-09-01T10:00:00Z')));
  assert.equal((await post(`/api/c2w/orders/${made.id}/release`, {})).status, 200);
  await dueNow(maya);
  await sendDueForShop(owner.shop.id);
  assert.equal((await messagesTo(maya)).find((m) => m.template_key === 'c2w_hold_ending').intent_state, 'undone');
});

test('9.1 Your hold ends on [date]: not sent for a hold no longer than the reminder days, as Put aside gave the date', async () => {
  const maya = await newMaya();
  assert.equal((await own('/api/c2w/settings', { method: 'PUT', body: { holdDays: 2, remindDays: 2, quoteValidDays: 30 } })).status, 200);
  try {
    await quote(maya, await framedBike(1));
    await inShop(() => queueHoldEndings(new Date('2026-09-01T10:00:00Z')));
  } finally {
    assert.equal((await own('/api/c2w/settings', { method: 'PUT', body: { holdDays: 7, remindDays: 2, quoteValidDays: 30 } })).status, 200);
  }
  assert.deepEqual((await messagesTo(maya)).map((m) => m.template_key), ['c2w_put_aside']);
  // A 7-day hold, its date left as put aside (8 Sep), is still reminded 2 days before.
  const longer = await newMaya();
  await quote(longer, await framedBike(1));
  await inShop(() => queueHoldEndings(new Date('2026-09-06T10:00:00Z')));
  assert.deepEqual((await messagesTo(longer)).map((m) => m.template_key), ['c2w_put_aside', 'c2w_hold_ending']);
});

const toldPutAside = async (maya) => {
  await dueNow(maya);
  await sendDueForShop(owner.shop.id);
};

test('9.1 Your bike is no longer put aside: sent when the bike is released, with the drawn words (cw-texts-hold)', async () => {
  const maya = await newMaya();
  const made = await quote(maya, await framedBike(1));
  await toldPutAside(maya);
  assert.equal((await post(`/api/c2w/orders/${made.id}/release`, {})).status, 200);
  const sent = await messagesTo(maya);
  assert.deepEqual(sent.map((m) => m.template_key), ['c2w_put_aside', 'c2w_released']);
  assert.equal(sent[1].intent_state, 'intended', 'waits for Undo, like every automatic message');
  assert.equal(sent[1].body, 'Hi Maya, [Bike] · [Size] is no longer put aside. We’ll still get you one when your certificate comes. See your Cycle to Work bike: [link]');
});

test('9.1 Your bike is no longer put aside: still sent once its minute has passed, as the bike stays released', async () => {
  const maya = await newMaya();
  const made = await quote(maya, await framedBike(1));
  await toldPutAside(maya);
  assert.equal((await post(`/api/c2w/orders/${made.id}/release`, {})).status, 200);
  await dueNow(maya);
  await sendDueForShop(owner.shop.id);
  assert.deepEqual((await messagesTo(maya)).map((m) => [m.template_key, m.intent_state]), [['c2w_put_aside', 'delivered'], ['c2w_released', 'delivered']]);
});

test('9.1 Your bike is no longer put aside: not sent once the bike is held again within its minute', async () => {
  // Released, then the certificate comes in the same minute and the bike is held again (cw-certificate-released).
  const maya = await newMaya();
  const made = await quote(maya, await framedBike(1));
  await toldPutAside(maya);
  assert.equal((await post(`/api/c2w/orders/${made.id}/release`, {})).status, 200);
  assert.equal((await certify(made.id, { amountPence: 100000 })).status, 200);
  await dueNow(maya);
  await sendDueForShop(owner.shop.id);
  const released = (await messagesTo(maya)).find((m) => m.template_key === 'c2w_released');
  assert.equal(released.intent_state, 'undone');
});

// Cancelling is pull request 8's (tasks 8.5, 8.6), and the deposit section 11's:
// until then the three drawn wordings are checked as Wheelhouse fills them in.
test('9.1 Your order is cancelled: the three drawn wordings, with no link (cw-texts-cancelled)', async () => {
  const vars = { 'Customer’s first name': 'Maya', 'Quote number': 'Q-[n]', 'Deposit amount': '£[£]', 'Shop phone': '[shop phone]' };
  const words = (key) => render(TEMPLATES[key].wording, vars);
  assert.equal(words('c2w_cancelled'), 'Hi Maya, your Cycle to Work order, quote Q-[n], is cancelled. Questions? Call [shop phone].');
  assert.equal(words('c2w_cancelled_kept'), 'Hi Maya, your Cycle to Work order, quote Q-[n], is cancelled. Your £[£] deposit is kept, as your quote said, because the bike was ordered in for you. Questions? Call [shop phone].');
  assert.equal(words('c2w_cancelled_refunded'), 'Hi Maya, your Cycle to Work order, quote Q-[n], is cancelled. Your £[£] deposit is being refunded, the way you paid it. Questions? Call [shop phone].');
  // The two deposit wordings are part of the one message: one on/off, one subject.
  for (const key of ['c2w_cancelled_kept', 'c2w_cancelled_refunded']) {
    assert.equal(TEMPLATES[key].partOf, 'c2w_cancelled');
    assert.equal(TEMPLATES[key].subject, TEMPLATES.c2w_cancelled.subject);
  }
});

test('9.1 each message switched off in Settings › Messages is not sent', async () => {
  for (const key of ['c2w_put_aside', 'c2w_certificate', 'c2w_ready', 'c2w_hold_ending', 'c2w_released']) await switchOff(key);
  try {
    const maya = await newMaya();
    const a = await quote(maya, await framedBike(1));
    const b = await quote(maya, await framedBike(1), { accessoryIds: [pump] });
    const c = await quote(maya, await framedBike(1));
    const d = await quote(maya, await framedBike(1));
    assert.equal((await post(`/api/c2w/orders/${a.id}/hold-longer`, {})).status, 200);
    assert.equal((await certify(a.id, { amountPence: 100000 })).status, 200);
    assert.equal((await certify(b.id, { amountPence: 90000, difference: 'keep' })).status, 200, 'the for-less wording follows Certificate received');
    assert.equal((await post(`/api/c2w/orders/${a.id}/ready`, {})).status, 200);
    assert.equal((await post(`/api/c2w/orders/${d.id}/release`, {})).status, 200);
    await inShop(() => prepare("UPDATE c2w_orders SET hold_until = '2026-09-02' WHERE id = ?").run(c.id));
    await inShop(() => queueHoldEndings(new Date('2026-09-01T10:00:00Z')));
    assert.deepEqual(await messagesTo(maya), []);
  } finally {
    for (const key of ['c2w_put_aside', 'c2w_certificate', 'c2w_ready', 'c2w_hold_ending', 'c2w_released']) await switchOn(key);
  }
});

test('9.1 Settings › Messages has the six, grouped as Cycle to Work, with the drawn names and when they go', async () => {
  const res = await own('/api/message-templates');
  assert.equal(res.status, 200);
  const rows = res.body.filter((t) => t.group === 'c2w' && !t.partOf);
  assert.deepEqual(rows.map((t) => [t.key, t.name, t.when]), [
    ['c2w_put_aside', 'Your bike is put aside', 'When a Cycle to Work bike is held for the customer, and again when the hold is made longer'],
    ['c2w_certificate', 'Certificate received', 'When the scheme certificate arrives'],
    ['c2w_ready', 'Ready to collect', 'When the Cycle to Work bike is ready'],
    ['c2w_hold_ending', 'Your hold ends on [date]', '[n] days before a hold ends'],
    ['c2w_released', 'Your bike is no longer put aside', 'When a held bike is released — the order stays open'],
    ['c2w_cancelled', 'Your order is cancelled', 'When a Cycle to Work order is cancelled, with what happens to any deposit'],
  ]);
  assert.ok(rows.every((t) => t.enabled));
  // All six are live: "Your order is cancelled" joined with cancelling (pull request 8b).
  assert.deepEqual(rows.filter((t) => !t.live).map((t) => t.key), []);
});

test('10.4 Undo on Hold longer stops its waiting “Your bike is put aside”, and leaves another customer’s alone', async () => {
  const maya = await newMaya();
  const made = await quote(maya, await framedBike(1));
  const other = await newMaya();
  await quote(other, await framedBike(1));
  assert.equal((await post(`/api/c2w/orders/${made.id}/hold-longer`, {})).status, 200);
  const res = await post(`/api/c2w/orders/${made.id}/hold-longer/undo`, {});
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const sent = (await messagesTo(maya)).filter((m) => m.template_key === 'c2w_put_aside');
  assert.deepEqual(sent.map((m) => m.intent_state), ['undone', 'undone'], 'the longer hold’s text is stopped');
  assert.deepEqual((await messagesTo(other)).map((m) => m.intent_state), ['intended']);
});
