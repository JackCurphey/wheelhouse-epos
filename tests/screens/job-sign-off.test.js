// The mechanic sign-off, piece 1 (Jack, 16 and 18 Oct,
// docs/decisions/2026-10-16-mechanic-sign-off.md; drawn in diary.mjs
// signOffDrawings()): "Mark ready for collection" asks "Who’s signing this
// off?" with the mechanics as pills, the job's own picked; the finished page
// shows "Signed off by [name] · [day], [time]".
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';
import { fakeJob } from '../helpers/fake-job.js';
const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [
  { id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true },
  { id: 12, name: 'Jo Taylor', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true },
];
const CUSTOMER = { id: 5, name: 'Maya Patel', email: 'maya@example.test', phone: '07700 900142', active: true };
const ORDER = { id: 80, status: 'draft', total: 111, items: [
  { id: 1, name: 'Standard service', lineType: 'service', qty: 1, unitPrice: 75, lineTotal: 75 },
  { id: 2, name: 'Brake pads (pair)', lineType: 'product', qty: 2, unitPrice: 18, lineTotal: 36 },
] };

let JOB;
function job(over) {
  return fakeJob({
    id: 1, title: 'Standard service', reference: 'WH-1042', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane AL 3',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-08', startTime: '10:00', endTime: '11:30', status: 'scheduled',
    bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', version: 3, notes: 'Check the rear hub too.', requested: null,
    customerDescription: 'Rear brake squeals and feels weak.', cancelledBy: null, cancelledAt: null, cancellationSeenAt: null,
    orderId: 80, orderStatus: 'draft', orderTotal: 111, createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', ...over,
  });
}

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let answer;
let messages;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

function stubServer() {
  calls = [];
  answer = null;
  messages = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : undefined });
    const reply = (status, body) => ({ status, ok: status < 300, json: async () => body });
    const u = new URL(url, 'http://localhost');
    if (method === 'POST') return answer ?? reply(200, { ...JOB, version: JOB.version + 1 });
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, MECHANICS);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, { count: 0, items: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, [JOB]);
    if (u.pathname === '/api/workshop-jobs/1') return reply(200, JOB);
    if (u.pathname === '/api/customers/5') return reply(200, CUSTOMER);
    if (u.pathname === '/api/sale-documents/80') return reply(200, ORDER);
    if (u.pathname === '/api/messages') return reply(200, messages);
    return reply(404, { error: 'Not found' });
  };
}

async function openJob(over = {}, how = 'click', held = []) {
  JOB = job(over);
  uninstall = installDom('http://localhost/workshop/diary?date=2026-10-05');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer();
  messages = held;
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  const block = await ui.findByRole('button', { name: /^Trek Domane AL 3, Standard service/ });
  if (how === 'click') rtl.fireEvent.click(block);
  else rtl.fireEvent.keyDown(block, { key: 'Enter' });
  const dlg = rtl.within(await ui.findByRole('dialog', { name: /Standard service/ }));
  await rtl.waitFor(() => assert.equal(Boolean(dlg.queryByText('Loading…')), false));
  return { ...rtl, ui, dlg };
}

const posts = () => calls.filter((c) => c.method === 'POST').map((c) => `${c.url} ${JSON.stringify(c.body)}`);
const has = (q) => Boolean(q);

test('a click on a diary block opens the job: title, status, customer, bike, mechanic and ready-by', async () => {
  const { dlg } = await openJob();
  assert.ok(has(dlg.queryByRole('heading', { name: 'Standard service' })));
  assert.ok(has(dlg.queryByText('Expected')));
  assert.ok(has(await dlg.findByText('07700 900142')));
  assert.ok(has(dlg.queryByText('maya@example.test')));
  assert.ok(has(dlg.queryByText('Trek Domane AL 3')));
  assert.ok(has(dlg.queryByText('Mechanic: Alex Morgan')));
  assert.ok(has(dlg.queryByText('Ready by Thu 8 Oct')));
});

test('Enter on a block opens the job too', async () => {
  const { dlg } = await openJob({}, 'enter');
  assert.ok(has(dlg.queryByRole('heading', { name: 'Standard service' })));
});

test('the job shows its number, the customer\'s words, its notes, and its work and parts', async () => {
  const { dlg } = await openJob();
  assert.ok(has(dlg.queryByText('WH-1042')));
  assert.ok(has(dlg.queryByText('Rear brake squeals and feels weak.')));
  assert.ok(has(dlg.queryByText('Check the rear hub too.')));
  assert.ok(has(await dlg.findByText('Brake pads (pair)')));
  assert.ok(has(dlg.queryByText('£111.00')));
});

const IN_PROGRESS = { custodyState: 'in_shop', workState: 'in_progress' };

async function askSignOff(over = {}) {
  const t = await openJob({ ...IN_PROGRESS, ...over });
  t.fireEvent.click(t.dlg.getByRole('button', { name: 'Mark ready for collection' }));
  const pop = t.within(await t.ui.findByRole('dialog', { name: 'Who’s signing this off?' }));
  return { ...t, pop };
}

test('Mark ready asks who is signing it off, with the job’s mechanic picked, and finishes nothing yet', async () => {
  const { pop } = await askSignOff();
  assert.ok(has(pop.queryByText('Standard service · WH-1042')));
  assert.ok(has(pop.queryByText('Signing off says the work is done and the bike is fine to go out. If it comes back, the job shows who passed it.')));
  const group = pop.getByRole('radiogroup', { name: 'Signed off by' });
  assert.ok(group !== null);
  assert.equal(pop.getByRole('radio', { name: 'Alex Morgan' }).getAttribute('aria-checked'), 'true');
  assert.equal(pop.getByRole('radio', { name: 'Jo Taylor' }).getAttribute('aria-checked'), 'false');
  assert.deepEqual(posts(), []);
});

test('the sign-off pills are one Tab stop and move with the arrow keys', async () => {
  const { pop, fireEvent, waitFor } = await askSignOff();
  const alex = pop.getByRole('radio', { name: 'Alex Morgan' });
  const jo = pop.getByRole('radio', { name: 'Jo Taylor' });
  await waitFor(() => assert.equal(alex.tabIndex, 0));
  assert.equal(jo.tabIndex, -1);
  alex.focus();
  fireEvent.keyDown(alex, { key: 'ArrowDown' });
  await waitFor(() => assert.equal(jo.getAttribute('aria-checked'), 'true'));
  assert.ok(document.activeElement === jo);
});

test('Sign off and mark ready finishes the work with who signed it off', async () => {
  const { pop, fireEvent, waitFor, ui } = await askSignOff();
  fireEvent.click(pop.getByRole('radio', { name: 'Jo Taylor' }));
  fireEvent.click(pop.getByRole('button', { name: 'Sign off and mark ready' }));
  await waitFor(() => assert.deepEqual(posts(), ['/api/workshop-jobs/1/finish {"signedOffBy":12,"version":3}']));
  await waitFor(() => assert.equal(has(ui.queryByRole('dialog', { name: 'Who’s signing this off?' })), false));
});

test('a shared-queue job has nobody picked, and Sign off waits until someone is', async () => {
  const { pop, fireEvent, waitFor } = await askSignOff({ mechanicId: null, mechanicName: null });
  for (const name of ['Alex Morgan', 'Jo Taylor']) assert.equal(pop.getByRole('radio', { name }).getAttribute('aria-checked'), 'false');
  const go = pop.getByRole('button', { name: 'Sign off and mark ready' });
  assert.equal(go.disabled, true);
  fireEvent.click(pop.getByRole('radio', { name: 'Alex Morgan' }));
  assert.equal(go.disabled, false);
  fireEvent.click(go);
  await waitFor(() => assert.deepEqual(posts(), ['/api/workshop-jobs/1/finish {"signedOffBy":11,"version":3}']));
});

test('Cancel finishes nothing', async () => {
  const { pop, fireEvent, ui } = await askSignOff();
  fireEvent.click(pop.getByRole('button', { name: 'Cancel' }));
  assert.equal(has(ui.queryByRole('dialog', { name: 'Who’s signing this off?' })), false);
  assert.deepEqual(posts(), []);
});

test('the finished page shows who signed it off, and when', async () => {
  const { dlg } = await openJob({ custodyState: 'in_shop', workState: 'complete', signedOffBy: 11, signedOffByName: 'Alex Morgan', signedOffAt: '2026-09-17T14:30:00.000Z' });
  const line = dlg.getByText((_, el) => el?.getAttribute('data-sign-off') === 'true');
  assert.equal(line.textContent, 'Signed off by Alex Morgan · Thu 17 Sep, 15:30');
});

test('work not signed off (finished before the sign-off, or paid at the till) shows no line', async () => {
  const { dlg } = await openJob({ custodyState: 'in_shop', workState: 'complete', signedOffBy: null, signedOffByName: null, signedOffAt: null });
  assert.equal(has(dlg.queryByText(/Signed off by/)), false);
});

// Bike ready (UX walk-through 1 H2; the messages engine, Jack 20 Oct): marking
// it ready queues "Bike ready" with a minute to Undo, drawn as the strip
// "Alex marked it ready at 15:30. “Bike ready” goes to Maya by text in 1 minute."
const FINISHED = { custodyState: 'in_shop', workState: 'complete', signedOffBy: 12, signedOffByName: 'Jo Taylor', signedOffAt: '2026-09-17T14:30:00.000Z' };
const inAMinute = () => new Date(Date.now() + 60_000).toISOString();

async function markReady(readyMessage) {
  const t = await askSignOff();
  answer = { status: 200, ok: true, json: async () => ({ ...JOB, ...FINISHED, version: 4, readyMessage }) };
  // The job as the server then has it, finished, when the page reloads it (as the real one).
  JOB = { ...JOB, ...FINISHED, version: 4 };
  t.fireEvent.click(t.pop.getByRole('radio', { name: 'Jo Taylor' }));
  t.fireEvent.click(t.pop.getByRole('button', { name: 'Sign off and mark ready' }));
  return t;
}

test('marking it ready says Bike ready goes in a minute, the customer’s way, with Undo', async () => {
  const { dlg } = await markReady({ id: 55, channel: 'sms', to: '07700 900142', sendAfter: inAMinute() });
  assert.ok(has(await dlg.findByText('Jo Taylor marked it ready at 15:30. “Bike ready” goes to Maya by text in 1 minute.')));
  assert.ok(has(dlg.queryByRole('button', { name: 'Undo' })));
});

test('by email or WhatsApp when that’s the customer’s way', async () => {
  const { dlg } = await markReady({ id: 55, channel: 'whatsapp', to: '07700 900142', sendAfter: inAMinute() });
  assert.ok(has(await dlg.findByText('Jo Taylor marked it ready at 15:30. “Bike ready” goes to Maya by WhatsApp in 1 minute.')));
});

test('Undo stops Bike ready, and the strip goes', async () => {
  const { dlg, fireEvent, waitFor } = await markReady({ id: 55, channel: 'email', to: 'maya@example.test', sendAfter: inAMinute() });
  await dlg.findByText(/“Bike ready” goes to Maya by email in 1 minute\./);
  answer = { status: 200, ok: true, json: async () => ({ id: 55, state: 'undone' }) };
  fireEvent.click(dlg.getByRole('button', { name: 'Undo' }));
  await waitFor(() => assert.equal(posts().at(-1), '/api/messages/55/undo {}'));
  await waitFor(() => assert.equal(has(dlg.queryByText(/“Bike ready” goes to/)), false));
});

test('too late to Undo: says it’s already gone', async () => {
  const { dlg, fireEvent } = await markReady({ id: 55, channel: 'sms', to: '07700 900142', sendAfter: inAMinute() });
  await dlg.findByText(/“Bike ready” goes to Maya/);
  answer = { status: 409, ok: false, json: async () => ({ error: 'It’s already gone', code: 'illegal' }) };
  fireEvent.click(dlg.getByRole('button', { name: 'Undo' }));
  assert.ok(has(await dlg.findByText('It’s already gone')));
});

test('a customer with no phone or email: says Bike ready didn’t go, and why', async () => {
  const { dlg } = await markReady({ skipped: 'no_contact' });
  assert.ok(has(await dlg.findByText('“Bike ready” didn’t go: Maya Patel has no phone number or email on file.')));
  assert.equal(has(dlg.queryByRole('button', { name: 'Undo' })), false);
});

test('Bike ready switched off in Settings: nothing is said', async () => {
  const { dlg, waitFor } = await markReady({ skipped: 'off' });
  await waitFor(() => assert.ok(posts().length === 1));
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(has(dlg.queryByText(/Bike ready/)), false);
});

// Don't close things by themselves (Jack, 24 Oct answer 9; drawn as
// job-finished-wait and job-finished-sent; openspec/changes/dont-close-screens):
// with the switch on, Bike ready is held, and the strip waits for Send now.
const HELD = { id: 55, channel: 'sms', to: '07700 900142', sendAfter: null, held: true };
const WAITING = 'Jo Taylor marked it ready at 15:30. “Bike ready” to Maya by text is waiting until you press Send now.';
const stripText = (want) => (_, el) => el?.tagName === 'SPAN' && (typeof want === 'string' ? el.textContent === want : want.test(el.textContent ?? ''));

test('held: the strip waits for Send now or Undo, with nothing on a timer', async () => {
  const { dlg } = await markReady(HELD);
  assert.ok(has(await dlg.findByText(stripText(WAITING))));
  assert.ok(has(dlg.queryByRole('button', { name: 'Send now' })));
  assert.ok(has(dlg.queryByRole('button', { name: 'Undo' })));
  await new Promise((r) => setTimeout(r, 80));
  assert.ok(has(dlg.queryByText(stripText(WAITING))), 'the strip went by itself');
});

test('Send now sends it: the strip says it was sent, and when, with no buttons', async () => {
  const { dlg, fireEvent, waitFor } = await markReady(HELD);
  await dlg.findByText(stripText(WAITING));
  answer = { status: 200, ok: true, json: async () => ({ id: 55, state: 'intended', held: false, sendAfter: new Date().toISOString() }) };
  fireEvent.click(dlg.getByRole('button', { name: 'Send now' }));
  await waitFor(() => assert.equal(posts().at(-1), '/api/messages/55/send-now {}'));
  assert.ok(has(await dlg.findByText(stripText(/^Jo Taylor marked it ready at 15:30\. “Bike ready” sent to Maya by text · \d\d:\d\d$/))));
  assert.equal(has(dlg.queryByRole('button', { name: 'Send now' })), false);
  assert.equal(has(dlg.queryByRole('button', { name: 'Undo' })), false);
});

test('Undo stops a held Bike ready, as in its minute', async () => {
  const { dlg, fireEvent, waitFor } = await markReady(HELD);
  await dlg.findByText(stripText(WAITING));
  answer = { status: 200, ok: true, json: async () => ({ id: 55, state: 'undone' }) };
  fireEvent.click(dlg.getByRole('button', { name: 'Undo' }));
  await waitFor(() => assert.equal(posts().at(-1), '/api/messages/55/undo {}'));
  await waitFor(() => assert.equal(has(dlg.queryByText(stripText(WAITING))), false));
});

test('Send now refused (the bike has gone): says why', async () => {
  const { dlg, fireEvent } = await markReady(HELD);
  await dlg.findByText(stripText(WAITING));
  answer = { status: 409, ok: false, json: async () => ({ error: 'The bike has been collected, so it won’t be sent.', code: 'illegal' }) };
  fireEvent.click(dlg.getByRole('button', { name: 'Send now' }));
  assert.ok(has(await dlg.findByText('The bike has been collected, so it won’t be sent.')));
});

const HELD_MESSAGE = { id: 55, key: 'bike_ready', name: 'Bike ready', channel: 'sms', to: '07700 900142', body: 'Hi Maya, your bike is ready.', state: 'intended', pretend: true, sendAfter: null, held: true, sentAt: null, error: null, createdAt: '2026-09-17T14:30:00.000Z', direction: 'outbound' };

test('opened again later: a held Bike ready still waits for Send now', async () => {
  const { dlg } = await openJob(FINISHED, 'click', [HELD_MESSAGE]);
  assert.ok(has(await dlg.findByText(stripText(WAITING))));
  assert.ok(has(dlg.queryByRole('button', { name: 'Send now' })));
});

test('Messages says a held Bike ready is waiting until Send now', async () => {
  const { dlg, fireEvent, ui, within } = await openJob(FINISHED, 'click', [HELD_MESSAGE]);
  fireEvent.click(dlg.getByRole('button', { name: 'Message Maya Patel' }));
  const box = within(await ui.findByRole('dialog', { name: 'Messages' }));
  assert.ok(has(await box.findByText('By text to 07700 900142 · waits until you press Send now')));
});

test('a collected bike: no waiting strip, even with Bike ready still held (review)', async () => {
  const { dlg } = await openJob({ ...FINISHED, custodyState: 'collected' }, 'click', [HELD_MESSAGE]);
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(has(dlg.queryByRole('button', { name: 'Send now' })), false);
  assert.equal(has(dlg.queryByText(stripText(WAITING))), false);
});

test('Send now that couldn’t reach Wheelhouse: the strip stays, to try again (review)', async () => {
  const { dlg, fireEvent, waitFor } = await markReady(HELD);
  await dlg.findByText(stripText(WAITING));
  answer = { status: 500, ok: false, json: async () => ({ error: 'Server error' }) };
  fireEvent.click(dlg.getByRole('button', { name: 'Send now' }));
  await waitFor(() => assert.equal(posts().at(-1), '/api/messages/55/send-now {}'));
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(has(dlg.queryByText(stripText(WAITING))));
  assert.ok(has(dlg.queryByRole('button', { name: 'Send now' })));
});
