// Close the day (openspec/changes/close-the-day): the page's steps (eod-count,
// eod-count-result, eod-count-exact, eod-banking, eod-banking-none,
// eod-finish), the paid-out pop-up (eod-paidout), the report (eod-z), the
// till's "Close the day" (eod-entry), and an over float on Today. Cash-up
// decisions 2 to 6; walk-through 2 M2; opening the shop decision 8 H1.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JACK = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false, shopName: 'North Street Cycles', shopSlug: 'north-street', employee: { id: 21, name: 'Jo Taylor', isCashier: true } };
const LOOKED = { id: 7, how: 'looked', expectedPence: 15000, countedPence: null, reason: '', checkedByName: 'Jack Lewis', checkedAt: '2026-09-01T08:02:00Z' };
const CHECKED = { day: '2026-09-01', floatPence: 15000, takesPayments: true, firstDay: false, check: LOOKED };
const START = { pence: 15000, how: 'looked', expectedPence: 15000, byName: 'Jack Lewis', at: '2026-09-01T08:02:00Z' };
// The page's figures: the float looked right at £150.00 and £74.00 was taken in cash.
const DAY = { day: '2026-09-01', floatPence: 15000, floatStart: START, cashPence: 7400, paidOutsPence: 0, expectedPence: 22400, paidOuts: [], entry: { show: true, closesAt: '18:00' }, close: null };
const PAID_OUT = { id: 3, amountPence: 500, reason: '[Shop’s reason]', note: '', byName: 'Jack Lewis', at: '2026-09-01T13:15:00Z' };
const closeFrom = (body, day) => ({
  id: 9, day: '2026-09-01', closedByName: 'Jack Lewis', closedAt: '2026-09-01T17:40:00Z', floatStart: START,
  cashPence: day.cashPence, paidOutsPence: day.paidOutsPence, expectedPence: day.expectedPence, countedPence: body.countedPence,
  differencePence: body.countedPence - day.expectedPence, reason: body.reason ?? '', floatPence: 15000,
  bankedPence: Math.max(0, body.countedPence - 15000), leftPence: 15000, topUpPence: Math.max(0, 15000 - body.countedPence),
  takingsPence: 9400, cardPence: 2000, otherPence: 0, onlinePence: 4000,
});
const CHANGED = 'The till’s figures changed while you were counting. Check the difference again.';

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let server;
let printed;
afterEach(async () => {
  // Nothing rendered, nothing to clean: importing the testing library before
  // any DOM would break typing for the whole file.
  if (!shell) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
  shell = undefined;
});

async function open(path, { me = JACK, day = DAY, floatCheck = CHECKED, items = [] } = {}) {
  calls = [];
  printed = 0;
  server = { day: structuredClone(day), floatCheck, items };
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, me);
    if (u.pathname === '/api/close-the-day' && method === 'POST') {
      // The server's own check: the expected figure the screen showed must still be right.
      if (body.expectedPence !== server.day.expectedPence) return reply(409, { error: CHANGED, code: 'expected_changed', expectedPence: server.day.expectedPence });
      server.day.close = closeFrom(body, server.day);
      server.day.entry = { ...server.day.entry, show: false };
      return reply(201, { close: server.day.close });
    }
    if (u.pathname === '/api/close-the-day') return me.isOwner ? reply(200, server.day) : reply(403, { error: "Only the shop's owner can close the day", code: 'owner_only' });
    if (u.pathname === '/api/paid-outs' && method === 'POST') {
      const paidOut = { ...PAID_OUT, id: 10 + server.day.paidOuts.length, amountPence: body.amountPence, reason: body.reason, note: body.note ?? '' };
      server.day.paidOuts.push(paidOut);
      server.day.paidOutsPence += body.amountPence;
      server.day.expectedPence -= body.amountPence;
      return reply(201, { paidOut });
    }
    if (u.pathname === '/api/float-check' && method === 'POST') {
      server.floatCheck = { ...server.floatCheck, check: LOOKED };
      return reply(201, { check: LOOKED });
    }
    if (u.pathname === '/api/float-check') return reply(200, server.floatCheck);
    if (u.pathname === '/api/float-check/8/seen') { server.items = []; return reply(200, { ok: true }); }
    if (u.pathname === '/api/needs-attention') return reply(200, { items: server.items });
    if (u.pathname === '/api/workshop-services') return reply(200, []);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost${path}`);
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  window.print = () => { printed += 1; };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
const openClose = (options) => open('/workshop/till/close', options);
const step = async (t, name) => t.ui.findByRole('button', { name: new RegExp(`^\\d\\s?${name}`) });
const posts = (path) => calls.filter((c) => c.method === 'POST' && c.url === path).map((c) => c.body);
const popUp = async (t, name) => t.within(await t.ui.findByRole('dialog', { name }));
// An element's words, a space between each piece of text.
const text = (el) => {
  const walk = el.ownerDocument.createTreeWalker(el, 4);
  const out = [];
  while (walk.nextNode()) { const v = walk.currentNode.nodeValue.trim(); if (v) out.push(v); }
  return out.join(' ');
};

async function count(t, total) {
  const page = t.within(await t.ui.findByRole('region', { name: 'Count the cash' }));
  t.fireEvent.change(page.getByLabelText('Cash counted, total'), { target: { value: total } });
  t.fireEvent.click(page.getByRole('button', { name: 'Done counting — show the difference' }));
}

test('Close the day opens on a blind count: the counter, no expected figure, and the steps to come', async () => {
  const t = await openClose();
  assert.ok(await t.ui.findByRole('heading', { name: 'Close the day', level: 2 }));
  assert.ok(t.ui.getByText('Tuesday 1 September'));
  const counting = await step(t, 'Count the cash');
  assert.equal(counting.getAttribute('aria-expanded'), 'true');
  assert.ok(text(counting).includes('To do'));
  assert.equal((await step(t, 'Paid-outs and banking')).getAttribute('aria-expanded'), 'false');
  assert.ok(text(await step(t, 'End-of-day report')).includes('After the steps above'));
  const region = t.within(t.ui.getByRole('region', { name: 'Count the cash' }));
  assert.ok(region.getByText('Count the drawer and fill in how many of each. The till shows what it expected once you’ve finished.'));
  assert.ok(region.getByRole('group', { name: 'Count each note and coin' }));
  // Blind (cash-up decision 2): what the till expects isn't on the page.
  assert.ok(t.ui.queryByText(/£224\.00/) === null);
  const done = region.getByRole('button', { name: 'Done counting — show the difference' });
  assert.equal(done.disabled, true);
  t.fireEvent.change(region.getByLabelText('Number of £50'), { target: { value: '4' } });
  assert.equal(done.disabled, false);
});

test('a difference: counted, expected, how the till worked it out, and a reason', async () => {
  const t = await openClose();
  await count(t, '221.90');
  const region = t.within(await t.ui.findByRole('region', { name: 'Count the cash' }));
  const rows = text(await region.findByRole('group', { name: 'How the till worked out what it expected' }));
  assert.ok(rows.includes('Float this morning · looked right · Jack Lewis at 09:02 £150.00'), rows);
  assert.ok(rows.includes('plus cash sales £74.00'), rows);
  assert.ok(rows.includes('minus cash taken out (paid-outs) £0.00'), rows);
  assert.ok(text(region.getByText('Counted').closest('[data-row]')).includes('£221.90'));
  assert.ok(text(region.getByText('The till expected').closest('[data-row]')).includes('£224.00'));
  assert.ok(text(region.getByText('Difference').closest('[data-row]')).includes('£2.10 short'));
  t.fireEvent.change(region.getByLabelText('Reason for the difference'), { target: { value: 'change given wrongly' } });
  // Count again goes back to the counter.
  t.fireEvent.click(region.getByRole('button', { name: 'Count again' }));
  assert.ok(await region.findByRole('group', { name: 'Count each note and coin' }));
  await count(t, '221.90');
  const again = t.within(await t.ui.findByRole('region', { name: 'Count the cash' }));
  t.fireEvent.change(await again.findByLabelText('Reason for the difference'), { target: { value: 'change given wrongly' } });
  t.fireEvent.click(again.getByRole('button', { name: 'Keep this count and go on' }));
  // Finishing a step opens the next (decision 6).
  await t.waitFor(async () => assert.equal((await step(t, 'Paid-outs and banking')).getAttribute('aria-expanded'), 'true'));
  assert.ok(text(await step(t, 'Count the cash')).includes('Counted'));
});

test('a count that matches is Spot on, with no reason box', async () => {
  const t = await openClose();
  await count(t, '224.00');
  const region = t.within(await t.ui.findByRole('region', { name: 'Count the cash' }));
  assert.equal(text((await region.findByText('Spot on')).closest('div')), 'Spot on £0.00');
  assert.ok(region.queryByLabelText('Reason for the difference') === null);
  assert.ok(text(await step(t, 'Count the cash')).includes('Spot on'));
});

test('banking: no cash taken out today, leave the float, bank the rest', async () => {
  const t = await openClose();
  await count(t, '224.00');
  t.fireEvent.click((await t.ui.findByRole('button', { name: 'Keep this count and go on' })));
  const banking = t.within(await t.ui.findByRole('region', { name: 'Paid-outs and banking' }));
  assert.ok(banking.getByText('No cash taken out today.'));
  assert.ok(text(banking.getByText('Leave in the drawer').closest('[data-row]')).includes('£150.00'));
  assert.ok(text(banking.getByText('Bank').closest('[data-row]')).includes('£74.00'));
  assert.ok(banking.getByText('The float is the shop’s standard amount, so tomorrow starts the same. Bag the rest for the bank.'));
});

test('Add a paid-out: amount, what it was for and a note; it is listed and comes off what the till expects', async () => {
  const t = await openClose();
  await count(t, '219.00');
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Keep this count and go on' }));
  const banking = t.within(await t.ui.findByRole('region', { name: 'Paid-outs and banking' }));
  t.fireEvent.click(banking.getByRole('button', { name: 'Add a paid-out' }));
  const box = await popUp(t, 'Cash taken out');
  assert.ok(box.getByText('Taken out by Jack Lewis. It comes off the cash the till expects.'));
  const take = box.getByRole('button', { name: 'Take it out' });
  t.fireEvent.change(box.getByLabelText('Amount'), { target: { value: 'five' } });
  t.fireEvent.click(take);
  assert.ok(await box.findByText('Pounds and pence, like 5.00'));
  assert.deepEqual(posts('/api/paid-outs'), []);
  t.fireEvent.change(box.getByLabelText('Amount'), { target: { value: '5.00' } });
  t.fireEvent.click(take);
  assert.ok(await box.findByText('Say what it was for.'));
  t.fireEvent.change(box.getByLabelText('What it was for'), { target: { value: '[Shop’s reason]' } });
  t.fireEvent.change(box.getByLabelText('Note (optional)'), { target: { value: 'receipt 12' } });
  t.fireEvent.click(take);
  await t.waitFor(() => assert.deepEqual(posts('/api/paid-outs'), [{ amountPence: 500, reason: '[Shop’s reason]', note: 'receipt 12' }]));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  const after = t.within(t.ui.getByRole('region', { name: 'Paid-outs and banking' }));
  const line = await after.findByText('[Shop’s reason]');
  assert.ok(text(line.closest('li')).includes('14:15 · Jack Lewis'));
  assert.ok(text(line.closest('li')).includes('£5.00'));
  // The count's result now expects £5.00 less: £219.00, spot on.
  t.fireEvent.click(await step(t, 'Count the cash'));
  const counted = t.within(await t.ui.findByRole('region', { name: 'Count the cash' }));
  assert.ok(await counted.findByText('Spot on'));
});

test('Close the day saves the count and shows the report, with Print', async () => {
  const t = await openClose();
  await count(t, '221.90');
  const region = t.within(await t.ui.findByRole('region', { name: 'Count the cash' }));
  t.fireEvent.change(await region.findByLabelText('Reason for the difference'), { target: { value: ' change given wrongly ' } });
  t.fireEvent.click(region.getByRole('button', { name: 'Keep this count and go on' }));
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Banking bagged — next step' }));
  const finish = t.within(await t.ui.findByRole('region', { name: 'End-of-day report' }));
  assert.ok(text(await step(t, 'Paid-outs and banking')).includes('Bagged'));
  assert.ok(text(await step(t, 'End-of-day report')).includes('Ready'));
  assert.ok(finish.getByText('Everything above is done. Closing the day saves the report and starts tomorrow with the float.'));
  t.fireEvent.click(finish.getByRole('button', { name: 'Close the day and show the report' }));
  await t.waitFor(() => assert.deepEqual(posts('/api/close-the-day'), [{ countedPence: 22190, expectedPence: 22400, reason: 'change given wrongly' }]));
  const report = await popUp(t, 'Day closed');
  assert.ok(report.getByText('Tuesday 1 September · closed by Jack Lewis'));
  const rows = report.getAllByRole('listitem').map(text);
  assert.deepEqual(rows, [
    'Takings £94.00', 'Card £20.00', 'Cash £74.00', 'Gift cards, store credit, customer accounts, other £0.00',
    'Float at the start £150.00 · looked right · Jack Lewis at 09:02 £150.00', 'Cash difference £2.10 short', 'Banked £71.90',
  ]);
  // Online money on its own line, not in the takings (Jack's answer 7).
  assert.ok(report.getByText('Online money is not in this till’s takings: £40.00 today'));
  t.fireEvent.click(report.getByRole('button', { name: 'Print' }));
  assert.equal(printed, 1);
  t.fireEvent.click(report.getByRole('button', { name: 'Close' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  // The day is closed: the last step says so and shows the report again.
  assert.ok(text(await step(t, 'End-of-day report')).includes('Closed'));
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Show the report' }));
  assert.ok(await popUp(t, 'Day closed'));
});

test('a day already closed opens with its steps done and the report to hand', async () => {
  const t = await openClose({ day: { ...DAY, entry: { show: false, closesAt: '18:00' }, close: closeFrom({ countedPence: 22400 }, DAY) } });
  assert.ok(text(await step(t, 'Count the cash')).includes('Counted'));
  assert.ok(text(await step(t, 'Paid-outs and banking')).includes('Bagged'));
  assert.ok(text(await step(t, 'End-of-day report')).includes('Closed'));
  assert.ok(t.ui.queryByRole('group', { name: 'Count each note and coin' }) === null);
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Show the report' }));
  const report = await popUp(t, 'Day closed');
  assert.ok(report.getAllByRole('listitem').map(text).includes('Cash difference £0.00'));
});

// Jack's answer 8: at closing, a float nobody checked is looked at (the
// shop's set float, one press), never counted, even on the first day.
test('the float is checked first when nobody has checked it today, Looks right only, and the count then starts from it', async () => {
  const t = await openClose({ day: { ...DAY, floatStart: null, expectedPence: null }, floatCheck: { ...CHECKED, firstDay: true, check: null } });
  const check = await popUp(t, 'Hello, Jack');
  assert.ok(check.getByText('£150.00'));
  assert.deepEqual(check.getAllByRole('button').map((b) => b.textContent), ['Looks right']);
  // The server now has this morning's float, as it would once the check is saved.
  server.day = { ...server.day, floatStart: START, expectedPence: DAY.expectedPence };
  t.fireEvent.click(check.getByRole('button', { name: 'Looks right' }));
  await t.waitFor(() => assert.deepEqual(posts('/api/float-check'), [{ countedPence: null, atClose: true }]));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  await count(t, '224.00');
  const region = t.within(await t.ui.findByRole('region', { name: 'Count the cash' }));
  assert.ok(await region.findByText('Spot on'));
});

// Jack's answer 5: a drawer below the float banks nothing and says how much to put in.
test('a count below the float: bank nothing, and put the difference in', async () => {
  const t = await openClose();
  await count(t, '140.00');
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Keep this count and go on' }));
  const banking = t.within(await t.ui.findByRole('region', { name: 'Paid-outs and banking' }));
  assert.ok(text(banking.getByText('Leave in the drawer').closest('[data-row]')).includes('£150.00'));
  assert.ok(text(banking.getByText('Bank').closest('[data-row]')).includes('£0.00'));
  assert.ok(banking.getByText('Put £10.00 in to make the float up to £150.00'));
});

// Review fix 3: the figures are read again when the count is done, and a
// change while counting is caught before the day closes.
test('Done counting reads the figures again', async () => {
  const t = await openClose();
  await t.ui.findByRole('region', { name: 'Count the cash' });
  await t.waitFor(() => assert.equal(shell.queryClient.isFetching(), 0));
  // A £6.00 cash sale while counting.
  server.day = { ...server.day, cashPence: 8000, expectedPence: 23000 };
  await count(t, '230.00');
  const region = t.within(await t.ui.findByRole('region', { name: 'Count the cash' }));
  assert.ok(await region.findByText('Spot on'));
});

test('a sale between counting and closing: the close is refused and the new difference shown', async () => {
  const t = await openClose();
  await count(t, '224.00');
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Keep this count and go on' }));
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Banking bagged — next step' }));
  server.day = { ...server.day, cashPence: 8000, expectedPence: 23000 };
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Close the day and show the report' }));
  const region = t.within(await t.ui.findByRole('region', { name: 'Count the cash' }));
  assert.ok(await region.findByText(CHANGED));
  await t.waitFor(() => assert.ok(text(region.getByText('Difference').closest('[data-row]')).includes('£6.00 short')));
  assert.ok(t.ui.queryByRole('dialog') === null);
  // Kept again, it closes against the new figure.
  t.fireEvent.click(region.getByRole('button', { name: 'Keep this count and go on' }));
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Banking bagged — next step' }));
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Close the day and show the report' }));
  assert.ok(await popUp(t, 'Day closed'));
  assert.deepEqual(posts('/api/close-the-day').map((b) => b.expectedPence), [22400, 23000]);
});

// Third review, item 4: once closed, the page shows the saved close, never
// the live figures the server still sends beside it (a later sale moves those).
test('a closed day shows its saved report, not the live figures', async () => {
  const saved = closeFrom({ countedPence: 22400 }, DAY);
  const t = await openClose({ day: { ...DAY, cashPence: 99900, expectedPence: 114900, paidOutsPence: 0, entry: { show: false, closesAt: '18:00' }, close: saved } });
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Show the report' }));
  const report = await popUp(t, 'Day closed');
  const rows = report.getAllByRole('listitem').map(text);
  assert.ok(rows.includes('Cash £74.00'), rows.join(' | '));
  assert.ok(rows.includes('Cash difference £0.00'), rows.join(' | '));
  assert.ok(t.ui.queryByText(/£999\.00|£1149\.00/) === null);
  assert.ok(t.ui.queryByRole('group', { name: 'How the till worked out what it expected' }) === null);
});

test('with no float set, the page says where to set it', async () => {
  const t = await openClose({ day: { ...DAY, floatPence: null, floatStart: null, expectedPence: null }, floatCheck: { ...CHECKED, floatPence: null, check: null } });
  assert.ok(await t.ui.findByText('Set the shop’s float in Settings › Front desk › End of day first: Close the day leaves it in the drawer and banks the rest.'));
  assert.ok(t.ui.queryByRole('group', { name: 'Count each note and coin' }) === null);
});

test('the till shows Close the day to the Owner from an hour before closing, and to nobody else', async () => {
  let t = await open('/workshop/till');
  const link = await t.ui.findByRole('link', { name: 'Close the day' });
  assert.equal(link.getAttribute('href'), '/workshop/till/close');
  assert.ok(t.ui.getByText('The shop closes at 18:00'));
  t.cleanup(); shell.queryClient.clear(); uninstall();
  t = await open('/workshop/till', { day: { ...DAY, entry: { show: false, closesAt: '18:00' } } });
  await t.ui.findByRole('region', { name: 'Sale' });
  await t.waitFor(() => assert.equal(shell.queryClient.isFetching(), 0));
  assert.ok(t.ui.queryByRole('link', { name: 'Close the day' }) === null);
  t.cleanup(); shell.queryClient.clear(); uninstall();
  t = await open('/workshop/till', { me: JO });
  await t.ui.findByRole('region', { name: 'Sale' });
  await t.waitFor(() => assert.equal(shell.queryClient.isFetching(), 0));
  assert.ok(t.ui.queryByRole('link', { name: 'Close the day' }) === null);
  assert.equal(calls.filter((c) => c.url === '/api/close-the-day').length, 0, 'not asked for someone who can’t close');
});

test('Today lists an over float with Seen', async () => {
  const OVER = { kind: 'float_over', checkId: 8, day: new Date().toLocaleDateString('en-CA'), overPence: 300, countedByName: 'Jo Taylor', checkedAt: new Date().toISOString(), reason: 'a note found' };
  const t = await open('/workshop/today', { items: [OVER] });
  const line = (await t.ui.findByText('The float was £3.00 over this morning')).closest('li');
  assert.ok(text(line).includes('Counted by Jo Taylor at'));
  assert.ok(text(line).includes('“a note found”'));
  t.fireEvent.click(t.within(line).getByRole('button', { name: 'Seen' }));
  await t.waitFor(() => assert.ok(calls.some((c) => c.method === 'POST' && c.url === '/api/float-check/8/seen')));
  await t.waitFor(() => assert.ok(t.ui.queryByText('The float was £3.00 over this morning') === null));
});
