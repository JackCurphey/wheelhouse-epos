// The customer's Cycle to Work page, opened from the private link in the
// messages (cw-customer-view, cw-customer-released, cw-customer-cancelled;
// openspec/changes/cycle-to-work design 8, cycle-to-work PR 9b): where the order
// is up to, whether the bike is put aside, what's in the order and how to apply.
// A link that doesn't work says so and nothing more.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';
import { C2W_ROUTE } from '../../src/customer/routes.ts';
import { c2wLinkPath } from '../../server/c2w/customer-view.js';

let current;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const SERVICES = { shopName: 'North Street Cycles', showPrices: true, full: [], categories: [], uncategorised: [] };
const CODE = 'c'.repeat(64);
const STAGES = ['Quote given', 'Waiting for the certificate', 'Certificate received', 'Ready to collect', 'Collected'];
// The drawing's placeholders, as the server's allowed fields carry them (server/c2w/customer-view.js).
const HELD = {
  quoteRef: '[quote number]', shopName: 'North Street Cycles', place: 'Bolton', providerName: '[Provider]',
  stage: 'waiting', stageIndex: 1, stages: STAGES, state: 'held', holdUntil: '2026-09-08',
  bike: '[Bike] · [Size]', accessories: ['[Accessory]', '[Accessory]'], totalPence: 100000,
  customerPaysPence: null, collectedAt: null, howToApply: '[The shop’s own words, from Settings]',
};
const open = async (c2wLink = HELD) => {
  current = await renderBookScreen({
    file: 'screens/book/c2w.js', exportName: 'C2wScreen', at: 'cycle-to-work/:code',
    url: `/book/north/cycle-to-work/${CODE}`, services: SERVICES, c2wLink,
  });
  return current;
};
const heading = (ui) => ui.findByRole('heading', { level: 1, name: 'Your Cycle to Work bike' });
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
// A row is its label (dt) and its value (dd), read as one line.
const row = (ui, label) => { const dt = ui.getByText(label, { selector: 'dt' }); return `${text(dt)} ${text(dt.nextElementSibling)}`; };

test('the address is the one the messages link to', () => {
  assert.equal(C2W_ROUTE.replace(':shopSlug', 'north').replace(':code', CODE), c2wLinkPath('north', CODE));
});

test('put aside: the link is read with no sign-in, and the page says until when (cw-customer-view)', async () => {
  const { ui, requests } = await open();
  await heading(ui);
  assert.ok(requests.some((r) => r.url === `/api/portal/north/c2w-links/${CODE}`), JSON.stringify(requests));
  assert.equal(ui.getByRole('link', { name: /Your account/ }).getAttribute('href'), '/book/north/account');
  assert.ok(ui.getByText('Quote [quote number] · North Street Cycles, Bolton · [Provider]'));
  const top = ui.getByText('Your bike is put aside until 8 September 2026.').parentElement;
  assert.equal(text(top), 'Your bike is put aside until 8 September 2026. We’ll let you know when your certificate reaches us.');
  assert.doesNotMatch(top.parentElement.className, /wh-warn-bg/);
});

test('the five stages, the second one now; "Paid by the provider" is never shown', async () => {
  const { ui } = await open();
  await heading(ui);
  const steps = ui.getAllByRole('listitem').filter((li) => li.closest('ol[aria-label="Stages"]'));
  assert.deepEqual(steps.map((li) => text(li).replace(/^\d+ ?/, '').replace(/ ?(Done|Now)$/, '')), STAGES);
  assert.deepEqual(steps.map((li) => li.getAttribute('aria-current')), [null, 'step', null, null, null]);
  assert.match(text(steps[0]), /Done$/);
  assert.match(text(steps[1]), /Now$/);
  // Stages still to come show their number and nothing under them.
  assert.deepEqual(steps.slice(2).map(text), ['3Certificate received', '4Ready to collect', '5Collected']);
  assert.ok(ui.queryByText('Paid by the provider') === null);
});

test('the order: bike, accessories and the total with VAT; ask the shop; how to apply in the shop’s words', async () => {
  const { ui } = await open();
  await heading(ui);
  assert.equal(row(ui, 'Bike'), 'Bike [Bike] · [Size]');
  assert.equal(row(ui, 'Accessories'), 'Accessories [Accessory] · [Accessory]');
  assert.equal(row(ui, 'Total (includes VAT)'), 'Total (includes VAT) £1,000.00');
  assert.equal(ui.getByRole('link', { name: 'Ask the shop a question' }).getAttribute('href'), '/book/north/messages');
  assert.ok(ui.getByRole('heading', { level: 2, name: 'How to apply' }));
  assert.ok(ui.getByText('[The shop’s own words, from Settings]'));
});

test('a shop with one site is just its name in the quote line', async () => {
  const { ui } = await open({ ...HELD, place: null });
  await heading(ui);
  assert.ok(ui.getByText('Quote [quote number] · North Street Cycles · [Provider]'));
});

test('no longer put aside (cw-customer-released)', async () => {
  const { ui } = await open({ ...HELD, state: 'released', holdUntil: null });
  await heading(ui);
  const top = ui.getByText('Your bike is no longer put aside.').parentElement;
  assert.equal(text(top), 'Your bike is no longer put aside. We’ll still get you one when your certificate comes.');
  // Drawn as a warning, unlike the grey put-aside and cancelled lines.
  assert.match(top.parentElement.className, /wh-warn-bg/);
  assert.ok(ui.queryByText(/put aside until/) === null);
});

test('cancelled: says so, with no stages and no how to apply (cw-customer-cancelled)', async () => {
  const { ui } = await open({ ...HELD, stage: 'cancelled', stageIndex: null, state: 'cancelled', holdUntil: null, howToApply: null });
  await heading(ui);
  assert.ok(ui.getByText('This order is cancelled.'));
  // Deposits aren't built yet (question 1), so there's no deposit to speak of.
  assert.ok(ui.queryByText(/deposit/) === null);
  assert.ok(ui.queryByRole('list', { name: 'Stages' }) === null);
  assert.ok(ui.queryByRole('heading', { name: 'How to apply' }) === null);
  assert.equal(row(ui, 'Bike'), 'Bike [Bike] · [Size]');
});

test('from the certificate on, no put-aside line: the stage says it', async () => {
  const { ui } = await open({ ...HELD, stage: 'certificate', stageIndex: 2, state: null, holdUntil: null });
  await heading(ui);
  assert.ok(ui.queryByText(/put aside/) === null);
  const steps = ui.getAllByRole('listitem').filter((li) => li.closest('ol[aria-label="Stages"]'));
  assert.deepEqual(steps.map((li) => li.getAttribute('aria-current')), [null, null, 'step', null, null]);
  assert.deepEqual(steps.map(text), ['Quote givenDone', 'Waiting for the certificateDone', '3Certificate receivedNow', '4Ready to collect', '5Collected']);
});

test('no accessories and no how-to-apply words: those parts are left out', async () => {
  const { ui } = await open({ ...HELD, accessories: [], howToApply: null });
  await heading(ui);
  assert.ok(ui.queryByText('Accessories') === null);
  assert.ok(ui.queryByRole('heading', { name: 'How to apply' }) === null);
});

test('a link that doesn’t work says so; any other failure offers Try again', async () => {
  const gone = await open(() => ({ status: 404, body: { error: 'This link doesn’t work' } }));
  assert.ok(await gone.ui.findByRole('heading', { level: 1, name: 'This link doesn’t work' }));
  assert.ok(gone.ui.queryByText(/Cycle to Work bike/) === null);
  const { cleanup } = await import('@testing-library/react');
  cleanup(); current.client.clear(); current.uninstall(); current = undefined;
  const failed = await open(() => ({ status: 500, body: { error: 'Something went wrong' } }));
  assert.ok(await failed.ui.findByRole('heading', { level: 1, name: 'We couldn’t open this link' }));
  assert.ok(failed.ui.getByRole('button', { name: 'Try again' }));
});
