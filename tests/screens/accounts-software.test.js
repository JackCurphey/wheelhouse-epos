// Settings › Office › Your data › Accounts software (openspec/changes/reports-accounts-and-reopen, accounts-software
// spec; drawn as rp-accounts-connect, rp-accounts-map, rp-accounts-missing and rp-accounts-disconnect in
// generator/reports.mjs; Jack's answers 2 and 3 of 12 Nov). The answers are the shapes server/routes/accounts.js
// sends; tests/accounts-software.test.js proves the server sends them.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const DETAILS = { name: 'North Street Cycles', address: null, phone: null, email: null, vatNumber: null, receiptFooter: null };
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

const ACCOUNTS = Array.from({ length: 4 }, (_, i) => ({ id: `xero-${i + 1}`, name: `[Xero account ${i + 1}]` }));
const GROUPS = [
  { key: 'sales', title: 'Sales go to', lines: [['sales:Accessories', 'Accessories', true], ['sales:Labour', 'Labour', true]] },
  { key: 'money', title: 'Money taken goes to', lines: [['money:cash', 'Cash', true], ['money:online', 'Online sales (paid on the website)', true]] },
  { key: 'other', title: 'Everything else goes to', lines: [['other:refunds', 'Refunds', false], ['other:vat', 'VAT on sales', true]] },
];

// A tiny accounts server: it keeps what was connected and chosen, so what the fold shows after each change is true.
function fakeAccounts(extra = {}) {
  let connected = Boolean(extra.connected);
  const chosen = new Map();
  const state = () => {
    if (!connected) return { status: 'not_connected', connection: null, providers: [{ id: 'xero', name: 'Xero' }, { id: 'quickbooks', name: 'QuickBooks' }], summary: 'Not connected' };
    const groups = GROUPS.map((g) => ({ key: g.key, title: g.title, lines: g.lines.map(([key, label, recorded]) => ({ key, label, recorded, accountId: chosen.get(key)?.id ?? null, accountName: chosen.get(key)?.name ?? null })) }));
    const missing = groups.flatMap((g) => g.lines).filter((l) => l.recorded && !l.accountId).length;
    return {
      status: extra.lost ? 'lost' : 'connected', lostOn: extra.lost ? '2026-09-16T10:00:00Z' : null, needLook: extra.needLook ?? 0, practice: true, accounts: ACCOUNTS, groups, missing,
      connection: { provider: 'xero', providerName: 'Xero', connectedByName: 'Jack Lewis', connectedAt: '2026-09-15T10:00:00Z' },
      summary: extra.lost ? 'Xero disconnected' : `Connected to Xero${missing ? ` · ${missing} ${missing === 1 ? 'account' : 'accounts'} to choose` : ''}${extra.needLook ? ` · ${extra.needLook} day needs a look` : ''}`,
    };
  };
  return (method, path, body) => {
    if (path === '/api/accounts/connect') { connected = true; extra.lost = false; return state(); }
    if (path === '/api/accounts/disconnect') { connected = false; return state(); }
    if (path === '/api/accounts/choices') {
      if (body.accountId === null) chosen.delete(body.line); else chosen.set(body.line, ACCOUNTS.find((a) => a.id === body.accountId));
      return state();
    }
    return state();
  };
}

async function open(extra = {}) {
  calls = [];
  const accounts = fakeAccounts(extra);
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url, 'http://localhost');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ path: u.pathname, method, body });
    const json = (status, b) => ({ status, ok: status < 300, json: async () => b });
    if (u.pathname === '/api/auth/me') return json(200, OWNER);
    if (u.pathname === '/api/shop-details') return json(200, DETAILS);
    if (u.pathname === '/api/settings/your-data') return json(200, { leftOut: 0 });
    if (u.pathname === '/api/accounts/log') return json(200, extra.log ?? { connected: true, providerName: 'Xero', status: 'connected', days: [] });
    if (u.pathname.startsWith('/api/accounts')) return json(200, accounts(method, u.pathname, body));
    return json(200, []);
  };
  uninstall = installDom('http://localhost/workshop/settings?room=office');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findAllByText('Office');
  return { ...rtl, ui };
}
const fold = async (t) => {
  const button = await t.ui.findByRole('button', { name: /^Accounts software/ });
  if (button.getAttribute('aria-expanded') !== 'true') t.fireEvent.click(button);
  return button;
};
// The fold's panel (settings-frame gives it the id set-fold-<key>).
const panel = async (t) => {
  await t.ui.findByRole('button', { name: /^Accounts software/ });
  return t.within(document.getElementById('set-fold-accounts'));
};
const pick = (region, label) => region.getByRole('combobox', { name: new RegExp(`^${label.replace(/[()]/g, '\\$&')}`) });
const posts = (path) => calls.filter((c) => c.method !== 'GET' && c.path === path).map((c) => c.body);

test('Your data has an Accounts software fold, "Not connected", with Connect Xero and Connect QuickBooks and the two notes', async () => {
  const t = await open();
  const button = await fold(t);
  assert.ok(button.textContent.includes('Not connected'), button.textContent);
  const region = (await panel(t));
  assert.ok(region.queryByText('Each closed day goes across as one summary per shop: sales by account, the VAT, the money taken by how it was paid. Only the owner can connect.') !== null);
  assert.ok(region.getByRole('button', { name: 'Connect Xero' }) !== null);
  assert.ok(region.getByRole('button', { name: 'Connect QuickBooks' }) !== null);
  assert.ok(region.queryByText('Not using either? “Download everything” above has the same daily figures to import.') !== null);
  // It comes after Download everything.
  const all = t.ui.getAllByRole('button', { name: /^(Download everything|Accounts software)/ }).map((b) => b.textContent.split(/(?=[A-Z][a-z]+ [a-z])/)[0]);
  assert.ok(all[0].startsWith('Download everything'), all.join('|'));
});

test('Connect Xero connects, says who and when, says it is a practice, and shows the choices', async () => {
  const t = await open();
  await fold(t);
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Connect Xero' }));
  const region = (await panel(t));
  assert.ok(await region.findByText('Connected to Xero'));
  assert.ok(region.getByText(/^by Jack Lewis on 15 September 2026$/));
  assert.ok(region.getByRole('button', { name: 'Disconnect Xero' }) !== null);
  assert.deepEqual(posts('/api/accounts/connect'), [{ provider: 'xero' }]);
  assert.ok(region.queryByText('This is a practice connection: nothing leaves Wheelhouse until a real Xero account is set up.') !== null);
  assert.deepEqual(region.getAllByRole('heading', { level: 4 }).map((h) => h.textContent), ['Sales go to', 'Money taken goes to', 'Everything else goes to']);
  const sales = pick(region, 'Accessories');
  assert.deepEqual([...sales.options].map((o) => o.textContent), ['Choose a Xero account', '[Xero account 1]', '[Xero account 2]', '[Xero account 3]', '[Xero account 4]']);
  assert.ok(pick(region, 'Online sales (paid on the website)') !== null);
  const header = await t.ui.findByRole('button', { name: /^Accounts software/ });
  assert.ok(header.textContent.includes('Connected to Xero · 5 accounts to choose'), header.textContent);
  assert.ok(region.getByText('VAT on sales goes to one Xero account for every rate. Check these choices with your accountant before the first day is sent.'));
});

test('a line with no account says so in words, and a line Wheelhouse doesn\'t record yet does not', async () => {
  const t = await open();
  await fold(t);
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Connect Xero' }));
  const region = (await panel(t));
  await region.findByText('Connected to Xero');
  assert.ok(region.queryByText('No Xero account chosen — days with Accessories sales can’t be sent') !== null);
  assert.ok(region.queryByText('No Xero account chosen — days with Cash can’t be sent') !== null);
  assert.ok(region.queryByText('No Xero account chosen — days with VAT on sales can’t be sent') !== null);
  assert.equal(pick(region, 'Accessories').getAttribute('aria-invalid'), 'true');
  assert.ok(region.queryByText(/days with Refunds/) === null, 'Refunds aren\'t recorded yet');
  assert.ok(region.queryByText('Not recorded in Wheelhouse yet') !== null);
});

test('choosing an account saves it at once and the line is no longer missing', async () => {
  const t = await open();
  await fold(t);
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Connect Xero' }));
  const region = (await panel(t));
  await region.findByText('Connected to Xero');
  t.fireEvent.change(pick(region, 'Accessories'), { target: { value: 'xero-2' } });
  await t.waitFor(() => assert.deepEqual(posts('/api/accounts/choices'), [{ line: 'sales:Accessories', accountId: 'xero-2' }]));
  await t.waitFor(() => assert.ok(region.queryByText('No Xero account chosen — days with Accessories sales can’t be sent') === null));
  assert.equal(pick(region, 'Accessories').value, 'xero-2');
  assert.ok((await t.ui.findByRole('button', { name: /^Accounts software/ })).textContent.includes('Connected to Xero · 4 accounts to choose'));
  // Choosing "Choose a Xero account" again clears it.
  t.fireEvent.change(pick(region, 'Accessories'), { target: { value: '' } });
  await t.waitFor(() => assert.deepEqual(posts('/api/accounts/choices').at(-1), { line: 'sales:Accessories', accountId: null }));
});

test('Disconnect Xero asks first, keeps the choices, and Keep connected leaves it', async () => {
  const t = await open();
  await fold(t);
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Connect Xero' }));
  const region = (await panel(t));
  await region.findByText('Connected to Xero');
  t.fireEvent.click(region.getByRole('button', { name: 'Disconnect Xero' }));
  const box = t.within(await t.ui.findByRole('dialog', { name: 'Disconnect Xero?' }));
  assert.ok(box.queryByText('North Street Cycles, every shop') !== null);
  assert.ok(box.queryByText('Days already sent stay in Xero. Nothing more is sent until you connect again — the daily figures are still in “Download everything”.') !== null);
  assert.ok(box.queryByText('Your account choices are kept in case you reconnect.') !== null);
  t.fireEvent.click(box.getByRole('button', { name: 'Keep connected' }));
  assert.ok(t.ui.queryByRole('dialog', { name: 'Disconnect Xero?' }) === null);
  assert.equal(posts('/api/accounts/disconnect').length, 0);
  t.fireEvent.click(region.getByRole('button', { name: 'Disconnect Xero' }));
  t.fireEvent.click(t.within(await t.ui.findByRole('dialog', { name: 'Disconnect Xero?' })).getByRole('button', { name: 'Disconnect' }));
  await t.waitFor(() => assert.equal(posts('/api/accounts/disconnect').length, 1));
  assert.ok(await t.ui.findByRole('button', { name: 'Connect Xero' }));
  assert.ok((await t.ui.findByRole('button', { name: /^Accounts software/ })).textContent.includes('Not connected'));
});

const DAYS = [
  { day: '2026-09-17', closeId: null, closedAt: null, amountPence: null, sentAt: null, status: 'open', reason: null, line: null, missingLine: null, notRecorded: [], text: 'Not closed yet' },
  { day: '2026-09-16', closeId: 31, closedAt: '2026-09-16T16:30:00Z', amountPence: null, sentAt: null, status: 'failed', reason: 'Accessories has no Xero account chosen', line: 'sales:Accessories', missingLine: 'Accessories', notRecorded: [], text: 'Accessories has no Xero account chosen' },
  { day: '2026-09-15', closeId: 30, closedAt: '2026-09-15T16:30:00Z', amountPence: 6000, sentAt: '2026-09-15T16:31:00Z', status: 'sent', reason: null, line: null, missingLine: null, notRecorded: ['Refunds', 'Discounts given'], text: null },
  { day: '2026-09-14', closeId: 29, closedAt: '2026-09-14T16:30:00Z', amountPence: 4000, sentAt: null, status: 'waiting', reason: null, line: null, missingLine: null, notRecorded: [], text: 'sends when Xero is reconnected' },
  { day: '2026-09-13', closeId: 28, closedAt: '2026-09-13T16:30:00Z', amountPence: 2000, sentAt: '2026-09-13T16:31:00Z', status: 'reopened', reason: null, line: null, missingLine: null, notRecorded: [], text: 'Reopened: sent again when it is closed' },
];

test('what was sent: each day newest first with its state, the missing account to choose, and the note', async () => {
  const t = await open({ connected: true, needLook: 1, log: { connected: true, providerName: 'Xero', status: 'connected', days: DAYS } });
  await fold(t);
  const p = await panel(t);
  const header = await t.ui.findByRole('button', { name: /^Accounts software/ });
  assert.ok(header.textContent.includes('1 day needs a look'), header.textContent);
  const list = await p.findByRole('list', { name: 'What was sent' });
  const rows = [...list.querySelectorAll(':scope > li')].map((li) => li.textContent);
  assert.equal(rows.length, 5);
  assert.ok(rows[0].includes('Thu 17 Sep') && rows[0].includes('Not closed yet'), rows[0]);
  assert.ok(/Wed 16 Sep.*Closed at \d\d:\d\d · Accessories has no Xero account chosen.*Choose an account for Accessories/.test(rows[1]), rows[1]);
  assert.ok(/Tue 15 Sep.*Sent at \d\d:\d\d · £60\.00.*Sent/.test(rows[2]), rows[2]);
  assert.ok(rows[2].includes('Not recorded in Wheelhouse yet: Refunds, Discounts given'), 'what is not recorded is said on the day (Jack\'s answer 2)');
  assert.ok(/Mon 14 Sep.*Closed at \d\d:\d\d · sends when Xero is reconnected.*Waiting/.test(rows[3]), rows[3]);
  assert.ok(rows[4].includes('Reopened'), rows[4]);
  assert.ok(p.queryByText('Each day goes once all that shop’s tills are closed. A day that’s reopened is corrected when it closes again.') !== null);
  // The button takes the person to the choice that is missing.
  t.fireEvent.click(p.getByRole('button', { name: 'Choose an account for Accessories' }));
  assert.equal(document.activeElement, pick(p, 'Accessories'));
});

test('a lost connection says so with Reconnect, and the days wait', async () => {
  const days = [{ ...DAYS[3], day: '2026-09-16' }, { ...DAYS[2] }];
  const t = await open({ connected: true, lost: true, log: { connected: true, providerName: 'Xero', status: 'lost', days } });
  await fold(t);
  const p = await panel(t);
  await p.findByText(/Xero disconnected on 16 September 2026\./);
  assert.ok(p.queryByText(/Nothing has been sent since\. Reconnect and the waiting days go across\./) !== null);
  assert.ok((await t.ui.findByRole('button', { name: /^Accounts software/ })).textContent.includes('Xero disconnected'));
  // Only the bar and the log, as drawn: the waiting day is listed, and the choices and Disconnect are not.
  const rows = p.getAllByRole('listitem').map((li) => li.textContent ?? '');
  assert.ok(/Wed 16 Sep.*sends when Xero is reconnected.*Waiting/.test(rows[0]), rows[0]);
  assert.ok(p.queryByRole('button', { name: 'Disconnect Xero' }) === null);
  t.fireEvent.click(p.getByRole('button', { name: 'Reconnect Xero' }));
  await t.waitFor(() => assert.deepEqual(posts('/api/accounts/connect'), [{ provider: 'xero' }]));
  await t.waitFor(() => assert.ok(p.queryByText(/Nothing has been sent since/) === null));
  assert.ok(p.queryByRole('button', { name: 'Disconnect Xero' }) !== null);
});

test('after a deliberate disconnect the days already sent stay in the log, under the Connect buttons', async () => {
  const t = await open({ connected: false, log: { connected: false, providerName: 'Xero', status: 'not_connected', days: [{ ...DAYS[2] }, { ...DAYS[3] }] } });
  await fold(t);
  const p = await panel(t);
  await p.findByRole('button', { name: 'Connect Xero' });
  const rows = p.getAllByRole('listitem').map((li) => li.textContent ?? '');
  assert.ok(/Tue 15 Sep.*Sent at \d\d:\d\d · £60\.00.*Sent/.test(rows[0]), rows[0]);
  assert.ok(/Mon 14 Sep.*Waiting/.test(rows[1]), rows[1]);
});
