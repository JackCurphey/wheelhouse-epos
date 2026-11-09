// Store credit on the customer's website account (openspec/changes/finish-customers, design 8;
// drawn as ac-account and ac-delete in account.mjs; account and reminders decision 1 and audit
// M12): the Store credit card while the shop has it on, and the delete pop-up's warning that it
// will be lost. Placeholders as the drawings have them.
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

const open = async (me) => {
  current = await renderBookScreen({
    file: 'screens/book/account.js', exportName: 'AccountScreen', at: 'account', url: '/book/north/account', services: SERVICES,
    account: (url) => {
      const { pathname } = new URL(url, 'http://localhost');
      if (pathname.endsWith('/me')) return { status: 200, body: me };
      return { status: 200, body: [] };
    },
  });
  const rtl = await import('@testing-library/react');
  return { ...current, within: rtl.within };
};

test('the Store credit card while the shop has store credit on', async () => {
  const { ui, within } = await open({ ...ME, storeCredit: 1500 });
  const card = within(await ui.findByRole('region', { name: 'Store credit' }));
  assert.ok(card.getByText('£15.00'));
  assert.ok(card.getByText('Use it in the shop or online'));
});

test('no Store credit card while it is off', async () => {
  const { ui } = await open({ ...ME, storeCredit: null });
  await ui.findByRole('region', { name: 'Your data' });
  assert.ok(ui.queryByRole('region', { name: 'Store credit' }) === null);
});

test('asking to delete warns that her store credit will be lost', async () => {
  const { ui, within } = await open({ ...ME, storeCredit: 1500 });
  (await ui.findByRole('button', { name: 'Ask us to delete your account' })).click();
  const box = within(await ui.findByRole('dialog', { name: 'Ask us to delete your account' }));
  assert.equal(box.getByRole('note').textContent, 'You have £15.00 of store credit. It will be lost when your account is deleted — use it first, or ask for it back.');
});

test('no warning with no store credit', async () => {
  const { ui, within } = await open({ ...ME, storeCredit: 0 });
  (await ui.findByRole('button', { name: 'Ask us to delete your account' })).click();
  const box = within(await ui.findByRole('dialog', { name: 'Ask us to delete your account' }));
  assert.ok(box.queryByRole('note') === null);
});
