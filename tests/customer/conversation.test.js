// The customer's conversation with the shop (openspec/changes/ask-the-shop-screens
// design 1; drawn as conversationPage in account.mjs: ac-ask,
// ac-account-question-sent, ac-question; day answers 2 and 8).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';
import { MESSAGES_ROUTE } from '../../src/customer/routes.ts';

let current;
afterEach(async () => {
  if (!current) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const SERVICES = { shopName: 'North Street Cycles', showPrices: true, full: [], categories: [], uncategorised: [] };
const SHOP = 'North Street Cycles';
const NOTE = { id: 1, fromCustomer: true, from: 'You', text: '[Maya’s note to the shop]', at: '2026-09-17T09:00:00.000Z', about: { jobId: 42, reference: 'WH-1042' } };
const REPLY = { id: 2, fromCustomer: false, from: 'Jo Taylor, North Street Cycles', text: '[Jo’s reply]', at: '2026-09-17T10:00:00.000Z', about: { jobId: 42, reference: 'WH-1042' } };
const GENERAL = { id: 3, fromCustomer: true, from: 'You', text: '[Maya’s message]', at: '2026-09-18T09:00:00.000Z', about: null };

// A pretend server: GET answers the thread; POST adds a general message, or answers `refuse`.
const server = ({ items = [NOTE, REPLY], signedIn = true, refuse } = {}) => {
  let thread = items;
  return (url, init) => {
    if (!signedIn) return { status: 401, body: { error: 'Not signed in' } };
    if (init?.method === 'POST') {
      if (refuse) return refuse;
      const { text } = JSON.parse(init.body);
      thread = [...thread, { id: 10 + thread.length, fromCustomer: true, from: 'You', text, at: '2026-09-19T09:00:00.000Z', about: null }];
      return { status: 201, body: { shopName: SHOP, items: thread } };
    }
    return { status: 200, body: { shopName: SHOP, items: thread } };
  };
};
const open = async (opts) => {
  current = await renderBookScreen({ file: 'screens/book/conversation.js', exportName: 'ConversationScreen', at: 'messages', url: '/book/north/messages', services: SERVICES, messages: server(opts) });
  return current;
};

test('the page lives under the shop’s booking pages', () => {
  assert.equal(MESSAGES_ROUTE, '/book/:shopSlug/messages');
});

test('signed out, it goes to sign in, and back here after', async () => {
  const { ui } = await open({ signedIn: false });
  assert.ok(await ui.findByText(`At /book/north/sign-in?from=${encodeURIComponent('/book/north/messages')}`));
});

test('the heading, Your account back, and the thread: hers on the right, the shop’s on the left', async () => {
  const { ui } = await open();
  const { within } = await import('@testing-library/react');
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Messages with North Street Cycles' }));
  assert.equal(ui.getByRole('link', { name: /Your account/ }).getAttribute('href'), '/book/north/account');
  const thread = within(ui.getByRole('list', { name: 'Messages with North Street Cycles' }));
  const [mine, theirs] = thread.getAllByRole('listitem');
  assert.match(mine.textContent, /^You · Thu 17 Sept?, 10:00/);
  assert.equal(mine.dataset.from, 'customer');
  assert.match(mine.className, /items-end/);
  assert.match(theirs.textContent, /^Jo Taylor, North Street Cycles · /);
  assert.match(theirs.className, /items-start/);
});

test('each repair note says “About WH-1042 ›” and opens that repair', async () => {
  const { ui } = await open({ items: [NOTE, REPLY, GENERAL] });
  const abouts = await ui.findAllByRole('link', { name: /About WH-1042/ });
  assert.equal(abouts.length, 2, 'the note and the reply to it; the general message has none');
  assert.equal(abouts[0].getAttribute('href'), '/book/north/booking/job-42');
  assert.match(abouts[0].textContent, /^About WH-1042\s*›$/);
});

test('with nothing yet, the box asks the question', async () => {
  const { ui } = await open({ items: [] });
  assert.ok(await ui.findByRole('textbox', { name: 'Ask the shop a question' }));
  assert.ok(ui.getByText('We’ll let you know when North Street Cycles replies.'));
  assert.ok(ui.queryByRole('list', { name: 'Messages with North Street Cycles' }) === null);
  assert.ok(ui.queryByRole('textbox', { name: 'Your message' }) === null);
});

test('with messages, the box is “Your message”', async () => {
  const { ui } = await open();
  assert.ok(await ui.findByRole('textbox', { name: 'Your message' }));
  assert.ok(ui.queryByRole('textbox', { name: 'Ask the shop a question' }) === null);
});

test('Send adds it to the thread and announces “Sent.”', async () => {
  const { ui, requests } = await open();
  const { fireEvent, within } = await import('@testing-library/react');
  fireEvent.change(await ui.findByRole('textbox', { name: 'Your message' }), { target: { value: '  Is the back light done?  ' } });
  fireEvent.click(ui.getByRole('button', { name: 'Send' }));
  const status = await ui.findByText('Sent. We’ll let you know when North Street Cycles replies.');
  assert.equal(status.getAttribute('role'), 'status');
  const post = requests.find((r) => r.method === 'POST');
  assert.equal(post.url, '/api/portal/north/messages');
  assert.deepEqual(post.body, { text: 'Is the back light done?' });
  const items = within(ui.getByRole('list', { name: 'Messages with North Street Cycles' })).getAllByRole('listitem');
  assert.match(items.at(-1).textContent, /Is the back light done\?/);
  assert.equal(ui.getByRole('textbox', { name: 'Your message' }).value, '');
});

test('an empty box sends nothing', async () => {
  const { ui, requests } = await open();
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(await ui.findByRole('button', { name: 'Send' }));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(requests.filter((r) => r.method === 'POST').length, 0);
});

test('a refusal shows the shop’s own words: too many at once (429)', async () => {
  const { ui } = await open({ refuse: { status: 429, body: { error: 'That’s a lot of messages at once. Try again in a few minutes.' } } });
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.change(await ui.findByRole('textbox', { name: 'Your message' }), { target: { value: 'Hello' } });
  fireEvent.click(ui.getByRole('button', { name: 'Send' }));
  const alert = await ui.findByRole('alert');
  assert.equal(alert.textContent, 'That’s a lot of messages at once. Try again in a few minutes.');
  assert.ok(ui.queryByText(/^Sent\./) === null);
  assert.equal(ui.getByRole('textbox', { name: 'Your message' }).value, 'Hello', 'kept, to send again');
});

test('a refusal shows the shop’s own words: too long (400)', async () => {
  const { ui } = await open({ refuse: { status: 400, body: { error: 'Write a message of up to 1,000 letters.' } } });
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.change(await ui.findByRole('textbox', { name: 'Your message' }), { target: { value: 'Hello' } });
  fireEvent.click(ui.getByRole('button', { name: 'Send' }));
  assert.equal((await ui.findByRole('alert')).textContent, 'Write a message of up to 1,000 letters.');
});

test('signed out while writing: says to sign in again', async () => {
  const { ui } = await open({ refuse: { status: 401, body: { error: 'Not signed in' } } });
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.change(await ui.findByRole('textbox', { name: 'Your message' }), { target: { value: 'Hello' } });
  fireEvent.click(ui.getByRole('button', { name: 'Send' }));
  assert.equal((await ui.findByRole('alert')).textContent, 'Please sign in again to send this. Sign in again');
});

test('a server failure on sending gets the general line, not its words', async () => {
  const { ui } = await open({ refuse: { status: 500, body: { error: 'Internal error' } } });
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.change(await ui.findByRole('textbox', { name: 'Your message' }), { target: { value: 'Hello' } });
  fireEvent.click(ui.getByRole('button', { name: 'Send' }));
  assert.equal((await ui.findByRole('alert')).textContent, 'Wheelhouse couldn’t send that. Try again in a moment.');
});

// The review of ask-the-shop-screens (26 Oct).
// 1. The status line is on the page before anything is sent, so "Sent." is announced.
test('the status line is on the page, empty, before sending, so Sent. is announced', async () => {
  const { ui } = await open();
  await ui.findByRole('heading', { level: 1, name: 'Messages with North Street Cycles' });
  const status = ui.getByRole('status');
  assert.equal(status.textContent, '');
  assert.equal(status.className.includes('empty:hidden'), false, 'not hidden while empty');
});

// 2. Her sign-in running out mid-message: the page stays, with what she typed.
test('signed out after the page loaded: her typing stays, and the alert offers Sign in again', async () => {
  let signedIn = true;
  const base = server();
  current = await renderBookScreen({ file: 'screens/book/conversation.js', exportName: 'ConversationScreen', at: 'messages', url: '/book/north/messages', services: SERVICES,
    messages: (url, init) => (signedIn ? base(url, init) : { status: 401, body: { error: 'Not signed in' } }) });
  const { ui } = current;
  const { fireEvent, act } = await import('@testing-library/react');
  const box = await ui.findByLabelText('Your message');
  fireEvent.change(box, { target: { value: 'Half a message' } });
  signedIn = false;
  await act(async () => { await current.client.refetchQueries(); });
  assert.equal(ui.getByLabelText('Your message').value, 'Half a message', 'still here, with her words');
  fireEvent.click(ui.getByRole('button', { name: 'Send' }));
  const alert = await ui.findByRole('alert');
  // 3. The alert says so, and links to sign in, coming back here.
  const link = (await import('@testing-library/react')).within(alert).getByRole('link', { name: 'Sign in again' });
  assert.equal(link.getAttribute('href'), `/book/north/sign-in?from=${encodeURIComponent('/book/north/messages')}`);
});
