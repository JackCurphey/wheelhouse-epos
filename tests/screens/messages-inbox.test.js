// The staff Messages inbox (decision 7; account.mjs inbox(): ac-inbox,
// ac-inbox-sent, ac-inbox-all, ac-inbox-list, ac-inbox-empty, ac-reply-text;
// openspec/changes/messages-inbox).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';
import { fakeJob } from '../helpers/fake-job.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jo Taylor', email: 'jo@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MAYA_ROW = { jobId: 1, customerName: 'Maya Patel', bikeLabel: 'Trek Domane AL 3', reference: 'WH-1042', lastText: 'Can you check the back light too?', lastAt: '2026-10-05T10:15:00Z', needsReply: true };
const OLIVER_ROW = { jobId: 2, customerName: 'Oliver Chen', bikeLabel: 'Brompton C Line', reference: 'WH-1068', lastText: 'Ready Thursday.', lastAt: '2026-10-04T09:00:00Z', needsReply: false };
const MAYA_NOTE = { id: 1, fromCustomer: true, from: null, text: 'Can you check the back light too?', at: '2026-10-05T10:15:00Z' };
const JOB = fakeJob({ id: 1, title: 'Standard service', reference: 'WH-1042', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane AL 3', jobDate: '2026-10-05' });

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let rows;
let notes;
let replyAnswer;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function openInbox({ url = 'http://localhost/workshop/messages', list = [MAYA_ROW, OLIVER_ROW], thread = [MAYA_NOTE], answer } = {}) {
  calls = [];
  rows = list;
  notes = thread;
  replyAnswer = answer;
  globalThis.fetch = async (u, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: u, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const p = new URL(u, 'http://localhost');
    if (p.pathname === '/api/auth/me') return reply(200, OWNER);
    if (p.pathname === '/api/job-notes/conversations') {
      const needing = rows.filter((r) => r.needsReply);
      return reply(200, { items: p.searchParams.get('filter') === 'needs-reply' ? needing : rows, count: needing.length });
    }
    if (p.pathname === '/api/workshop-jobs/1/notes' && method === 'POST') {
      if (replyAnswer) return reply(replyAnswer.status, replyAnswer.body);
      notes = [...notes, { id: 9, fromCustomer: false, from: 'Jo Taylor', text: body.text.trim(), at: '2026-10-05T11:00:00Z' }];
      rows = rows.map((r) => (r.jobId === 1 ? { ...r, needsReply: false, lastText: body.text.trim() } : r));
      return reply(201, { notes, message: { status: 'sent', channel: 'sms', to: '07700 900142', pretend: true } });
    }
    if (p.pathname === '/api/workshop-jobs/1/notes') return reply(200, notes);
    if (p.pathname === '/api/workshop-jobs/1') return reply(200, JOB);
    if (p.pathname === '/api/customers/5') return reply(200, { id: 5, name: 'Maya Patel', phone: '07700 900142', email: null });
    if (p.pathname === '/api/messages') return reply(200, [{ id: 3, key: 'shop_reply', name: 'Reply from the shop', body: 'North Street Cycles replied about your Trek Domane AL 3 (WH-1042): Yes, we’ll check it. Replies to this number aren’t read — reply on your page: [link]', direction: 'outbound', state: 'delivered' }]);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(url);
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { name: 'Messages' });
  return { ...rtl, ui };
}
const has = (q) => Boolean(q);

test('Messages lists who needs a reply first, with the count, and asks you to choose one', async () => {
  const { ui, within } = await openInbox();
  assert.ok(has(ui.queryByText('Messages from customers — from a job’s page, or their account. Replies go the way each customer chose, with a link back.')));
  const show = within(ui.getByRole('group', { name: 'Show' }));
  assert.ok(has(await show.findByRole('button', { name: 'Needs a reply · 1', pressed: true })));
  assert.ok(has(show.getByRole('button', { name: 'All', pressed: false })));
  const list = within(ui.getByRole('navigation', { name: 'Conversations' }));
  const links = list.getAllByRole('link');
  assert.equal(links.length, 1, 'only those needing a reply');
  assert.equal(links[0].getAttribute('aria-label'), 'Needs a reply: Maya Patel');
  assert.ok(links[0].textContent.includes('Trek Domane AL 3 · WH-1042'));
  assert.ok(links[0].textContent.includes('Can you check the back light too?'));
  assert.ok(has(ui.queryByText('Choose a conversation to read it.')));
});

test('All shows every conversation', async () => {
  const { ui, within, fireEvent } = await openInbox();
  fireEvent.click(await ui.findByRole('button', { name: 'All' }));
  const list = within(ui.getByRole('navigation', { name: 'Conversations' }));
  await list.findByRole('link', { name: 'Oliver Chen' });
  assert.equal(list.getAllByRole('link').length, 2);
});

test('nothing needing a reply says so', async () => {
  const { ui } = await openInbox({ list: [OLIVER_ROW] });
  assert.ok(has(await ui.findByText('Nothing needs a reply. Every conversation is under All.')));
});

test('opening a conversation shows the customer, the job, the thread and Reply', async () => {
  const { ui, within, fireEvent } = await openInbox();
  fireEvent.click(await ui.findByRole('link', { name: 'Needs a reply: Maya Patel' }));
  const conv = within(await ui.findByRole('region', { name: 'Maya Patel' }));
  assert.ok(has(await conv.findByText(/Trek Domane AL 3 · WH-1042/)));
  assert.equal((await conv.findByRole('link', { name: '07700 900142' })).getAttribute('href'), 'tel:07700900142');
  assert.equal(conv.getByRole('link', { name: 'Open the job' }).getAttribute('href'), '/workshop/diary?job=1');
  assert.ok(has(conv.queryByText('On the job’s page · started by Maya')));
  const thread = within(conv.getByRole('list', { name: 'Conversation with Maya Patel' }));
  assert.ok(thread.getAllByRole('listitem')[0].textContent.startsWith('Maya Patel · '));
  assert.ok(has(conv.getByRole('textbox', { name: 'Reply' })));
  assert.ok(has(conv.getByRole('button', { name: 'Send reply' })));
  assert.equal(new URL(window.location.href).searchParams.get('job'), '1');
});

test('sending a reply adds it to the thread, says how it went, and offers Reply again and the text', async () => {
  const { ui, within, fireEvent, waitFor } = await openInbox({ url: 'http://localhost/workshop/messages?job=1' });
  const conv = within(await ui.findByRole('region', { name: 'Maya Patel' }));
  fireEvent.change(await conv.findByRole('textbox', { name: 'Reply' }), { target: { value: ' Yes, we’ll check it. ' } });
  fireEvent.click(conv.getByRole('button', { name: 'Send reply' }));
  assert.ok(has(await conv.findByText('Sent to Maya by text, with a link to reply on the job’s page.')));
  await waitFor(() => assert.ok(calls.some((c) => c.method === 'POST' && c.body.text === 'Yes, we’ll check it.')));
  const thread = within(conv.getByRole('list', { name: 'Conversation with Maya Patel' }));
  assert.ok(thread.getAllByRole('listitem')[1].textContent.startsWith('You (Jo Taylor) · '));
  assert.ok(has(conv.getByRole('textbox', { name: 'Reply again' })));
  fireEvent.click(conv.getByRole('button', { name: 'See the text Maya gets' }));
  const text = within(await ui.findByRole('dialog', { name: 'What Maya gets' }));
  assert.ok(has(await text.findByText(/^North Street Cycles replied about your Trek Domane AL 3 \(WH-1042\): Yes, we’ll check it\./)));
});

test('a reply that couldn’t be texted says why', async () => {
  const { ui, within, fireEvent } = await openInbox({
    url: 'http://localhost/workshop/messages?job=1',
    answer: { status: 201, body: { notes: [MAYA_NOTE], message: { status: 'not_sent', reason: 'Maya Patel has no phone number or email on file.' } } },
  });
  const conv = within(await ui.findByRole('region', { name: 'Maya Patel' }));
  fireEvent.change(await conv.findByRole('textbox', { name: 'Reply' }), { target: { value: 'Hello' } });
  fireEvent.click(conv.getByRole('button', { name: 'Send reply' }));
  assert.ok(has(await conv.findByText('Saved on the job, but no text went: Maya Patel has no phone number or email on file.')));
});

test('an empty reply sends nothing', async () => {
  const { ui, within, fireEvent } = await openInbox({ url: 'http://localhost/workshop/messages?job=1' });
  const conv = within(await ui.findByRole('region', { name: 'Maya Patel' }));
  fireEvent.click(await conv.findByRole('button', { name: 'Send reply' }));
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0);
});
