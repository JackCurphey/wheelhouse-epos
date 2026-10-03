// Migration 038: what the quote stage needs (Jack, 3 Oct: "1"). Quote lines
// gain Needed/Optional, a reason, how and when they were decided and by whom,
// and when an approved line joined the job's work and parts; quotes gain
// sent_at and the state 'withdrawn'. Additive only.
// Spec: docs/superpowers/specs/2026-10-03-quote-stage-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const column = async (table, name) => (await pool.query(
  'SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
  [table, name],
)).rows[0];
const inShop = (fn) => runWithShop(owner.shop.id, fn);
async function newQuote(state = 'draft') {
  const job = await inShop(() => prepare("INSERT INTO workshop_jobs (title, job_date) VALUES ('x', '2030-02-04')").run());
  const q = await inShop(() => prepare('INSERT INTO workshop_quotes (workshop_job_id, state) VALUES (?, ?)').run(job.lastInsertRowid, state));
  return q.lastInsertRowid;
}

test('quote lines gain need, reason, how and when decided, by whom, and when added to the job', async () => {
  const expected = {
    need: 'text', reason: 'text', decided_via: 'text', decided_by_login_id: 'integer',
    decided_at: 'timestamp with time zone', added_to_order_at: 'timestamp with time zone',
  };
  for (const [name, type] of Object.entries(expected)) {
    const c = await column('workshop_quote_lines', name);
    assert.ok(c, `${name} missing`);
    assert.equal(c.data_type, type, name);
  }
  assert.equal((await column('workshop_quote_lines', 'need')).is_nullable, 'NO');
});

test('a line is Needed unless it says Optional, and nothing else', async () => {
  const quoteId = await newQuote();
  await inShop(() => prepare("INSERT INTO workshop_quote_lines (workshop_quote_id, kind, description, unit_amount) VALUES (?, 'part', 'Pads', 18)").run(quoteId));
  const row = await inShop(() => prepare('SELECT need FROM workshop_quote_lines WHERE workshop_quote_id = ?').get(quoteId));
  assert.equal(row.need, 'needed');
  await assert.rejects(() => inShop(() => prepare("INSERT INTO workshop_quote_lines (workshop_quote_id, kind, description, unit_amount, need) VALUES (?, 'part', 'Pads', 18, 'maybe')").run(quoteId)));
});

test('a decision is made online, by phone or in the shop, and nothing else', async () => {
  const quoteId = await newQuote();
  await assert.rejects(() => inShop(() => prepare("INSERT INTO workshop_quote_lines (workshop_quote_id, kind, description, unit_amount, decided_via) VALUES (?, 'part', 'Pads', 18, 'email')").run(quoteId)));
});

test('quotes gain sent_at and can be withdrawn', async () => {
  assert.equal((await column('workshop_quotes', 'sent_at')).data_type, 'timestamp with time zone');
  const id = await newQuote('withdrawn');
  const row = await inShop(() => prepare('SELECT state FROM workshop_quotes WHERE id = ?').get(id));
  assert.equal(row.state, 'withdrawn');
  await assert.rejects(() => newQuote('cancelled'));
});
