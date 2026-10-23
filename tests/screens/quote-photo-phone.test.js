// Use my phone, the computer's side (openspec/changes/use-my-phone; drawn as
// job-photo-choice, job-photo-phone and job-photo-phone-added in
// docs/design/user-journeys/generator, approved 23 Oct,
// docs/decisions/2026-10-23-use-my-phone.md): on a computer, a draft line's
// Add photo offers "Choose a file" or "Use my phone"; the pop-up shows a code
// to scan and changes by itself when the photo arrives. The pop-up's 3
// seconds between asks are shortened for the tests (window.WH_PHOTO_CODE_POLL_MS).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';
import { fakeJob } from '../helpers/fake-job.js';
import { fakeOrder } from '../helpers/fake-order.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [{ id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true }];
const ORDER = fakeOrder({ id: 80, kind: 'order', status: 'open', subtotal: 65, discount: 0, total: 65, items: [] });
const URL_TO_SCAN = 'http://localhost/book/north-street/photo/' + 'c'.repeat(64);
const line = (over) => ({ id: 1, kind: 'part', description: 'Shimano brake pads', productId: 40, quantity: 1, unitAmount: 28, decision: 'pending', lineTotal: 28, need: 'needed', reason: 'Rear pads worn — replacing', decidedVia: null, decidedAt: null, decidedByName: null, addedToOrderAt: null, goesWithLineId: null, without: null, photoId: null, ...over });
const LINES = [line({ id: 1, kind: 'labour', description: 'Fit & adjust brakes', productId: null, unitAmount: 18, lineTotal: 18 }), line({ id: 2 })];
const QUOTE = { id: 9, workshopJobId: 1, revision: 1, state: 'draft', createdAt: '2026-10-05T09:00:00Z', sentAt: null, lines: LINES, totals: { all: 46, approved: 0, pending: 46, declined: 0 } };
const JOB = fakeJob({
  id: 1, title: 'Standard service', reference: 'WH-1042', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane AL 3',
  mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-05', startTime: '10:00', endTime: '11:30', status: 'scheduled',
  bookingState: 'scheduled', custodyState: 'in_shop', workState: 'not_started', version: 3, orderId: 80, orderStatus: 'open', orderTotal: 65,
  createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', quote: { id: 9, state: 'draft', revision: 1 },
  parts: [{ id: 21, position: 1, date: '2026-10-05', startTime: '10:00', endTime: '11:30', mechanicId: 11, mechanicName: 'Alex Morgan' }],
});

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let codeState;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

function stubServer() {
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : undefined });
    const reply = (status, body) => ({ status, ok: status < 300, json: async () => body });
    const u = new URL(url, 'http://localhost');
    if (method === 'POST' && u.pathname === '/api/workshop-jobs/1/quote-photo-codes') return reply(201, { codeId: 3, path: new URL(URL_TO_SCAN).pathname, url: URL_TO_SCAN, expiresAt: '2026-09-01T06:15:00.000Z' });
    if (u.pathname === '/api/workshop-jobs/1/quote-photo-codes/3') return reply(200, codeState);
    if (method === 'POST' && u.pathname === '/api/workshop-jobs/1/attachments') return reply(201, { id: 77 });
    if (method === 'POST') return reply(201, QUOTE);
    if (u.pathname === '/api/workshop-jobs/1/attachments') return reply(200, []);
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, MECHANICS);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, { count: 0, items: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, [JOB]);
    if (u.pathname === '/api/workshop-jobs/1') return reply(200, JOB);
    if (u.pathname === '/api/sale-documents/80') return reply(200, ORDER);
    if (u.pathname === '/api/quotes/9') return reply(200, QUOTE);
    return reply(404, { error: 'Not found' });
  };
}

// A computer unless told otherwise: no media query matches.
async function openJob({ media } = {}) {
  codeState = { state: 'waiting' };
  uninstall = installDom('http://localhost/workshop/diary?date=2026-10-05');
  window.WH_PHOTO_CODE_POLL_MS = 20;
  if (media) window.matchMedia = (q) => ({ matches: media(q), media: q, addEventListener() {}, removeEventListener() {} });
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  rtl.fireEvent.click(await ui.findByRole('button', { name: /^Trek Domane AL 3, Standard service/ }));
  const dlg = rtl.within(await ui.findByRole('dialog', { name: /Standard service/ }));
  await dlg.findByRole('table');
  return { ...rtl, ui, dlg };
}
const posts = () => calls.filter((c) => c.method === 'POST').map((c) => `${new URL(c.url, 'http://localhost').pathname} ${JSON.stringify(c.body ?? null)}`);
const PNG_FILE = () => new window.File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'pads.png', { type: 'image/png' });

test('on a computer, Add photo offers Choose a file and Use my phone, as drawn', async () => {
  const { dlg, fireEvent } = await openJob();
  const add = await dlg.findByRole('button', { name: 'Add photo for Shimano brake pads' });
  assert.equal(add.getAttribute('aria-haspopup'), 'menu');
  fireEvent.click(add);
  assert.equal(add.getAttribute('aria-expanded'), 'true');
  const menu = dlg.getByRole('menu', { name: 'Add photo for Shimano brake pads' });
  const { within } = await import('@testing-library/react');
  assert.deepEqual(within(menu).getAllByRole('menuitem').map((m) => m.textContent), ['Choose a file', 'Use my phone']);
  assert.ok(within(menu).queryByText('Use my phone shows a code to scan with your phone’s camera.') !== null);
});

test('Choose a file still adds the photo from the computer', async () => {
  const { dlg, fireEvent, waitFor } = await openJob();
  fireEvent.change(await dlg.findByLabelText('Choose a file for Shimano brake pads'), { target: { files: [PNG_FILE()] } });
  await waitFor(() => assert.ok(posts().some((p) => p.startsWith('/api/workshop-jobs/1/attachments'))));
});

test('on a touch screen Add photo goes straight to the camera or file picker, with no menu', async () => {
  const { dlg } = await openJob({ media: (q) => q.includes('pointer: coarse') });
  const input = await dlg.findByLabelText('Add photo for Shimano brake pads');
  assert.equal(input.getAttribute('type'), 'file');
  assert.ok(dlg.queryByRole('menu') === null);
  assert.ok(dlg.queryByRole('button', { name: 'Add photo for Shimano brake pads' }) === null);
});

test('Use my phone makes a code for that line and shows it to scan, waiting for the photo', async () => {
  const { ui, dlg, fireEvent } = await openJob();
  fireEvent.click(await dlg.findByRole('button', { name: 'Add photo for Shimano brake pads' }));
  fireEvent.click(dlg.getByRole('menuitem', { name: 'Use my phone' }));
  const pop = (await import('@testing-library/react')).within(await ui.findByRole('dialog', { name: 'Add a photo from your phone' }));
  assert.deepEqual(posts().filter((p) => p.includes('quote-photo-codes')), ['/api/workshop-jobs/1/quote-photo-codes {"quoteId":9,"linePosition":1}']);
  assert.ok(pop.queryByText('Shimano brake pads · WH-1042') !== null);
  assert.ok(pop.queryByText('Scan this code with your phone’s camera. It opens the photo step for Shimano brake pads on WH-1042.') !== null);
  const code = await pop.findByRole('img', { name: 'A code to scan with your phone’s camera' });
  assert.match(code.getAttribute('src'), /^data:image\/svg\+xml/);
  assert.ok(pop.queryByText('Works for 15 minutes, for this photo only. No sign-in needed.') !== null);
  assert.ok(pop.queryByText('Waiting for the photo…') !== null);
  assert.ok(pop.queryByText(URL_TO_SCAN) !== null, 'the address to type isn\'t shown');
  fireEvent.click(pop.getByRole('button', { name: 'Cancel' }));
  const { waitFor } = await import('@testing-library/react');
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'Add a photo from your phone' }) === null));
});

test('when the photo arrives the pop-up says so by itself, and Done shows it on the line', async () => {
  const { ui, dlg, fireEvent, waitFor, within } = await openJob();
  fireEvent.click(await dlg.findByRole('button', { name: 'Add photo for Shimano brake pads' }));
  fireEvent.click(dlg.getByRole('menuitem', { name: 'Use my phone' }));
  const pop = within(await ui.findByRole('dialog', { name: 'Add a photo from your phone' }));
  await pop.findByText('Waiting for the photo…');
  codeState = { state: 'added', attachmentId: 77 };
  assert.ok((await pop.findByText('Photo added')) !== null);
  assert.ok(pop.queryByText('It’s on Shimano brake pads now, and the code no longer works.') !== null);
  assert.equal(pop.getByRole('img', { name: 'The photo from your phone' }).getAttribute('src'), '/api/workshop-jobs/1/attachments/77');
  const before = calls.filter((c) => c.url.endsWith('/api/quotes/9')).length;
  fireEvent.click(pop.getByRole('button', { name: 'Done' }));
  await waitFor(() => assert.ok(calls.filter((c) => c.url.endsWith('/api/quotes/9')).length > before, 'the quote wasn\'t read again'));
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'Add a photo from your phone' }) === null));
});

test('a code that runs out says so, and offers a new one', async () => {
  const { ui, dlg, fireEvent, within } = await openJob();
  fireEvent.click(await dlg.findByRole('button', { name: 'Add photo for Shimano brake pads' }));
  fireEvent.click(dlg.getByRole('menuitem', { name: 'Use my phone' }));
  const pop = within(await ui.findByRole('dialog', { name: 'Add a photo from your phone' }));
  await pop.findByText('Waiting for the photo…');
  codeState = { state: 'expired' };
  assert.ok((await pop.findByText('This code has expired.')) !== null);
  fireEvent.click(pop.getByRole('button', { name: 'Make a new code' }));
  const { waitFor } = await import('@testing-library/react');
  await waitFor(() => assert.equal(posts().filter((p) => p.includes('quote-photo-codes')).length, 2));
});
