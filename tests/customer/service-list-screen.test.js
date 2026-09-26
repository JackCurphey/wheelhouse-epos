// The service list: sections, prices, hint-and-lock, the running summary and
// Continue.
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

const svc = (id, name, price = 20, minutes = 30) => ({ id, name, price, minutes, questions: [] });
const DATA = {
  shopName: 'North Street Cycles', showPrices: true,
  full: [{ ...svc(1, 'General service', 80, 90), includes: [{ id: 11, name: 'Brake service' }, { id: 12, name: 'Gear service' }] }],
  categories: [
    { id: 5, name: 'Brakes', services: [svc(11, 'Brake service', 25)] },
    { id: 6, name: 'Wheels', services: [svc(13, 'Wheel true', 15)] },
  ],
  uncategorised: [svc(12, 'Gear service', 22.5)],
};

const open = async ({ services = DATA, draft, search = '' } = {}) => {
  current = await renderBookScreen({
    file: 'screens/book/service-list.js', exportName: 'ServiceListScreen', at: 'services',
    url: `/book/north/services${search}`, services, draft,
  });
  await current.ui.findByRole('heading', { level: 1, name: 'Choose your services' });
  return current;
};
const card = (ui, name) => ui.getByRole('button', { name: new RegExp(`^${name}`) });
const click = async (el) => (await import('@testing-library/react')).fireEvent.click(el);

test('sections in order: full, each category, then Other; empty ones hidden', async () => {
  let { ui } = await open();
  assert.deepEqual(ui.getAllByRole('heading', { level: 2 }).map((h) => h.textContent), ['Full services', 'Brakes', 'Wheels', 'Other']);
  ui.unmount(); current.client.clear(); current.uninstall();
  ({ ui } = await open({ services: { ...DATA, full: [], uncategorised: [] } }));
  assert.deepEqual(ui.getAllByRole('heading', { level: 2 }).map((h) => h.textContent), ['Brakes', 'Wheels']);
});

test('?start scrolls to its section; no start, or an unknown start, does not scroll', async () => {
  let s = await open({ search: '?start=individual' });
  const { waitFor } = await import('@testing-library/react');
  await waitFor(() => assert.equal(s.scrolled.length, 1));
  assert.ok(s.scrolled[0] === s.ui.getByRole('heading', { level: 2, name: 'Brakes' }));
  s.ui.unmount(); current.client.clear(); current.uninstall();
  s = await open({ search: '?start=full' });
  await waitFor(() => assert.equal(s.scrolled.length, 1));
  assert.ok(s.scrolled[0] === s.ui.getByRole('heading', { level: 2, name: 'Full services' }));
  s.ui.unmount(); current.client.clear(); current.uninstall();
  s = await open();
  assert.equal(s.scrolled.length, 0);
  s.ui.unmount(); current.client.clear(); current.uninstall();
  s = await open({ search: '?start=bogus' });
  assert.equal(s.scrolled.length, 0);
});

// The frame scrolls the window to the top on every ready screen (I1); the
// list screen's own ?start scroll must still win the final position, so it
// has to run after the frame's.
test('the frame scrolls to the top before the ?start scroll runs', async () => {
  const { waitFor } = await import('@testing-library/react');
  const s = await open({ search: '?start=full' });
  await waitFor(() => assert.equal(s.scrolled.length, 1));
  assert.deepEqual(s.scrollCalls.map((c) => c.type), ['top', 'start']);
});

test('prices read "From", with the parts note, and the includes line on the full service', async () => {
  const { ui } = await open();
  assert.ok(ui.getByText('Prices are for labour. Parts are quoted separately.'));
  assert.ok(ui.getByText('From £80'));
  assert.ok(ui.getByText('From £22.50'));
  assert.ok(ui.getByText('Includes Brake service, Gear service'));
});

test('ticking a full service locks what it includes and updates the summary', async () => {
  const { ui, readDraft } = await open();
  await click(card(ui, 'General service'));
  assert.equal(card(ui, 'General service').getAttribute('aria-pressed'), 'true');
  const brake = card(ui, 'Brake service');
  assert.equal(brake.getAttribute('aria-disabled'), 'true');
  assert.ok(brake.textContent.includes('Included in your General service'));
  assert.equal(card(ui, 'Wheel true').getAttribute('aria-disabled'), null);
  assert.ok(ui.getByText('1 service · from £80'));
  assert.deepEqual(readDraft().serviceIds, [1]);
});

test('a locked service ignores taps', async () => {
  const { ui, readDraft } = await open();
  await click(card(ui, 'General service'));
  await click(card(ui, 'Brake service'));
  assert.equal(card(ui, 'Brake service').getAttribute('aria-pressed'), 'false');
  assert.deepEqual(readDraft().serviceIds, [1]);
});

test('ticking a full service takes off what it includes, and says so', async () => {
  const { ui, readDraft } = await open();
  await click(card(ui, 'Brake service'));
  await click(card(ui, 'General service'));
  assert.ok(ui.getByText("Brake service is part of your General service, so we've taken it off"));
  assert.deepEqual(readDraft().serviceIds, [1]);
  await click(card(ui, 'Wheel true'));
  assert.equal(ui.queryByText(/so we've taken it off/), null, 'the notice outlived the next tap');
});

// The card's own detail line is visual only, so a screen-reader user ticking
// through the list never hears it; the notice also has to reach the polite
// live region that already announces the running summary.
test('a taken-off notice is announced in the live region, not just the card detail', async () => {
  const { ui } = await open();
  await click(card(ui, 'Brake service'));
  await click(card(ui, 'General service'));
  const live = document.querySelector('[aria-live="polite"]');
  assert.ok(live, 'no polite live region');
  assert.ok(live.textContent.includes("Brake service is part of your General service, so we've taken it off"));
});

test('unticking the full service unlocks without re-ticking', async () => {
  const { ui } = await open({ draft: { serviceIds: [1] } });
  await click(card(ui, 'General service'));
  assert.equal(card(ui, 'Brake service').getAttribute('aria-disabled'), null);
  assert.equal(card(ui, 'Brake service').getAttribute('aria-pressed'), 'false');
});

test('Continue with nothing ticked says so and stays', async () => {
  const { ui } = await open();
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(ui.getByRole('alert').textContent.includes('Choose at least one service'));
  assert.ok(ui.queryByText(/^At /) === null);
});

// role="alert" is only announced when its content changes (or the node is
// new); pressing Continue twice with the same unresolved problem must not
// leave a screen reader silent the second time.
test('pressing Continue twice with the same problem re-announces a fresh alert', async () => {
  const { ui } = await open();
  await click(ui.getByRole('button', { name: 'Continue' }));
  const first = ui.getByRole('alert');
  await click(ui.getByRole('button', { name: 'Continue' }));
  const second = ui.getByRole('alert');
  assert.ok(first !== second, 'the alert node was not replaced on the second press');
  assert.ok(second.textContent.includes('Choose at least one service'));
});

test('Continue refuses more than 10 services and more than 12 hours', async () => {
  const many = Array.from({ length: 11 }, (_, i) => svc(100 + i, `Job ${i}`, 10, 10));
  let { ui } = await open({ services: { ...DATA, full: [], categories: [], uncategorised: many }, draft: { serviceIds: many.map((s) => s.id) } });
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(ui.getByRole('alert').textContent.includes('You can book up to 10 services at once'));
  ui.unmount(); current.client.clear(); current.uninstall();
  const long = [svc(200, 'Rebuild', 300, 400), svc(201, 'Respray', 300, 400)];
  ({ ui } = await open({ services: { ...DATA, full: [], categories: [], uncategorised: long }, draft: { serviceIds: [200, 201] } }));
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(ui.getByRole('alert').textContent.includes("That's too much work for one visit - please book the jobs separately"));
});

// The shop's includes can change server-side while the tab is open, so a
// draft that started before that change can hold both a full service and one
// of the individual ids it now includes, both ticked. The UI itself can't
// produce this locally (tapping the full service takes the individual one
// off), so the draft is seeded directly with both ticked (M3).
test('Continue drops a ticked id that is also locked by a ticked full service', async () => {
  const { ui, readDraft } = await open({ draft: { serviceIds: [11, 1] } });
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(await ui.findByText('At /book/north/problem'));
  assert.deepEqual(readDraft().serviceIds, [1]);
});

test('a good Continue saves the services in list order, drops orphaned answers and moves on', async () => {
  const answers = [{ serviceId: 13, questionId: 'q1', text: 'Front' }, { serviceId: 12, questionId: 'q2', text: 'x' }];
  const { ui, readDraft } = await open({ draft: { answers } });
  await click(card(ui, 'Wheel true'));
  await click(card(ui, 'General service'));
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(await ui.findByText('At /book/north/problem'));
  const saved = readDraft();
  assert.deepEqual(saved.serviceIds, [1, 13]);
  assert.deepEqual(saved.answers, [answers[0]]);
});

test('ticks survive a reload of the tab', async () => {
  // A real round trip, not a hand-written stored draft: tick a service
  // through the UI, capture what the draft provider actually wrote to
  // sessionStorage, unmount, then re-render the screen with that captured
  // value as its starting draft (each renderBookScreen installs a brand new
  // jsdom window, so the second render's sessionStorage starts empty
  // otherwise).
  const first = await open();
  await click(card(first.ui, 'Wheel true'));
  assert.equal(card(first.ui, 'Wheel true').getAttribute('aria-pressed'), 'true');
  const stored = first.readDraft();
  first.ui.unmount();
  current.client.clear();
  current.uninstall();
  current = undefined;

  const second = await open({ draft: stored });
  assert.equal(card(second.ui, 'Wheel true').getAttribute('aria-pressed'), 'true');
  assert.ok(second.ui.getByText('1 service · from £15'));
});

test('with prices hidden: no "From", no parts note, and a count-only summary', async () => {
  const hide = (s) => ({ ...s, price: null });
  const services = {
    ...DATA, showPrices: false,
    full: DATA.full.map(hide), categories: DATA.categories.map((c) => ({ ...c, services: c.services.map(hide) })), uncategorised: DATA.uncategorised.map(hide),
  };
  const { ui } = await open({ services, draft: { serviceIds: [13, 12] } });
  assert.ok(ui.queryByText(/From £/) === null);
  assert.ok(ui.queryByText('Prices are for labour. Parts are quoted separately.') === null);
  assert.ok(ui.getByText('2 services'));
});

test('the Not sure link clears ticks and answers and goes to the problem screen', async () => {
  const { ui, readDraft } = await open({ draft: { serviceIds: [13], answers: [{ serviceId: 13, questionId: 'q', text: 'x' }] } });
  await click(ui.getByRole('button', { name: 'Not sure what you need? Describe the problem' }));
  assert.ok(await ui.findByText('At /book/north/problem'));
  assert.deepEqual(readDraft(), { serviceIds: [], answers: [], notSure: true });
});

test('the back link returns to the first screen', async () => {
  const { ui } = await open();
  await click(ui.getByRole('link', { name: /Back/ }));
  assert.ok(await ui.findByText('At /book/north'));
});
