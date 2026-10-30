// The shop's privacy requests (openspec/changes/delete-account, design 7;
// cs-list's link, cs-privacy, ac-privacy-requests, cs-privacy-delete and
// ac-customer-delete in customer.mjs and account.mjs; customer service
// decision 9; coverage walks answers 4 and 5; Jack's 30 Oct answer 3).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', isOwner: false };
const MAYA = { id: 7, reference: 'PR-7', customerId: 5, name: 'Maya Patel', kind: 'delete', source: 'account', askedOn: '2026-10-30', dueBy: '2026-11-30', overdue: false, doneOn: null, inTheWay: [{ jobId: 42, reference: 'WH-1042' }] };
const OLIVER = { id: 8, reference: 'PR-8', customerId: 6, name: 'Oliver Chen', kind: 'delete', source: 'account', askedOn: '2026-09-01', dueBy: '2026-10-01', overdue: true, doneOn: null, inTheWay: [] };
const COPY = { id: 3, reference: 'PR-3', customerId: 5, name: 'Maya Patel', kind: 'copy', source: 'account', askedOn: '2026-10-29', dueBy: '2026-11-29', overdue: false, doneOn: '2026-10-29', inTheWay: [] };
const GONE = { id: 2, reference: 'PR-2', customerId: 9, name: null, kind: 'delete', source: 'account', askedOn: '2026-09-02', dueBy: '2026-10-02', overdue: false, doneOn: '2026-09-20', inTheWay: [] };
const CUSTOMER = { id: 5, name: 'Maya Patel', phone: '07700 900142', email: 'maya@example.test', notes: '', address: null, postcode: null, marketingPermission: false, groups: [], deletionRequest: { askedOn: '2026-10-30', dueBy: '2026-11-30', source: 'account', inTheWay: [{ jobId: 42, reference: 'WH-1042' }] } };

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function open(at, { who = OWNER, requests = [OLIVER, MAYA, COPY, GONE], deleteReply = null } = {}) {
  calls = [];
  let list = requests;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url: String(url), method });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, who);
    if (u.pathname === '/api/recent-customers') return reply(200, []);
    if (u.pathname === '/api/privacy-requests/open-count') return reply(200, { openCount: list.filter((r) => !r.doneOn).length });
    if (u.pathname === '/api/privacy-requests') return who.isOwner ? reply(200, { requests: list, openCount: list.filter((r) => !r.doneOn).length }) : reply(403, { error: 'Only the shop’s owner can deal with privacy requests', code: 'owner_only' });
    const del = /^\/api\/privacy-requests\/(\d+)\/delete$/.exec(u.pathname);
    if (del && method === 'POST') {
      if (deleteReply) return reply(...deleteReply);
      list = list.map((r) => (r.id === Number(del[1]) ? { ...r, name: null, doneOn: '2026-10-30' } : r));
      return reply(200, { ok: true });
    }
    if (u.pathname === '/api/customers/5') return reply(200, CUSTOMER);
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost${at}`);
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}

test('Customers shows “Privacy requests · [n] open” to the Owner, opening the list', async () => {
  const { ui } = await open('/workshop/customers');
  const link = await ui.findByRole('link', { name: 'Privacy requests · 2 open' });
  assert.equal(link.getAttribute('href'), '/workshop/customers/privacy');
});

test('Staff see no Privacy requests link', async () => {
  const { ui } = await open('/workshop/customers', { who: JO });
  await ui.findByRole('heading', { level: 2, name: 'Recent customers' });
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(ui.queryByRole('link', { name: /Privacy requests/ }) === null);
});

test('the list: each request with who, what, where from, asked and due; overdue marked; done ones by reference', async () => {
  const { ui, within } = await open('/workshop/customers/privacy');
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Privacy requests' }));
  assert.ok(ui.getByText('When someone asks for a copy of what the shop holds about them, or for it to be deleted. Answer within one month.'));
  assert.ok(ui.getAllByRole('link', { name: 'Customers' }).every((a) => a.getAttribute('href') === '/workshop/customers'));
  const rows = within(await ui.findByRole('list', { name: 'Privacy requests' })).getAllByRole('listitem');
  const text = rows.map((r) => r.textContent);
  assert.match(text[0], /^Oliver Chen · Delete their detailsOverdue · From their account on the website · asked Tue 1 Sep · answer by Thu 1 Oct/);
  assert.match(text[1], /^Maya Patel · Delete their detailsFrom their account on the website · asked Fri 30 Oct · answer by Mon 30 Nov/);
  assert.match(text[1], /Still in the way: bike in the workshop, WH-1042/);
  assert.equal(text[2], 'Maya Patel · Copy of their dataAsked Thu 29 Oct · done Thu 29 OctDone');
  assert.equal(text[3], 'PR-2 · Delete their detailsAsked Wed 2 Sep · done Sun 20 SepDone');
  // Maya's bike holds hers back; Oliver's can go.
  const mayaDelete = within(rows[1]).getByRole('button', { name: 'Delete their details' });
  assert.equal(mayaDelete.disabled, true);
  assert.equal(document.getElementById(mayaDelete.getAttribute('aria-describedby')).textContent, 'Can be deleted once the bike is collected.');
  assert.equal(within(rows[0]).getByRole('button', { name: 'Delete their details' }).disabled, false);
});

test('Delete their details asks first, then deletes and the row is done, by its reference', async () => {
  const { ui, within } = await open('/workshop/customers/privacy');
  const rows = within(await ui.findByRole('list', { name: 'Privacy requests' })).getAllByRole('listitem');
  within(rows[0]).getByRole('button', { name: 'Delete their details' }).click();
  const box = within(await ui.findByRole('dialog', { name: 'Delete Oliver Chen’s details?' }));
  assert.ok(box.getByText('A privacy request asked on Tue 1 Sep'));
  assert.ok(box.getByText('Their name, phone, email, address, note and bikes are removed. Sales and jobs stay in the books without their name, because the shop must keep them for tax. This can’t be undone.'));
  assert.ok(box.getByRole('button', { name: 'Keep their details' }));
  box.getByRole('button', { name: 'Delete their details' }).click();
  assert.ok(await ui.findByText('PR-8 · Delete their details'));
  assert.ok(calls.some((c) => c.url.endsWith('/api/privacy-requests/8/delete') && c.method === 'POST'));
  assert.ok(ui.queryByRole('dialog') === null);
});

test('a deletion the shop refuses says why in the pop-up', async () => {
  const { ui, within } = await open('/workshop/customers/privacy', { deleteReply: [409, { error: 'Can be deleted once the bike is collected.', code: 'in_the_way', inTheWay: [] }] });
  const rows = within(await ui.findByRole('list', { name: 'Privacy requests' })).getAllByRole('listitem');
  within(rows[0]).getByRole('button', { name: 'Delete their details' }).click();
  const box = within(await ui.findByRole('dialog'));
  box.getByRole('button', { name: 'Delete their details' }).click();
  assert.equal((await box.findByRole('alert')).textContent, 'Can be deleted once the bike is collected.');
});

test('Staff opening the list are told it’s the Owner’s', async () => {
  const { ui } = await open('/workshop/customers/privacy', { who: JO });
  assert.ok(await ui.findByText('Only the shop’s owner can see privacy requests.'));
});

test('the customer page shows her request, and what’s in the way', async () => {
  const { ui } = await open('/workshop/customers/5');
  const line = await ui.findByRole('note');
  assert.equal(line.textContent, 'Asked to delete their account on Fri 30 Oct · from their account on the website · answer by Mon 30 Nov. Still in the way: bike in the workshop, WH-1042.');
});
