// Settings › Messages › Your own messages (openspec/changes/own-messages-screens;
// drawn as set-msg-new in setup.mjs; owner setup decision 14; stage 1 drawing
// gaps decision 7; Jack's answers of 26 Oct): the rows, the add box, Edit with
// Remove and Save.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const SPRING = { id: 3, name: 'Spring check', sendWhen: 'after_collected', amount: 6, unit: 'months', byText: false, byEmail: true, wording: 'Hi [Customer’s first name], time for a spring check.', enabled: true };
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let mine;
let rendered = false;
afterEach(async () => {
  if (!rendered) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
  rendered = false;
});

async function openMessages(start = [SPRING]) {
  calls = [];
  mine = start.map((m) => ({ ...m }));
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
    if (u.pathname === '/api/own-messages' && method === 'GET') return reply(200, mine);
    if (u.pathname === '/api/own-messages' && method === 'POST') {
      if (!body.name?.trim()) return reply(400, { error: 'Give the message a name.' });
      const made = { ...body, id: next++, enabled: true };
      mine = [...mine, made];
      return reply(201, made);
    }
    const one = u.pathname.match(/^\/api\/own-messages\/(\d+)$/);
    if (one && method === 'PUT') {
      mine = mine.map((m) => (m.id === Number(one[1]) ? { ...m, ...body } : m));
      return reply(200, mine.find((m) => m.id === Number(one[1])));
    }
    if (one && method === 'DELETE') {
      mine = mine.filter((m) => m.id !== Number(one[1]));
      return reply(200, { ok: true });
    }
    return reply(200, []);
  };
  uninstall = installDom('http://localhost/workshop/settings?room=front-desk');
  rendered = true;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { name: 'Messages' });
  rtl.fireEvent.click(ui.getByRole('button', { name: /^Automatic messages/ }));
  await ui.findByRole('heading', { name: 'Your own messages' });
  return { ...rtl, ui };
}
const sent = (method) => calls.filter((c) => c.method === method && c.url.includes('/api/own-messages'));

test('Your own messages: each row with when and how it goes, Edit and On; then + Add your own message', async () => {
  const { ui } = await openMessages([SPRING, { ...SPRING, id: 4, name: 'Booking soon', sendWhen: 'before_booked', amount: 1, unit: 'days', byText: true, byEmail: true, enabled: false }]);
  assert.ok(await ui.findByText('Spring check'));
  assert.ok(ui.getByText('6 months after a job is collected · by email'));
  assert.ok(ui.getByText('1 day before a booked job · by text or email'));
  assert.ok(ui.getByText('Only customers who’ve agreed to hear from the shop get messages like this. Job updates always go.'));
  assert.equal(ui.getByRole('button', { name: 'Spring check: On' }).getAttribute('aria-pressed'), 'true');
  assert.equal(ui.getByRole('button', { name: 'Booking soon: Off' }).getAttribute('aria-pressed'), 'false');
  assert.ok(ui.getByRole('button', { name: 'Edit Spring check' }));
  assert.ok(ui.getByRole('button', { name: '+ Add your own message' }));
});

test('adding one: the drawn box, its starting choices, and the new row', async () => {
  const { ui, fireEvent, within } = await openMessages([]);
  fireEvent.click(ui.getByRole('button', { name: '+ Add your own message' }));
  const box = within(await ui.findByRole('dialog', { name: 'Your own message' }));
  assert.ok(box.getByText('Sent automatically'));
  assert.equal(box.getByLabelText('Name').getAttribute('placeholder'), 'e.g. Service reminder');
  assert.equal(box.getByRole('radio', { name: 'After a job is collected' }).checked, true);
  assert.equal(box.getByRole('radio', { name: 'Months' }).checked, true);
  assert.equal(box.getByRole('button', { name: 'Email' }).getAttribute('aria-pressed'), 'true');
  assert.equal(box.getByRole('button', { name: 'Text' }).getAttribute('aria-pressed'), 'false');
  for (const chip of ['Customer’s first name', 'Bike', 'Job number', 'Amount to pay', 'Link to the job', 'Shop name', 'Opening hours']) {
    assert.ok(box.getByRole('button', { name: `+ ${chip}` }), chip);
  }
  assert.ok(box.getByText('Only customers who’ve agreed to hear from the shop get messages like this. Job updates always go.'));
  fireEvent.change(box.getByLabelText('Name'), { target: { value: 'Spring check' } });
  fireEvent.change(box.getByLabelText('How long after'), { target: { value: '6' } });
  fireEvent.change(box.getByLabelText('Wording'), { target: { value: 'Hi ' } });
  fireEvent.click(box.getByRole('button', { name: '+ Customer’s first name' }));
  fireEvent.click(box.getByRole('button', { name: 'Add the message' }));
  assert.ok(await ui.findByText('6 months after a job is collected · by email'));
  assert.ok(ui.queryByRole('dialog') === null, 'the box closes');
  assert.deepEqual(sent('POST')[0].body, { name: 'Spring check', sendWhen: 'after_collected', amount: 6, unit: 'months', byText: false, byEmail: true, wording: 'Hi [Customer’s first name]' });
});

test('before a booked job, the number is how long before', async () => {
  const { ui, fireEvent, within } = await openMessages([]);
  fireEvent.click(ui.getByRole('button', { name: '+ Add your own message' }));
  const box = within(await ui.findByRole('dialog', { name: 'Your own message' }));
  fireEvent.click(box.getByRole('radio', { name: 'Before a booked job' }));
  assert.ok(box.getByLabelText('How long before'));
});

test('a refusal shows in the box, which stays open', async () => {
  const { ui, fireEvent, within } = await openMessages([]);
  fireEvent.click(ui.getByRole('button', { name: '+ Add your own message' }));
  const box = within(await ui.findByRole('dialog', { name: 'Your own message' }));
  fireEvent.click(box.getByRole('button', { name: 'Add the message' }));
  assert.equal((await box.findByRole('alert')).textContent, 'Give the message a name.');
  assert.ok(ui.getByRole('dialog', { name: 'Your own message' }));
});

test('On and Off send the whole message with the switch changed', async () => {
  const { ui, fireEvent } = await openMessages();
  fireEvent.click(await ui.findByRole('button', { name: 'Spring check: On' }));
  assert.ok(await ui.findByRole('button', { name: 'Spring check: Off' }));
  const { body } = sent('PUT')[0];
  assert.equal(body.enabled, false);
  assert.equal(body.name, 'Spring check');
  assert.equal(body.amount, 6);
});

test('Edit opens the same box with what was saved; Save changes it; Remove takes it away', async () => {
  const { ui, fireEvent, within } = await openMessages();
  fireEvent.click(await ui.findByRole('button', { name: 'Edit Spring check' }));
  let box = within(await ui.findByRole('dialog', { name: 'Your own message' }));
  assert.equal(box.getByLabelText('Name').value, 'Spring check');
  assert.equal(box.getByLabelText('How long after').value, '6');
  assert.equal(box.getByLabelText('Wording').value, SPRING.wording);
  fireEvent.change(box.getByLabelText('How long after'), { target: { value: '3' } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  assert.ok(await ui.findByText('3 months after a job is collected · by email'));
  assert.equal(sent('PUT')[0].url.endsWith('/api/own-messages/3'), true);
  fireEvent.click(ui.getByRole('button', { name: 'Edit Spring check' }));
  box = within(await ui.findByRole('dialog', { name: 'Your own message' }));
  fireEvent.click(box.getByRole('button', { name: 'Remove' }));
  const { waitFor } = await import('@testing-library/react');
  await waitFor(() => assert.ok(ui.queryByText('Spring check') === null));
  assert.equal(sent('DELETE').length, 1);
});
