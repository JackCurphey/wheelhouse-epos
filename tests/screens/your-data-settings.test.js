// Settings › Office › Your data (openspec/changes/your-data-download group 3; drawn as
// set-data-export in generator/setup.mjs; Jack's 10 Nov answers 2 and 7): the fold
// Download everything, its four ticked rows, the note and the button; the waiting and
// failure states (small one 8, not drawn: logged).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const DETAILS = { name: 'North Street Cycles', address: null, phone: null, email: null, vatNumber: null, receiptFooter: null };
const NAME = 'North Street Cycles data 2026-09-01.zip';
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let downloads;
let clicked;
let answer;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

const zipReply = () => ({
  status: 200, ok: true,
  headers: new Headers({ 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${NAME}"; filename*=UTF-8''${encodeURIComponent(NAME)}` }),
  blob: async () => new Blob(['PK']),
});

async function openOffice({ query = 'room=office', reply = zipReply, leftOut = 0 } = {}) {
  downloads = 0;
  clicked = [];
  answer = reply;
  globalThis.fetch = async (url) => {
    const u = new URL(url, 'http://localhost');
    const json = (status, b) => ({ status, ok: status < 300, json: async () => b });
    if (u.pathname === '/api/auth/me') return json(200, OWNER);
    if (u.pathname === '/api/shop-details') return json(200, DETAILS);
    if (u.pathname === '/api/settings/your-data/download') { downloads += 1; return answer(); }
    if (u.pathname === '/api/settings/your-data') return json(200, { leftOut });
    return json(200, []);
  };
  uninstall = installDom(`http://localhost/workshop/settings?${query}`);
  window.URL.createObjectURL = () => 'blob:held';
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function click() { clicked.push(this.download); };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findAllByText('Office');
  return { ...rtl, ui };
}

async function unfold(t) {
  const fold = await t.ui.findByRole('button', { name: /^Download everything.*Customers, sales/ });
  if (fold.getAttribute('aria-expanded') !== 'true') t.fireEvent.click(fold);
  return fold;
}

test('Office shows Shop and sites, then Your data, with its words; Jump to offers both', async () => {
  const t = await openOffice();
  const data = await t.ui.findByRole('heading', { name: 'Your data' });
  const jump = t.within(t.ui.getByRole('navigation', { name: 'Jump to' }));
  assert.deepEqual(jump.getAllByRole('link').map((a) => a.textContent), ['Shop and sites', 'Your data']);
  const shop = t.ui.getByRole('heading', { name: 'Shop and sites' });
  assert.ok(shop.compareDocumentPosition(data) & Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(t.ui.getByText('Take a copy of everything, and see who changed what in Settings.'));
  assert.ok(t.ui.getByText('The shop and its sites, the people who work here, and your data.'));
  assert.ok(t.ui.getByText('The shop’s details, its sites and their opening hours.'), 'Shop and sites keeps its words');
  assert.ok(t.ui.queryByRole('button', { name: /^Settings changes/ }) === null, 'no Settings changes until the activity log');
});

test('Download everything is summarised, and opens to the four ticked rows, the note and the button', async () => {
  const t = await openOffice();
  const fold = await unfold(t);
  assert.match(fold.textContent, /Customers, sales, stock, jobs/);
  const rows = t.within(await t.ui.findByRole('list', { name: 'What the download holds' })).getAllByRole('listitem').map((li) => li.textContent);
  assert.deepEqual(rows, ['Customers', 'Daily figures', 'Sales and refunds', 'Stock', 'Workshop jobs']);
  assert.ok(t.ui.getByText('Spreadsheets that open in Excel or Google Sheets — yours to keep, whatever happens.'));
  assert.ok(t.ui.getByRole('button', { name: 'Download everything' }));
  assert.equal(downloads, 0, 'nothing is made until the button is pressed');
});

test('pressing it says Preparing your download…, disabled and announced, then the file downloads by its name', async () => {
  let release;
  const held = new Promise((r) => { release = r; });
  const t = await openOffice({ reply: async () => { await held; return zipReply(); } });
  await unfold(t);
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Download everything' }));
  const waiting = await t.ui.findByRole('button', { name: 'Preparing your download…' });
  const disabled = waiting.disabled;
  const announced = waiting.closest('[aria-live="polite"]') !== null;
  release();
  await t.waitFor(() => assert.deepEqual(clicked, [NAME]));
  await t.ui.findByRole('button', { name: 'Download everything' });
  assert.equal(disabled, true, 'disabled while it is made');
  assert.ok(announced, 'announced to screen readers');
  assert.equal(downloads, 1);
});

test('a failed download shows The download didn’t start. with Try again, which works and keeps the focus', async () => {
  const t = await openOffice({ reply: () => ({ status: 500, ok: false, headers: new Headers(), json: async () => ({ error: 'Internal error' }) }) });
  await unfold(t);
  const list = await t.ui.findByRole('list', { name: 'What the download holds' });
  // Screen readers read out a status area that is already there when its words arrive (review).
  const status = list.parentElement.querySelector('[role="status"]');
  assert.ok(status !== null, 'the status area is there before anything fails');
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Download everything' }));
  await t.ui.findByText('The download didn’t start.');
  assert.ok(status.isConnected && status.textContent.includes('The download didn’t start.'), 'the words arrive in that same area');
  assert.equal(t.ui.getByRole('button', { name: 'Download everything' }).disabled, false, 'the button works again');
  answer = zipReply;
  const again = t.ui.getByRole('button', { name: 'Try again' });
  again.focus();
  t.fireEvent.click(again);
  await t.waitFor(() => assert.deepEqual(clicked, [NAME]));
  await t.waitFor(() => assert.ok(t.ui.queryByText('The download didn’t start.') === null));
  // Try again goes with the warning: the focus moves to the button, not the top of the page.
  await t.waitFor(() => assert.ok(document.activeElement === t.ui.getByRole('button', { name: 'Download everything' })));
});

test('a shop name with ’ downloads by its own name, not the plain stand-in', async () => {
  const real = 'Jack’s Bikes data 2026-09-01.zip';
  const reply = () => ({ ...zipReply(), headers: new Headers({ 'content-type': 'application/zip', 'content-disposition': `attachment; filename="Jack_s Bikes data 2026-09-01.zip"; filename*=UTF-8''${encodeURIComponent(real)}` }) });
  const t = await openOffice({ reply });
  await unfold(t);
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Download everything' }));
  await t.waitFor(() => assert.deepEqual(clicked, [real]));
});

test('with Citrus Lime rows left out, the list gains Left out from Citrus Lime and how many (group 4)', async () => {
  const t = await openOffice({ leftOut: 2 });
  await unfold(t);
  const list = await t.ui.findByRole('list', { name: 'What the download holds' });
  await t.waitFor(() => assert.equal(t.within(list).getAllByRole('listitem').length, 5));
  assert.deepEqual(t.within(list).getAllByRole('listitem').map((li) => li.textContent), ['Customers', 'Daily figures', 'Sales and refunds', 'Stock', 'Workshop jobs', 'Left out from Citrus Lime · 2 rows']);
});

test('one row left out reads 1 row', async () => {
  const t = await openOffice({ leftOut: 1 });
  await unfold(t);
  await t.ui.findByText('Left out from Citrus Lime · 1 row');
});

test('?room=office&fold=download-everything opens with it unfolded', async () => {
  const t = await openOffice({ query: 'room=office&fold=download-everything' });
  const fold = await t.ui.findByRole('button', { name: /^Download everything.*Customers, sales/ });
  assert.equal(fold.getAttribute('aria-expanded'), 'true');
  assert.ok(await t.ui.findByRole('list', { name: 'What the download holds' }));
});

test('on a phone, the Office room lists Your data', async () => {
  const t = await openOffice({ query: '' });
  const rooms = await t.ui.findByRole('navigation', { name: 'Settings rooms' });
  const office = t.within(rooms).getByRole('link', { name: /^Office/ });
  assert.match(office.textContent, /Shop and sites, your data/);
});
