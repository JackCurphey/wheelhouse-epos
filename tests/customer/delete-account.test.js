// "Ask us to delete your account" on the customer's account
// (openspec/changes/delete-account, design 6; drawn as ac-account, ac-delete,
// ac-delete-blocked, ac-delete-sent, ac-account-delete-pending and
// ac-account-delete-cancelled in account.mjs; account and reminders decision
// 4 and audit H3; coverage walks answer 4; Jack's 30 Oct answer 3).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';

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
const ME = { id: 5, email: 'maya@example.test', name: 'Maya Patel', phone: '07700 900142', shopName: 'North Street Cycles', shopSlug: 'north', shopPhone: '[shop phone]', updateChannel: 'sms', serviceReminders: true, reviewRequests: true, marketingPermission: false, deletion: null };
const IN_SHOP = { kind: 'repair', jobId: 42, reference: 'WH-1042', title: 'Standard service', bikeLabel: 'Trek Domane AL 3', bikeId: 7, stage: 'in_workshop', workStarted: false, jobDate: '2026-09-17', totalPence: null, at: '2026-09-17T09:00:00.000Z' };
const ASKED = { askedOn: '2026-10-30', finishBy: '2026-11-30' };

const open = async ({ me = ME, history = [], ask = () => ({ status: 200, body: { deletion: ASKED } }), cancel = () => ({ status: 200, body: { deletion: null } }) } = {}) => {
  const posts = [];
  let mine = me;
  current = await renderBookScreen({
    file: 'screens/book/account.js', exportName: 'AccountScreen', at: 'account', url: '/book/north/account', services: SERVICES,
    account: (url, init) => {
      const { pathname } = new URL(url, 'http://localhost');
      if (pathname.endsWith('/me/delete-request')) { posts.push('ask'); const r = ask(); if (r.status === 200) mine = { ...mine, deletion: r.body.deletion }; return r; }
      if (pathname.endsWith('/me/delete-request/cancel')) { posts.push('cancel'); const r = cancel(); if (r.status === 200) mine = { ...mine, deletion: null }; return r; }
      if (pathname.endsWith('/me')) return { status: 200, body: mine };
      if (pathname.endsWith('/bikes')) return { status: 200, body: [] };
      return { status: 200, body: history };
    },
  });
  const rtl = await import('@testing-library/react');
  return { ...current, posts, within: rtl.within, fireEvent: rtl.fireEvent };
};

test('Your data offers Ask us to delete your account, after the copy', async () => {
  const { ui, within } = await open();
  const card = within(await ui.findByRole('region', { name: 'Your data' }));
  const buttons = card.getAllByRole('button').map((b) => b.textContent);
  assert.deepEqual(buttons, ['Download a copy of your data', 'Ask us to delete your account']);
});

test('the pop-up says what goes and what stays, and Keep my account closes it', async () => {
  const { ui, posts, within } = await open();
  (await ui.findByRole('button', { name: 'Ask us to delete your account' })).click();
  const box = within(await ui.findByRole('dialog', { name: 'Ask us to delete your account' }));
  assert.ok(box.getByText('North Street Cycles will delete your account within one month, and tell you when it’s done.'));
  assert.ok(box.getByText('Your details, bikes and messages are deleted. Sales stay in the shop’s books without your name, because the shop must keep them for tax.'));
  assert.ok(box.getByRole('button', { name: 'Download a copy of your data' }));
  assert.ok(box.getByText('This can’t be undone.'));
  box.getByRole('button', { name: 'Keep my account' }).click();
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(ui.queryByRole('dialog') === null);
  assert.deepEqual(posts, []);
});

test('Ask to delete: Request sent, then the request on the account with Cancel my request', async () => {
  const { ui, posts, within } = await open();
  (await ui.findByRole('button', { name: 'Ask us to delete your account' })).click();
  within(await ui.findByRole('dialog')).getByRole('button', { name: 'Ask to delete' }).click();
  const sent = within(await ui.findByRole('dialog', { name: 'Request sent' }));
  assert.equal(sent.getByRole('status').textContent, 'North Street Cycles will delete your account and tell you when it’s done — by Mon 30 Nov 2026 at the latest.');
  assert.ok(sent.getByText('Changed your mind? “Cancel my request” is on your account until the shop has done it.'));
  sent.getByRole('button', { name: 'OK' }).click();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(posts, ['ask']);
  const line = 'You asked us to delete your account on Fri 30 Oct 2026. We’ll finish by Mon 30 Nov 2026.';
  // On the card, and in the bar at the top (ac-account-delete-pending).
  const card = within(ui.getByRole('region', { name: 'Your data' }));
  assert.ok(card.getByText(line));
  assert.ok(card.getByRole('button', { name: 'Cancel my request' }));
  assert.ok(card.queryByRole('button', { name: 'Ask us to delete your account' }) === null);
  assert.equal(ui.getAllByText(line).length, 2);
  assert.equal(ui.getAllByRole('button', { name: 'Cancel my request' }).length, 2);
});

test('a bike still with the shop: the deletion waits for it, and she can still ask', async () => {
  const { ui, posts, within } = await open({ history: [IN_SHOP] });
  (await ui.findByRole('button', { name: 'Ask us to delete your account' })).click();
  const box = within(await ui.findByRole('dialog', { name: 'Ask us to delete your account' }));
  assert.ok(box.getByText('We’ll delete your account once your bike has been collected.'));
  assert.equal(box.getByText('Bike with us').parentElement.textContent, 'Bike with usTrek Domane AL 3 · WH-1042');
  assert.ok(box.getByText('Call [shop phone] if you need to talk it through.'));
  box.getByRole('button', { name: 'Ask to delete' }).click();
  assert.ok(await ui.findByRole('dialog', { name: 'Request sent' }));
  assert.deepEqual(posts, ['ask']);
});

test('Cancel my request: cancelled, said so, and Ask us to delete your account is back', async () => {
  const { ui, posts } = await open({ me: { ...ME, deletion: ASKED } });
  (await ui.findAllByRole('button', { name: 'Cancel my request' }))[0].click();
  const said = await ui.findByText('Request cancelled — your account stays as it is.');
  assert.equal(said.closest('[role="status"]')?.textContent, 'Request cancelled — your account stays as it is.');
  assert.deepEqual(posts, ['cancel']);
  assert.ok(await ui.findByRole('button', { name: 'Ask us to delete your account' }));
  assert.ok(ui.queryByText(/You asked us to delete your account/) === null);
});

test('a request that doesn’t go through says so in the pop-up, and nothing changes', async () => {
  const { ui, within } = await open({ ask: () => ({ status: 500, body: { error: 'Something went wrong' } }) });
  (await ui.findByRole('button', { name: 'Ask us to delete your account' })).click();
  const box = within(await ui.findByRole('dialog'));
  box.getByRole('button', { name: 'Ask to delete' }).click();
  assert.equal((await box.findByRole('alert')).textContent, 'That didn’t go through. Check your connection and try again.');
  assert.ok(ui.queryByText(/You asked us to delete your account/) === null);
});
