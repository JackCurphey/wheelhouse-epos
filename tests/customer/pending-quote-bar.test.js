// The quote's answer bar (openspec/changes/quote-pinned-bar; Jack, 1 Oct,
// docs/decisions/2026-10-01-drop-off-and-quote-review.md decision 8): on a
// tablet or phone the new total, "Your answers are final once sent." and the
// one button sit in a bar pinned along the bottom (quoteBar in
// docs/design/user-journeys/generator/quote.mjs); on a computer they stay in
// the quote.
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
const qline = (over) => ({ id: 1, kind: 'part', description: 'Shimano brake pads', productId: 40, quantity: 1, unitAmount: 28, decision: 'pending', lineTotal: 28, need: 'needed', reason: 'Rear pads worn — replacing', decidedVia: null, decidedAt: null, decidedByName: null, addedToOrderAt: null, goesWithLineId: null, without: null, photoId: null, ...over, lineTotalPence: over?.lineTotalPence ?? Math.round((over?.lineTotal ?? 28) * 100) });
// The drawing's three lines (quote.mjs NEW_LINES): fitting goes with the pads.
const LINES = [
  qline({}),
  qline({ id: 2, kind: 'labour', description: 'Fit & adjust brakes', productId: null, unitAmount: 18, lineTotal: 18, reason: 'Goes together with the new pads', goesWithLineId: 1 }),
  qline({ id: 3, description: 'Replace gear cable', productId: null, unitAmount: 12, lineTotal: 12, need: 'optional', reason: 'Cable still serviceable' }),
];
const QUOTE = (state, lines = LINES) => ({ id: 9, workshopJobId: 1, revision: 2, state, createdAt: '2026-10-05T09:00:00Z', sentAt: '2026-10-05T10:15:00Z', lines, totals: { all: 58, approved: 0, pending: 58, declined: 0 } });

// A phone: a touch screen, narrower than a computer.
const PHONE = (q) => q.includes('pointer: coarse') || q.includes('max-width');
// A tablet held sideways: a touch screen, as wide as a computer.
const TABLET = (q) => q.includes('pointer: coarse');

const open = async (quote, { media, answer } = {}) => {
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES, media,
    bookingLink: (url) => {
      if (url.endsWith('/quote/answer')) return answer ?? { status: 200, body: { ...quote, state: 'partly_approved' } };
      if (url.endsWith('/quote')) return { status: 200, body: quote };
      return { status: 200, body: LINK };
    },
  });
  return current;
};
const rtl = () => import('@testing-library/react');
const bar = () => document.querySelector('[data-book-pinned]');
const card = () => document.querySelector('section[aria-labelledby="quote-heading"]');

for (const [size, media] of [['phone', PHONE], ['tablet', TABLET]]) {
  test(`on a ${size} the new total, the final-answer line and the button sit in a bar pinned along the bottom`, async () => {
    const { ui } = await open(QUOTE('sent'), { media });
    const { within } = await rtl();
    await ui.findByText('Waiting for your answer');
    assert.ok(bar() !== null, 'no pinned bar');
    const b = within(bar());
    assert.ok(b.queryByText('New total') !== null);
    assert.ok(b.queryByText('£111.00') !== null);
    assert.ok(b.queryByText('Your answers are final once sent.') !== null);
    assert.ok(b.queryByRole('button', { name: 'Approve £111.00' }) !== null);
    // The total is in a polite live area inside the bar (quoteBar's aria-live).
    assert.equal(b.getByText('£111.00').closest('[aria-live]')?.getAttribute('aria-live'), 'polite');
    // The quote keeps its New total line, but not the final-answer line or the
    // button (quote.mjs inCard). The bar sits inside the quote's section, so
    // what's in the bar doesn't count.
    const c = within(card());
    const outsideBar = (els) => els.filter((el) => !bar().contains(el));
    assert.equal(outsideBar(c.queryAllByText('New total')).length, 1);
    assert.equal(outsideBar(c.queryAllByText('Your answers are final once sent.')).length, 0);
    assert.equal(outsideBar(c.queryAllByRole('button', { name: /Approve|Decline the extra work/ })).length, 0);
  });
}

test('unticking the pads takes the fitting with them: the bar says £65.00 and Decline the extra work', async () => {
  const { ui } = await open(QUOTE('sent'), { media: PHONE });
  const { fireEvent, within } = await rtl();
  fireEvent.click(await ui.findByRole('checkbox', { name: /Shimano brake pads/ }));
  const b = within(bar());
  assert.ok(b.queryByText('£65.00') !== null);
  assert.ok(b.queryByRole('button', { name: 'Decline the extra work' }) !== null);
});

test('the bar\'s button sends at once, with no pop-up, and the bar goes once answered', async () => {
  const { ui, requests } = await open(QUOTE('sent'), { media: PHONE });
  const { fireEvent, within } = await rtl();
  await ui.findByText('Waiting for your answer');
  fireEvent.click(within(bar()).getByRole('button', { name: 'Approve £111.00' }));
  assert.ok((await ui.findByRole('heading', { name: 'Thanks — we’re carrying on' })) !== null);
  assert.ok(ui.queryByRole('dialog') === null);
  assert.equal(requests.filter((r) => r.method === 'POST').length, 1);
  assert.ok(bar() === null, 'the bar stayed after the answer');
  assert.equal(document.querySelector('main').style.paddingBottom, '', 'room kept after the answer');
  assert.equal(document.documentElement.style.scrollPaddingBottom, '', 'scroll padding kept after the answer');
});

test('a failed send says so in the bar, where the button was tapped', async () => {
  const { ui } = await open(QUOTE('sent'), { media: PHONE, answer: { status: 409, body: { error: 'this link is for revision 2; the current quote is revision 3', code: 'illegal' } } });
  const { fireEvent, within } = await rtl();
  await ui.findByText('Waiting for your answer');
  fireEvent.click(within(bar()).getByRole('button', { name: 'Approve £111.00' }));
  const said = await within(bar()).findByText('The quote has changed since you opened it. Please look at it again.');
  // An alert of its own, not inside the bar's polite area too, so it's read once.
  assert.ok(said.closest('[aria-live]') === null, 'the message is inside a live area as well as an alert');
  // The message makes the bar taller, so the room under it grows too.
  const { waitFor } = await rtl();
  await waitFor(() => assert.equal(document.querySelector('main').style.paddingBottom, '13rem'));
});

test('no bar for a quote already answered or withdrawn', async () => {
  const answered = (state, decision) => QUOTE(state, LINES.map((l) => ({ ...l, decision })));
  const cases = [
    [answered('approved', 'approved'), 'Answered'], [answered('partly_approved', 'approved'), 'Answered'],
    [answered('declined', 'declined'), 'Answered'], [QUOTE('withdrawn'), 'Quote withdrawn'],
    [QUOTE('approved', LINES.map((l) => ({ ...l, decision: 'approved', decidedVia: 'limit' }))), 'Work added'],
    // Shown to customers by the server (quotes.js) but with nothing to answer.
    [QUOTE('superseded'), null], [QUOTE('expired'), null],
  ];
  for (const [quote, words] of cases) {
    const state = quote.state;
    const { ui, requests } = await open(quote, { media: PHONE });
    if (words) await ui.findByText(words);
    else {
      // Nothing to see for these: wait for the quote to arrive and the page to settle.
      const { waitFor } = await rtl();
      await waitFor(() => assert.ok(requests.some((r) => r.url.endsWith('/quote'))));
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(bar() === null, `a bar on a ${state} quote`);
    assert.equal(document.documentElement.style.scrollPaddingBottom, '', `room kept for a bar on a ${state} quote`);
    const { cleanup } = await rtl();
    cleanup(); current.client.clear(); current.uninstall(); current = undefined;
  }
});

test('the page leaves room under the bar, and Tab never lands behind it', async () => {
  const { ui } = await open(QUOTE('sent'), { media: PHONE });
  await ui.findByText('Waiting for your answer');
  assert.ok(document.documentElement.style.scrollPaddingBottom !== '', 'no scroll padding under the bar');
  assert.equal(document.querySelector('main').style.paddingBottom, '9rem', 'no room left under the bar');
  assert.equal(document.documentElement.style.scrollPaddingBottom, '9rem');
});

test('a computer window narrower than a computer\'s gets the bar too', async () => {
  const { ui } = await open(QUOTE('sent'), { media: (q) => q.includes('max-width') });
  await ui.findByText('Waiting for your answer');
  assert.ok(bar() !== null);
});

test('on a computer there is no bar: the line and the button stay in the quote', async () => {
  const { ui } = await open(QUOTE('sent'));
  const { within } = await rtl();
  await ui.findByText('Waiting for your answer');
  assert.ok(bar() === null);
  const c = within(card());
  assert.ok(c.queryByText('Your answers are final once sent.') !== null);
  assert.ok(c.queryByRole('button', { name: 'Approve £111.00' }) !== null);
});
