// The review request's box in Settings › Messages (openspec/changes/review-box;
// drawn as ac-review-first and ac-review-setting; account and reminders
// decision 5, audit M6): the switch, the review page, the days, the wording
// with its fixed Stop these line and a preview; the switch waits for a page.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const WORDS = 'Thanks for coming to [Shop name], [Customer’s first name]. If you have a minute, we’d love a review: [Link to review].';
const REVIEW = {
  key: 'review_request', name: 'Review request', when: 'After a bike is collected', group: 'reminders', enabled: false, wording: WORDS,
  subject: 'Thanks for coming to [Shop name]', changed: false, tapIns: ['Customer’s first name', 'Shop name', 'Link to review'], live: true,
};
const PAGE = 'https://g.page/r/north-street-cycles/review';
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let settings;
let template;
let refuse;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function openBox({ page = null, enabled = false } = {}) {
  calls = [];
  settings = { openingHours: [], bookingMode: 'day', quoteReminderHours: 24, reviewPageUrl: page, reviewRequestDays: 2 };
  template = { ...REVIEW, enabled };
  refuse = null;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    if (refuse && method === 'PUT' && u.pathname === refuse.path) return reply(400, { error: refuse.error });
    if (u.pathname === '/api/workshop-settings' && method === 'PUT') { settings = { ...settings, ...body }; return reply(200, settings); }
    if (u.pathname === '/api/workshop-settings') return reply(200, settings);
    if (u.pathname === '/api/message-templates') return reply(200, [template]);
    if (u.pathname === '/api/message-templates/review_request' && method === 'PUT') { template = { ...template, ...body }; return reply(200, template); }
    if (u.pathname === '/api/message-templates/review_request/preview') {
      const words = (body.wording ?? template.wording).replace('[Shop name]', 'North Street Cycles').replace('[Customer’s first name]', 'Maya').replace('[Link to review]', '[link]');
      return reply(200, { text: `${words} Stop these: [link].`, email: { subject: 'Thanks for coming to North Street Cycles', body: words } });
    }
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/settings?room=front-desk');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { name: 'Messages' });
  rtl.fireEvent.click(ui.getByRole('button', { name: /^Automatic messages/ }));
  rtl.fireEvent.click(await ui.findByRole('button', { name: 'Edit the wording of Review request' }));
  const box = await ui.findByRole('dialog', { name: 'Review request' });
  return { ...rtl, ui, box: rtl.within(box) };
}
const puts = () => calls.filter((c) => c.method === 'PUT').map((c) => `${c.url} ${JSON.stringify(c.body)}`);

test('the box as drawn: switch, review page, days, wording with the fixed line, preview, the note', async () => {
  const { box } = await openBox({ page: PAGE, enabled: true });
  assert.ok(box.getByText('Sent after a bike is collected'));
  assert.equal(box.getByRole('switch', { name: 'Send review requests' }).getAttribute('aria-checked'), 'true');
  const page = box.getByRole('textbox', { name: 'Your review page' });
  assert.equal(page.value, PAGE);
  assert.equal(page.getAttribute('placeholder'), 'Paste the link to your review page');
  assert.ok(box.getByText('Where the link goes — your Google page, say.'));
  assert.equal(box.getByRole('textbox', { name: /Send it/ }).value, '2');
  assert.ok(box.getByText('days after collection'));
  assert.equal(box.getByRole('textbox', { name: 'Wording' }).value, WORDS);
  assert.deepEqual(box.getAllByRole('button', { name: /^\+ / }).map((b) => b.textContent), ['+ Customer’s first name', '+ Shop name', '+ Link to review']);
  assert.ok(box.getByText('Always added at the end: “Stop these: [link]”. It can’t be taken off.'));
  assert.ok(await box.findByText('Thanks for coming to North Street Cycles, Maya. If you have a minute, we’d love a review: [link]. Stop these: [link].'));
  assert.ok(box.getByText('Everyone gets the same link — Google doesn’t allow asking only happy customers. Only customers who said yes get it.'));
  assert.ok(box.getByRole('button', { name: 'Cancel' }) && box.getByRole('button', { name: 'Save' }));
});

test('the first time: no page, so the switch can’t go on, and says to add the page first', async () => {
  const { box, fireEvent } = await openBox();
  const sw = box.getByRole('switch', { name: 'Send review requests' });
  assert.equal(sw.disabled, true);
  assert.ok(box.getByText('Add your review page first, then switch this on.'));
  fireEvent.change(box.getByRole('textbox', { name: 'Your review page' }), { target: { value: PAGE } });
  assert.equal(box.getByRole('switch', { name: 'Send review requests' }).disabled, false);
  assert.ok(box.queryByText('Add your review page first, then switch this on.') === null);
});

test('Save writes the page and days first, then switches it on', async () => {
  const { box, fireEvent, waitFor, ui } = await openBox();
  fireEvent.change(box.getByRole('textbox', { name: 'Your review page' }), { target: { value: PAGE } });
  fireEvent.change(box.getByRole('textbox', { name: /Send it/ }), { target: { value: '3' } });
  fireEvent.click(box.getByRole('switch', { name: 'Send review requests' }));
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.deepEqual(puts(), [
    `/api/workshop-settings {"reviewPageUrl":"${PAGE}","reviewRequestDays":3}`,
    '/api/message-templates/review_request {"enabled":true}',
  ]));
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
});

test('a refusal shows in the box, which stays open; Cancel sends nothing', async () => {
  const { box, fireEvent, ui } = await openBox();
  refuse = { path: '/api/workshop-settings', error: 'Paste the whole link to your review page, starting https://' };
  fireEvent.change(box.getByRole('textbox', { name: 'Your review page' }), { target: { value: 'my google page' } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  assert.ok(await box.findByText('Paste the whole link to your review page, starting https://'));
  assert.ok(ui.queryByRole('dialog', { name: 'Review request' }) !== null);
  const before = puts().length;
  fireEvent.click(box.getByRole('button', { name: 'Cancel' }));
  assert.equal(puts().length, before);
});

// Self-review: clearing the page while it's on switches it off first, so the
// shop never refuses the save ("Switch review requests off first").
test('clearing the page while it’s on saves it off first, then the page', async () => {
  const { box, fireEvent, waitFor } = await openBox({ page: PAGE, enabled: true });
  fireEvent.change(box.getByRole('textbox', { name: 'Your review page' }), { target: { value: '' } });
  assert.equal(box.getByRole('switch', { name: 'Send review requests' }).getAttribute('aria-checked'), 'false');
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.deepEqual(puts(), [
    '/api/message-templates/review_request {"enabled":false}',
    '/api/workshop-settings {"reviewPageUrl":null,"reviewRequestDays":2}',
  ]));
});

// Switched on from its row with no page yet: the shop's own words, not "couldn't save".
test('switching it on from its row with no page says why', async () => {
  const { ui, fireEvent } = await openBox();
  fireEvent.click(ui.getByRole('button', { name: 'Cancel' }));
  refuse = { path: '/api/message-templates/review_request', error: 'Add your review page first, then switch this on.' };
  fireEvent.click(await ui.findByRole('button', { name: 'Review request: Off' }));
  assert.ok(await ui.findByText('Add your review page first, then switch this on.'));
});
