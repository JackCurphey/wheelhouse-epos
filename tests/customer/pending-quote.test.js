// The quote on the customer's booking link (journey 4; drawn by quoteCard,
// answered and withdrawn in docs/design/user-journeys/generator/quote.mjs).
// The customer ticks what they want (Needed lines start ticked, Optional not),
// sees the new total, and sends their answer once; answered and withdrawn
// quotes say so. Spec: docs/superpowers/specs/2026-10-03-quote-stage-design.md (piece 3)
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
const LINK = {
  reference: 'WH-1042', shopName: 'North Street Cycles', jobDate: '2026-10-05', startTime: '09:30', description: null, bikeNote: null,
  answers: [], bike: null, stage: 'in_workshop', photoCount: 0, services: [{ name: 'Standard service', price: 65 }], totalPrice: 65,
  shop: { address: null, phone: '[shop phone]' },
};
const qline = (over) => ({ id: 1, kind: 'part', description: 'Shimano brake pads', productId: 40, quantity: 1, unitAmount: 28, decision: 'pending', lineTotal: 28, need: 'needed', reason: 'Rear pads are worn down to 1mm.', decidedVia: null, decidedAt: null, decidedByName: null, addedToOrderAt: null, ...over });
const LINES = [
  qline({}),
  qline({ id: 2, kind: 'labour', description: 'Fit and adjust brakes', productId: null, unitAmount: 18, lineTotal: 18, reason: 'Needed with the new pads.' }),
  qline({ id: 3, kind: 'part', description: 'Replace gear cable', productId: null, unitAmount: 12, lineTotal: 12, need: 'optional', reason: 'Shifting is a little stiff.' }),
];
const QUOTE = (state, lines = LINES) => ({ id: 9, workshopJobId: 1, revision: 2, state, createdAt: '2026-10-05T09:00:00Z', sentAt: '2026-10-05T10:15:00Z', lines, totals: { all: 58, approved: 0, pending: 58, declined: 0 } });

const open = async (quote, answer = null) => {
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES,
    bookingLink: (url, init) => {
      if (url.endsWith('/quote/answer')) return answer ?? { status: 200, body: { ...quote, state: 'partly_approved' } };
      if (url.endsWith('/quote')) return quote ? { status: 200, body: quote } : { status: 404, body: { error: 'There is no quote for this booking' } };
      return { status: 200, body: LINK };
    },
  });
  return current;
};
const rtl = () => import('@testing-library/react');
const has = (q) => Boolean(q);
// The phone link inside the quote card (the page's shop lines have one too).
const quotePhone = (ui) => ui.getAllByRole('link', { name: '[shop phone]' }).find((a) => a.closest('section[aria-labelledby="quote-heading"]'))?.getAttribute('href');

test('no quote, no quote card', async () => {
  const { ui } = await open(null);
  await ui.findByText('WH-1042');
  assert.equal(has(ui.queryByText('Waiting for your answer')), false);
});

test('a sent quote asks for an answer: Needed lines ticked, Optional not, prices in the labels', async () => {
  const { ui } = await open(QUOTE('sent'));
  assert.ok(has(await ui.findByText('Waiting for your answer')));
  assert.ok(has(ui.queryByRole('heading', { name: 'We recommend more work' })));
  assert.equal(ui.getByRole('checkbox', { name: /Shimano brake pads, needed, £28.00/ }).checked, true);
  assert.equal(ui.getByRole('checkbox', { name: /Replace gear cable, optional, £12.00/ }).checked, false);
  assert.ok(has(ui.queryByText('Rear pads are worn down to 1mm.')));
  assert.ok(has(ui.queryByText('£111.00')));
  assert.ok(has(ui.queryByRole('button', { name: 'Approve £111.00' })));
});

test('ticking and unticking changes the total and the button, and unticking a Needed line says it is recommended', async () => {
  const { ui } = await open(QUOTE('sent'));
  const { fireEvent } = await rtl();
  fireEvent.click(await ui.findByRole('checkbox', { name: /Replace gear cable/ }));
  assert.ok(has(ui.queryByRole('button', { name: 'Approve £123.00' })));
  fireEvent.click(ui.getByRole('checkbox', { name: /Shimano brake pads/ }));
  assert.ok(has(ui.queryByText('We recommend this.')));
  for (const name of [/Fit and adjust brakes/, /Replace gear cable/]) fireEvent.click(ui.getByRole('checkbox', { name }));
  assert.ok(has(ui.queryByRole('button', { name: 'Decline the extra work' })));
});

test('the answer is sent once, with the revision shown, and then thanks them', async () => {
  const { ui, requests } = await open(QUOTE('sent'));
  const { fireEvent } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: 'Approve £111.00' }));
  assert.ok(has(await ui.findByRole('heading', { name: 'Thanks — we’re carrying on' })));
  assert.ok(has(ui.queryByText('We’ve saved your answers. The work you agreed is going ahead.')));
  const sent = requests.filter((r) => r.method === 'POST');
  assert.equal(sent.length, 1);
  assert.match(sent[0].url, /\/booking-links\/b{64}\/quote\/answer$/);
  assert.deepEqual(sent[0].body, { revision: 2, decisions: [
    { lineId: 1, decision: 'approved' }, { lineId: 2, decision: 'approved' }, { lineId: 3, decision: 'declined' },
  ] });
});

test('if the quote changed meanwhile, it says so and asks them to look again', async () => {
  const { ui } = await open(QUOTE('sent'), { status: 409, body: { error: 'this link is for revision 2; the current quote is revision 3', code: 'illegal' } });
  const { fireEvent } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: 'Approve £111.00' }));
  assert.ok(has(await ui.findByText('The quote has changed since you opened it. Please look at it again.')));
});

test('an answered quote shows what was agreed, and what they said no to', async () => {
  const lines = [qline({ decision: 'approved' }), qline({ id: 2, description: 'Fit and adjust brakes', unitAmount: 18, lineTotal: 18, decision: 'approved' }), qline({ id: 3, description: 'Replace gear cable', unitAmount: 12, lineTotal: 12, need: 'optional', decision: 'declined' })];
  const { ui } = await open(QUOTE('partly_approved', lines));
  assert.ok(has(await ui.findByText('Answered')));
  assert.ok(has(ui.queryByText('Replace gear cable · no thanks')));
  assert.equal(has(ui.queryByRole('checkbox')), false);
});

test('an answer taken by phone says who it was with', async () => {
  const lines = LINES.map((l) => ({ ...l, decision: 'approved', decidedVia: 'phone', decidedByName: 'Jo Taylor', decidedAt: '2026-10-05T10:40:00Z' }));
  const { ui } = await open(QUOTE('approved', lines));
  assert.ok(has(await ui.findByRole('heading', { name: 'Your answers, from your call' })));
  const at = new Date('2026-10-05T10:40:00Z');
  const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  assert.ok(has(ui.queryByText(`You answered by phone with Jo Taylor at ${time}. Here’s what was agreed.`)));
});

test('a withdrawn quote has nothing to answer', async () => {
  const { ui } = await open(QUOTE('withdrawn'));
  assert.ok(has(await ui.findByText('Quote withdrawn')));
  assert.ok(has(ui.queryByRole('heading', { name: 'We’ve withdrawn this quote' })));
  assert.ok(has(ui.queryByText(/^Nothing to answer\. Call/)));
  assert.equal(quotePhone(ui), 'tel:[shop phone]');
  assert.equal(has(ui.queryByRole('checkbox')), false);
});

// Staff names only with the shop's "Show who signed off to customers" switch
// on (Jack, 22 Oct): the server sends mechanicName and decidedByName only
// then, and the card says "we" without them.
const NAMED = (state, lines = LINES) => ({ ...QUOTE(state, lines), mechanicName: 'Alex Morgan', customerFirstName: 'Maya' });

test('with the switch on, the quote is the mechanic’s recommendation, by first name', async () => {
  const { ui } = await open(NAMED('sent'));
  assert.ok(has(await ui.findByRole('heading', { name: 'Alex recommends more work' })));
  const { fireEvent } = await rtl();
  fireEvent.click(ui.getByRole('checkbox', { name: /Shimano brake pads/ }));
  assert.ok(has(ui.queryByText('Alex recommends this.')));
  assert.equal(has(ui.queryByText('We recommend this.')), false);
});

test('a sent quote offers the shop’s phone for anyone not sure', async () => {
  const { ui } = await open(QUOTE('sent'));
  assert.ok(has(await ui.findByText(/^Not sure\? Call/)));
  assert.equal(quotePhone(ui), 'tel:[shop phone]');
});

test('an answered quote thanks the customer by first name, and names the mechanic with the switch on', async () => {
  const lines = [qline({ decision: 'approved' }), qline({ id: 3, description: 'Replace gear cable', need: 'optional', decision: 'declined' })];
  const { ui } = await open(NAMED('partly_approved', lines));
  assert.ok(has(await ui.findByRole('heading', { name: 'Thanks, Maya — Alex is carrying on' })));
  assert.ok(has(ui.queryByText('We’ve saved your answers. The work you agreed is going ahead.')));
});

test('all declined: the booked service carries on, said with “we” when the switch is off', async () => {
  const lines = LINES.map((l) => ({ ...l, decision: 'declined' }));
  const { ui } = await open({ ...QUOTE('declined', lines), customerFirstName: 'Maya' });
  assert.ok(has(await ui.findByRole('heading', { name: 'Thanks, Maya — we’ll carry on with the service' })));
  assert.ok(has(ui.queryByText('You didn’t add any extra work. We’ve saved your answers.')));
});

test('all declined with the switch on names the mechanic', async () => {
  const lines = LINES.map((l) => ({ ...l, decision: 'declined' }));
  const { ui } = await open(NAMED('declined', lines));
  assert.ok(has(await ui.findByRole('heading', { name: 'Thanks, Maya — Alex will carry on with the service' })));
});

test('a phone answer with the switch off doesn’t name who took it', async () => {
  const lines = LINES.map((l) => ({ ...l, decision: 'approved', decidedVia: 'phone', decidedByName: null, decidedAt: '2026-10-05T10:40:00Z' }));
  const { ui } = await open(QUOTE('approved', lines));
  assert.ok(has(await ui.findByText(/^You answered by phone at \d\d:\d\d\. Here’s what was agreed\.$/)));
});

test('a withdrawn quote names the mechanic with the switch on', async () => {
  const { ui } = await open(NAMED('withdrawn'));
  assert.ok(has(await ui.findByRole('heading', { name: 'Alex has withdrawn this quote' })));
});
