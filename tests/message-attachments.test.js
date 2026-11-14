// An email message can carry attachments (openspec/changes/message-attachments;
// cw-email and cw-email-certificate-revised draw "Attached: Quote [n]"). The
// files are kept with the message and handed to the email sender when it goes;
// a text carries none. Sending stays pretend (Jack, 20 Oct).
import test, { before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { queueMessage, sendEmailTo, sendDueForShop, undoMessage } from '../server/messaging/engine.js';
import { senderFor } from '../server/messaging/senders/index.js';

let shop;
let other;
before(async () => {
  shop = await createTestShop();
  other = await createTestShop();
});
after(async () => {
  if (shop) await deleteTestShop(shop.id);
  if (other) await deleteTestShop(other.id);
  await pool.end();
});

const inShop = (fn, id = shop.id) => runWithShop(id, fn);
const customer = (fields) => inShop(async () => (await prepare(
  'INSERT INTO customers (name, phone, email, update_channel) VALUES (?, ?, ?, ?) RETURNING id'
).get('Maya Patel', fields.phone ?? null, fields.email ?? null, fields.channel ?? null)).id);
const filesOf = (id, shopId = shop.id) => inShop(() => prepare(
  'SELECT filename, content_type, content FROM customer_message_attachments WHERE message_id = ? ORDER BY id'
).all(id), shopId);
const VARS = { 'Customer’s first name': 'Maya', Bike: 'Trek Domane AL 3', 'Shop name': 'North Street Cycles', 'Amount to pay': '£111.00', 'Link to the job': 'https://example.test/j', 'Job number': 'WH-1042', 'Opening hours': '9 to 5' };
const PDF = { filename: 'Quote Q-1.pdf', contentType: 'application/pdf', content: Buffer.from('%PDF-1.3 a quote') };

/** Sends this shop's due messages, noting what the email sender was given. */
async function sendWatching() {
  const given = [];
  const sender = senderFor('email');
  const spy = mock.method(sender, 'send', async (m) => { given.push(m); return { ok: true, providerId: 'pretend', pretend: true }; });
  try {
    await sendDueForShop(shop.id);
  } finally {
    spy.mock.restore();
  }
  return given;
}

test('a queued email carries its attachment to the sender when it goes, and is recorded as pretend', async () => {
  const c = await customer({ email: 'maya@example.test', channel: 'email' });
  const queued = await inShop(() => queueMessage({ customerId: c, key: 'bike_ready', vars: VARS, attachments: [PDF] }));
  assert.equal(queued.channel, 'email');
  const given = (await sendWatching()).filter((m) => m.to === 'maya@example.test');
  assert.equal(given.length, 1);
  assert.equal(given[0].attachments.length, 1);
  assert.equal(given[0].attachments[0].filename, 'Quote Q-1.pdf');
  assert.equal(given[0].attachments[0].contentType, 'application/pdf');
  assert.ok(Buffer.from(given[0].attachments[0].content).equals(PDF.content), 'the file’s contents, unchanged');
  const row = await inShop(() => prepare('SELECT status, pretend FROM customer_messages WHERE id = ?').get(queued.id));
  assert.equal(row.status, 'sent');
  assert.equal(row.pretend, true);
});

test('a one-off email (the quote email’s way) carries its attachment too', async () => {
  const id = await inShop(() => sendEmailTo({ to: 'quote@example.test', subject: 'Your Cycle to Work quote', body: 'Hi', templateKey: 'c2w_quote', attachments: [PDF] }));
  assert.equal((await filesOf(id)).length, 1);
  const given = (await sendWatching()).filter((m) => m.to === 'quote@example.test');
  assert.equal(given.length, 1);
  assert.deepEqual(given[0].attachments.map((a) => a.filename), ['Quote Q-1.pdf']);
});

test('an email with no attachment hands the sender an empty list', async () => {
  const id = await inShop(() => sendEmailTo({ to: 'plain@example.test', subject: 'S', body: 'B' }));
  assert.equal((await filesOf(id)).length, 0);
  const given = (await sendWatching()).filter((m) => m.to === 'plain@example.test');
  assert.deepEqual(given[0].attachments, []);
});

test('a text carries no attachment', async () => {
  const c = await customer({ phone: '07700 900142' });
  const queued = await inShop(() => queueMessage({ customerId: c, key: 'bike_ready', vars: VARS, attachments: [PDF] }));
  assert.equal(queued.channel, 'sms');
  assert.equal((await filesOf(queued.id)).length, 0);
});

test('an undone message’s attachment is never sent', async () => {
  const c = await customer({ email: 'undo@example.test', channel: 'email' });
  const queued = await inShop(() => queueMessage({ customerId: c, key: 'bike_ready', vars: VARS, delayMs: 60_000, attachments: [PDF] }));
  assert.equal(await inShop(() => undoMessage(queued.id)), true);
  const given = (await sendWatching()).filter((m) => m.to === 'undo@example.test');
  assert.equal(given.length, 0);
});

test('a message’s files go with it, and another shop can’t read them', async () => {
  const id = await inShop(() => sendEmailTo({ to: 'gone@example.test', subject: 'S', body: 'B', attachments: [PDF] }));
  assert.equal((await filesOf(id, other.id)).length, 0, 'not visible to another shop');
  assert.equal((await filesOf(id)).length, 1);
  // A file hangs only off its own shop's message, even if another shop names its id.
  await assert.rejects(inShop(() => prepare('INSERT INTO customer_message_attachments (message_id, filename, content_type, content) VALUES (?, ?, ?, ?)')
    .run(id, PDF.filename, PDF.contentType, PDF.content), other.id), /foreign key/);
  await inShop(() => prepare('DELETE FROM customer_messages WHERE id = ?').run(id));
  assert.equal((await filesOf(id)).length, 0);
});

// openspec/changes/clear-sent-files: once a message has left the queue, nothing
// reads its files again, so the sending round clears them; the message stays.
test('a sent message’s files are cleared by the round that sends it; the message stays', async () => {
  const id = await inShop(() => sendEmailTo({ to: 'cleared@example.test', subject: 'S', body: 'B', attachments: [PDF] }));
  assert.equal((await filesOf(id)).length, 1, 'kept while it waits');
  const given = (await sendWatching()).filter((m) => m.to === 'cleared@example.test');
  assert.equal(given[0].attachments.length, 1, 'the sender still gets the file');
  assert.equal((await filesOf(id)).length, 0, 'gone once sent');
  assert.equal((await inShop(() => prepare('SELECT status FROM customer_messages WHERE id = ?').get(id))).status, 'sent');
});

test('a failed send’s files are cleared too (a failed message is never sent again)', async () => {
  const id = await inShop(() => sendEmailTo({ to: 'failed@example.test', subject: 'S', body: 'B', attachments: [PDF] }));
  const sender = senderFor('email');
  const spy = mock.method(sender, 'send', async () => ({ ok: false, error: 'refused' }));
  try {
    await sendDueForShop(shop.id);
  } finally {
    spy.mock.restore();
  }
  assert.equal((await inShop(() => prepare('SELECT status FROM customer_messages WHERE id = ?').get(id))).status, 'failed');
  assert.equal((await filesOf(id)).length, 0);
});

test('an undone message’s files are cleared by the next round; a message still waiting keeps its own', async () => {
  const c = await customer({ email: 'undone-files@example.test', channel: 'email' });
  const undone = await inShop(() => queueMessage({ customerId: c, key: 'bike_ready', vars: VARS, delayMs: 60_000, attachments: [PDF] }));
  const waiting = await inShop(() => queueMessage({ customerId: c, key: 'bike_ready', vars: VARS, delayMs: 60_000, attachments: [PDF] }));
  assert.equal(await inShop(() => undoMessage(undone.id)), true);
  await sendWatching();
  assert.equal((await filesOf(undone.id)).length, 0, 'undone, so never needed');
  assert.equal((await filesOf(waiting.id)).length, 1, 'still in its minute, so kept');
});

test('a stuck message’s files are cleared once it is marked unknown; a held one keeps its own', async () => {
  const stuck = await inShop(() => sendEmailTo({ to: 'stuck@example.test', subject: 'S', body: 'B', attachments: [PDF] }));
  const held = await inShop(() => sendEmailTo({ to: 'held@example.test', subject: 'S', body: 'B', attachments: [PDF] }));
  await inShop(async () => {
    await prepare("UPDATE customer_messages SET intent_state = 'sending', claimed_at = ? WHERE id = ?").run(new Date(Date.now() - 60 * 60_000).toISOString(), stuck);
    await prepare("UPDATE customer_messages SET send_after = 'infinity' WHERE id = ?").run(held);
  });
  await sendWatching();
  assert.equal((await inShop(() => prepare('SELECT intent_state FROM customer_messages WHERE id = ?').get(stuck))).intent_state, 'unknown');
  assert.equal((await filesOf(stuck)).length, 0, 'stuck, so never sent again');
  assert.equal((await filesOf(held)).length, 1, 'held until Send now, so kept');
});
