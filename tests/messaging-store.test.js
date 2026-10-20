// A shop's own wording and on/off for each message (owner setup 14; the
// messages engine, Jack 20 Oct): Wheelhouse's wording until the shop changes
// it; switched off, a message isn't sent.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { templateFor, TEMPLATES } from '../server/messaging/templates.js';

let shop;
before(async () => { shop = await createTestShop(); });
after(async () => { if (shop) await deleteTestShop(shop.id); await pool.end(); });

test('with nothing changed, a message is on with Wheelhouse’s wording', async () => {
  const t = await runWithShop(shop.id, () => templateFor('bike_ready'));
  assert.equal(t.enabled, true);
  assert.equal(t.wording, TEMPLATES.bike_ready.wording);
  assert.equal(t.subject, TEMPLATES.bike_ready.subject);
  assert.equal(t.changed, false);
});

test('a shop’s own wording and subject, and switching it off', async () => {
  await runWithShop(shop.id, () => prepare(
    "INSERT INTO message_templates (key, enabled, wording, subject) VALUES ('bike_ready', false, 'Ready, [Customer’s first name]!', 'Ready')"
  ).run());
  const t = await runWithShop(shop.id, () => templateFor('bike_ready'));
  assert.equal(t.enabled, false);
  assert.equal(t.wording, 'Ready, [Customer’s first name]!');
  assert.equal(t.subject, 'Ready');
  assert.equal(t.changed, true);
});

test('a message gone back to Wheelhouse’s wording reads Wheelhouse’s again', async () => {
  await runWithShop(shop.id, () => prepare("UPDATE message_templates SET wording = NULL, subject = NULL WHERE key = 'bike_ready'").run());
  const t = await runWithShop(shop.id, () => templateFor('bike_ready'));
  assert.equal(t.wording, TEMPLATES.bike_ready.wording);
  assert.equal(t.changed, true, 'still switched off, so changed');
});

test('an unknown message is refused', async () => {
  await assert.rejects(() => runWithShop(shop.id, () => templateFor('no_such_message')), /unknown message/);
});

// Old messages never being sent again is held by the sender, which only claims
// rows with a send_after (tested with the engine), and by 048's backfill.
