// The stub adapter for print and messaging (decision A). It records intent and
// claims nothing: P00b and P00c are outstanding, so the system does not know
// whether anything was printed or sent, and a stub reporting success would be
// fabricated data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recordPrintIntent, recordMessageIntent } from '../../src/lib/adapters/intent.ts';

test('a recorded print intent never claims it printed', async () => {
  const record = await recordPrintIntent(1, 'tag');
  assert.equal(record.state, 'recorded');
  assert.equal(record.deliveredAt, null);
  assert.equal(record.intent, 'print');
  assert.equal(record.kind, 'tag');
  assert.equal(record.jobId, 1);
});

test('no adapter code path can produce a delivered state', async () => {
  const source = await readFile(new URL('../../src/lib/adapters/intent.ts', import.meta.url), 'utf8');
  // A guard against the stub quietly growing a success path later.
  assert.doesNotMatch(source, /'sent'|'printed'|'delivered'/);
});

test('a recorded message intent keeps the channel and the text', async () => {
  const record = await recordMessageIntent(1, 'sms', 'Your bike is ready');
  assert.equal(record.intent, 'message');
  assert.equal(record.channel, 'sms');
  assert.equal(record.bodyText, 'Your bike is ready');
  assert.equal(record.state, 'recorded');
  assert.equal(record.deliveredAt, null);
});

test('each record has its own id and a real timestamp', async () => {
  const a = await recordPrintIntent(2, 'job-card');
  const b = await recordPrintIntent(2, 'job-card');
  assert.notEqual(a.id, b.id);
  assert.ok(!Number.isNaN(Date.parse(a.createdAt)), `createdAt is not a date: ${a.createdAt}`);
});
