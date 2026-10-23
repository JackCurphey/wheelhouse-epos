// The booking page's later stages (Jack, 21 Oct,
// docs/decisions/2026-10-21-booking-page-stages.md; openspec/changes/booking-page-stages):
// in the workshop (dq-in-shop, a plain line for now: answer 1), ready
// (cp-summary-inshop, cp-summary-checked), collected (cp-summary-collected)
// and a request the shop never answered (bk-request-expired, answer 2).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';

let current;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const SERVICES = { shopName: 'North Street Cycles', showPrices: true, full: [], categories: [], uncategorised: [] };
const CODE = 'b'.repeat(64);
const MAYA = {
  reference: 'WH-1042', shopName: 'North Street Cycles', jobDate: '2026-09-17', startTime: '11:30', description: null, bikeNote: null, answers: [],
  bike: { make: 'Trek', model: 'Domane AL 3' }, stage: 'in_workshop', photoCount: 0, services: [{ name: 'Standard service', price: 65 }], totalPrice: 65,
  dropOff: null, confirmationNote: null, canCancel: false, canChange: false, checkedBy: null,
  // The server's later-stage data (#359; booking page stages answer 4), with the drawings' figures.
  workState: 'in_progress', bookedInAt: '2026-09-17T08:42:00Z', collectedAt: null, expectedReady: { date: '2026-09-17', time: null },
  shop: { address: '[Shop address]', phone: '[shop phone]', openingHours: '[opening hours]' },
  work: [{ name: 'Standard service', price: 65 }, { name: 'Shimano brake pads', price: 28 }, { name: 'Fit & adjust brakes', price: 18 }],
  declined: [{ name: 'Replace gear cable', price: 12 }], toPay: 111, paid: null,
};

const open = async (link) => {
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES, bookingLink: { ...MAYA, ...link },
  });
  return { ...current, within: await withinOf() };
};
const h1 = (ui, name) => ui.findByRole('heading', { level: 1, name });
const withinOf = async () => (await import('@testing-library/react')).within;
const tracker = (ui) => ui.queryByRole('list', { name: 'Where your bike is' });
// Nothing from the first release's page, whose drawings these stages replace.
const noOldPage = (ui) => {
  assert.ok(ui.queryByRole('button', { name: 'Copy link' }) === null, 'no Copy link');
  assert.ok(ui.queryByText(/Need to change|Contact North Street Cycles/) === null, 'no contact line');
};

test('in the workshop: the heading, the tracker at Being worked on, when it came in and when it’s ready, the work agreed, the quote, the shop', async () => {
  const { ui, requests, within } = await open({});
  assert.ok(await h1(ui, 'Trek Domane AL 3 · Standard service'));
  assert.ok(ui.getByText('Your repair · WH-1042'));
  const steps = within(tracker(ui)).getAllByRole('listitem');
  assert.deepEqual(steps.map((s) => s.getAttribute('aria-current')), [null, null, 'step', null]);
  assert.deepEqual(steps.map((s) => Boolean(s.querySelector('[data-done]'))), [true, true, false, false]);
  assert.ok(ui.getByText('We’ve got your bike — booked in Thu 17 Sep at 09:42. Expected ready: Thu 17 Sep.'));
  const agreed = within(ui.getByRole('region', { name: 'Work agreed' }));
  assert.ok(agreed.getByText('Shimano brake pads'));
  assert.ok(agreed.getByText('£28.00'));
  // The sum of its own lines, whatever the discount on the amount to pay.
  assert.ok(agreed.getByText('£111.00'));
  const { waitFor } = await import('@testing-library/react');
  await waitFor(() => assert.ok(requests.some((r) => r.url.endsWith('/quote')), 'asks for any quote'));
  noOldPage(ui);
});

test('in the shop, not started yet: the tracker’s current step is In the shop', async () => {
  const { ui, within } = await open({ workState: 'not_started' });
  await h1(ui, 'Trek Domane AL 3 · Standard service');
  assert.deepEqual(within(tracker(ui)).getAllByRole('listitem').map((s) => s.getAttribute('aria-current')), [null, 'step', null, null]);
});

test('waiting for a part: the drawn warning, announced, then the ready day, in place of the booked-in line', async () => {
  const { ui } = await open({ workState: 'waiting_parts' });
  await ui.findByText('Waiting for a part — we’ll update you.');
  const warn = ui.getAllByRole('status').find((el) => el.textContent.includes('Waiting for a part'));
  assert.ok(warn, 'announced');
  assert.equal(warn.textContent, 'Waiting for a part — we’ll update you.');
  assert.ok(ui.getByText('Expected ready: Thu 17 Sep.'));
  assert.ok(ui.queryByText(/We’ve got your bike/) === null);
});

test('with no booked-in time the plain line stays', async () => {
  const { ui } = await open({ bookedInAt: null, expectedReady: null });
  assert.ok(await ui.findByText('Your bike is in the workshop'));
});

test('ready: the bike’s name, every step ticked with Ready current, pay at the counter, who checked it', async () => {
  const { ui, within } = await open({ stage: 'ready_to_collect', checkedBy: 'Alex Morgan' });
  assert.ok(await h1(ui, 'Your Trek Domane AL 3 is ready'));
  const steps = within(tracker(ui)).getAllByRole('listitem');
  assert.deepEqual(steps.map((s) => s.textContent), ['Booked', 'In the shop', 'Being worked on', 'Ready']);
  assert.deepEqual(steps.map((s) => s.getAttribute('aria-current')), [null, null, null, 'step']);
  const pay = within(ui.getByRole('region', { name: 'To pay when you collect' }));
  assert.ok(pay.getByText('£111.00'));
  assert.ok(pay.getByText('Pay at the counter by card or cash. When you come in, just give your name.'));
  assert.equal(document.querySelector('[data-checked-by]').textContent, 'Checked by Alex Morgan');
  noOldPage(ui);
});

test('ready with no bike named says “Your bike”', async () => {
  const { ui } = await open({ stage: 'ready_to_collect', bike: null });
  assert.ok(await h1(ui, 'Your bike is ready'));
});

// "What we did" comes from the job now (#359), so the quote isn't asked for
// once the work is done.
for (const stage of ['ready_to_collect', 'collected']) {
  test(`${stage} no longer asks for the quote`, async () => {
    const { ui, requests } = await open({ stage });
    await ui.findByRole('list', { name: 'Where your bike is' });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(requests.some((r) => r.url.endsWith('/quote')), false);
  });
}

test('collected: the heading, the tracker, and the Collected card', async () => {
  const { ui } = await open({ stage: 'collected', collectedAt: '2026-09-18T15:00:00Z', toPay: null, paid: { at: '2026-09-18T14:55:00Z', amount: 111 } });
  assert.ok(await h1(ui, 'Your Trek Domane AL 3 has been collected'));
  assert.ok(tracker(ui) !== null);
  assert.ok(ui.getByRole('heading', { level: 2, name: 'Collected' }));
  assert.ok(ui.getByText('Collected · Fri 18 Sep'));
  assert.ok(ui.getByText('£111.00 paid. Thanks for coming in — this page keeps working until Sun 18 Oct, 30 days after collection.'));
  assert.ok(ui.queryByText(/To pay when you collect/) === null);
  noOldPage(ui);
});

test('collected names nobody as checking it: its drawing has no Checked by', async () => {
  const { ui } = await open({ stage: 'collected', checkedBy: 'Alex Morgan' });
  await h1(ui, 'Your Trek Domane AL 3 has been collected');
  assert.ok(ui.queryByText(/Checked by/) === null);
});

test('a request the shop didn’t answer in time: Not booked, why, nothing booked, another date', async () => {
  const { ui } = await open({ stage: 'request_expired' });
  assert.ok(await h1(ui, 'Sorry, we couldn’t get back to you in time'));
  assert.ok(ui.getByText('Not booked'));
  assert.ok(ui.getByText('North Street Cycles couldn’t answer your request for Thursday 17 September, 11:30 in time, so it has expired.'));
  assert.ok(ui.getByText('Nothing is booked.'));
  assert.equal(ui.getByRole('link', { name: 'Choose another date' }).getAttribute('href'), '/book/north');
  noOldPage(ui);
});

test('an expired request with no time names the day alone', async () => {
  const { ui } = await open({ stage: 'request_expired', startTime: '' });
  assert.ok(await ui.findByText('North Street Cycles couldn’t answer your request for Thursday 17 September in time, so it has expired.'));
});

test('the customer’s own words show on the later pages', async () => {
  const { ui } = await open({ stage: 'ready_to_collect', description: 'Rear brake squeals' });
  assert.ok(await ui.findByText('Rear brake squeals'));
});

// What we did, the money, the shop and the expired pages (#359; cp-summary,
// cp-summary-inshop, cp-summary-paid, cp-expired, bk-expired; answer 4).
test('ready: What we did lists the work and what was declined, after the pay card', async () => {
  const { ui, within } = await open({ stage: 'ready_to_collect' });
  const did = await ui.findByRole('region', { name: 'What we did' });
  assert.ok(within(did).getByText('Fit & adjust brakes'));
  assert.ok(within(did).getByText('£18.00'));
  assert.ok(within(did).getByText('Not done — you said no thanks: Replace gear cable (£12.00)'));
  assert.ok(ui.getByRole('region', { name: 'To pay when you collect' }).compareDocumentPosition(did) & 4, 'the pay card comes first');
});

test('with prices hidden, the work and the pay card show without figures', async () => {
  const { ui, within } = await open({ stage: 'ready_to_collect', toPay: null, work: [{ name: 'Standard service', price: null }], declined: [{ name: 'Replace gear cable', price: null }] });
  const did = within(await ui.findByRole('region', { name: 'What we did' }));
  assert.ok(did.getByText('Standard service'));
  assert.ok(did.getByText('Not done — you said no thanks: Replace gear cable'));
  assert.ok(ui.queryByText(/£/) === null);
  assert.ok(ui.getByRole('region', { name: 'To pay when you collect' }));
});

test('paid already: the Paid card, nothing more to pay', async () => {
  const { ui, within } = await open({ stage: 'ready_to_collect', toPay: null, paid: { at: '2026-09-17T13:10:00Z', amount: 111 } });
  const paid = within(await ui.findByRole('region', { name: 'Paid' }));
  assert.ok(paid.getByText('£111.00 paid on Thu 17 Sep'));
  assert.ok(paid.getByText('Nothing more to pay. When you come in, just give your name.'));
  assert.ok(ui.queryByRole('region', { name: 'To pay when you collect' }) === null);
});

test('the shop’s lines: its name, opening hours, address and phone to call', async () => {
  const { ui } = await open({ stage: 'ready_to_collect' });
  await h1(ui, 'Your Trek Domane AL 3 is ready');
  const line = document.querySelector('[data-shop-line]');
  assert.ok(line.textContent.includes('North Street Cycles'));
  assert.ok(line.textContent.includes('Open [opening hours]'));
  assert.ok(line.textContent.includes('[Shop address] · [shop phone]'));
  assert.equal(ui.getByRole('link', { name: '[shop phone]' }).getAttribute('href'), 'tel:[shop phone]');
});

const openExpired = async (body) => {
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES, bookingLink: () => ({ status: 410, body }),
  });
  return current;
};
const SHOP_410 = { name: 'North Street Cycles', address: '[Shop address]', phone: '[shop phone]' };

test('a collected job’s link, expired: which job, and the shop', async () => {
  const { ui } = await openExpired({ error: 'This link has expired', reference: 'WH-1042', reason: 'collected', shop: SHOP_410 });
  assert.ok(await h1(ui, 'This link has expired'));
  assert.ok(ui.getByText('It was for job WH-1042, which has been collected. If you need a copy of anything, get in touch.'));
  assert.ok(document.querySelector('[data-shop-line]').textContent.includes('[Shop address] · [shop phone]'));
});

test('a booking that never came in, expired: Book a repair', async () => {
  const { ui } = await openExpired({ error: 'This link has expired', reference: 'WH-1042', reason: 'never_came_in', shop: SHOP_410 });
  assert.ok(await h1(ui, 'This booking link has expired'));
  assert.ok(ui.getByText('It was for WH-1042. A booking’s link stops working 30 days after collection — or, if the bike never came in, 30 days after the booked date.'));
  assert.equal(ui.getByRole('link', { name: 'Book a repair' }).getAttribute('href'), '/book/north');
});

// Fresh review, 21 Oct.
test('the Work agreed total adds up its lines, even with a discount on what is to pay', async () => {
  const { ui, within } = await open({ toPay: 99.9 });
  const agreed = within(await ui.findByRole('region', { name: 'Work agreed' }));
  assert.ok(agreed.getByText('£111.00'));
});

test('nothing to pay: the card says so, not "Pay at the counter"', async () => {
  const { ui, within } = await open({ stage: 'ready_to_collect', toPay: 0, nothingToPay: true });
  const pay = within(await ui.findByRole('region', { name: 'To pay when you collect' }));
  assert.ok(pay.getByText('Nothing to pay on collection. When you come in, just give your name.'));
  assert.ok(pay.queryByText(/Pay at the counter/) === null);
  assert.ok(pay.queryByText('£0.00') === null);
});

test('an answered quote isn’t listed again while the bike is in: Work agreed has its lines', async () => {
  const { ui, requests } = await open({});
  await h1(ui, 'Trek Domane AL 3 · Standard service');
  const { waitFor } = await import('@testing-library/react');
  await waitFor(() => assert.ok(requests.some((r) => r.url.endsWith('/quote'))));
  // The page asks for the quote only to show one waiting for an answer.
  assert.ok(ui.queryByText('Answered') === null);
});

test('“until” counts 30 days on the shop’s own calendar, across the clocks going back', async () => {
  // 23:30 UTC on 21 Oct is 00:30 on 22 Oct in the shop; 30 days on is 21 Nov.
  const { ui } = await open({ stage: 'collected', collectedAt: '2026-10-21T23:30:00Z', toPay: null, paid: null });
  assert.ok(await ui.findByText('Thanks for coming in — this page keeps working until Sat 21 Nov, 30 days after collection.'));
  assert.ok(ui.getByText('Collected · Thu 22 Oct'));
});

// The checklist (cp-summary's "Full service checklist"; Workshop day 21: a
// ticked item with no note reads "All working well"; audit M1, Jack 30 Sep:
// a note is "What the mechanic found:", and a line counts the checks done;
// UX walk-through 1 L5: the checks not done are named).
const CHECKLIST = { name: 'Full service checklist', items: ['Frame & fork', 'Wheels & tyres', 'Tyre pressure', 'Brakes bled & adjusted', 'Gears indexed',
  'Chain & drivetrain', 'Bottom bracket', 'Headset', 'Cables & housing', 'Bolts torqued'].map((name, i) => ({
  name, done: i < 8, note: i === 3 ? 'The rear pads are worn. We recommend replacing the pads and adjusting the brake.' : null })) };

test('ready: the checklist lists the checks done, what the mechanic found, and names the ones not done', async () => {
  const { ui, within } = await open({ stage: 'ready_to_collect', checklist: CHECKLIST });
  const box = await ui.findByRole('region', { name: 'Full service checklist' });
  const rows = within(box).getAllByRole('listitem');
  assert.equal(rows.length, 8, 'only the checks done are listed');
  assert.ok(rows[0].textContent.includes('Frame & fork') && rows[0].textContent.includes('All working well'));
  assert.ok(rows[3].textContent.includes('What the mechanic found: The rear pads are worn. We recommend replacing the pads and adjusting the brake.'));
  assert.ok(!rows[3].textContent.includes('All working well'));
  assert.ok(within(box).getByText('8 of 10 checks done. Not done: Cables & housing, Bolts torqued.'));
  assert.ok(ui.getByRole('region', { name: 'What we did' }).compareDocumentPosition(box) & 4, 'after What we did');
});

test('every check done: the count names none not done; no checklist, no card', async () => {
  const all = { ...CHECKLIST, items: CHECKLIST.items.map((i) => ({ ...i, done: true })) };
  const first = await open({ stage: 'collected', checklist: all });
  assert.ok(await first.ui.findByText('10 of 10 checks done.'));
  first.cleanup?.();
  const { ui } = await open({ stage: 'ready_to_collect', checklist: null });
  await ui.findByRole('region', { name: 'What we did' });
  assert.ok(ui.queryByRole('region', { name: 'Full service checklist' }) === null);
});
