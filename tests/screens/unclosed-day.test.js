// A day nobody closed (openspec/changes/unclosed-day; Jack's 29 Oct answer
// 5; UX walk-through 2 H1(b)): the morning's float check for it
// (op-float-check-unclosed), Today's line with Close it (op-today-unclosed,
// op-today-two), and that day's Close the day at banking
// (op-close-yesterday), shown first when tonight's close waits on it.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JACK = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false, shopName: 'North Street Cycles', shopSlug: 'north-street', employee: { id: 21, name: 'Jo Taylor', isCashier: true } };
const TODAY = new Date().toLocaleDateString('en-CA');
const NOW = new Date().toISOString();
// Monday 31 August wasn't closed: it started with the £150.00 float and took £79.00 in cash.
const MON = '2026-08-31';
const UNCLOSED = { day: TODAY, floatPence: 15000, takesPayments: true, firstDay: false, check: null, unclosed: { day: MON, startPence: 15000, cashPence: 7900, expectedPence: 22900 } };
const START = { pence: 15000, how: 'looked', expectedPence: 15000, byName: 'Jo Taylor', at: '2026-08-31T08:02:00Z' };
const COUNTED_BY = { pence: 21900, byName: 'Jo Taylor', at: NOW, day: TODAY };
const PAID_OUT = { id: 3, amountPence: 500, reason: '[Shop’s reason]', note: '', byName: 'Jack Lewis', at: '2026-08-31T13:15:00Z' };
const LATE = { day: MON, floatPence: 15000, floatStart: START, cashPence: 7900, paidOutsPence: 500, expectedPence: 22400, earlierBankedPence: 0, paidOuts: [PAID_OUT], countedBy: COUNTED_BY, carriedPence: 0, bankPence: 6900, topUpPence: 0, close: null };
const TONIGHT = { day: TODAY, floatPence: 15000, floatStart: { ...START, at: NOW }, cashPence: 0, paidOutsPence: 0, expectedPence: 15000, earlierBankedPence: 0, paidOuts: [], entry: { show: true, closesAt: '18:00' }, close: null, earlierDay: null };
const lateClose = (late) => ({
  id: 9, day: MON, closedByName: 'Jack Lewis', closedAt: NOW, floatStart: START, cashPence: 7900, drawerCashPence: 7900, paidOutsPence: late.paidOutsPence,
  expectedPence: late.expectedPence, earlierBankedPence: 0, countedPence: 21900, differencePence: 21900 - late.expectedPence, reason: '', floatPence: 15000,
  bankedPence: 6900, carriedPence: 0, leftPence: 15000, topUpPence: 0, takingsPence: 7900, cardPence: 0, otherPence: 0, onlinePence: 0, countedBy: COUNTED_BY,
});
const NOT_CLOSED = { kind: 'day_not_closed', day: MON, checkId: 12, checkDay: TODAY, countedByName: 'Jo Taylor', checkedAt: NOW, tillCode: 'B1' };
const SHORT = { kind: 'float_short', checkId: 12, day: TODAY, shortPence: 1000, tillCode: 'B1', countedByName: 'Jo Taylor', checkedAt: NOW, reason: '' };

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let server;
afterEach(async () => {
  if (!shell) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
  shell = undefined;
});

async function open(path, { me = JACK, floatCheck = UNCLOSED, items = [NOT_CLOSED], late = LATE, tonight = TONIGHT } = {}) {
  calls = [];
  server = { floatCheck, items, late: structuredClone(late), tonight: structuredClone(tonight) };
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/till-checkin') return reply(200, { serving: me.employee ? { id: me.employee.id, name: me.employee.name } : { id: 11, name: me.name }, checkedInToday: [] });
    if (u.pathname === '/api/auth/me') return reply(200, me);
    if (u.pathname === '/api/close-the-day' && method === 'POST' && body.day === MON) {
      server.late.close = lateClose(server.late);
      server.tonight.earlierDay = null;
      server.items = server.items.filter((i) => i.kind !== 'day_not_closed');
      return reply(201, { close: server.late.close });
    }
    if (u.pathname === '/api/close-the-day') return reply(200, u.searchParams.get('day') === MON ? server.late : server.tonight);
    if (u.pathname === '/api/paid-outs' && method === 'POST') {
      const paidOut = { ...PAID_OUT, id: 4, amountPence: body.amountPence, reason: body.reason };
      server.late.paidOuts.push(paidOut);
      server.late.paidOutsPence += body.amountPence;
      server.late.expectedPence -= body.amountPence;
      return reply(201, { paidOut });
    }
    if (u.pathname === '/api/float-check' && method === 'POST') {
      const check = { id: 12, how: 'counted', expectedPence: 22900, countedPence: body.countedPence, reason: body.reason ?? '', checkedByName: 'Jo Taylor', checkedAt: NOW };
      server.floatCheck = { ...server.floatCheck, check, unclosed: null };
      return reply(201, { check });
    }
    if (u.pathname === '/api/float-check') return reply(200, server.floatCheck);
    if (u.pathname === '/api/needs-attention') return reply(200, { items: server.items });
    if (u.pathname === '/api/workshop-services') return reply(200, []);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost${path}`);
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
const popUp = async (t, name) => t.within(await t.ui.findByRole('dialog', { name }));
const step = async (t, name) => t.ui.findByRole('button', { name: new RegExp(`^\\d\\s?${name}`) });
const posts = (path) => calls.filter((c) => c.method === 'POST' && c.url === path).map((c) => c.body);
const text = (el) => {
  const walk = el.ownerDocument.createTreeWalker(el, 4);
  const out = [];
  while (walk.nextNode()) { const v = walk.currentNode.nodeValue.trim(); if (v) out.push(v); }
  return out.join(' ');
};

test('first in after a day nobody closed: the float plus its cash, Count it only', async () => {
  const t = await open('/workshop/till', { me: JO });
  const check = await popUp(t, 'Hello, Jo');
  const words = text(t.ui.getByRole('dialog', { name: 'Hello, Jo' }));
  assert.ok(words.includes('The drawer should have £150.00 plus Monday’s cash £79.00'), words);
  assert.ok(check.getByText('Monday 31 August wasn’t counted, so its cash is still in the drawer. Count it now — your count becomes Monday’s count, so it needs real numbers, not a quick look.'));
  assert.deepEqual(check.getAllByRole('button').map((b) => b.textContent), ['Count it']);
  // A count that's out is out against the float plus Monday's cash.
  t.fireEvent.click(check.getByRole('button', { name: 'Count it' }));
  const count = await popUp(t, 'Count the float');
  t.fireEvent.change(count.getByLabelText('Cash counted, total'), { target: { value: '219.00' } });
  t.fireEvent.click(count.getByRole('button', { name: 'Done counting' }));
  const diff = text(t.ui.getByRole('dialog', { name: 'The float is short' }));
  assert.ok(diff.includes('Should have £229.00 Counted £219.00 Difference £10.00 short'), diff);
  t.fireEvent.click((await popUp(t, 'The float is short')).getByRole('button', { name: 'Start the day' }));
  await t.waitFor(() => assert.deepEqual(posts('/api/float-check'), [{ countedPence: 21900 }]));
});

test('Today: the day nobody closed with Close it, beside a short float', async () => {
  const t = await open('/workshop/today', { items: [SHORT, NOT_CLOSED] });
  const title = await t.ui.findByText('Monday 31 August wasn’t closed');
  assert.ok(t.ui.getByText('Needs attention · 2'));
  const [short, unclosed] = [...title.closest('ul').querySelectorAll(':scope > li')];
  assert.ok(text(short).startsWith('Till B1’s float was £10.00 short this morning'), text(short));
  assert.ok(text(unclosed).includes('Monday 31 August wasn’t closed Till B1 · counted with this morning’s float by Jo Taylor · still to bank'), text(unclosed));
  const close = t.within(unclosed).getByRole('link', { name: 'Close Monday 31 August' });
  assert.equal(close.textContent, 'Close it');
  assert.equal(close.getAttribute('href'), `/workshop/till/close?day=${MON}`);
});

test('Close it: the earlier day at banking, its cash taken out, and its own report', async () => {
  const t = await open(`/workshop/till/close?day=${MON}`);
  assert.ok(await t.ui.findByText('Monday 31 August'));
  assert.ok(text(await step(t, 'Count the cash')).includes('Counted this morning by Jo Taylor'));
  const banking = t.within(await t.ui.findByRole('region', { name: 'Paid-outs and banking' }));
  const words = text(t.ui.getByRole('region', { name: 'Paid-outs and banking' }));
  assert.ok(words.includes('Cash taken out on Monday [Shop’s reason]'), words);
  assert.ok(words.includes('Bank Monday’s cash £69.00 Leave in the drawer The float and today’s sales'), words);
  assert.ok(banking.getByText('Jo Taylor counted the drawer this morning: the float plus Monday’s cash. That count is Monday’s count, so there’s nothing to count again. Take Monday’s cash out and bag it for the bank.'));
  // Cash taken out for Monday is Monday's.
  t.fireEvent.click(banking.getByRole('button', { name: 'Add a paid-out' }));
  const po = await popUp(t, 'Cash taken out');
  t.fireEvent.change(po.getByLabelText('Amount'), { target: { value: '2.00' } });
  t.fireEvent.change(po.getByLabelText('What it was for'), { target: { value: 'Other' } });
  t.fireEvent.click(po.getByRole('button', { name: 'Take it out' }));
  await t.waitFor(() => assert.deepEqual(posts('/api/paid-outs'), [{ amountPence: 200, reason: 'Other', note: '', day: MON }]));
  t.fireEvent.click(banking.getByRole('button', { name: 'Banking bagged — next step' }));
  const report = t.within(await t.ui.findByRole('region', { name: 'End-of-day report' }));
  t.fireEvent.click(report.getByRole('button', { name: 'Close the day and show the report' }));
  await t.waitFor(() => assert.deepEqual(posts('/api/close-the-day'), [{ day: MON }]));
  const z = await popUp(t, 'Day closed');
  assert.ok(z.getByText('Monday 31 August · closed by Jack Lewis'));
});

// Money review 4, 29 Oct: Close it came from Today, so closing its report
// goes back to Today, not to the day just closed.
test('closing the report after Close it goes back to Today', async () => {
  const t = await open(`/workshop/till/close?day=${MON}`);
  const banking = t.within(await t.ui.findByRole('region', { name: 'Paid-outs and banking' }));
  t.fireEvent.click(banking.getByRole('button', { name: 'Banking bagged — next step' }));
  t.fireEvent.click(t.within(await t.ui.findByRole('region', { name: 'End-of-day report' })).getByRole('button', { name: 'Close the day and show the report' }));
  t.fireEvent.click((await popUp(t, 'Day closed')).getByRole('button', { name: 'Close' }));
  await t.waitFor(() => assert.equal(window.location.pathname, '/workshop/today'));
});

test('tonight\'s Close the day shows the day nobody closed first', async () => {
  const t = await open('/workshop/till/close', { tonight: { ...TONIGHT, earlierDay: MON } });
  assert.ok(await t.ui.findByText('Monday 31 August'));
  assert.ok(await t.ui.findByText('Bank Monday’s cash'));
  assert.ok(t.ui.queryByRole('group', { name: 'Count each note and coin' }) === null);
});

test('tonight, the cash banked for an earlier day comes off what the till expected', async () => {
  const t = await open('/workshop/till/close', { tonight: { ...TONIGHT, floatStart: { ...START, pence: 21900, how: 'counted', expectedPence: 22900, at: NOW }, earlierBankedPence: 6900 } });
  const region = t.within(await t.ui.findByRole('region', { name: 'Count the cash' }));
  t.fireEvent.change(region.getByLabelText('Cash counted, total'), { target: { value: '150.00' } });
  t.fireEvent.click(region.getByRole('button', { name: 'Done counting — show the difference' }));
  const rows = text(await region.findByRole('group', { name: 'How the till worked out what it expected' }));
  assert.ok(rows.includes('minus cash banked for an earlier day £69.00'), rows);
});
