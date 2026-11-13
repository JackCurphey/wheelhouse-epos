// The staff banner on a switched-off website (openspec/changes/website-browse,
// design 5; task 8.5; screens wb-off-preview, wb-off-preview-product,
// wb-off-preview-ask and wb-turned-on in browse.mjs). The site answer says
// `preview` when this shop's staff look at a switched-off website, with
// `canTurnOn` for the Owner and `ownerNames` for everyone else.
// Example data from the drawings: North Street Cycles, Jack Lewis.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderWebsite, TWO_SHOPS, BASE } from '../helpers/site-screen.js';

const realFetch = globalThis.fetch;
let r;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  r?.client.clear();
  r?.uninstall();
  r = undefined;
  globalThis.fetch = realFetch;
});

const OWNER = { ...TWO_SHOPS, preview: true, canTurnOn: true };
const STAFF = { ...TWO_SHOPS, preview: true, canTurnOn: false, ownerNames: ['Jack Lewis'] };
const OFF_WORDS = 'Only your staff can see this. Your website is switched off — customers see “This website isn’t available”.';
const banner = (ui) => ui.getByText('Only your staff can see this.').closest('div');

test('wb-off-preview: the Owner sees the banner first on the page, with Turn it on, Edit this page and Back to Wheelhouse', async () => {
  r = await renderWebsite({ site: OWNER });
  const { ui } = r;
  await ui.findByText('Only your staff can see this.');
  const bar = banner(ui);
  assert.equal(bar.textContent.replace(/(Turn it on|Edit this page|Back to Wheelhouse)/g, ''), `${OFF_WORDS} Turning it on the first time also publishes it.`);
  // First in the main content, before the chip line and the page.
  const main = document.getElementById('main-content');
  assert.ok(main.firstElementChild === bar);
  assert.ok(bar.querySelector('button')?.textContent === 'Turn it on');
  assert.equal(ui.getByRole('link', { name: 'Edit this page' }).getAttribute('href'), '/workshop/website');
  assert.equal(ui.getByRole('link', { name: 'Back to Wheelhouse' }).getAttribute('href'), '/workshop');
});

test('wb-off-preview-product: the banner is on every page, not only the home page', async () => {
  r = await renderWebsite({ url: '/shop', site: OWNER });
  await r.ui.findByText('Only your staff can see this.');
  r.ui.getByRole('button', { name: 'Turn it on' });
});

test('wb-off-preview-ask: staff who can’t turn it on are told who to ask, with only Back to Wheelhouse', async () => {
  r = await renderWebsite({ site: STAFF });
  const { ui } = r;
  await ui.findByText('Only your staff can see this.');
  const bar = banner(ui);
  assert.equal(bar.textContent.replace('Back to Wheelhouse', ''), `${OFF_WORDS} Ask Jack Lewis to turn it on.`);
  assert.ok(bar.querySelector('button') === null);
  assert.ok(ui.queryByRole('link', { name: 'Edit this page' }) === null);
  ui.getByRole('link', { name: 'Back to Wheelhouse' });
});

test('wb-off-preview-ask with two owners names both', async () => {
  r = await renderWebsite({ site: { ...STAFF, ownerNames: ['Jack Lewis', '[Second owner]'] } });
  await r.ui.findByText(/Ask Jack Lewis or \[Second owner\] to turn it on\./);
});

test('wb-turned-on: Turn it on posts to this shop’s switch, then says “Your website is on.” with Turn off', async () => {
  let on = false;
  r = await renderWebsite({
    site: () => ({ status: 200, body: on ? TWO_SHOPS : OWNER }),
    answer: (pathname, { method }) => {
      if (method !== 'POST') return undefined;
      if (pathname === `${BASE}/api/site/turn-on`) { on = true; return { status: 200, body: { on: true } }; }
      if (pathname === `${BASE}/api/site/turn-off`) { on = false; return { status: 200, body: { on: false } }; }
      return undefined;
    },
  });
  const { ui, requests } = r;
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(await ui.findByRole('button', { name: 'Turn it on' }));
  const status = await ui.findByText('Your website is on.');
  const bar = status.closest('div');
  assert.equal(bar.getAttribute('role'), 'status');
  assert.match(bar.textContent, /Your website is on\. Customers can see it now\./);
  assert.ok(requests.some((q) => q.method === 'POST' && q.url === `${BASE}/api/site/turn-on`));
  ui.getByRole('link', { name: 'Edit this page' });
  ui.getByRole('link', { name: 'Back to Wheelhouse' });
  // Turn off goes back to the switched-off banner.
  fireEvent.click(ui.getByRole('button', { name: 'Turn off' }));
  await ui.findByText('Only your staff can see this.');
  assert.ok(requests.some((q) => q.method === 'POST' && q.url === `${BASE}/api/site/turn-off`));
});

test('a refused Turn it on says why, and the banner stays as it was', async () => {
  r = await renderWebsite({
    site: OWNER,
    answer: (pathname, { method }) => (method === 'POST' ? { status: 403, body: { error: 'Only the shop’s owner can turn the website on', owners: ['Jack Lewis'] } } : undefined),
  });
  const { ui } = r;
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(await ui.findByRole('button', { name: 'Turn it on' }));
  const alert = await ui.findByRole('alert');
  assert.equal(alert.textContent, 'Only the shop’s owner can turn the website on');
  ui.getByText('Only your staff can see this.');
});

test('customers on a website that is on see no staff banner', async () => {
  r = await renderWebsite();
  await r.ui.findByRole('link', { name: 'North Street Cycles' });
  assert.ok(r.ui.queryByText('Only your staff can see this.') === null);
  assert.ok(r.ui.queryByText('Your website is on.') === null);
});
