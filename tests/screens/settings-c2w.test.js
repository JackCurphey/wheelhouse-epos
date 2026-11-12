// Settings › Front desk › Cycle to Work (openspec/changes/cycle-to-work tasks
// 2.1 and 2.2; drawn as cw-settings and cw-settings-provider in c2w.mjs, the
// folds in settings-frame.mjs c2wFolds; decisions 3, 4 and 5).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const EMPTY = {
  holdDays: null, remindDays: null, quoteValidDays: null, orderRule: 'certificate', depositKind: 'pounds', depositValue: null,
  depositOnCertificate: 'refund', depositOnPullOut: 'refund', howToApply: '', todayLines: true, noCertificateDays: null, paymentLateDays: null,
};
const PROVIDER = { id: 4, name: 'Ride Scheme', commissionKind: 'percent', commissionValue: 450, paysInDays: 30, accessoriesInside: true, handoverNote: 'ID seen\nForm signed', handoverChecks: ['ID seen', 'Form signed'], retiredAt: null };
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

async function openC2w({ settings = {}, providers = [PROVIDER], open } = {}) {
  calls = [];
  let saved = { ...EMPTY, ...settings };
  let list = providers.map((p) => ({ ...p }));
  let next = 20;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    if (u.pathname === '/api/message-templates') return reply(200, []);
    if (u.pathname === '/api/c2w/settings' && method === 'GET') return reply(200, { settings: saved });
    if (u.pathname === '/api/c2w/settings' && method === 'PUT') {
      if (body.orderRule === 'deposit') return reply(400, { error: 'Ordering straight away with a deposit isn’t ready yet: the till can’t take a deposit for an order', code: 'deposit_not_ready' });
      saved = { ...saved, ...body };
      return reply(200, { settings: saved });
    }
    if (u.pathname === '/api/c2w/providers' && method === 'GET') return reply(200, { providers: list.filter((p) => !p.retiredAt) });
    if (u.pathname === '/api/c2w/providers' && method === 'POST') {
      const made = { id: next++, retiredAt: null, ...body, handoverChecks: (body.handoverNote ?? '').split('\n').filter(Boolean) };
      list = [...list, made];
      return reply(201, { provider: made });
    }
    const one = u.pathname.match(/^\/api\/c2w\/providers\/(\d+)(\/retire)?$/);
    if (one) {
      const id = Number(one[1]);
      list = list.map((p) => (p.id !== id ? p : one[2] ? { ...p, retiredAt: '2026-09-01T09:00:00.000Z' } : { ...p, ...body, handoverChecks: (body.handoverNote ?? p.handoverNote).split('\n').filter(Boolean) }));
      return reply(200, { provider: list.find((p) => p.id === id) });
    }
    return reply(200, []);
  };
  uninstall = installDom('http://localhost/workshop/settings?room=front-desk');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { level: 3, name: 'Cycle to Work' });
  const fold = (name) => ui.getByRole('button', { name: new RegExp(`^${name}`) });
  const openFold = async (name) => {
    const f = await ui.findByRole('button', { name: new RegExp(`^${name}`) });
    if (f.getAttribute('aria-expanded') !== 'true') rtl.fireEvent.click(f);
  };
  if (open) await openFold(open);
  return { ...rtl, ui, fold, openFold };
}
const writes = () => calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.url} ${JSON.stringify(c.body ?? null)}`);
const FOLDS = ['Holding bikes and quotes', 'Bikes not in stock', 'How to apply', 'Deposits', 'Scheme providers', 'On Today'];

test('Cycle to Work comes after End of day in Front desk, with its intro and six folds in the drawn order', async () => {
  const { ui, fold, within } = await openC2w();
  const eod = ui.getByRole('heading', { level: 3, name: 'End of day' });
  const c2w = ui.getByRole('heading', { level: 3, name: 'Cycle to Work' });
  assert.ok(eod.compareDocumentPosition(c2w) & Node.DOCUMENT_POSITION_FOLLOWING, 'Cycle to Work after End of day');
  assert.ok(ui.getByText('Holding and ordering bikes, deposits, and the scheme providers you work with.'));
  const jump = within(ui.getByRole('navigation', { name: 'Jump to' }));
  assert.equal(jump.getByRole('link', { name: 'Cycle to Work' }).getAttribute('href'), '#set-c2w');
  const at = FOLDS.map((n) => fold(n));
  for (let i = 1; i < at.length; i += 1) assert.ok(at[i - 1].compareDocumentPosition(at[i]) & Node.DOCUMENT_POSITION_FOLLOWING, `${FOLDS[i]} after ${FOLDS[i - 1]}`);
});

test('each fold’s summary says what is set, in the drawn words', async () => {
  const { fold, waitFor } = await openC2w({
    settings: { holdDays: 5, quoteValidDays: 30, howToApply: 'Start at your employer’s scheme page', noCertificateDays: 10, paymentLateDays: 7 },
    providers: [PROVIDER, { ...PROVIDER, id: 5, name: 'Bike Benefit' }],
  });
  await waitFor(() => assert.match(fold('Holding bikes and quotes').textContent, /Held from the quote for 5 days · quotes valid for 30 days/));
  assert.match(fold('Bikes not in stock').textContent, /Ordered once the certificate arrives/);
  assert.match(fold('How to apply').textContent, /A line on every quote and email/);
  assert.match(fold('Deposits').textContent, /Refunded when the certificate arrives/);
  await waitFor(() => assert.match(fold('Scheme providers').textContent, /2 providers/));
  assert.match(fold('On Today').textContent, /No certificate after 10 days · payment 7 days late/);
});

test('nothing set yet: the summaries say so, and invent no numbers', async () => {
  const { fold, waitFor } = await openC2w({ providers: [] });
  await waitFor(() => assert.match(fold('Holding bikes and quotes').textContent, /Not set yet/));
  assert.match(fold('How to apply').textContent, /Not set yet/);
  await waitFor(() => assert.match(fold('Scheme providers').textContent, /No providers yet/));
  assert.match(fold('On Today').textContent, /Not set yet/);
});

test('Holding bikes and quotes: three day boxes that save when left, a refused 0, and the drawn note', async () => {
  const { ui, fireEvent, waitFor } = await openC2w({ open: 'Holding bikes and quotes' });
  const hold = await ui.findByLabelText('Hold a bike in stock from the quote for');
  assert.ok(ui.getByLabelText('Remind the shop before the hold ends'));
  assert.ok(ui.getByLabelText('Quotes are valid for'));
  assert.ok(ui.getByText('days before'));
  assert.ok(ui.getByText('The certificate makes the hold firm until the bike is collected.'));
  await waitFor(() => assert.equal(hold.disabled, false));
  fireEvent.change(hold, { target: { value: '0' } });
  fireEvent.blur(hold);
  assert.equal((await ui.findByRole('alert')).textContent, 'A whole number of days, 1 to 365');
  assert.deepEqual(writes(), []);
  fireEvent.change(hold, { target: { value: '7' } });
  fireEvent.blur(hold);
  await waitFor(() => assert.deepEqual(writes(), ['PUT /api/c2w/settings {"holdDays":7}']));
  const remind = ui.getByLabelText('Remind the shop before the hold ends');
  fireEvent.change(remind, { target: { value: '0' } });
  fireEvent.blur(remind);
  await waitFor(() => assert.equal(writes()[1], 'PUT /api/c2w/settings {"remindDays":0}'), 'a reminder can be on the day');
});

test('Bikes not in stock: the three drawn rules with their hints; picking one saves it; the deposit one is refused for now', async () => {
  const { ui, fireEvent, waitFor, fold } = await openC2w({ open: 'Bikes not in stock' });
  const group = await ui.findByRole('group', { name: 'Order a bike that isn’t in stock' });
  const cert = ui.getByRole('radio', { name: 'Once the certificate arrives' });
  await waitFor(() => assert.equal(cert.checked, true));
  assert.ok(group.textContent.includes('Safest. The customer waits a little longer.'));
  assert.ok(group.textContent.includes('Staff mark the order “Applied”, with the application reference if there is one.'));
  assert.ok(group.textContent.includes('Until the certificate arrives.'));
  assert.ok(ui.getByText('Owners, managers and anyone with “Can close the day” can still “Order now anyway” on one order, with a reason that goes in the activity log.'));
  fireEvent.click(ui.getByRole('radio', { name: 'Once the customer has applied' }));
  await waitFor(() => assert.deepEqual(writes(), ['PUT /api/c2w/settings {"orderRule":"applied"}']));
  await waitFor(() => assert.match(fold('Bikes not in stock').textContent, /Ordered once the customer has applied/));
  fireEvent.click(ui.getByRole('radio', { name: 'Straight away, with a deposit' }));
  assert.match((await ui.findByRole('alert')).textContent, /isn’t ready yet/);
  await waitFor(() => assert.equal(ui.getByRole('radio', { name: 'Once the customer has applied' }).checked, true));
});

test('the deposit amount: £ or %, saved with its unit', async () => {
  const { ui, fireEvent, waitFor, within } = await openC2w({ open: 'Bikes not in stock' });
  const unit = await ui.findByRole('group', { name: 'Deposit in' });
  const box = ui.getByLabelText('Deposit');
  await waitFor(() => assert.equal(box.disabled, false));
  assert.equal(within(unit).getByRole('button', { name: '£' }).getAttribute('aria-pressed'), 'true');
  fireEvent.change(box, { target: { value: '50' } });
  fireEvent.blur(box);
  await waitFor(() => assert.deepEqual(writes(), ['PUT /api/c2w/settings {"depositKind":"pounds","depositValue":5000}']));
  // Switching unit with nothing typed sends nothing: the box empties and asks
  // for the amount in the new unit, so £50 is never read as 50%.
  fireEvent.click(within(unit).getByRole('button', { name: '%' }));
  assert.equal(within(unit).getByRole('button', { name: '%' }).getAttribute('aria-pressed'), 'true');
  assert.equal(box.value, '');
  assert.equal(ui.getByText('Type the deposit as a percentage').getAttribute('role'), 'status');
  assert.equal(writes().length, 1);
  fireEvent.change(box, { target: { value: '10' } });
  fireEvent.blur(box);
  await waitFor(() => assert.deepEqual(writes().slice(1), ['PUT /api/c2w/settings {"depositKind":"percent","depositValue":1000}']));
  assert.equal(box.value, '10');
});

test('the deposit: typing an amount then picking its unit sends it once, in that unit', async () => {
  const { ui, fireEvent, waitFor, within } = await openC2w({ settings: { depositValue: 5000 }, open: 'Bikes not in stock' });
  const unit = await ui.findByRole('group', { name: 'Deposit in' });
  const box = ui.getByLabelText('Deposit');
  await waitFor(() => assert.equal(box.value, '50.00'));
  const pct = within(unit).getByRole('button', { name: '%' });
  fireEvent.change(box, { target: { value: '10' } });
  fireEvent.blur(box, { relatedTarget: pct });
  fireEvent.click(pct);
  await waitFor(() => assert.deepEqual(writes(), ['PUT /api/c2w/settings {"depositKind":"percent","depositValue":1000}']));
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(writes().length, 1);
});

test('How to apply: the drawn placeholder and hint; the words save when the box is left', async () => {
  const { ui, fireEvent, waitFor } = await openC2w({ open: 'How to apply' });
  const box = await ui.findByRole('textbox', { name: 'How to apply' });
  assert.equal(box.getAttribute('placeholder'), '[The shop’s own words — for example, where customers start their application]');
  assert.ok(ui.getByText('Printed on every quote and in the “Your bike is put aside” email.'));
  await waitFor(() => assert.equal(box.disabled, false));
  fireEvent.change(box, { target: { value: 'Ask your employer for the scheme link' } });
  fireEvent.blur(box);
  await waitFor(() => assert.deepEqual(writes(), ['PUT /api/c2w/settings {"howToApply":"Ask your employer for the scheme link"}']));
});

test('Deposits: the two drawn choices, each saved when picked', async () => {
  const { ui, fireEvent, waitFor, fold } = await openC2w({ open: 'Deposits' });
  assert.ok(await ui.findByRole('group', { name: 'When the certificate arrives' }));
  assert.ok(ui.getByRole('group', { name: 'If the customer pulls out' }));
  assert.ok(ui.getByText('The provider pays the rest; Wheelhouse works out the split.'));
  await waitFor(() => assert.equal(ui.getByRole('radio', { name: 'Refund the deposit' }).checked, true));
  fireEvent.click(ui.getByRole('radio', { name: 'Count it toward the price' }));
  await waitFor(() => assert.deepEqual(writes(), ['PUT /api/c2w/settings {"depositOnCertificate":"count"}']));
  await waitFor(() => assert.match(fold('Deposits').textContent, /Counted toward the price/));
  fireEvent.click(ui.getByRole('radio', { name: 'Keep it when the bike was ordered in' }));
  await waitFor(() => assert.equal(writes()[1], 'PUT /api/c2w/settings {"depositOnPullOut":"keep"}'));
});

test('On Today: the switch and its two day boxes', async () => {
  const { ui, fireEvent, waitFor, fold } = await openC2w({ open: 'On Today' });
  const late = await ui.findByLabelText('Payment late after');
  await waitFor(() => assert.equal(late.disabled, false));
  fireEvent.change(late, { target: { value: '14' } });
  fireEvent.blur(late);
  await waitFor(() => assert.deepEqual(writes(), ['PUT /api/c2w/settings {"paymentLateDays":14}']));
  fireEvent.click(ui.getByRole('switch', { name: 'Show these on Today' }));
  await waitFor(() => assert.equal(writes()[1], 'PUT /api/c2w/settings {"todayLines":false}'));
  await waitFor(() => assert.match(fold('On Today').textContent, /Off/));
});

test('Scheme providers: each row’s terms, Edit and Retire, the two drawn notes and + Add a provider', async () => {
  const { ui } = await openC2w({ open: 'Scheme providers' });
  assert.ok(await ui.findByText('Commission 4.5% · pays in about 30 days · 2 checks at hand-over'));
  assert.ok(ui.getByRole('button', { name: 'Edit Ride Scheme' }));
  assert.ok(ui.getByRole('button', { name: 'Retire Ride Scheme' }));
  assert.ok(ui.getByRole('button', { name: '+ Add a provider' }));
  assert.ok(ui.getByText('The schemes your customers use. Their terms are yours to fill in, from each provider’s agreement.'));
  assert.ok(ui.getByText('Changing a provider’s terms applies to new orders; open orders keep the terms they were made with.'));
});

test('+ Add a provider: the drawn box; Save sends the terms in pence or hundredths of a percent', async () => {
  const { ui, fireEvent, waitFor, within } = await openC2w({ providers: [], open: 'Scheme providers' });
  fireEvent.click(await ui.findByRole('button', { name: '+ Add a provider' }));
  const box = within(await ui.findByRole('dialog', { name: 'Add a provider' }));
  fireEvent.change(box.getByLabelText('Name'), { target: { value: 'Ride Scheme' } });
  fireEvent.change(box.getByLabelText('Commission'), { target: { value: '4.5' } });
  fireEvent.change(box.getByLabelText('Pays in about'), { target: { value: '30' } });
  assert.ok(box.getByText('After collection'));
  assert.equal(box.getByRole('radio', { name: 'Inside what the provider pays' }).checked, true);
  assert.ok(box.getByRole('radio', { name: 'The customer pays for them at collection' }));
  const checks = box.getByRole('textbox', { name: 'Checks at hand-over' });
  assert.equal(checks.getAttribute('placeholder'), '[From their agreement — one check per line]');
  assert.ok(box.getByText('Each line becomes a box for staff to tick at hand-over.'));
  fireEvent.change(checks, { target: { value: 'ID seen\nForm signed' } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.deepEqual(writes(), ['POST /api/c2w/providers {"name":"Ride Scheme","commissionKind":"percent","commissionValue":450,"paysInDays":30,"accessoriesInside":true,"handoverNote":"ID seen\\nForm signed"}']));
  assert.ok(await ui.findByRole('button', { name: 'Edit Ride Scheme' }));
});

test('Edit: the box is titled “Edit provider” and filled in; £ commission is sent in pence', async () => {
  const { ui, fireEvent, waitFor, within } = await openC2w({ open: 'Scheme providers' });
  fireEvent.click(await ui.findByRole('button', { name: 'Edit Ride Scheme' }));
  const dialog = await ui.findByRole('dialog', { name: 'Edit provider' });
  const box = within(dialog);
  assert.ok(box.getByText('Ride Scheme', { selector: 'p' }), 'the provider’s name under the title');
  assert.equal(box.getByLabelText('Name').value, 'Ride Scheme');
  assert.equal(box.getByLabelText('Commission').value, '4.5');
  assert.equal(box.getByLabelText('Pays in about').value, '30');
  assert.equal(box.getByRole('textbox', { name: 'Checks at hand-over' }).value, 'ID seen\nForm signed');
  fireEvent.click(within(box.getByRole('group', { name: 'Commission in' })).getByRole('button', { name: '£' }));
  fireEvent.change(box.getByLabelText('Commission'), { target: { value: '25' } });
  fireEvent.click(box.getByRole('radio', { name: 'The customer pays for them at collection' }));
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.deepEqual(writes(), ['PUT /api/c2w/providers/4 {"name":"Ride Scheme","commissionKind":"pounds","commissionValue":2500,"paysInDays":30,"accessoriesInside":false,"handoverNote":"ID seen\\nForm signed"}']));
  assert.ok(await ui.findByText('Commission £25.00 · pays in about 30 days · 2 checks at hand-over'));
});

test('Edit from a till that isn’t sent the commission: no Commission box, and none is sent', async () => {
  const { commissionKind, commissionValue, ...noCosts } = PROVIDER;
  const { ui, fireEvent, waitFor, within } = await openC2w({ providers: [noCosts], open: 'Scheme providers' });
  fireEvent.click(await ui.findByRole('button', { name: 'Edit Ride Scheme' }));
  const box = within(await ui.findByRole('dialog', { name: 'Edit provider' }));
  assert.ok(box.queryByLabelText('Commission') === null);
  assert.ok(box.queryByRole('group', { name: 'Commission in' }) === null);
  fireEvent.change(box.getByLabelText('Pays in about'), { target: { value: '45' } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.deepEqual(writes(), ['PUT /api/c2w/providers/4 {"name":"Ride Scheme","paysInDays":45,"accessoriesInside":true,"handoverNote":"ID seen\\nForm signed"}']));
});

test('a commission that isn’t a number is refused in the box, sending nothing; Cancel closes it', async () => {
  const { ui, fireEvent, waitFor, within } = await openC2w({ providers: [], open: 'Scheme providers' });
  fireEvent.click(await ui.findByRole('button', { name: '+ Add a provider' }));
  const box = within(await ui.findByRole('dialog', { name: 'Add a provider' }));
  fireEvent.change(box.getByLabelText('Name'), { target: { value: 'Ride Scheme' } });
  fireEvent.change(box.getByLabelText('Commission'), { target: { value: 'lots' } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  assert.equal((await box.findByRole('alert')).textContent, 'Type the commission as a percentage from 0 to 100');
  assert.deepEqual(writes(), []);
  fireEvent.click(box.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'Add a provider' }) === null));
});

test('Retire asks first, then takes the provider off the list', async () => {
  const { ui, fireEvent, waitFor, within } = await openC2w({ open: 'Scheme providers' });
  fireEvent.click(await ui.findByRole('button', { name: 'Retire Ride Scheme' }));
  const box = within(await ui.findByRole('dialog', { name: 'Retire Ride Scheme?' }));
  assert.ok(box.getByText('It comes off the list staff pick from for new orders. Orders that already use it keep it. A retired provider can’t be brought back.'));
  assert.ok(box.getByRole('button', { name: 'Keep Ride Scheme' }));
  assert.deepEqual(writes(), []);
  fireEvent.click(box.getByRole('button', { name: 'Retire Ride Scheme' }));
  await waitFor(() => assert.deepEqual(writes(), ['POST /api/c2w/providers/4/retire {}']));
  await waitFor(() => assert.ok(ui.queryByRole('button', { name: 'Edit Ride Scheme' }) === null));
});
