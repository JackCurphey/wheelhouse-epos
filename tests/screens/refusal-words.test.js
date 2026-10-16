// The job page's and diary's refusals in plain words (issue 190 C; Jack,
// 15 Oct, docs/decisions/2026-10-15-job-page-fixes.md answer 2). The server's
// own messages are copied exactly from server/lib/sales.js,
// server/routes/sales.js and server/routes/workshop.js.
// Spec: openspec/changes/job-page-plain-refusals-rest
import test from 'node:test';
import assert from 'node:assert/strict';

const { plainWords } = await import(new URL('../../.test-build/screens/diary/refusal-words.js', import.meta.url).href);

const PLAIN = {
  'This order is already converted': "This job has been paid for, so its work and parts can't change.",
  'This order is already cancelled': "This job's order was cancelled, so its work and parts can't change.",
  "This job's order is already converted": "This job has been paid for, so its work and parts can't change.",
  'Service 7 not found or inactive': 'That service is no longer offered. Choose another.',
  'A labour line needs a description': 'The work needs a description.',
  'A labour line needs a price of zero or more': 'The work needs a price of £0.00 or more.',
  'Duration must be a positive number of minutes': 'The work needs a time of at least 1 minute.',
  'Each item needs a valid productId and positive qty': 'Each part needs a quantity of 1 or more.',
  'That day of the job was not found': 'That day has already been removed.',
  'Job not found': 'This job no longer exists.',
  'Mechanic not found or inactive': 'That mechanic is no longer working here. Choose another.',
  'Product 40 not found or inactive': 'That product is no longer sold. Choose another.',
  'This job is complete - reopen it before making changes.': 'The work is already finished. Reopen the job to change it.',
};

for (const [said, plain] of Object.entries(PLAIN)) {
  test(`"${said}" reads in plain words`, () => {
    assert.equal(plainWords(said), plain);
  });
}

test('a message already in plain English is left to show as it is', () => {
  assert.equal(plainWords("A job's first day can't be removed"), null);
  assert.equal(plainWords('That mechanic is already booked over part of that window - please choose another time.'), null);
});
