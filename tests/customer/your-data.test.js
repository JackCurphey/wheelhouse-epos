// "Your data" on the customer's account (openspec/changes/your-data-copy,
// design 5; drawn as ac-account, ac-download and ac-download-failed in
// account.mjs; account and reminders decision 4).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';

let current;
let restore = () => {};
afterEach(async () => {
  restore();
  restore = () => {};
  if (!current) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const SERVICES = { shopName: 'North Street Cycles', showPrices: true, full: [], categories: [], uncategorised: [] };
const ME = { id: 5, email: 'maya@example.test', name: 'Maya Patel', phone: '07700 900142', shopName: 'North Street Cycles', shopSlug: 'north', updateChannel: 'sms', serviceReminders: true, reviewRequests: true, marketingPermission: false };
const FILE = 'north-your-data-2026-09-01.zip';
const zipReply = () => new Response(new Uint8Array([0x50, 0x4b, 5, 6]), {
  status: 200, headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${FILE}"` },
});

// The browser's own saving of a file: a link to the file it holds, clicked.
// Caught on the screen's own window, so after it opens.
function catchDownloads() {
  const saved = [];
  saved.revoked = [];
  const { createObjectURL, revokeObjectURL } = URL;
  const click = window.HTMLAnchorElement.prototype.click;
  URL.createObjectURL = () => 'blob:copy-1';
  URL.revokeObjectURL = (url) => { saved.revoked.push(url); };
  window.HTMLAnchorElement.prototype.click = function clicked() { saved.push({ href: this.getAttribute('href'), name: this.getAttribute('download') }); };
  restore = () => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    window.HTMLAnchorElement.prototype.click = click;
  };
  return saved;
}

const open = async (copy) => {
  const posts = [];
  current = await renderBookScreen({
    file: 'screens/book/account.js', exportName: 'AccountScreen', at: 'account', url: '/book/north/account', services: SERVICES,
    account: (url, init) => {
      const { pathname } = new URL(url, 'http://localhost');
      if (pathname.endsWith('/me/data-copy')) { posts.push(init?.method); return copy(); }
      if (pathname.endsWith('/me')) return { status: 200, body: ME };
      if (pathname.endsWith('/bikes')) return { status: 200, body: [] };
      return { status: 200, body: [] };
    },
  });
  return { ...current, posts };
};

test('a Your data card, with Download a copy of your data', async () => {
  const { ui } = await open(zipReply);
  const { within } = await import('@testing-library/react');
  const card = within(await ui.findByRole('region', { name: 'Your data' }));
  assert.ok(card.getByRole('button', { name: 'Download a copy of your data' }));
  // Not built yet, so not shown (proposal: out of scope).
  assert.ok(card.queryByText('Ask us to delete your account') === null);
});

test('pressing it downloads the zip and says so, naming the file, with Download it again', async () => {
  const { ui, posts } = await open(zipReply);
  const saved = catchDownloads();
  (await ui.findByRole('button', { name: 'Download a copy of your data' })).click();
  const bar = await ui.findByRole('status');
  assert.equal(bar.textContent, `Your data is downloading as one file, ${FILE} — details, bikes, jobs, purchases, messages and what you agreed to. Not started? Download it again`);
  assert.deepEqual(posts, ['POST']);
  assert.deepEqual([...saved], [{ href: 'blob:copy-1', name: FILE }]);
  // Again: the same file, not another request.
  const again = ui.getByRole('link', { name: 'Not started? Download it again' });
  assert.equal(again.getAttribute('href'), 'blob:copy-1');
  assert.equal(again.getAttribute('download'), FILE);
});

test('a failed download says so, and Try again tries again', async () => {
  let fail = true;
  const { ui, posts } = await open(() => (fail ? { status: 500, body: { error: 'Something went wrong' } } : zipReply()));
  catchDownloads();
  (await ui.findByRole('button', { name: 'Download a copy of your data' })).click();
  // The drawn warning bar is a status, as the green one is (ac-download-failed).
  const bar = await ui.findByRole('status');
  assert.match(bar.textContent, /^The download didn’t start\./);
  fail = false;
  const { within } = await import('@testing-library/react');
  within(bar).getByRole('button', { name: 'Try again' }).click();
  assert.ok(await ui.findByText(new RegExp(`downloading as one file, ${FILE.replace(/\./g, '\\.')}`)));
  assert.equal(posts.length, 2);
  assert.ok(ui.queryByText(/The download didn’t start/) === null);
});

test('signed out by the time it’s pressed, it goes to sign in', async () => {
  const { ui } = await open(() => ({ status: 401, body: { error: 'Not signed in' } }));
  catchDownloads();
  (await ui.findByRole('button', { name: 'Download a copy of your data' })).click();
  assert.ok(await ui.findByText(`At /book/north/sign-in?from=${encodeURIComponent('/book/north/account')}`));
});

test('leaving the account lets go of the downloaded file', async () => {
  const { ui } = await open(zipReply);
  const saved = catchDownloads();
  (await ui.findByRole('button', { name: 'Download a copy of your data' })).click();
  await ui.findByRole('status');
  assert.deepEqual(saved.revoked, []);
  ui.unmount();
  assert.deepEqual(saved.revoked, ['blob:copy-1']);
});

test('already downloaded today: the server’s own words, with no Try again', async () => {
  const { ui } = await open(() => ({ status: 429, body: { error: 'You’ve already downloaded a copy today. You can get another tomorrow.' } }));
  catchDownloads();
  (await ui.findByRole('button', { name: 'Download a copy of your data' })).click();
  const bar = await ui.findByRole('status');
  assert.equal(bar.textContent, 'You’ve already downloaded a copy today. You can get another tomorrow.');
  assert.ok(ui.queryByRole('button', { name: 'Try again' }) === null, 'trying again today would only be refused');
});

test('a 429 a proxy sent, with no words of its own, still says the download didn’t start', async () => {
  const { ui } = await open(() => new Response('<html>Too Many Requests</html>', { status: 429, headers: { 'content-type': 'text/html' } }));
  catchDownloads();
  (await ui.findByRole('button', { name: 'Download a copy of your data' })).click();
  assert.match((await ui.findByRole('status')).textContent, /^The download didn’t start\./);
  assert.ok(ui.getByRole('button', { name: 'Try again' }));
});

test('Download it again saves the same file, with no new request, so it never uses up the day', async () => {
  const { ui, posts } = await open(zipReply);
  const saved = catchDownloads();
  (await ui.findByRole('button', { name: 'Download a copy of your data' })).click();
  const again = await ui.findByRole('link', { name: 'Not started? Download it again' });
  // A real click event on the link, as a person's would be.
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(again);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(posts.length, 1, 'no second request');
  assert.equal(again.getAttribute('href'), saved[0].href, 'the same file');
});
