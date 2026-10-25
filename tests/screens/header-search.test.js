// The header search, the screens (openspec/changes/header-search; staff-search
// in app-map.mjs; the header's box and button in diary.mjs): on every staff
// page, results as links grouped Jobs then Customers, nothing found, and the
// phone's button with the box over the page.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
// The drawing's example: WH-1042, Maya Patel's Trek Domane AL 3, expected.
const MAYA_JOB = { id: 42, reference: 'WH-1042', title: 'Standard service', jobDate: '2026-09-17', startTime: '11:30', bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', customerName: 'Maya Patel', bikeLabel: 'Trek Domane AL 3' };
const MAYA = { id: 5, name: 'Maya Patel', phone: '07700 900142', email: 'maya@example.com' };
// Her Trek, as the bike's page draws it (cs-bike, customer.mjs).
const TREK = { id: 7, make: 'Trek', model: 'Domane AL 3', colour: 'Green', serialNumber: '[frame number]', customerId: 5, customerName: 'Maya Patel' };

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let searches;
let calls;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function open(path = '/workshop/today', { phone = false } = {}) {
  searches = [];
  calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/search') {
      const q = u.searchParams.get('q');
      searches.push(q);
      if (q.toLowerCase().includes('trek')) return reply(200, { jobs: [], customers: [], bikes: [TREK, { ...TREK, id: 8, colour: '', serialNumber: '' }] });
      return reply(200, q.toLowerCase().includes('maya') ? { jobs: [MAYA_JOB], customers: [MAYA], bikes: [] } : { jobs: [], customers: [], bikes: [] });
    }
    if (u.pathname === '/api/your-settings') return reply(200, { accessibility: { statusSymbols: false, reduceMotion: false, noAutoClose: false, largerText: false, foldedSidebar: false } });
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost${path}`);
  if (phone) window.matchMedia = (q) => ({ matches: q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {} });
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { level: 1 });
  return { ...rtl, ui };
}

test('every staff page has the search box in its header', async () => {
  for (const path of ['/workshop/today', '/workshop/diary', '/workshop/settings']) {
    const { ui, cleanup } = await open(path);
    assert.ok(ui.getByRole('banner').querySelector('input[type="search"][aria-label="Search jobs, customers and bikes"]'), path);
    cleanup();
    uninstall();
  }
});

test('typing finds the jobs and the customers, grouped, each a link to its page, with a count', async () => {
  const { ui, fireEvent, within } = await open();
  const box = ui.getByRole('searchbox', { name: 'Search jobs, customers and bikes' });
  // Typed a letter at a time: one search, once typing stops.
  for (const value of ['m', 'ma', 'may', 'maya']) {
    fireEvent.change(box, { target: { value } });
    await new Promise((r) => setTimeout(r, 60));
  }
  const results = within(await ui.findByRole('region', { name: 'Search results' }));
  const jobs = within(results.getByRole('group', { name: 'Jobs' }));
  const job = jobs.getByRole('link', { name: 'WH-1042 · Maya Patel' });
  assert.equal(job.getAttribute('href'), '/workshop/diary?job=42');
  assert.ok(jobs.queryByText('Trek Domane AL 3 · Standard service · Expected · Thu 17 Sep') !== null);
  const customers = within(results.getByRole('group', { name: 'Customers' }));
  assert.equal(customers.getByRole('link', { name: 'Maya Patel' }).getAttribute('href'), '/workshop/customers/5');
  assert.ok(customers.queryByText('Customer · 07700 900142') !== null);
  assert.ok(ui.getByRole('status').textContent === '2 results');
  assert.deepEqual(searches, ['maya'], 'one search once typing stops');
});

test('nothing found says so, and one letter doesn’t search', async () => {
  const { ui, fireEvent } = await open();
  const box = ui.getByRole('searchbox', { name: 'Search jobs, customers and bikes' });
  fireEvent.change(box, { target: { value: 'z' } });
  await new Promise((r) => setTimeout(r, 400));
  assert.deepEqual(searches, []);
  fireEvent.change(box, { target: { value: 'zz' } });
  const results = (await import('@testing-library/react')).within(await ui.findByRole('region', { name: 'Search results' }));
  assert.ok(results.queryByText('Nothing matches “zz”') !== null, 'said in the results, not only to a screen reader');
});

test('Escape clears the results and stays in the box', async () => {
  const { ui, fireEvent, waitFor } = await open();
  const box = ui.getByRole('searchbox', { name: 'Search jobs, customers and bikes' });
  box.focus();
  fireEvent.change(box, { target: { value: 'maya' } });
  await ui.findByRole('region', { name: 'Search results' });
  fireEvent.keyDown(box, { key: 'Escape' });
  await waitFor(() => assert.ok(ui.queryByRole('region', { name: 'Search results' }) === null));
  assert.equal(box.value, '');
});

test('on a phone, the search button opens the box over the page; Close search and Escape shut it', async () => {
  const { ui, fireEvent, waitFor, within } = await open('/workshop/today', { phone: true });
  const button = ui.getByRole('button', { name: 'Search jobs, customers and bikes' });
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  fireEvent.click(button);
  const sheet = within(await ui.findByRole('dialog', { name: 'Search' }));
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  const box = sheet.getByRole('searchbox', { name: 'Search jobs, customers and bikes' });
  await waitFor(() => assert.ok(document.activeElement === box, 'the box takes the focus'));
  fireEvent.change(box, { target: { value: 'maya' } });
  assert.ok((await sheet.findByRole('link', { name: 'WH-1042 · Maya Patel' })) !== null);
  fireEvent.click(sheet.getByRole('button', { name: 'Close search' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'Search' }) === null));
  assert.ok(document.activeElement === button, 'back to the button');
  fireEvent.click(button);
  fireEvent.keyDown(await ui.findByRole('dialog', { name: 'Search' }), { key: 'Escape' });
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'Search' }) === null));
});

test('picking a job while already on the diary opens it there (review)', async () => {
  const { ui, fireEvent, waitFor } = await open('/workshop/diary');
  fireEvent.change(ui.getByRole('searchbox', { name: 'Search jobs, customers and bikes' }), { target: { value: 'maya' } });
  fireEvent.click(await ui.findByRole('link', { name: 'WH-1042 · Maya Patel' }));
  await waitFor(() => assert.ok(calls.some((c) => c.endsWith('/api/workshop-jobs/42')), 'the diary didn’t open the job'));
});

test('the count is said in one place that’s always there, so a screen reader hears it change (review)', async () => {
  const { ui, fireEvent, waitFor } = await open();
  const status = document.querySelector('[data-search-status]');
  assert.ok(status, 'a status line before anything is typed');
  fireEvent.change(ui.getByRole('searchbox', { name: 'Search jobs, customers and bikes' }), { target: { value: 'maya' } });
  await waitFor(() => assert.equal(status.textContent, '2 results'));
  assert.ok(status.isConnected, 'the same line, not a new one');
});

// Bikes (openspec/changes/bike-search): after Customers, each opening its page.
test('a bike is found under Bikes, a link to its page with its owner, colour and frame number', async () => {
  const { ui, fireEvent, within, waitFor } = await open();
  fireEvent.change(ui.getByRole('searchbox', { name: 'Search jobs, customers and bikes' }), { target: { value: 'trek' } });
  const results = within(await ui.findByRole('region', { name: 'Search results' }));
  const bikes = within(results.getByRole('group', { name: 'Bikes' }));
  const links = bikes.getAllByRole('link', { name: 'Trek Domane AL 3' });
  assert.deepEqual(links.map((a) => a.getAttribute('href')), ['/workshop/bikes/7', '/workshop/bikes/8']);
  assert.ok(bikes.queryByText('Maya Patel · Green · [frame number]') !== null);
  assert.ok(bikes.queryByText('Maya Patel') !== null, 'what’s blank is left out');
  await waitFor(() => assert.equal(document.querySelector('[data-search-status]').textContent, '2 results'));
});
