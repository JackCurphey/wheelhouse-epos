// Offer another time (Jack, 20 Oct, docs/decisions/2026-10-20-offer-another-time.md;
// drawn as request-offer-pick and request-offer; openspec/changes/offer-another-time):
// from a request, the diary goes into pick mode; a free time opens the offer
// pop-up with a message; an offered booking shows as "Time offered".
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [{ id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true }];

function job(over) {
  return {
    id: 1, title: 'Brake service', reference: 'WH-1001', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-06', startTime: '10:00', endTime: '11:00', status: 'scheduled',
    bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', version: 3, notes: null, requested: null,
    customerDescription: null, cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, changeDeclinedAt: null,
    orderId: null, orderStatus: null, orderTotal: null, createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', ...over,
  };
}
const REQUEST = job({ id: 3, reference: 'WH-1003', title: 'Puncture repair', bikeLabel: 'Specialized Sirrus', customerName: 'Sam Reed', mechanicId: null, mechanicName: null, jobDate: '2026-10-09', startTime: '10:00', endTime: '10:45', bookingState: 'pending', version: 4 });
const CHANGE = job({ id: 2, reference: 'WH-1002', title: 'Full service', bikeLabel: 'Brompton C Line', customerName: 'Oliver Chen', jobDate: '2026-10-05', bookingState: 'reschedule_requested', version: 7,
  requested: { jobDate: '2026-10-05', startTime: '14:00', endTime: '15:00', mechanicId: 11 } });
const CANCELLED = job({ id: 4, reference: 'WH-1004', title: 'Safety check', bikeLabel: 'Cannondale Quick', customerName: 'Aisha Khan', jobDate: '2026-10-07', startTime: '13:00', endTime: '14:00',
  bookingState: 'cancelled', cancelledBy: 'customer', cancelledAt: '2026-10-03T07:58:00Z', version: 9 });
const OFFER_WORDS = 'Sorry, we can’t fit this service in when you asked. Would Thursday 8 October at 09:00 work instead?';
const OFFERED = job({ id: 5, reference: 'WH-1005', title: 'Gear service', bikeLabel: 'Giant Escape 2', customerName: 'Jamie Brooks', jobDate: '2026-10-08', startTime: '09:00', endTime: '10:00', bookingState: 'offered', version: 2,
  offer: { fromDate: '2026-10-07', fromTime: '10:00', message: OFFER_WORDS } });
const JOBS = [REQUEST, CHANGE, CANCELLED, OFFERED];
const WAITING = {
  count: 3,
  items: [
    { kind: 'new_booking', jobId: 3, reference: 'WH-1003', jobDate: '2026-10-09', startTime: '10:00', endTime: '10:45', mechanicId: null, customerName: 'Sam Reed', serviceNames: ['Puncture repair'], services: [], arrivedAt: '2026-10-03T08:15:00Z' },
    { kind: 'change_request', jobId: 2, reference: 'WH-1002', jobDate: '2026-10-05', startTime: '10:00', endTime: '11:00', mechanicId: 11, customerName: 'Oliver Chen', serviceNames: ['Full service'], services: [], arrivedAt: '2026-10-03T08:20:00Z',
      from: { jobDate: '2026-10-05', startTime: '10:00', endTime: '11:00', mechanicId: 11, mechanicName: 'Sam' }, to: { jobDate: '2026-10-05', startTime: '14:00', endTime: '15:00', mechanicId: 12, mechanicName: 'Alex Morgan' } },
    { kind: 'customer_cancelled', jobId: 4, reference: 'WH-1004', jobDate: '2026-10-07', startTime: '13:00', endTime: '14:00', mechanicId: 11, customerName: 'Aisha Khan', serviceNames: ['Safety check'], services: [], arrivedAt: '2026-10-03T07:58:00Z' },
  ],
};

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let answer; // what the next POST gets back: { status, body }
let people = MECHANICS;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
  people = MECHANICS;
});

function stubServer() {
  calls = [];
  answer = null;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : undefined });
    const reply = (status, body) => ({ status, ok: status < 300, json: async () => body });
    const u = new URL(url, 'http://localhost');
    if (method === 'POST') return answer ? reply(answer.status, answer.body) : reply(200, JOBS.find((j) => u.pathname.includes(`/${j.id}/`)));
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, people);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, WAITING);
    if (u.pathname === '/api/workshop-jobs') return reply(200, JOBS);
    const one = u.pathname.match(/^\/api\/workshop-jobs\/(\d+)$/);
    if (one) return reply(200, JOBS.find((j) => j.id === Number(one[1])));
    return reply(404, { error: 'Not found' });
  };
}

async function openDiary() {
  uninstall = installDom('http://localhost/workshop/diary?date=2026-10-05');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('button', { name: /Sam Reed/ });
  return { ...rtl, ui };
}

async function openRequest(r) {
  const col = r.within(r.ui.getByRole('region', { name: /Waiting for you/ }));
  r.fireEvent.click(col.getByRole('button', { name: /Sam Reed/ }));
  r.fireEvent.click(await col.findByRole('button', { name: "Open Sam Reed's request" }));
  const dialog = await r.ui.findByRole('dialog');
  await r.waitFor(() => assert.ok(r.within(dialog).queryByText('Loading…') === null));
  return r.within(dialog);
}
const BAR = 'Click a free time in the diary to offer Sam Reed · 45 minutes.';
const posted = () => calls.filter((c) => c.method === 'POST').map((c) => `${new URL(c.url, 'http://localhost').pathname} ${JSON.stringify(c.body)}`);

test('a request offers Offer another time, between Accept and Decline', async () => {
  const r = await openDiary();
  const dlg = await openRequest(r);
  const offer = dlg.getByRole('button', { name: 'Offer another time' });
  assert.ok(dlg.getByRole('button', { name: 'Accept' }).compareDocumentPosition(offer) & 4);
  assert.ok(offer.compareDocumentPosition(dlg.getByRole('button', { name: 'Decline' })) & 4);
});

test('Offer another time puts the diary in pick mode for the request; Cancel goes back to the request', async () => {
  const r = await openDiary();
  const dlg = await openRequest(r);
  r.fireEvent.click(dlg.getByRole('button', { name: 'Offer another time' }));
  assert.ok(await r.ui.findByText(BAR));
  assert.ok(r.ui.queryByRole('dialog') === null);
  assert.ok(r.ui.queryByRole('button', { name: 'Enter a time instead' }) === null);
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Cancel' }));
  assert.ok(await r.ui.findByRole('button', { name: 'Offer another time' }));
  assert.ok(r.ui.queryByText(BAR) === null);
});

test('a free time opens the offer with a message started; Offer this time sends it', async () => {
  const r = await openDiary();
  const dlg = await openRequest(r);
  r.fireEvent.click(dlg.getByRole('button', { name: 'Offer another time' }));
  await r.ui.findByText(BAR);
  r.fireEvent.click(r.ui.getByRole('group', { name: 'Tuesday 6 October' }), { clientY: 58 });
  const offer = r.within(await r.ui.findByRole('dialog', { name: 'Offer another time' }));
  assert.ok(offer.queryByText('Tuesday 6 October, 10:00') !== null);
  assert.ok(offer.queryByText(/Alex Morgan/) !== null);
  const box = offer.getByLabelText('Message to Sam');
  assert.equal(box.value, 'Sorry, we can’t fit this service in when you asked. Would Tuesday 6 October at 10:00 work instead?');
  assert.ok(offer.queryByText('Sam sees the time and your message on their booking page, and accepts it or cancels. Tuesday 6 October at 10:00 is kept free for them; the time they asked for is let go.') !== null);
  r.fireEvent.click(offer.getByRole('button', { name: 'Offer this time' }));
  await r.waitFor(() => assert.equal(posted().length, 1));
  const post = calls.find((c) => c.method === 'POST');
  assert.equal(new URL(post.url, 'http://localhost').pathname, '/api/workshop-jobs/3/offer');
  assert.deepEqual(post.body, { version: 4, jobDate: '2026-10-06', startTime: '10:00', mechanicId: 11, message: 'Sorry, we can’t fit this service in when you asked. Would Tuesday 6 October at 10:00 work instead?' });
  await r.waitFor(() => assert.ok(r.ui.queryByRole('dialog', { name: 'Offer another time' }) === null));
});

test('Choose another time goes back to the diary; a refusal shows its words', async () => {
  const r = await openDiary();
  const dlg = await openRequest(r);
  r.fireEvent.click(dlg.getByRole('button', { name: 'Offer another time' }));
  await r.ui.findByText(BAR);
  r.fireEvent.click(r.ui.getByRole('group', { name: 'Tuesday 6 October' }), { clientY: 58 });
  let offer = r.within(await r.ui.findByRole('dialog', { name: 'Offer another time' }));
  r.fireEvent.click(offer.getByRole('button', { name: 'Choose another time' }));
  assert.ok(await r.ui.findByText(BAR));
  r.fireEvent.click(r.ui.getByRole('group', { name: 'Tuesday 6 October' }), { clientY: 58 });
  offer = r.within(await r.ui.findByRole('dialog', { name: 'Offer another time' }));
  answer = { status: 409, body: { error: 'That time is no longer free', code: 'capacity' } };
  r.fireEvent.click(offer.getByRole('button', { name: 'Offer this time' }));
  assert.ok(await offer.findByRole('alert'));
});

test('an offered booking shows as Time offered, with nothing to answer', async () => {
  const r = await openDiary();
  assert.ok(await r.ui.findByText(/Giant Escape 2, Gear service, Jamie Brooks, WH-1005, Time offered/));
  const col = r.within(r.ui.getByRole('region', { name: /Waiting for you/ }));
  assert.ok(col.queryByRole('button', { name: /Jamie Brooks/ }) === null);
});

test('an offered booking can’t be dragged to another time, like a request', async () => {
  const r = await openDiary();
  const label = await r.ui.findByText(/Jamie Brooks, WH-1005, Time offered/);
  const request = r.ui.getByText(/Sam Reed, WH-1003, Pending/);
  // A request's block is a plain box; an offered one opens its pop-up (Jack,
  // 20 Oct, request-offered) but has no way to drag it.
  assert.ok(request.closest('button') === null);
  assert.ok(label.closest('button') !== null);
  assert.ok(label.closest('button').getAttribute('aria-describedby') !== 'diary-move-hint', 'no drag hint');
  assert.ok(r.ui.getByText(/Oliver Chen, WH-1002/).closest('button') !== null, 'a confirmed booking is a button');
});

// Fresh review: with no mechanic to give it (no one working, and none on the
// request), the pop-up says so and offers nothing the server would refuse.
test('with no mechanic for the time, the offer says to choose a mechanic’s time and can’t be sent', async () => {
  people = [];
  const r = await openDiary();
  const dlg = await openRequest(r);
  r.fireEvent.click(dlg.getByRole('button', { name: 'Offer another time' }));
  await r.ui.findByText(BAR);
  r.fireEvent.click(r.ui.getByRole('group', { name: 'Tuesday 6 October' }), { clientY: 58 });
  const offer = r.within(await r.ui.findByRole('dialog', { name: 'Offer another time' }));
  assert.ok(offer.queryByText('No mechanic is free to take this time. Choose another time, in a mechanic’s column.') !== null);
  assert.equal(offer.getByRole('button', { name: 'Offer this time' }).disabled, true);
});

// Declining or re-offering a time already offered (Jack, 20 Oct,
// docs/decisions/2026-10-20-offer-another-time.md item 4; drawn as
// request-offered and request-offered-decline).
async function openOffered(r) {
  const label = await r.ui.findByText(/Jamie Brooks, WH-1005, Time offered/);
  r.fireEvent.click(label.closest('button'));
  const dialog = await r.ui.findByRole('dialog', { name: 'Jamie Brooks · Giant Escape 2' });
  return r.within(dialog);
}

test('clicking an offered booking opens it: the time offered, the message, Offer a different time and Decline, no Accept', async () => {
  const r = await openDiary();
  const dlg = await openOffered(r);
  assert.ok(dlg.queryByText('Time offered', { selector: 'span' }) !== null);
  assert.ok(dlg.queryByText('Thursday 8 October, 09:00') !== null);
  assert.ok(dlg.queryByText(/· Alex Morgan/) !== null);
  assert.ok(dlg.queryByText('Waiting for Jamie to accept it or cancel. It’s kept free for them.') !== null);
  assert.ok(dlg.queryByRole('heading', { name: 'Your message to Jamie' }) !== null);
  assert.ok(dlg.queryByText(OFFER_WORDS) !== null);
  assert.ok(dlg.queryByText('60 minutes planned. Asked for Wednesday 7 October.') !== null);
  assert.ok(dlg.queryByRole('button', { name: 'Offer a different time' }) !== null);
  assert.ok(dlg.queryByRole('button', { name: 'Decline' }) !== null);
  assert.ok(dlg.queryByRole('button', { name: 'Accept' }) === null);
});

test('Offer a different time picks in the diary; Cancel comes back; the new offer says the day first asked for', async () => {
  const r = await openDiary();
  const dlg = await openOffered(r);
  r.fireEvent.click(dlg.getByRole('button', { name: 'Offer a different time' }));
  const bar = 'Click a free time in the diary to offer Jamie Brooks · 60 minutes.';
  assert.ok(await r.ui.findByText(bar));
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Cancel' }));
  assert.ok(await r.ui.findByRole('button', { name: 'Offer a different time' }));
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Offer a different time' }));
  await r.ui.findByText(bar);
  r.fireEvent.click(r.ui.getByRole('group', { name: 'Tuesday 6 October' }), { clientY: 58 });
  const offer = r.within(await r.ui.findByRole('dialog', { name: 'Offer another time' }));
  assert.ok(offer.queryByText('Asked for Wednesday 7 October · 60 minutes') !== null);
  r.fireEvent.click(offer.getByRole('button', { name: 'Offer this time' }));
  await r.waitFor(() => assert.equal(posted().length, 1));
  const post = calls.find((c) => c.method === 'POST');
  assert.equal(new URL(post.url, 'http://localhost').pathname, '/api/workshop-jobs/5/offer');
  assert.equal(post.body.version, 2);
  assert.equal(post.body.jobDate, '2026-10-06');
  assert.equal(post.body.startTime, '10:00');
});

test('Decline asks for a message, says the offered time is let go, and sends it; Keep request goes back', async () => {
  const r = await openDiary();
  let dlg = await openOffered(r);
  r.fireEvent.click(dlg.getByRole('button', { name: 'Decline' }));
  dlg = r.within(await r.ui.findByRole('dialog', { name: 'Decline request' }));
  assert.ok(dlg.queryByText('Jamie Brooks · Giant Escape 2') !== null);
  const box = dlg.getByLabelText('Message to Jamie');
  assert.equal(box.value, '');
  assert.ok(dlg.queryByText('Declining releases the request’s reservation. The customer is told not to travel for this request. Thursday 8 October at 09:00 is no longer kept for Jamie.') !== null);
  r.fireEvent.click(dlg.getByRole('button', { name: 'Keep request' }));
  dlg = r.within(await r.ui.findByRole('dialog', { name: 'Jamie Brooks · Giant Escape 2' }));
  r.fireEvent.click(dlg.getByRole('button', { name: 'Decline' }));
  dlg = r.within(await r.ui.findByRole('dialog', { name: 'Decline request' }));
  r.fireEvent.change(dlg.getByLabelText('Message to Jamie'), { target: { value: 'Sorry, we’re full that week.' } });
  r.fireEvent.click(dlg.getByRole('button', { name: 'Decline & notify customer' }));
  await r.waitFor(() => assert.deepEqual(posted(), ['/api/workshop-jobs/5/decline {"message":"Sorry, we’re full that week.","version":2}']));
});

