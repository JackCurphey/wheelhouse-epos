// The staff Messages inbox (decision 7; account.mjs inbox(): ac-inbox,
// ac-inbox-sent, ac-inbox-all, ac-inbox-list, ac-inbox-empty, ac-reply-text;
// openspec/changes/messages-inbox), one conversation per customer
// (openspec/changes/ask-the-shop-screens design 3; day answers 8.2).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jo Taylor', email: 'jo@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const WH1042 = { jobId: 1, reference: 'WH-1042', bikeLabel: 'Trek Domane AL 3' };
const MAYA_ROW = { customerId: 5, customerName: 'Maya Patel', lastText: 'Can you check the back light too?', lastAt: '2026-10-05T10:15:00Z', needsReply: true, about: WH1042 };
const OLIVER_ROW = { customerId: 6, customerName: 'Oliver Chen', lastText: 'Ready Thursday.', lastAt: '2026-10-06T09:00:00Z', needsReply: false, about: { jobId: 2, reference: 'WH-1068', bikeLabel: 'Brompton C Line' } };
const MAYA_NOTE = { id: 1, fromCustomer: true, from: null, text: 'Can you check the back light too?', at: '2026-10-05T10:15:00Z', about: WH1042 };
const MAYA_GENERAL = { id: 4, fromCustomer: true, from: null, text: 'Do you sell lights?', at: '2026-10-05T11:15:00Z', about: null };

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let rows;
let items;
let replyAnswer;
afterEach(async () => {
  if (!shell) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
  shell = undefined;
});

async function openInbox({ url = 'http://localhost/workshop/messages', list = [MAYA_ROW, OLIVER_ROW], thread = [MAYA_NOTE], answer, threadStatus = 200 } = {}) {
  calls = [];
  rows = list;
  items = thread;
  replyAnswer = answer;
  globalThis.fetch = async (u, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: u, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const p = new URL(u, 'http://localhost');
    if (p.pathname === '/api/auth/me') return reply(200, OWNER);
    if (p.pathname === '/api/customer-conversations') {
      const needing = rows.filter((r) => r.needsReply);
      return reply(200, { items: p.searchParams.get('filter') === 'needs-reply' ? needing : rows, count: needing.length });
    }
    if (p.pathname === '/api/customer-conversations/5/messages' && method === 'POST') {
      if (replyAnswer) return reply(replyAnswer.status, replyAnswer.body);
      const about = body.jobId ? WH1042 : null;
      items = [...items, { id: 9, fromCustomer: false, from: 'Jo Taylor', text: body.text.trim(), at: '2026-10-05T12:00:00Z', about }];
      rows = rows.map((r) => (r.customerId === 5 ? { ...r, needsReply: false, lastText: body.text.trim(), about } : r));
      return reply(201, { items, message: { status: 'sent', channel: 'sms', to: '07700 900142', pretend: true } });
    }
    if (p.pathname === '/api/customer-conversations/5') return threadStatus === 200 ? reply(200, { customerId: 5, customerName: 'Maya Patel', phone: '07700 900142', items }) : reply(threadStatus, { error: threadStatus === 404 ? 'Customer not found' : 'Internal error' });
    if (p.pathname === '/api/customer-conversations/6') return reply(200, { customerId: 6, customerName: 'Oliver Chen', phone: null, items: [] });
    if (p.pathname === '/api/messages' && p.searchParams.get('jobId') === '1') return reply(200, [{ id: 3, key: 'shop_reply', name: 'Reply from the shop', body: 'North Street Cycles replied about your Trek Domane AL 3 (WH-1042): Yes, we’ll check it. Replies to this number aren’t read — reply on your page: [link]', direction: 'outbound', state: 'delivered' }]);
    if (p.pathname === '/api/messages' && p.searchParams.get('customerId') === '5') return reply(200, [{ id: 7, key: 'message_reply', name: 'Reply to a message', body: 'North Street Cycles replied to your message: [link]', direction: 'outbound', state: 'delivered' }, { id: 3, key: 'shop_reply', name: 'Reply from the shop', body: 'older', direction: 'outbound', state: 'delivered' }]);
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

test('Messages lists who needs a reply first, one row per customer, with the count, and asks you to choose one', async () => {
  const { ui, within } = await openInbox();
  assert.ok(has(ui.queryByText('Messages from customers — from a job’s page, or their account. Replies go the way each customer chose, with a link back.')));
  const show = within(ui.getByRole('group', { name: 'Show' }));
  assert.ok(has(await show.findByRole('button', { name: 'Needs a reply · 1', pressed: true })));
  assert.ok(has(show.getByRole('button', { name: 'All', pressed: false })));
  const list = within(ui.getByRole('navigation', { name: 'Conversations' }));
  const links = await list.findAllByRole('link');
  assert.equal(links.length, 1, 'only those needing a reply');
  assert.equal(links[0].getAttribute('aria-label'), 'Needs a reply: Maya Patel');
  assert.equal(links[0].getAttribute('href'), '/workshop/messages?customer=5');
  assert.ok(links[0].textContent.includes('Trek Domane AL 3 · WH-1042'));
  assert.ok(links[0].textContent.includes('Can you check the back light too?'));
  assert.ok(has(ui.queryByText('Choose a conversation to read it.')));
  assert.ok(calls.some((c) => c.url === '/api/customer-conversations?filter=needs-reply'));
});

test('a row whose newest message came from their account says so', async () => {
  const { ui, within } = await openInbox({ list: [{ ...MAYA_ROW, lastText: 'Do you sell lights?', about: null }] });
  const list = within(ui.getByRole('navigation', { name: 'Conversations' }));
  const row = await list.findByRole('link', { name: 'Needs a reply: Maya Patel' });
  assert.ok(row.textContent.includes('From their account'));
  assert.ok(!row.textContent.includes('WH-1042'));
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

test('opening a conversation shows the customer, their phone, the thread with each repair note marked, and Reply', async () => {
  const { ui, within, fireEvent } = await openInbox({ thread: [MAYA_NOTE, MAYA_GENERAL] });
  fireEvent.click(await ui.findByRole('link', { name: 'Needs a reply: Maya Patel' }));
  const conv = within(await ui.findByRole('region', { name: 'Maya Patel' }));
  assert.equal((await conv.findByRole('link', { name: '07700 900142' })).getAttribute('href'), 'tel:07700900142');
  assert.equal(conv.getByRole('link', { name: 'Customer page' }).getAttribute('href'), '/workshop/customers/5');
  const thread = within(conv.getByRole('list', { name: 'Conversation with Maya Patel' }));
  const [note, general] = thread.getAllByRole('listitem');
  assert.ok(note.textContent.startsWith('Maya Patel · '));
  const about = within(note).getByRole('link', { name: /About WH-1042/ });
  assert.equal(about.getAttribute('href'), '/workshop/diary?job=1');
  assert.ok(within(general).queryByRole('link') === null, 'a general message is about no repair');
  assert.ok(has(conv.getByRole('textbox', { name: 'Reply' })));
  assert.ok(has(conv.getByRole('button', { name: 'Send reply' })));
  assert.equal(new URL(window.location.href).searchParams.get('customer'), '5');
  assert.ok(calls.some((c) => c.url === '/api/customer-conversations/5'));
});

test('sending a reply about her repair: posts its job, joins the thread, says how it went, offers Reply again and the text', async () => {
  const { ui, within, fireEvent, waitFor } = await openInbox({ url: 'http://localhost/workshop/messages?customer=5' });
  const conv = within(await ui.findByRole('region', { name: 'Maya Patel' }));
  assert.ok(has(await conv.findByText('About WH-1042: goes to Maya the way they chose, with a link to reply on the job’s page.')));
  fireEvent.change(conv.getByRole('textbox', { name: 'Reply' }), { target: { value: ' Yes, we’ll check it. ' } });
  fireEvent.click(conv.getByRole('button', { name: 'Send reply' }));
  assert.ok(has(await conv.findByText('Sent to Maya by text, with a link to reply on the job’s page.')));
  await waitFor(() => assert.ok(calls.some((c) => c.method === 'POST' && c.url === '/api/customer-conversations/5/messages')));
  assert.deepEqual(calls.find((c) => c.method === 'POST').body, { text: 'Yes, we’ll check it.', jobId: 1 });
  const thread = within(conv.getByRole('list', { name: 'Conversation with Maya Patel' }));
  assert.ok(thread.getAllByRole('listitem')[1].textContent.startsWith('You (Jo Taylor) · '));
  assert.ok(has(conv.getByRole('textbox', { name: 'Reply again' })));
  fireEvent.click(conv.getByRole('button', { name: 'See the text Maya gets' }));
  const text = within(await ui.findByRole('dialog', { name: 'What Maya gets' }));
  assert.ok(has(await text.findByText(/^North Street Cycles replied about your Trek Domane AL 3 \(WH-1042\): Yes, we’ll check it\./)));
});

test('her newest message came from her account: the reply is general, and the text is Reply to a message', async () => {
  const { ui, within, fireEvent } = await openInbox({ url: 'http://localhost/workshop/messages?customer=5', thread: [MAYA_NOTE, MAYA_GENERAL] });
  const conv = within(await ui.findByRole('region', { name: 'Maya Patel' }));
  assert.ok(has(await conv.findByText('Goes to Maya the way they chose, with a link to their messages.')));
  fireEvent.change(conv.getByRole('textbox', { name: 'Reply' }), { target: { value: 'Yes, in the shop.' } });
  fireEvent.click(conv.getByRole('button', { name: 'Send reply' }));
  assert.ok(has(await conv.findByText('Sent to Maya by text, with a link to their messages.')));
  assert.deepEqual(calls.find((c) => c.method === 'POST').body, { text: 'Yes, in the shop.' });
  fireEvent.click(conv.getByRole('button', { name: 'See the text Maya gets' }));
  const text = within(await ui.findByRole('dialog', { name: 'What Maya gets' }));
  assert.ok(has(await text.findByText('North Street Cycles replied to your message: [link]')));
});

test('a reply that couldn’t be texted says why', async () => {
  const { ui, within, fireEvent } = await openInbox({
    url: 'http://localhost/workshop/messages?customer=5',
    answer: { status: 201, body: { items: [MAYA_NOTE], message: { status: 'not_sent', reason: 'Maya Patel has no phone number or email on file.' } } },
  });
  const conv = within(await ui.findByRole('region', { name: 'Maya Patel' }));
  fireEvent.change(await conv.findByRole('textbox', { name: 'Reply' }), { target: { value: 'Hello' } });
  fireEvent.click(conv.getByRole('button', { name: 'Send reply' }));
  assert.ok(has(await conv.findByText('Saved on the job, but no text went: Maya Patel has no phone number or email on file.')));
});

test('a general reply that couldn’t be sent says it was saved in the conversation', async () => {
  const { ui, within, fireEvent } = await openInbox({
    url: 'http://localhost/workshop/messages?customer=5', thread: [MAYA_GENERAL],
    answer: { status: 201, body: { items: [MAYA_GENERAL], message: { status: 'not_sent', reason: 'Reply to a message is switched off.' } } },
  });
  const conv = within(await ui.findByRole('region', { name: 'Maya Patel' }));
  fireEvent.change(await conv.findByRole('textbox', { name: 'Reply' }), { target: { value: 'Hello' } });
  fireEvent.click(conv.getByRole('button', { name: 'Send reply' }));
  assert.ok(has(await conv.findByText('Saved in the conversation, but no text went: Reply to a message is switched off.')));
});

test('an empty reply sends nothing', async () => {
  const { ui, within, fireEvent } = await openInbox({ url: 'http://localhost/workshop/messages?customer=5' });
  const conv = within(await ui.findByRole('region', { name: 'Maya Patel' }));
  fireEvent.click(await conv.findByRole('button', { name: 'Send reply' }));
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0);
});

// From the fresh review.
test('All puts those needing a reply first, and an answered row says who wrote last', async () => {
  const { ui, within, fireEvent } = await openInbox();
  fireEvent.click(await ui.findByRole('button', { name: 'All' }));
  const list = within(ui.getByRole('navigation', { name: 'Conversations' }));
  await list.findByRole('link', { name: 'Oliver Chen' });
  const links = list.getAllByRole('link');
  assert.equal(links[0].getAttribute('aria-label'), 'Needs a reply: Maya Patel', 'waiting first, though Oliver’s is newer');
  assert.ok(links[1].textContent.includes('You: Ready Thursday.'));
});

test('a conversation that won’t load says so, with Try again, and offers no reply box', async () => {
  const { ui, within } = await openInbox({ url: 'http://localhost/workshop/messages?customer=5', threadStatus: 500 });
  const conv = within(await ui.findByRole('region', { name: 'Conversation' }));
  assert.ok(Boolean(await conv.findByText('Wheelhouse couldn’t load this conversation.')));
  assert.ok(Boolean(conv.getByRole('button', { name: 'Try again' })));
  assert.ok(conv.queryByRole('textbox') === null);
});

test('a customer who no longer exists says so, and offers no reply box', async () => {
  const { ui, within } = await openInbox({ url: 'http://localhost/workshop/messages?customer=5', threadStatus: 404 });
  const conv = within(await ui.findByRole('region', { name: 'Conversation' }));
  assert.ok(Boolean(await conv.findByText('Wheelhouse couldn’t load this conversation.')));
  assert.ok(conv.queryByRole('textbox') === null);
});

test('a reply half typed is still there after looking at another conversation', async () => {
  const { ui, within, fireEvent } = await openInbox({ url: 'http://localhost/workshop/messages?customer=5' });
  const conv = within(await ui.findByRole('region', { name: 'Maya Patel' }));
  fireEvent.change(await conv.findByRole('textbox', { name: 'Reply' }), { target: { value: 'Half a reply' } });
  fireEvent.click(ui.getByRole('button', { name: 'All' }));
  fireEvent.click(await ui.findByRole('link', { name: 'Oliver Chen' }));
  await ui.findByRole('region', { name: 'Oliver Chen' });
  fireEvent.click(await ui.findByRole('link', { name: 'Needs a reply: Maya Patel' }));
  const again = within(await ui.findByRole('region', { name: 'Maya Patel' }));
  assert.equal((await again.findByRole('textbox', { name: 'Reply' })).value, 'Half a reply');
});

test('the count waits for the list rather than saying 0', async () => {
  const { ui } = await openInbox();
  assert.ok(ui.queryByRole('button', { name: 'Needs a reply · 0' }) === null);
});
