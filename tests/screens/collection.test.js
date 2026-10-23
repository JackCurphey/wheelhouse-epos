// A bike left uncollected, the screens (openspec/changes/uncollected-bike;
// cp-setting, the Bike still waiting row in setup.mjs, cp-today-uncollected):
// Settings › Workshop › Collection's two day counts, the message's row in
// Settings › Messages, and the bike's line on Today with Contacted.
import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const SETTINGS = { openingHours: [], bookingMode: 'day', showPricesOnline: true, confirmationNote: null, bookingTerms: null, fullDayThresholdMinutes: 0, minNoticeMinutes: 0, minNoticeDays: null, quoteReminderHours: 24, collectionReminderDays: 3, collectionTodayDays: 7 };
const STILL_WAITING = {
  key: 'bike_still_waiting', name: 'Bike still waiting', when: 'When a ready bike isn’t collected after the days the shop sets', enabled: true,
  wording: 'Hi [Customer’s first name], just a reminder that your [Bike] is ready to collect from [Shop name]. [What’s left to pay]. See what we did: [Link to the job]. Job [Job number]. We’re open [Opening hours].',
  subject: 'Your bike is still waiting — [Shop name]', changed: false, tapIns: ['Customer’s first name', 'Bike'], live: true,
};
// The drawing's line: WH-1050, Aisha Khan's Cannondale Quick, ready since Mon 14 Sep.
const UNCOLLECTED = { kind: 'uncollected', jobId: 50, reference: 'WH-1050', customerName: 'Aisha Khan', bikeLabel: 'Cannondale Quick', phone: '07700 900300', readySince: '2026-09-14T15:00:00Z', reminderSentAt: '2026-09-17T15:00:00Z' };

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let settings;
let attention;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
  mock.timers.reset();
});

async function open(path, { items = [UNCOLLECTED] } = {}) {
  calls = [];
  settings = { ...SETTINGS };
  attention = items;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/workshop-settings' && method === 'PUT') {
      const next = { ...settings, ...body };
      if (next.collectionTodayDays <= next.collectionReminderDays) return reply(400, { error: 'Show it on Today after more days than the reminder.' });
      settings = next;
      return reply(200, settings);
    }
    if (u.pathname === '/api/workshop-settings') return reply(200, settings);
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    if (u.pathname === '/api/message-templates') return reply(200, [STILL_WAITING]);
    if (u.pathname === '/api/needs-attention') return reply(200, { items: attention });
    if (u.pathname === '/api/workshop-jobs/50/contacted' && method === 'POST') { attention = attention.filter((i) => i.jobId !== 50); return reply(200, { ok: true }); }
    if (u.pathname === '/api/workshop-jobs') return reply(200, []);
    if (u.pathname.startsWith('/api/')) return reply(200, []);
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
async function openCollection() {
  const t = await open('/workshop/settings?room=workshop');
  t.fireEvent.click(await t.ui.findByRole('button', { name: /^Collection/ }));
  await t.ui.findByLabelText('Remind the customer after');
  return t;
}
const puts = () => calls.filter((c) => c.method === 'PUT' && c.url.includes('workshop-settings')).map((c) => c.body);

test('Collection is in Settings › Workshop, after Storage slots, its summary the reminder’s days', async () => {
  const { ui, waitFor } = await open('/workshop/settings?room=workshop');
  const fold = await ui.findByRole('button', { name: /^Collection/ });
  await waitFor(() => assert.match(fold.textContent, /Reminder after 3 days/));
  const names = ui.getAllByRole('button').map((b) => b.textContent);
  assert.ok(names.findIndex((n) => n.startsWith('Storage slots')) < names.findIndex((n) => n.startsWith('Collection')), 'after Storage slots');
});

test('the two day counts, as drawn, with what they count from', async () => {
  const { ui } = await openCollection();
  assert.equal(ui.getByLabelText('Remind the customer after').value, '3');
  assert.equal(ui.getByLabelText('Show it on Today after').value, '7');
  assert.match(ui.getByText(/^Counted from when the bike is marked ready/).textContent, /^Counted from when the bike is marked ready · sends “Bike still waiting” — edit it in Messages$/);
  assert.equal(ui.getByRole('link', { name: 'edit it in Messages' }).getAttribute('href'), '/workshop/settings?room=front-desk&fold=automatic-messages');
  assert.ok(ui.queryByText('Counted the same way, and longer than the reminder · for owners and managers') !== null);
});

test('a day count saves when you leave the box', async () => {
  const { ui, fireEvent, waitFor } = await openCollection();
  const box = ui.getByLabelText('Show it on Today after');
  fireEvent.change(box, { target: { value: '10' } });
  fireEvent.blur(box);
  await waitFor(() => assert.deepEqual(puts().at(-1), { collectionReminderDays: 3, collectionTodayDays: 10 }));
  assert.ok((await ui.findByText('Saved.')) !== null);
});

test('raising the reminder past Today’s count isn’t a dead end: raise Today and both save', async () => {
  const { ui, fireEvent, waitFor } = await openCollection();
  const remind = ui.getByLabelText('Remind the customer after');
  fireEvent.change(remind, { target: { value: '10' } });
  fireEvent.blur(remind);
  assert.ok((await ui.findByText('Show it on Today after more days than the reminder.')) !== null);
  assert.equal(remind.value, '10', 'what was typed stays');
  const today = ui.getByLabelText('Show it on Today after');
  fireEvent.change(today, { target: { value: '14' } });
  fireEvent.blur(today);
  await waitFor(() => assert.deepEqual(puts().at(-1), { collectionReminderDays: 10, collectionTodayDays: 14 }));
  await waitFor(() => assert.equal(settings.collectionReminderDays, 10));
});

test('a count that isn’t a whole number of days says so and saves nothing', async () => {
  const { ui, fireEvent } = await openCollection();
  const box = ui.getByLabelText('Remind the customer after');
  fireEvent.change(box, { target: { value: '0' } });
  fireEvent.blur(box);
  assert.ok((await ui.findByText('Enter 1 to 60 days')) !== null);
  assert.equal(puts().length, 0);
});

test('Settings › Messages says when Bike still waiting goes, with the shop’s days', async () => {
  const { ui, fireEvent } = await open('/workshop/settings?room=front-desk');
  await ui.findByRole('heading', { name: 'Messages' });
  fireEvent.click(ui.getByRole('button', { name: /^Automatic messages/ }));
  assert.ok((await ui.findByText('When a ready bike isn’t collected after 3 days')) !== null);
});

test('Today lists the uncollected bike, as drawn, and Contacted takes it off', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date(2026, 8, 24, 10, 0) });
  const { ui, fireEvent, waitFor, within } = await open('/workshop/today');
  const box = within(await ui.findByRole('region', { name: 'Needs attention · 1' }));
  assert.ok(box.queryByText('WH-1050 · Aisha Khan — ready since Mon 14 Sep') !== null);
  const sub = box.getByText(/^Cannondale Quick · /);
  assert.equal(sub.textContent, 'Cannondale Quick · reminder sent Thu 17 Sep · 07700 900300');
  assert.equal(box.getByRole('link', { name: '07700 900300' }).getAttribute('href'), 'tel:07700900300');
  fireEvent.click(box.getByRole('button', { name: 'Contacted: WH-1050' }));
  await waitFor(() => assert.ok(calls.some((c) => c.method === 'POST' && c.url.endsWith('/api/workshop-jobs/50/contacted'))));
  assert.ok((await ui.findByText('Nothing needs you right now')) !== null);
});

test('Today’s line leaves out the reminder before it has gone', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date(2026, 8, 24, 10, 0) });
  const { ui } = await open('/workshop/today', { items: [{ ...UNCOLLECTED, reminderSentAt: null }] });
  assert.equal((await ui.findByText(/^Cannondale Quick ·/)).textContent, 'Cannondale Quick · 07700 900300');
});

test('a Collection fold opened from a link: the fold named in the address opens', async () => {
  const { ui } = await open('/workshop/settings?room=front-desk&fold=automatic-messages');
  assert.ok((await ui.findByText('When a ready bike isn’t collected after 3 days')) !== null);
});
