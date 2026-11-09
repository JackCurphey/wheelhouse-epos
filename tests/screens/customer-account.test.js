// Accounts, the staff screens (openspec/changes/finish-customers, design 8; cs-account,
// cs-transfer, cs-page, cs-page-over; customer service decisions 7 and 12; Jack's 9 Nov answers 2
// and 5; design question 20). Real example data from the drawings: Maya Patel, Jo Taylor, Jack
// Lewis; everything else a bracketed placeholder.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
const MAYA = { id: 5, name: 'Maya Patel', phone: '07700 900142', email: 'maya@example.test', notes: null, address: null, postcode: null, marketingPermission: true, active: true, groups: [] };
const OPENING = { id: 61, kind: 'opening', changePence: 12000, reference: null, receivedOn: null, saleId: null, tillSaleId: null, reason: null, by: 'Jack Lewis', at: '2026-08-20T14:00:00.000Z', undone: false, undoesKind: null };
const PAID = { ...OPENING, id: 62, kind: 'bank_transfer', changePence: -2000, reference: '[reference]', receivedOn: '2026-08-28', by: 'Jo Taylor', at: '2026-08-28T10:00:00.000Z' };

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


const MONEY = { storeCreditOn: false, accountsOn: true, owed: 10000, hasAccount: true, limit: 25000, shopLimit: 25000, overBy: 0 };
const ACCOUNT = { owed: 10000, hasAccount: true, limit: 25000, ownLimit: null, shopLimit: 25000, overBy: 0, hasOpening: true, openedAt: '2026-08-20T14:00:00.000Z', statement: [PAID, OPENING], today: '2026-09-01' };

async function openMaya({ money = MONEY, account = ACCOUNT, who = OWNER, onTransfer, onEmail, items = [] } = {}) {
  let acct = { ...account, statement: [...account.statement] };
  const r = await render('http://localhost/workshop/customers/5', (path, method, body, reply) => {
    if (path === '/api/customers/5') return reply(200, { ...MAYA, money: { ...money, ...(money.accountsOn ? { owed: acct.owed, hasAccount: acct.hasAccount } : {}) } });
    if (path === '/api/customers/5/history') return reply(200, { items });
    if (path === '/api/customers/5/account') return reply(200, acct);
    if (path === '/api/customers/5/account/open' && method === 'POST') { acct = { ...acct, hasAccount: true }; return reply(200, acct); }
    if (path === '/api/customers/5/account/opening' && method === 'POST') {
      const entry = { ...OPENING, id: 70, changePence: body.pence };
      acct = { ...acct, owed: acct.owed + body.pence, hasOpening: true, statement: [entry, ...acct.statement] };
      return reply(201, { entry, owed: acct.owed });
    }
    if (path === '/api/customers/5/account/transfers' && method === 'POST') {
      const refused = onTransfer?.(body);
      if (refused) return reply(refused[0], refused[1]);
      const entry = { ...PAID, id: 71, changePence: -body.pence, reference: body.reference, receivedOn: body.receivedOn };
      acct = { ...acct, owed: acct.owed - body.pence, statement: [entry, ...acct.statement] };
      return reply(201, { entry, owed: acct.owed });
    }
    if (path === '/api/customers/5/account/email-statement' && method === 'POST') {
      const refused = onEmail?.();
      return refused ? reply(refused[0], refused[1]) : reply(200, { id: 90, to: 'maya@example.test' });
    }
    return null;
  }, who);
  await r.ui.findByRole('heading', { level: 2, name: 'Maya Patel' });
  return r;
}
const openAccount = async (r) => {
  r.fireEvent.click(await r.ui.findByRole('button', { name: /^Owes on account/ }));
  const box = r.within(await r.ui.findByRole('dialog', { name: 'Maya Patel’s account' }));
  await r.waitFor(() => assert.ok(box.queryByText('Loading…') === null));
  return box;
};

test('the Owes chip beside her name, and At a glance’s Owes on account, only while accounts are on', async () => {
  const on = await openMaya();
  assert.ok(await on.ui.findByText('Owes £100.00'));
  assert.ok(on.ui.getByRole('button', { name: /^Owes on account/ }).textContent.includes('£100.00'));
  on.cleanup();
  shell.queryClient.clear();
  uninstall();
  const off = await openMaya({ money: { storeCreditOn: false, accountsOn: false } });
  assert.ok(off.ui.queryByRole('button', { name: /^Owes on account/ }) === null);
  assert.ok(off.ui.queryByText(/^Owes £/) === null);
});

test('over her limit, the chip says by how much (cs-page-over)', async () => {
  const { ui } = await openMaya({ money: { ...MONEY, overBy: 5000 }, account: { ...ACCOUNT, owed: 30000, overBy: 5000 } });
  assert.ok(await ui.findByText('Over the limit by £50.00'));
});

test('nothing owed and no account: no chip', async () => {
  const { ui } = await openMaya({ account: { ...ACCOUNT, owed: 0, hasAccount: false, statement: [], hasOpening: false } });
  await ui.findByRole('button', { name: /^Owes on account/ });
  assert.ok(ui.queryByText(/^Owes £/) === null);
});

test('the account pop-up in the drawn words, without Take a payment at the till', async () => {
  const r = await openMaya({ who: JO });
  const box = await openAccount(r);
  assert.ok(box.getByText('Pay later, settled from here'));
  assert.ok(box.getByText('Owes now'));
  assert.ok(box.getByText('£100.00'));
  assert.ok(box.getByText('Most Maya can owe'));
  assert.ok(box.getByText('The shop’s owner can change it · the shop’s is £250.00'));
  assert.ok(box.queryByLabelText('Most Maya can owe') === null, 'read-only for staff');
  assert.ok(box.getByText('Paid by bank transfer · [reference]'));
  assert.ok(box.getByText('Owed from before Wheelhouse'));
  assert.ok(box.getByText('−£20.00'));
  assert.ok(box.getByText('+£120.00'));
  assert.ok(box.getByRole('button', { name: 'Email the statement' }));
  assert.ok(box.getByRole('button', { name: 'Record a bank transfer' }));
  assert.ok(box.getByRole('button', { name: 'Close' }));
  assert.ok(box.queryByRole('button', { name: 'Take a payment at the till' }) === null);
  assert.ok(box.queryByRole('button', { name: /^Undo/ }) === null, 'the undo is the Owner’s');
});

test('the Owner gives Maya an account and enters what she owed before Wheelhouse; Jo can’t', async () => {
  const none = { ...ACCOUNT, owed: 0, hasAccount: false, hasOpening: false, statement: [] };
  const jo = await openMaya({ who: JO, account: none });
  const joBox = await openAccount(jo);
  assert.ok(joBox.getByText('Only the shop’s owner can give someone an account.'));
  assert.ok(joBox.queryByRole('button', { name: 'Give Maya an account' }) === null);
  jo.cleanup();
  shell.queryClient.clear();
  uninstall();
  const r = await openMaya({ account: none });
  const box = await openAccount(r);
  r.fireEvent.click(box.getByRole('button', { name: 'Give Maya an account' }));
  const opening = await box.findByLabelText('Owed from before Wheelhouse');
  r.fireEvent.change(opening, { target: { value: '120.00' } });
  r.fireEvent.click(box.getByRole('button', { name: 'Add it' }));
  await r.waitFor(() => assert.deepEqual(writes(), ['POST /api/customers/5/account/open {}', 'POST /api/customers/5/account/opening {"pence":12000}']));
  assert.ok(await box.findByText('+£120.00'));
  await r.waitFor(() => assert.ok(box.queryByLabelText('Owed from before Wheelhouse') === null, 'once only'));
});

test('the Owner changes Most Maya can owe as he leaves the box; empty is the shop’s', async () => {
  const r = await openMaya();
  const box = await openAccount(r);
  const limit = box.getByLabelText('Most Maya can owe');
  r.fireEvent.change(limit, { target: { value: '400.00' } });
  r.fireEvent.blur(limit);
  await r.waitFor(() => assert.deepEqual(writes(), ['PUT /api/customers/5/account/limit {"pence":40000}']));
  r.fireEvent.change(limit, { target: { value: 'lots' } });
  r.fireEvent.blur(limit);
  assert.ok(await box.findByText('Pounds and pence, like 5.00'));
  assert.equal(writes().length, 1);
});

test('Record a bank transfer starts at everything owed; Jo records part of it; refusals show in the pop-up', async () => {
  let refuse = true;
  const r = await openMaya({ who: JO, onTransfer: () => (refuse ? [409, { error: 'Maya Patel owes only £100.00', code: 'more_than_owed' }] : null) });
  r.fireEvent.click((await openAccount(r)).getByRole('button', { name: 'Record a bank transfer' }));
  const bt = r.within(await r.ui.findByRole('dialog', { name: 'Record a bank transfer' }));
  assert.ok(bt.getByText('For money that didn’t come through the till'));
  assert.equal(bt.getByLabelText('Amount').value, '100.00');
  assert.ok(bt.getByText('Everything Maya owes — change it if they paid part.'));
  assert.equal(bt.getByLabelText('Date it arrived').value, '2026-09-01');
  assert.equal(bt.getByLabelText('Date it arrived').getAttribute('max'), '2026-09-01');
  assert.equal(bt.getByLabelText('Reference').getAttribute('placeholder'), 'As it shows on the bank statement');
  assert.ok(bt.getByText('It comes off what Maya owes. It isn’t counted in the till’s takings, so cash-up isn’t affected.'));
  r.fireEvent.change(bt.getByLabelText('Amount'), { target: { value: 'x' } });
  r.fireEvent.click(bt.getByRole('button', { name: 'Record it' }));
  assert.ok(await bt.findByText('Pounds and pence, like 5.00'));
  assert.equal(writes().length, 0);
  r.fireEvent.change(bt.getByLabelText('Amount'), { target: { value: '150.00' } });
  r.fireEvent.click(bt.getByRole('button', { name: 'Record it' }));
  assert.ok(await bt.findByText('Maya Patel owes only £100.00'));
  refuse = false;
  r.fireEvent.change(bt.getByLabelText('Amount'), { target: { value: '30.00' } });
  r.fireEvent.change(bt.getByLabelText('Reference'), { target: { value: '[reference]' } });
  r.fireEvent.click(bt.getByRole('button', { name: 'Record it' }));
  await r.waitFor(() => assert.equal(writes().at(-1), 'POST /api/customers/5/account/transfers {"pence":3000,"receivedOn":"2026-09-01","reference":"[reference]"}'));
  const box = r.within(await r.ui.findByRole('dialog', { name: 'Maya Patel’s account' }));
  assert.ok(await box.findByText('£70.00'));
});

test('Email the statement says where it went, or that there’s no address', async () => {
  let none = false;
  const r = await openMaya({ who: JO, onEmail: () => (none ? [409, { error: 'There’s no email address to send it to. Add one in their details.', code: 'no_email' }] : null) });
  const box = await openAccount(r);
  r.fireEvent.click(box.getByRole('button', { name: 'Email the statement' }));
  assert.equal((await box.findByRole('status')).textContent, 'Sent to maya@example.test');
  none = true;
  r.fireEvent.click(box.getByRole('button', { name: 'Email the statement' }));
  assert.equal((await box.findByRole('alert')).textContent, 'There’s no email address to send it to. Add one in their details.');
});

test('the Owner undoes a transfer from the statement with a reason', async () => {
  const r = await openMaya();
  const box = await openAccount(r);
  r.fireEvent.click(box.getByRole('button', { name: 'Undo Paid by bank transfer · [reference]' }));
  assert.ok(await r.ui.findByRole('dialog', { name: 'Undo this change' }));
});

test('a bank transfer in her history, as the statement words it', async () => {
  const row = { kind: 'account', id: 62, change: 'bank_transfer', changePence: -2000, reference: '[reference]', receivedOn: '2026-08-28', reason: null, by: 'Jo Taylor', undone: false, at: '2026-08-28T10:00:00.000Z' };
  const { ui } = await openMaya({ items: [row] });
  assert.ok(await ui.findByText('Paid by bank transfer · [reference]'));
  assert.ok(ui.getByText('Fri 28 Aug · by Jo Taylor'));
  assert.ok(ui.getByText('−£20.00'));
});

test('the Owner can undo what was owed before Wheelhouse, if it was typed wrong', async () => {
  const r = await openMaya();
  const box = await openAccount(r);
  assert.ok(box.getByRole('button', { name: 'Undo Owed from before Wheelhouse' }));
});
