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
  assert.ok(has(ui.queryByText('We’ll reply here and text you when we do.')));
});

test('sending a note shows it as yours, says it was sent, and the box becomes Reply', async () => {
  const { ui, requests } = await open([]);
  const { fireEvent } = await rtl();
  fireEvent.change(await ui.findByRole('textbox', { name: 'Add a note for the shop' }), { target: { value: '  Can you check the back light too?  ' } });
  fireEvent.click(ui.getByRole('button', { name: 'Send note' }));
  assert.ok(has(await ui.findByText('Sent. North Street Cycles will reply here, and we’ll text you when they do.')));
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

test('the card is on the page while the bike is in the shop, as drawn', async () => {
  const { ui } = await open([], { link: { ...LINK, stage: 'confirmed' } });
  await ui.findByText('WH-1042');
  assert.ok(ui.queryByRole('heading', { name: 'Notes with the shop' }) === null);
});
