// The customer website's other pages (openspec/changes/website-browse, tasks
// 3.6-3.9): Shop (wb-shop), not found (wb-not-found), switched off (wb-off),
// the footer pages (Contact us, Collection and returns, Privacy) and the
// basket's "can't take orders online yet" (written line 1). Example data from
// the drawings: North Street Cycles, Bolton, "[Second site]", Bearings and
// Drivetrain › Derailleurs.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderWebsite, TWO_SHOPS, ONE_SHOP, PARTS, BASE } from '../helpers/site-screen.js';

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

const href = (el) => el.getAttribute('href');
const main = () => document.getElementById('main-content');

test('the Shop page (wb-shop) lists the top categories, Drivetrain with Derailleurs beneath it', async () => {
  r = await renderWebsite({ url: '/shop' });
  const { ui } = r;
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Shop' }));
  await ui.findByRole('link', { name: /^Bearings/ });
  const cards = [...main().querySelectorAll('a')];
  assert.deepEqual(cards.map((a) => a.textContent), ['Bearings12 products', 'DrivetrainDerailleurs and 1 more']);
  assert.deepEqual(cards.map(href), [`${BASE}/shop/10`, `${BASE}/shop/20`]);
});

test('the Shop page with no categories online says so', async () => {
  r = await renderWebsite({ url: '/shop', categories: [] });
  assert.ok(await r.ui.findByText('This shop hasn’t put any products online yet.'));
});

test('an address that matches no page (wb-not-found) says so and offers a way on', async () => {
  r = await renderWebsite({ url: '/no-such-page' });
  const { ui } = r;
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'We can’t find that page' }));
  assert.ok(main().textContent.includes('It may have moved, or the link may be wrong.'));
  const search = ui.getByRole('searchbox', { name: 'Search for a page or product' });
  assert.equal(search.getAttribute('placeholder'), 'What are you looking for?');
  assert.ok(search.labels[0].textContent === 'Search for a page or product', 'a visible label');
  assert.equal(href(ui.getByRole('link', { name: 'Go to the home page' })), BASE);
  const shops = [...main().querySelectorAll('a')].find((a) => a.textContent === 'Our shops');
  assert.equal(href(shops), `${BASE}/shops`);
  // No menu item is marked as the current page.
  const nav = ui.getByRole('navigation', { name: 'Website' });
  assert.ok([...nav.querySelectorAll('a')].every((a) => !a.hasAttribute('aria-current')));
});

test('a switched-off or unknown shop (wb-off) gets a plain page with no shell', async () => {
  r = await renderWebsite({ site: () => ({ status: 404, body: { error: 'This website isn’t available', code: 'SITE_OFF' } }) });
  const { ui } = r;
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'This website isn’t available' }));
  assert.ok(document.querySelector('main').textContent.includes('Check the address, or contact the shop another way.'));
  assert.ok(document.querySelector('header') === null);
  assert.ok(document.querySelector('footer') === null);
  assert.ok(document.querySelector('a') === null);
  // Nothing else is asked for.
  assert.deepEqual(r.requests.map((q) => new URL(q.url, 'http://localhost').pathname), [`${BASE}/api/site`]);
});

test('a failed read of the site says so, and Try again asks again', async () => {
  let fail = true;
  r = await renderWebsite({ site: () => (fail ? { status: 503, body: { error: 'Something went wrong — try again' } } : { status: 200, body: TWO_SHOPS }) });
  const { ui } = r;
  const { fireEvent } = await import('@testing-library/react');
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Something went wrong — try again' }));
  fail = false;
  fireEvent.click(ui.getByRole('button', { name: 'Try again' }));
  assert.ok(await ui.findByRole('navigation', { name: 'Website' }));
});

test('a server failure is asked again by the app’s own rule before saying so', async () => {
  // The page leaves retrying to the query client (app-shell.tsx): a 503 is asked again.
  let calls = 0;
  r = await renderWebsite({ retry: 1, site: () => (++calls === 1 ? { status: 503, body: { error: 'Something went wrong — try again' } } : { status: 200, body: TWO_SHOPS }) });
  assert.ok(await r.ui.findByRole('navigation', { name: 'Website' }));
  assert.equal(calls, 2);
});

test('a page that breaks while drawing says so with Try again, which reloads the page', async () => {
  // A site answer the page can't draw (no shops list) stands in for any fault in a page.
  const realError = console.error;
  console.error = () => {};
  try {
    r = await renderWebsite({ site: { ...TWO_SHOPS, shops: null } });
    assert.ok(await r.ui.findByRole('heading', { level: 1, name: 'Something went wrong — try again' }));
    assert.ok(r.ui.getByRole('button', { name: 'Try again' }));
  } finally {
    console.error = realError;
  }
});

test('an address with a broken escape in the shop’s part still gives an address, not a crash', async () => {
  const { siteAddress } = await import(new URL('../../.test-build/website/address.js', import.meta.url).href);
  const address = siteAddress({ pathname: '/store/%E0%A4%A/', search: '', hostname: 'localhost' });
  assert.deepEqual(address, { base: '/store/%E0%A4%A', slug: '%E0%A4%A', storefrontSlug: null });
  assert.equal(siteAddress({ pathname: '/store/caf%C3%A9/', search: '', hostname: 'localhost' }).slug, 'café');
});

test('Collection and returns shows the shop’s published words', async () => {
  r = await renderWebsite({ url: '/collection-returns' });
  assert.ok(await r.ui.findByRole('heading', { level: 1, name: 'Collection and returns' }));
  assert.ok(main().textContent.includes(PARTS.collectionReturns));
});

test('Privacy shows the shop’s published words, and says so when there are none', async () => {
  r = await renderWebsite({ url: '/privacy' });
  assert.ok(await r.ui.findByRole('heading', { level: 1, name: 'Privacy' }));
  assert.ok(main().textContent.includes(PARTS.privacy));
  r.ui.unmount();
  r.client.clear();
  r.uninstall();
  r = await renderWebsite({ url: '/privacy', site: { ...TWO_SHOPS, parts: { ...PARTS, privacy: '' } } });
  assert.ok(await r.ui.findByText('This shop hasn’t added a privacy notice yet.'));
});

test('Collection and returns with no words says so', async () => {
  r = await renderWebsite({ url: '/collection-returns', site: { ...TWO_SHOPS, parts: { ...PARTS, collectionReturns: '' } } });
  assert.ok(await r.ui.findByText('This shop hasn’t added its collection and returns details yet.'));
});

test('Contact us shows each shop’s address, phone and email', async () => {
  r = await renderWebsite({ url: '/contact' });
  const { ui } = r;
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Contact us' }));
  assert.deepEqual([...main().querySelectorAll('h3')].map((h) => h.textContent), ['Bolton', '[Second site]']);
  assert.ok(main().textContent.includes('[Shop address]'));
  assert.equal(href(ui.getByRole('link', { name: '[shop phone]' })), 'tel:[shopphone]');
  assert.equal(href(ui.getByRole('link', { name: '[shop email]' })), 'mailto:[shop email]');
  // Contact us is in the footer, not the menu: no menu item is marked.
  const nav = ui.getByRole('navigation', { name: 'Website' });
  assert.ok([...nav.querySelectorAll('a')].every((a) => !a.hasAttribute('aria-current')));
});

test('Contact us with one shop names the business', async () => {
  r = await renderWebsite({ url: '/contact', site: ONE_SHOP });
  await r.ui.findByRole('heading', { level: 1, name: 'Contact us' });
  assert.deepEqual([...main().querySelectorAll('h3')].map((h) => h.textContent), ['North Street Cycles']);
  assert.ok(r.ui.getByRole('link', { name: '[shop email]' }));
});

test('Basket says the shop can’t take orders online yet, until WP-6.3 (written line 1)', async () => {
  r = await renderWebsite({ url: '/shop' });
  const { ui } = r;
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(await ui.findByRole('link', { name: 'Basket, 0 items' }));
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Basket' }));
  assert.equal(r.router.state.location.pathname, `${BASE}/basket`);
  assert.ok(main().textContent.includes('North Street Cycles can’t take orders online yet.'));
  assert.equal(href(ui.getAllByRole('link', { name: 'Contact us' })[0]), `${BASE}/contact`);
});

test('each page has its own title', async () => {
  r = await renderWebsite({ url: '/privacy' });
  await r.ui.findByRole('heading', { level: 1, name: 'Privacy' });
  assert.equal(document.title, 'Privacy · North Street Cycles');
});
