// Store credit and Ways to pay, the staff screens (openspec/changes/finish-customers, design 8;
// cs-credit, cs-page, cs-page-off, set-pay-ways; customer service decisions 6 and 10; design
// questions 8, 9 and 14). Real example data from the drawings: Maya Patel, Jo Taylor, Jack
// Lewis; everything else a bracketed placeholder.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
const MAYA = { id: 5, name: 'Maya Patel', phone: '07700 900142', email: 'maya@example.test', notes: null, address: null, postcode: null, marketingPermission: true, active: true, groups: [] };
const ADDED = { kind: 'store_credit', id: 31, change: 'added', changePence: 1500, reason: '[reason]', by: 'Jo Taylor', undone: false, at: '2026-08-20T14:00:00.000Z' };

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

async function render(url, handle, who = OWNER) {
  calls = [];
  globalThis.fetch = async (u0, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(u0), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(u0, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, who);
    const answer = handle(u.pathname, method, body, reply);
    if (answer) return answer;
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(url);
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
const writes = () => calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${new URL(c.url, 'http://localhost').pathname} ${JSON.stringify(c.body ?? null)}`);

// ---------- Ways to pay ----------

async function openWays(start = { storeCreditOn: false, accountsOn: false, accountLimitPence: null }) {
  let settings = { ...start };
  const r = await render('http://localhost/workshop/settings?room=front-desk', (path, method, body, reply) => {
    if (path === '/api/payment-settings' && method === 'PUT') { settings = { ...settings, ...body }; return reply(200, settings); }
    if (path === '/api/payment-settings') return reply(200, settings);
    return null;
  });
  const fold = await r.ui.findByRole('button', { name: /^Ways to pay/ });
  if (fold.getAttribute('aria-expanded') !== 'true') r.fireEvent.click(fold);
  await r.ui.findByRole('switch', { name: 'Store credit' });
  return { ...r, fold };
}

test('Ways to pay sits in Payments with the two drawn rows, both off to start', async () => {
  const { ui, fold } = await openWays();
  assert.match(fold.textContent, /None switched on yet/);
  assert.ok(ui.getByText('Earned back on sales, and given on refunds without a receipt'));
  assert.ok(ui.getByText('Pay later, settled from the customer’s page'));
  assert.equal(ui.getByRole('switch', { name: 'Store credit' }).getAttribute('aria-checked'), 'false');
  assert.equal(ui.getByRole('switch', { name: 'Customer accounts' }).getAttribute('aria-checked'), 'false');
  assert.ok(ui.queryByLabelText('Most a customer can owe') === null, 'the limit shows only when on');
});

test('the Owner switches Customer accounts on and types the limit; each saves as he goes', async () => {
  const { ui, fireEvent, waitFor, fold } = await openWays();
  fireEvent.click(ui.getByRole('switch', { name: 'Customer accounts' }));
  const limit = await ui.findByLabelText('Most a customer can owe');
  assert.ok(ui.getByText('For everyone. Change it for one customer on their page.'));
  fireEvent.change(limit, { target: { value: '250.00' } });
  fireEvent.blur(limit);
  await waitFor(() => assert.deepEqual(writes(), ['PUT /api/payment-settings {"accountsOn":true}', 'PUT /api/payment-settings {"accountLimitPence":25000}']));
  await waitFor(() => assert.match(fold.textContent, /Customer accounts/));
  fireEvent.change(limit, { target: { value: '2.5.0' } });
  fireEvent.blur(limit);
  assert.ok(await ui.findByText('Pounds and pence, like 5.00'));
  assert.equal(writes().length, 2, 'nothing sent');
});

// ---------- The customer page ----------

async function openMaya({ money = { storeCreditOn: true, accountsOn: false, credit: 1500 }, items = [ADDED], who = OWNER, onCredit } = {}) {
  let customer = { ...MAYA, money: { ...money } };
  let history = [...items];
  const r = await render('http://localhost/workshop/customers/5', (path, method, body, reply) => {
    if (path === '/api/customers/5') return reply(200, customer);
    if (path === '/api/customers/5/history') return reply(200, { items: history });
    if (path === '/api/customers/5/store-credit' && method === 'POST') {
      const refused = onCredit?.(body);
      if (refused) return reply(refused[0], refused[1]);
      const change = body.change === 'add' ? body.pence : -body.pence;
      customer = { ...customer, money: { ...customer.money, credit: customer.money.credit + change } };
      const entry = { kind: 'store_credit', id: 40, change: body.change === 'add' ? 'added' : 'taken', changePence: change, reason: body.reason, by: who.name, undone: false, at: '2026-09-01T10:00:00.000Z' };
      history = [entry, ...history];
      return reply(201, { entry, credit: customer.money.credit });
    }
    if (path === '/api/store-credit-entries/31/undo' && method === 'POST') {
      customer = { ...customer, money: { ...customer.money, credit: customer.money.credit - 1500 } };
      history = [{ ...ADDED, id: 41, change: 'undo', changePence: -1500, reason: body.reason, by: who.name, at: '2026-09-01T11:00:00.000Z' }, { ...ADDED, undone: true }];
      return reply(201, { credit: customer.money.credit });
    }
    return null;
  }, who);
  await r.ui.findByRole('heading', { level: 2, name: 'Maya Patel' });
  return r;
}

test('At a glance shows Store credit when it is on, and not when it is off', async () => {
  const on = await openMaya();
  const row = await on.ui.findByRole('button', { name: /Store credit/ });
  assert.match(row.textContent, /£15\.00/);
  on.cleanup();
  shell.queryClient.clear();
  uninstall();
  const off = await openMaya({ money: { storeCreditOn: false, accountsOn: false }, items: [] });
  assert.ok(off.ui.getByText('Happy to hear about offers'));
  assert.ok(off.ui.queryByRole('button', { name: /Store credit/ }) === null);
});

test('the store credit pop-up in the drawn words; Jo adds credit with a reason', async () => {
  const { ui, fireEvent, waitFor, within } = await openMaya({ who: JO });
  fireEvent.click(await ui.findByRole('button', { name: /Store credit/ }));
  const box = within(await ui.findByRole('dialog', { name: 'Maya Patel’s store credit' }));
  assert.ok(box.getByText('Has £15.00 now'));
  assert.ok(box.getByText('The change and its reason show in her history and in the reports.'));
  assert.ok(box.getByLabelText('Add credit').checked);
  assert.ok(box.getByLabelText('Take some away'));
  assert.ok(box.getByLabelText('Other…').checked, 'Other… until Till › Reasons has a list (question 9)');
  fireEvent.change(box.getByLabelText('Amount'), { target: { value: '5.00' } });
  fireEvent.change(box.getByLabelText('Reason'), { target: { value: '[reason]' } });
  fireEvent.click(box.getByRole('button', { name: 'Add the credit' }));
  await waitFor(() => assert.deepEqual(writes(), ['POST /api/customers/5/store-credit {"change":"add","pence":500,"reason":"[reason]"}']));
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
  await waitFor(() => assert.match(ui.getByRole('button', { name: /Store credit/ }).textContent, /£20\.00/));
  assert.ok(await ui.findByText('+£5.00'));
});

test('taking credit away says Take it away; the pop-up shows each refusal and sends nothing it can check itself', async () => {
  const { ui, fireEvent, waitFor, within } = await openMaya({ onCredit: () => [409, { error: 'Maya Patel has only £15.00', code: 'not_enough' }] });
  fireEvent.click(await ui.findByRole('button', { name: /Store credit/ }));
  const box = within(await ui.findByRole('dialog', { name: 'Maya Patel’s store credit' }));
  fireEvent.click(box.getByLabelText('Take some away'));
  const go = box.getByRole('button', { name: 'Take it away' });
  fireEvent.click(go);
  assert.ok(await box.findByText('Pounds and pence, like 5.00'));
  fireEvent.change(box.getByLabelText('Amount'), { target: { value: '20' } });
  fireEvent.click(go);
  assert.ok(await box.findByText('Give a reason for the change'));
  assert.equal(writes().length, 0);
  fireEvent.change(box.getByLabelText('Reason'), { target: { value: '[reason]' } });
  fireEvent.click(go);
  assert.ok(await box.findByText('Maya Patel has only £15.00'));
  await waitFor(() => assert.deepEqual(writes(), ['POST /api/customers/5/store-credit {"change":"take","pence":2000,"reason":"[reason]"}']));
  assert.ok(ui.getByRole('dialog'), 'stays open');
});

test('a store credit row in the history, in the drawn words', async () => {
  const { ui } = await openMaya();
  assert.ok(await ui.findByText('Store credit added'));
  assert.ok(ui.getByText('Thu 20 Aug · [reason] · by Jo Taylor'));
  assert.ok(ui.getByText('+£15.00'));
});

test('the Owner undoes a change from the history with a reason; Jo can’t', async () => {
  const jo = await openMaya({ who: JO });
  await jo.ui.findByText('Store credit added');
  assert.ok(jo.ui.queryByRole('button', { name: 'Undo Store credit added' }) === null);
  jo.cleanup();
  shell.queryClient.clear();
  uninstall();
  const { ui, fireEvent, waitFor, within } = await openMaya();
  fireEvent.click(await ui.findByRole('button', { name: 'Undo Store credit added' }));
  const box = within(await ui.findByRole('dialog', { name: 'Undo this change' }));
  fireEvent.click(box.getByRole('button', { name: 'Undo it' }));
  assert.ok(await box.findByText('Give a reason for undoing it'));
  fireEvent.change(box.getByLabelText('Reason'), { target: { value: '[reason]' } });
  fireEvent.click(box.getByRole('button', { name: 'Undo it' }));
  await waitFor(() => assert.deepEqual(writes(), ['POST /api/store-credit-entries/31/undo {"reason":"[reason]"}']));
  assert.ok(await ui.findByText('Store credit change undone'));
  assert.ok(ui.getByText('−£15.00'));
});
