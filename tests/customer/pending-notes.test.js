// Notes with the shop on the customer's booking page (decision 3; account.mjs
// jobThread: ac-job-note, -sent, -answered; openspec/changes/notes-card).
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
const MINE = { id: 1, fromCustomer: true, from: 'You', text: 'Can you check the back light too?', at: '2026-10-05T10:15:00Z' };
const THEIRS = { id: 2, fromCustomer: false, from: 'Jo Taylor, North Street Cycles', text: 'Yes, we’ll check it.', at: '2026-10-05T11:00:00Z' };

const open = async (notes, { link = LINK, post } = {}) => {
  let thread = notes;
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES,
    bookingLink: (url, init) => {
      if (url.endsWith('/notes') && init?.method === 'POST') {
        if (post) return post;
        const body = JSON.parse(init.body);
        thread = [...thread, { id: 9, fromCustomer: true, from: 'You', text: body.text.trim(), at: '2026-10-05T12:00:00Z' }];
        return { status: 201, body: thread };
      }
      if (url.endsWith('/notes')) return { status: 200, body: thread };
      if (url.endsWith('/quote')) return { status: 404, body: { error: 'There is no quote for this booking' } };
      return { status: 200, body: link };
    },
  });
  return current;
};
const rtl = () => import('@testing-library/react');
const has = (q) => Boolean(q);

test('with no notes yet, the card asks for one: Add a note for the shop, Send note', async () => {
  const { ui } = await open([]);
  assert.ok(has(await ui.findByRole('heading', { name: 'Notes with the shop' })));
  assert.ok(has(ui.getByRole('textbox', { name: 'Add a note for the shop' })));
  assert.ok(has(ui.getByRole('button', { name: 'Send note' })));
  assert.ok(has(ui.queryByText('We’ll reply here and let you know when we do.')));
});

test('sending a note shows it as yours, says it was sent, and the box becomes Reply', async () => {
  const { ui, requests } = await open([]);
  const { fireEvent } = await rtl();
  const box = await ui.findByRole('textbox', { name: 'Add a note for the shop' });
  assert.equal(ui.getByRole('status').textContent, '', 'an empty status region waits on the page');
  fireEvent.change(box, { target: { value: '  Can you check the back light too?  ' } });
  fireEvent.click(ui.getByRole('button', { name: 'Send note' }));
  await ui.findByText('Sent. North Street Cycles will reply here, and we’ll let you know when they do.');
  // Announced: the status region was on the page before, and is filled after the send.
  assert.equal(ui.getByRole('status').textContent, 'Sent. North Street Cycles will reply here, and we’ll let you know when they do.');
  const sent = requests.filter((r) => r.method === 'POST');
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].body, { text: 'Can you check the back light too?' });
  assert.ok(has(ui.getByText('Can you check the back light too?')));
  assert.ok(has(ui.getByRole('textbox', { name: 'Reply' })));
  assert.ok(has(ui.getByRole('button', { name: 'Send' })));
});

test('an answered thread lists both sides, the shop’s on the left, with who and when', async () => {
  const { ui } = await open([MINE, THEIRS]);
  const { within } = await rtl();
  const list = within(await ui.findByRole('list', { name: 'Notes with the shop' }));
  const items = list.getAllByRole('listitem');
  assert.equal(items.length, 2);
  assert.equal(items[0].dataset.from, 'customer');
  assert.equal(items[1].dataset.from, 'shop');
  assert.ok(items[1].textContent.startsWith('Jo Taylor, North Street Cycles · '));
  assert.ok(items[1].textContent.endsWith('Yes, we’ll check it.'));
  assert.equal(has(ui.queryByText(/^Sent\. /)), false, 'not waiting on a reply');
});

test('an empty note sends nothing, and a refusal shows the shop’s words', async () => {
  const { ui, requests } = await open([], { post: { status: 400, body: { error: 'Write a note of up to 1,000 letters.' } } });
  const { fireEvent } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: 'Send note' }));
  assert.equal(requests.filter((r) => r.method === 'POST').length, 0);
  fireEvent.change(ui.getByRole('textbox', { name: 'Add a note for the shop' }), { target: { value: 'x' } });
  fireEvent.click(ui.getByRole('button', { name: 'Send note' }));
  assert.ok(has(await ui.findByText('Write a note of up to 1,000 letters.')));
});

test('the card is on the page from the bike being in the shop to after collection, not before', async () => {
  const { ui } = await open([], { link: { ...LINK, stage: 'confirmed' } });
  await ui.findByText('WH-1042');
  assert.ok(ui.queryByRole('heading', { name: 'Notes with the shop' }) === null);
});

// From the fresh review: a reply's text links back here, and the recorded
// decisions put "Add a note for the shop" on the ready page too.
for (const stage of ['ready_to_collect', 'collected']) {
  test(`the card is on the ${stage} page, with the thread`, async () => {
    const { ui } = await open([MINE, THEIRS], { link: { ...LINK, stage } });
    assert.ok(has(await ui.findByRole('heading', { name: 'Notes with the shop' })));
    assert.ok(has(ui.getByText('Yes, we’ll check it.')));
  });
}

test('a server fault says so in Wheelhouse’s words and keeps what was typed', async () => {
  const { ui } = await open([], { post: { status: 502, body: null } });
  const { fireEvent } = await rtl();
  const box = await ui.findByRole('textbox', { name: 'Add a note for the shop' });
  fireEvent.change(box, { target: { value: 'Hello' } });
  fireEvent.click(ui.getByRole('button', { name: 'Send note' }));
  assert.equal((await ui.findByRole('alert')).textContent, 'Wheelhouse couldn’t send that. Try again in a moment.');
  assert.equal(box.value, 'Hello');
});

test('notes that won’t load say so, with Try again, rather than vanishing', async () => {
  let fail = true;
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES,
    bookingLink: (url) => {
      if (url.endsWith('/notes')) return fail ? { status: 429, body: { error: 'Too many attempts' } } : { status: 200, body: [MINE] };
      if (url.endsWith('/quote')) return { status: 404, body: { error: 'No quote' } };
      return { status: 200, body: LINK };
    },
  });
  const { ui } = current;
  const { fireEvent } = await rtl();
  assert.ok(has(await ui.findByText('Wheelhouse couldn’t load your notes.')));
  fail = false;
  fireEvent.click(ui.getByRole('button', { name: 'Try again' }));
  assert.ok(has(await ui.findByText('Can you check the back light too?')));
});

test('the thread is read once, not again when the window is focused', async () => {
  const { ui, requests } = await open([MINE]);
  await ui.findByText('Can you check the back light too?');
  window.dispatchEvent(new window.Event('focus'));
  document.dispatchEvent(new window.Event('visibilitychange'));
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(requests.filter((r) => r.method === 'GET' && r.url.endsWith('/notes')).length, 1);
});

test('times are London times, as the rest of the page', async () => {
  const { ui } = await open([MINE]);
  const item = (await ui.findByRole('list', { name: 'Notes with the shop' })).querySelector('li');
  // 10:15 UTC on 5 Oct is 11:15 in London (summer time).
  assert.ok(item.textContent.startsWith('You · Mon 5 Oct, 11:15'), item.textContent);
});
