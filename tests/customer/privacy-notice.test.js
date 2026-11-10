// The shop's privacy notice on the account (openspec/changes/finish-account
// design 7; Jack, 9 Nov, answer 2; "Privacy notice" on ac-account): Your data
// shows the link only when the shop has added one; it opens the shop's words
// on their own page, line breaks kept.
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
const ME = { id: 5, email: 'maya@example.test', name: 'Maya Patel', phone: '07700 900142', shopName: 'North Street Cycles', shopSlug: 'north', updateChannel: 'sms', serviceReminders: true, reviewRequests: true, marketingPermission: false };
const WORDS = '[Your privacy notice, first paragraph]\n\n[Second paragraph]';
const NOTICE = () => ({ status: 200, body: { shopName: 'North Street Cycles', text: WORDS } });
const account = (url) => (new URL(url, 'http://localhost').pathname.endsWith('/me') ? { status: 200, body: ME } : { status: 200, body: [] });

async function openAccount(privacy) {
  current = await renderBookScreen({ file: 'screens/book/account.js', exportName: 'AccountScreen', at: 'account', url: '/book/north/account', services: SERVICES, account, ...(privacy ? { privacy } : {}) });
  const { within } = await import('@testing-library/react');
  return within(await current.ui.findByRole('region', { name: 'Your data' }));
}

test('Your data shows “Privacy notice” when the shop has one, opening its page', async () => {
  const data = await openAccount(NOTICE);
  const link = await data.findByRole('link', { name: 'Privacy notice' });
  assert.equal(link.getAttribute('href'), '/book/north/privacy');
});

test('with no notice added, there’s no link', async () => {
  const data = await openAccount();
  assert.ok(data.getByRole('button', { name: 'Download a copy of your data' }) !== null);
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(data.queryByRole('link', { name: 'Privacy notice' }) === null);
});

test('the page shows the shop’s words as typed, line breaks kept, with a way back to the account', async () => {
  current = await renderBookScreen({ file: 'screens/book/privacy.js', exportName: 'PrivacyScreen', at: 'privacy', url: '/book/north/privacy', services: SERVICES, privacy: NOTICE });
  const { ui } = current;
  assert.ok((await ui.findByRole('heading', { level: 1, name: 'Privacy notice' })) !== null);
  const words = ui.getByText((_, el) => el?.tagName === 'P' && el.textContent === WORDS);
  assert.ok(words.className.includes('whitespace-pre-wrap'), 'line breaks kept');
  assert.equal(ui.getByRole('link', { name: 'Your account' }).getAttribute('href'), '/book/north/account');
});

test('a shop with no notice says so', async () => {
  current = await renderBookScreen({ file: 'screens/book/privacy.js', exportName: 'PrivacyScreen', at: 'privacy', url: '/book/north/privacy', services: SERVICES });
  assert.ok((await current.ui.findByText('This shop hasn’t added a privacy notice yet.')) !== null);
});
