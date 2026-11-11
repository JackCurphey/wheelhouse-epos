// The Reports page (openspec/changes/reports-sales-and-takings, group 2;
// drawn as rp-home in generator/reports.mjs; Jack's answers 1 and 2 of 10 Nov).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openReports, closeReports, HOME, STAFF, calls } from '../helpers/reports-screen.js';

afterEach(closeReports);
const home = { '/api/reports/home': () => [200, HOME] };

test('Reports opens with the date and shop, this week\'s takings so far and the Sales card', async () => {
  const { ui, within } = await openReports('/workshop/reports', { answers: home });
  assert.ok(await ui.findByText('Thursday 17 September · North Street Cycles, Bolton') !== null);
  const strip = within(await ui.findByRole('region', { name: 'So far: Mon 14 – Thu 17 September' }));
  assert.ok(strip.queryByText('Takings') !== null);
  assert.ok(strip.queryByText('£88.00') !== null);
  // The shop's name opens its Sales report (rp-home: answer 3 of the third walk).
  assert.equal(strip.getByRole('link', { name: /North Street Cycles, Bolton/ }).getAttribute('href'), '/workshop/reports/sales');
  const cards = within(await ui.findByRole('region', { name: 'Ready-made reports' }));
  const sales = cards.getByRole('link', { name: /^Sales/ });
  assert.equal(sales.getAttribute('href'), '/workshop/reports/sales');
  assert.ok(within(sales).queryByText('Takings, number of sales and the average sale') !== null);
  // The drawing's "and till" is left out while closes are per shop (Jack's answer 4).
  const cash = cards.getByRole('link', { name: /Takings and cash-ups/ });
  assert.equal(cash.getAttribute('href'), '/workshop/reports/takings');
  assert.ok(within(cash).queryByText('Each closed day, and any cash difference') !== null);
});

test('only reports that are built have a card, and no Margin tile on the strip', async () => {
  const { ui, within } = await openReports('/workshop/reports', { answers: home });
  const cards = within(await ui.findByRole('region', { name: 'Ready-made reports' }));
  assert.deepEqual(cards.getAllByRole('link').map((a) => a.querySelector('span')?.textContent), ['Sales', 'Takings and cash-ups', 'Workshop', 'Returning customers', 'Margin and stock value', 'VAT']);
  assert.ok(cards.queryByText('Jobs, labour and parts, how full each mechanic was') !== null);
  for (const name of ['Discounts and refunds', 'Your reports']) {
    assert.ok(cards.queryByText(name) === null, name);
  }
  assert.ok(ui.queryByText('Margin') === null);
  assert.ok(ui.queryByRole('region', { name: 'Your reports' }) === null);
});

test('the Owner sees Reports in the sidebar and Staff do not', async () => {
  const owner = await openReports('/workshop/reports', { answers: home });
  assert.ok((await owner.ui.findAllByRole('link', { name: 'Reports' })).length > 0);
  await closeReports();
  const { ui } = await openReports('/workshop/today', { who: STAFF });
  await ui.findAllByRole('link', { name: 'Today' });
  assert.ok(ui.queryByRole('link', { name: 'Reports' }) === null);
});

test('a refusal from the server is shown in its own words, with no figures', async () => {
  const { ui } = await openReports('/workshop/reports', { answers: { '/api/reports/home': () => [403, { error: "Only the shop's owner can see reports", code: 'owner_only' }] } });
  assert.ok(await ui.findByText("Only the shop's owner can see reports") !== null);
  assert.ok(ui.queryByText('£88.00') === null);
  assert.equal(calls.filter((c) => c.path === '/api/reports/home').length >= 1, true);
});
