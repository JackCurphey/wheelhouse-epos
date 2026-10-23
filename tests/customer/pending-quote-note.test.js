// "Add a note for the shop" from the quote and from Work agreed (quote.mjs:
// quoteCard's "Not sure? Call [shop phone], or", and agreed(); the mock-up
// sends it to the note box, ac-job-note; openspec/changes/quote-note-button).
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
const qline = (over) => ({ id: 1, kind: 'part', description: 'Shimano brake pads', productId: 40, quantity: 1, unitAmount: 28, decision: 'pending', lineTotal: 28, need: 'needed', reason: 'Rear pads are worn down to 1mm.', decidedVia: null, decidedAt: null, decidedByName: null, addedToOrderAt: null, goesWithLineId: null, without: null, photoId: null, ...over });
const QUOTE = { id: 9, workshopJobId: 1, revision: 1, state: 'sent', createdAt: '2026-10-05T09:00:00Z', sentAt: '2026-10-05T10:15:00Z', lines: [qline()], totals: { all: 28, approved: 0, pending: 28, declined: 0 } };
const THEIRS = { id: 2, fromCustomer: false, from: 'Jo Taylor, North Street Cycles', text: 'Yes, we’ll check it.', at: '2026-10-05T11:00:00Z' };

const open = async ({ link = LINK, quote = QUOTE, notes = [] } = {}) => {
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES,
    bookingLink: (url) => {
      if (url.endsWith('/notes')) return { status: 200, body: notes };
      if (url.endsWith('/quote')) return quote ? { status: 200, body: quote } : { status: 404, body: { error: 'There is no quote for this booking' } };
      return { status: 200, body: link };
    },
  });
  return current;
};
const rtl = () => import('@testing-library/react');
const quoteCard = (ui) => ui.getByRole('heading', { name: 'We recommend more work' }).closest('section');

test('the quote card ends “Not sure? Call [shop phone], or” and the note button', async () => {
  const { ui } = await open();
  const { within } = await rtl();
  await ui.findByRole('heading', { name: 'Notes with the shop' });
  const card = within(quoteCard(ui));
  const line = card.getByText(/^Not sure\? Call/).closest('p, div');
  assert.equal(line.textContent, 'Not sure? Call [shop phone], or Add a note for the shop');
  assert.ok(card.getByRole('button', { name: 'Add a note for the shop' }));
});

test('the quote card’s button puts the cursor in the note box', async () => {
  const { ui } = await open();
  const { fireEvent, within } = await rtl();
  const box = await ui.findByRole('textbox', { name: 'Add a note for the shop' });
  fireEvent.click(within(quoteCard(ui)).getByRole('button', { name: 'Add a note for the shop' }));
  assert.ok(document.activeElement === box);
});

test('with notes already there, the button goes to the Reply box', async () => {
  const { ui } = await open({ notes: [THEIRS] });
  const { fireEvent, within } = await rtl();
  const box = await ui.findByRole('textbox', { name: 'Reply' });
  fireEvent.click(within(quoteCard(ui)).getByRole('button', { name: 'Add a note for the shop' }));
  assert.ok(document.activeElement === box);
});

test('Work agreed ends with the note button, which goes to the box too', async () => {
  const answered = { ...QUOTE, state: 'approved', lines: [qline({ decision: 'approved', decidedVia: 'link', addedToOrderAt: '2026-10-05T11:00:00Z' })] };
  const { ui } = await open({ quote: answered, link: { ...LINK, work: [{ name: 'Standard service', price: 65 }, { name: 'Shimano brake pads', price: 28 }] } });
  const { fireEvent, within } = await rtl();
  const box = await ui.findByRole('textbox', { name: 'Add a note for the shop' });
  const agreed = within(ui.getByRole('heading', { name: 'Work agreed' }).closest('section, div'));
  fireEvent.click(agreed.getByRole('button', { name: 'Add a note for the shop' }));
  assert.ok(document.activeElement === box);
});

test('without the notes card, the quote card offers the phone only', async () => {
  const { ui } = await open({ link: { ...LINK, stage: 'confirmed' } });
  const { within } = await rtl();
  await ui.findByRole('heading', { name: 'We recommend more work' });
  const card = within(quoteCard(ui));
  assert.equal(card.getByText(/^Not sure\? Call/).textContent, 'Not sure? Call [shop phone].');
  assert.ok(card.queryByRole('button', { name: 'Add a note for the shop' }) === null);
});
