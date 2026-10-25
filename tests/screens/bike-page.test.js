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
