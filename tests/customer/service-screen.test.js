// The first book screen: Full services / Individual services / Not sure.
// Spec: docs/superpowers/specs/2026-09-26-book-d2-service-screens-design.md
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

const svc = (id, name) => ({ id, name, price: null, minutes: 30, questions: [] });
const BOTH = {
  shopName: 'North Street Cycles', showPrices: false,
  full: [{ ...svc(1, 'General service'), includes: [] }],
  categories: [{ id: 5, name: 'Brakes', services: [svc(11, 'Brake service')] }],
  uncategorised: [],
};

const open = async (services = BOTH, draft) => {
  current = await renderBookScreen({ file: 'screens/book/service.js', exportName: 'ServiceScreen', at: '', url: '/book/north', services, draft });
  await current.ui.findByRole('heading', { level: 1, name: 'What do you need?' });
  return current;
};

test('Full services opens the list at the full section', async () => {
  const { fireEvent } = await import('@testing-library/react');
  const { ui } = await open();
  fireEvent.click(ui.getByRole('button', { name: /^Full services/ }));
  assert.ok(await ui.findByText('At /book/north/services?start=full'));
});

test('Individual services opens the list at the individual sections', async () => {
  const { fireEvent } = await import('@testing-library/react');
  const { ui } = await open();
  fireEvent.click(ui.getByRole('button', { name: /^Individual services/ }));
  assert.ok(await ui.findByText('At /book/north/services?start=individual'));
});

test('Not sure clears any ticks and answers and goes to the problem screen', async () => {
  const { fireEvent } = await import('@testing-library/react');
  const { ui, readDraft } = await open(BOTH, { serviceIds: [11], answers: [{ serviceId: 11, questionId: 'q', text: 'x' }] });
  fireEvent.click(ui.getByRole('button', { name: /^Not sure/ }));
  assert.ok(await ui.findByText('At /book/north/problem'));
  assert.deepEqual(readDraft(), { serviceIds: [], answers: [], notSure: true });
});

test('opening a list clears Not sure but keeps ticked services', async () => {
  const { fireEvent } = await import('@testing-library/react');
  const { ui, readDraft } = await open(BOTH, { notSure: true, serviceIds: [11] });
  fireEvent.click(ui.getByRole('button', { name: /^Full services/ }));
  await ui.findByText('At /book/north/services?start=full');
  assert.deepEqual(readDraft(), { serviceIds: [11] });
});

test('a kind the shop does not offer hides its card', async () => {
  let { ui } = await open({ ...BOTH, full: [] });
  assert.equal(ui.queryByRole('button', { name: /^Full services/ }), null);
  assert.ok(ui.getByRole('button', { name: /^Individual services/ }));
  ui.unmount();
  current.client.clear(); current.uninstall();
  ({ ui } = await open({ ...BOTH, categories: [], uncategorised: [svc(12, 'Gear service')] }));
  assert.ok(ui.getByRole('button', { name: /^Individual services/ }), 'uncategorised counts as individual');
});

test('a shop with nothing bookable says so and offers no options', async () => {
  const { ui } = await open({ ...BOTH, full: [], categories: [] });
  assert.ok(ui.getByText("This shop isn't taking bookings online at the moment - please contact them directly"));
  assert.equal(ui.queryAllByRole('button').length, 0);
});

test('the cards carry their detail lines', async () => {
  const { ui } = await open();
  for (const t of ['Whole-bike services', 'Single jobs, like brakes or gears', "Tell us what's wrong and we'll advise"]) {
    assert.ok(ui.getByText(t), t);
  }
});
