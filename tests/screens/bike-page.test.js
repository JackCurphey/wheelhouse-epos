// A bike's own page (openspec/changes/bike-page; drawn as cs-bike, customer.mjs:150-183;
// Jack's answer of 15 Oct, not-drawn pages #7 and #8): back to the owner, the
// bike's name with "[Customer]’s bike" and New job; Details with Edit and
// Belongs to; Jobs on this bike, open first.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const job = (over) => ({ id: 42, reference: 'WH-1042', title: 'Standard service', jobDate: '2026-09-17', startTime: '11:30', bookingState: 'scheduled', custodyState: 'in_shop', workState: 'in_progress', mechanicName: 'Alex Morgan', open: true, at: '2026-09-17T11:30:00.000Z', ...over });
const TREK = {
  id: 7, customerId: 5, make: 'Trek', model: 'Domane AL 3', colour: 'Green', serialNumber: '[frame number]', notes: 'Black mudguards', active: true,
  customer: { id: 5, name: 'Maya Patel', phone: '07700 900142' },
  jobs: [job({}), job({ id: 30, reference: 'WH-1030', title: 'Gear tune', jobDate: '2026-06-02', custodyState: 'collected', workState: 'complete', open: false, at: '2026-06-02T10:00:00.000Z' })],
};
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let bike;
let refuse;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function open(over = {}) {
  calls = [];
  bike = { ...TREK, ...over };
  refuse = null;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/bikes/7' && method === 'PUT') {
      if (refuse) return reply(400, { error: refuse });
      bike = { ...bike, ...body };
      return reply(200, bike);
    }
    if (u.pathname === '/api/bikes/7') return reply(200, bike);
    if (u.pathname === '/api/bikes/404') return reply(404, { error: 'Bike not found' });
    if (u.pathname === '/api/bike-warranties') return reply(200, { brands: [{ id: 2, brand: 'Cube', lines: [] }, { id: 1, brand: 'Trek', lines: [] }] });
    if (u.pathname === '/api/products') return reply(200, [{ id: 3, name: 'Trek Domane AL 3', brand: 'Trek', isEbike: false }, { id: 4, name: '[Trek e-bike]', brand: 'trek', isEbike: true }, { id: 5, name: '[Cube model]', brand: 'Cube', isEbike: false }]);
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost/workshop/bikes/${over.id ?? 7}`);
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}

test('the page as drawn: back to Maya, the bike, her bike, New job, Details, Belongs to', async () => {
  const { ui } = await open();
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Trek Domane AL 3' }));
  assert.ok(ui.getByText('Maya Patel’s bike'));
  assert.equal(ui.getByRole('link', { name: 'Maya Patel' }).getAttribute('href'), '/workshop/customers/5');
  assert.equal(ui.getByRole('link', { name: 'New job' }).getAttribute('href'), '/workshop/diary?customer=5&bike=7');
  assert.ok(ui.getByText('Green'));
  assert.ok(ui.getByText('[frame number]'));
  assert.ok(ui.getByText('Black mudguards'));
  assert.ok(ui.getByRole('heading', { name: 'Belongs to' }));
  assert.ok(ui.getByText('07700 900142'));
  assert.ok(ui.queryByText('Warranty') === null, 'nothing records a bike bought here yet');
});

test('Jobs on this bike: open now first, then earlier; each opens the job', async () => {
  const { ui, within } = await open();
  const open_ = within(await ui.findByRole('list', { name: 'Open now' }));
  assert.ok(open_.getByText('WH-1042'));
  assert.equal(open_.getByRole('link').getAttribute('href'), '/workshop/diary?job=42');
  const earlier = within(ui.getByRole('list', { name: 'Earlier, newest first' }));
  assert.ok(earlier.getByText('WH-1030'));
  assert.ok(earlier.getByText('Collected'));
});

test('no jobs yet: it says so', async () => {
  const { ui } = await open({ jobs: [] });
  assert.ok(await ui.findByText('No jobs on this bike yet.'));
});

test('Edit opens the bike’s box; Save sends its fields; a refusal stays in the box', async () => {
  const { ui, fireEvent, waitFor, within } = await open();
  fireEvent.click(await ui.findByRole('button', { name: 'Edit' }));
  const box = within(await ui.findByRole('dialog', { name: 'Edit bike' }));
  assert.deepEqual(['Make', 'Model', 'Colour', 'Frame number', 'Note'].map((l) => box.getByLabelText(l).value),
    ['Trek', 'Domane AL 3', 'Green', '[frame number]', 'Black mudguards']);
  refuse = 'Make or model is required';
  fireEvent.change(box.getByLabelText('Make'), { target: { value: '' } });
  fireEvent.change(box.getByLabelText('Model'), { target: { value: '' } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  assert.ok(await box.findByText('Make or model is required'));
  refuse = null;
  fireEvent.change(box.getByLabelText('Make'), { target: { value: 'Trek' } });
  fireEvent.change(box.getByLabelText('Model'), { target: { value: 'Domane AL 3' } });
  fireEvent.change(box.getByLabelText('Colour'), { target: { value: 'Red' } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
  const put = calls.filter((c) => c.method === 'PUT').at(-1);
  assert.deepEqual(put.body, { make: 'Trek', model: 'Domane AL 3', colour: 'Red', serialNumber: '[frame number]', notes: 'Black mudguards' });
  assert.ok(await ui.findByText('Red'));
});

test('a bike that isn’t found says so', async () => {
  const { ui } = await open({ id: 404 });
  assert.ok(await ui.findByText('Bike not found'));
});

// A bike bought here (openspec/changes/finish-customers, design 6; question 19): the Warranty
// block between Details and Belongs to, as drawn on cs-bike, with each line (the plan's words).
const LINE = (part, endsOn, monthsLeft = null, ended = false) => ({ part, endsOn, monthsLeft, ended });
const UNDER = { boughtHereOn: '2026-01-15', brand: 'Trek', running: true, endedOn: null, lines: [LINE('frame', null), LINE('components', '2028-01-15', 16)] };

test('a bike bought here: Warranty, Bought here, Under warranty and each line', async () => {
  const { ui, within } = await open({ boughtHereOn: '2026-01-15', warrantyBrand: 'Trek', warranty: UNDER });
  const w = within(await ui.findByRole('region', { name: 'Warranty' }));
  assert.ok(w.getByText('Bought here'));
  assert.ok(w.getByText('15 Jan 2026'));
  assert.ok(w.getByText('Under warranty'));
  assert.deepEqual(w.getAllByRole('listitem').map((li) => li.textContent), ['Frame: lifetime', 'Components: until 15 Jan 2028, 16 months left']);
  const details = ui.getByRole('region', { name: 'Details' });
  const belongs = ui.getByRole('region', { name: 'Belongs to' });
  const block = ui.getByRole('region', { name: 'Warranty' });
  assert.ok(details.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(block.compareDocumentPosition(belongs) & Node.DOCUMENT_POSITION_FOLLOWING);
});

test('a line ended, less than a month left, every line ended, no lines for its brand', async () => {
  let t = await open({ warranty: { ...UNDER, lines: [LINE('frame', '2036-01-15', 112), LINE('components', '2026-08-15', null, true), LINE('electronics', '2026-09-20', 0)] } });
  let w = t.within(await t.ui.findByRole('region', { name: 'Warranty' }));
  assert.deepEqual(w.getAllByRole('listitem').map((li) => li.textContent), ['Frame: until 15 Jan 2036, 112 months left', 'Components: ended 15 Aug 2026', 'Electronics: until 20 Sep 2026, less than a month left']);
  t.cleanup(); shell.queryClient.clear(); uninstall();
  t = await open({ warranty: { ...UNDER, boughtHereOn: '2024-01-10', running: false, endedOn: '2025-01-10', lines: [LINE('frame', '2025-01-10', null, true)] } });
  w = t.within(await t.ui.findByRole('region', { name: 'Warranty' }));
  assert.ok(w.getByText('Warranty ended 10 Jan 2025'));
  assert.ok(w.queryByText('Under warranty') === null);
  t.cleanup(); shell.queryClient.clear(); uninstall();
  t = await open({ warranty: { ...UNDER, brand: null, running: false, lines: [] } });
  w = t.within(await t.ui.findByRole('region', { name: 'Warranty' }));
  assert.ok(w.getByText('15 Jan 2026'));
  assert.ok(w.queryByText(/^(Under warranty|Warranty ended)/) === null, 'no lines for its brand: no warranty');
});

test('Edit bike’s Bought here on: Brand starts at its Make, Model is a product of that brand, E-bike follows the model', async () => {
  const { ui, fireEvent, waitFor, within } = await open();
  fireEvent.click(await ui.findByRole('button', { name: 'Edit' }));
  const box = within(await ui.findByRole('dialog', { name: 'Edit bike' }));
  assert.ok(box.queryByLabelText('Brand') === null, 'only once it was bought here');
  fireEvent.change(box.getByLabelText('Bought here on'), { target: { value: '2026-01-15' } });
  const brand = box.getByLabelText('Brand');
  await waitFor(() => assert.equal(brand.value, 'Trek'));
  assert.deepEqual([...brand.querySelectorAll('option')].map((o) => o.textContent), ['None', 'Cube', 'Trek']);
  const model = box.getByLabelText('Model in Stock');
  await waitFor(() => assert.deepEqual([...model.querySelectorAll('option')].map((o) => o.textContent), ['Not chosen', 'Trek Domane AL 3', '[Trek e-bike]']));
  fireEvent.change(model, { target: { value: '4' } });
  assert.equal(box.getByLabelText('E-bike').checked, true);
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
  assert.deepEqual(calls.filter((c) => c.method === 'PUT').at(-1).body, { make: 'Trek', model: 'Domane AL 3', colour: 'Green', serialNumber: '[frame number]', notes: 'Black mudguards', boughtHereOn: '2026-01-15', warrantyBrand: 'Trek', warrantyProductId: 4, isEbike: true });
});

test('a Make not in Bike warranties starts with no brand; clearing Bought here on sends none; the server’s refusal shows', async () => {
  const { ui, fireEvent, waitFor, within } = await open({ make: '[Make]', boughtHereOn: '2026-01-15', warrantyBrand: null, warranty: { ...UNDER, brand: null, running: false, lines: [] } });
  fireEvent.click(await ui.findByRole('button', { name: 'Edit' }));
  const box = within(await ui.findByRole('dialog', { name: 'Edit bike' }));
  assert.equal(box.getByLabelText('Bought here on').value, '2026-01-15');
  await waitFor(() => assert.equal(box.getByLabelText('Brand').querySelectorAll('option').length, 3));
  assert.equal(box.getByLabelText('Brand').value, '');
  refuse = 'Bought here on can’t be in the future';
  fireEvent.change(box.getByLabelText('Bought here on'), { target: { value: '2026-09-02' } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  assert.ok(await box.findByText('Bought here on can’t be in the future'));
  refuse = null;
  fireEvent.change(box.getByLabelText('Bought here on'), { target: { value: '' } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
  assert.equal(calls.filter((c) => c.method === 'PUT').at(-1).body.boughtHereOn, null);
});
