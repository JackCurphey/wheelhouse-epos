// The messages engine's wording (Jack, 20 Oct, docs/decisions/2026-10-20-messages-engine.md;
// openspec/changes/messages-engine): Wheelhouse's wording for each message,
// and filling in its tap-ins; a tap-in with nothing to fill is left out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, LIVE_KEYS, render } from '../server/messaging/templates.js';

test('every message has a name, when it goes, wording, an email subject and its tap-ins', () => {
  for (const [key, t] of Object.entries(TEMPLATES)) {
    for (const field of ['name', 'when', 'wording', 'subject']) assert.ok(t[field], `${key}.${field}`);
    assert.ok(Array.isArray(t.tapIns) && t.tapIns.length, `${key}.tapIns`);
    // Every tap-in its wording uses is one it offers.
    for (const [, name] of t.wording.matchAll(/\[([^\]]+)\]/g)) assert.ok(t.tapIns.includes(name), `${key}: [${name}]`);
  }
});

test('the approved booking wording and the first live messages', () => {
  assert.equal(TEMPLATES.booking_confirmed.wording,
    'Hi [Customer’s first name], your [Service] at [Shop name] is booked for [Booked day and time]. [When to drop off] [Your note on the confirmation] See or change your booking: [Link to the booking] — no app or sign-in needed. Your repair · [Job number].');
  assert.equal(TEMPLATES.bike_ready.name, 'Bike ready');
  // The booking messages staff answers send (Jack, 20 Oct), and from 21 Oct
  // the customer's side: Request received and Booking cancelled.
  // Work added within your limit, Quote reminder and Your answers joined 22 Oct (openspec/changes/spend-limit-within, quote-reminder, your-answers-message).
  assert.deepEqual(LIVE_KEYS, ['quote_to_approve', 'quote_reminder', 'work_within_limit', 'your_answers', 'shop_reply', 'bike_ready', 'request_received', 'booking_confirmed', 'time_offered', 'request_declined', 'date_change_answered', 'booking_cancelled']);
  assert.deepEqual(Object.keys(TEMPLATES).filter((k) => TEMPLATES[k].group === 'booking'),
    ['request_received', 'booking_confirmed', 'time_offered', 'request_declined', 'date_change_answered', 'booking_cancelled']);
});

test('render fills tap-ins, and leaves out any with nothing to fill, tidily', () => {
  const words = 'Hi [Customer’s first name], your [Bike] is ready. [Amount to pay] to pay. Job [Job number].';
  assert.equal(render(words, { 'Customer’s first name': 'Maya', Bike: 'Trek Domane AL 3', 'Amount to pay': '£111.00', 'Job number': 'WH-1042' }),
    'Hi Maya, your Trek Domane AL 3 is ready. £111.00 to pay. Job WH-1042.');
  assert.equal(render('Booked. [When to drop off] [Your note on the confirmation] See: [Link to the booking].', { 'Link to the booking': 'https://x/y' }),
    'Booked. See: https://x/y.');
  assert.equal(render('Hi [Customer’s first name], hello.', {}), 'Hi, hello.');
});

// Fresh review: tidying touches only where a tap-in was left out, never what
// the shop or a value wrote.
test('render leaves the shop’s own punctuation and links alone', () => {
  assert.equal(render('Wait... [Customer’s first name]!!', { 'Customer’s first name': 'Maya' }), 'Wait... Maya!!');
  assert.equal(render('See: [Link to the job].', { 'Link to the job': 'https://x.co/a..b?q=1,,2' }), 'See: https://x.co/a..b?q=1,,2.');
  assert.equal(render('Note: “[The shop’s message]” Thanks.', { 'The shop’s message': 'Wait...' }), 'Note: “Wait...” Thanks.');
  assert.equal(render('Note: “[The shop’s message]” Thanks.', {}), 'Note: Thanks.');
});

test('Bike ready keeps the decided wording: the amount, then “to pay on collection”', () => {
  assert.equal(TEMPLATES.bike_ready.wording,
    'Hi [Customer’s first name], your [Bike] is ready to collect from [Shop name]. [Amount to pay] to pay on collection. See what we did: [Link to the job]. Job [Job number]. We’re open [Opening hours].');
});
