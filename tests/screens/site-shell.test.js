// The customer website's shell (openspec/changes/website-browse, tasks 3.2-3.4;
// screens site, site-menu, site-ocean, site-ocean-menu in app-map.mjs and the
// frame in browse.mjs). Example data from the drawings: North Street Cycles,
// Bolton and "[Second site]".
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderWebsite, TWO_SHOPS, ONE_SHOP, PHONE, TABLET, BASE } from '../helpers/site-screen.js';

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

test('the shell on a computer (site): skip link, name, menu, search, chip, Account, Basket and the footer', async () => {
  r = await renderWebsite({ url: '/shop' });
  const { ui } = r;
  const skip = await ui.findByRole('link', { name: 'Skip to the main content' });
  assert.equal(href(skip), '#main-content');
  // The skip link comes first in keyboard order (audit M15).
  assert.ok(document.body.querySelector('a') === skip);
  assert.ok(document.getElementById('main-content')?.tagName === 'MAIN');
  // No logo uploaded: the name only, no invented logo.
  const home = ui.getByRole('link', { name: 'North Street Cycles' });
  // The router writes the bare shop address; the server sends it on to the slash form.
  assert.equal(href(home), BASE);
  assert.ok(home.querySelector('img') === null);

  const nav = ui.getByRole('navigation', { name: 'Website' });
  const items = [...nav.querySelectorAll('a')].map((a) => a.textContent);
  assert.deepEqual(items, ['Shop', 'Book a repair', 'Our shops']);
  const shop = [...nav.querySelectorAll('a')][0];
  assert.equal(shop.getAttribute('aria-current'), 'page');
  assert.ok([...nav.querySelectorAll('a')].slice(1).every((a) => !a.hasAttribute('aria-current')));
  assert.equal(href(shop), `${BASE}/shop`);
  assert.equal(href([...nav.querySelectorAll('a')][1]), '/book/north');
  assert.equal(href([...nav.querySelectorAll('a')][2]), `${BASE}/shops`);

  // The search box is a search area (audit H4); with the chip it says "Search".
  const search = ui.getByRole('combobox', { name: 'Search the shop' });
  assert.ok(search.closest('[role="search"]') !== null);
  assert.equal(search.getAttribute('placeholder'), 'Search');
  // Two shops, none chosen: the chip asks, and opens "Which shop will you collect from?" (site-shops.test.js).
  const chip = ui.getByRole('button', { name: 'Choose a shop to collect from' });
  assert.equal(chip.textContent, 'Choose a shop');

  const account = ui.getByRole('link', { name: 'Your account' });
  assert.equal(account.textContent, 'Account');
  assert.equal(href(account), '/book/north/account');
  const basket = ui.getByRole('link', { name: 'Basket, 0 items' });
  assert.equal(basket.textContent, 'Basket');
  assert.equal(href(basket), `${BASE}/basket`);

  const footer = document.querySelector('footer');
  assert.ok(footer.textContent.includes('North Street Cycles · Bolton and [Second site]'));
  const links = [...footer.querySelectorAll('a')];
  assert.deepEqual(links.map((a) => a.textContent), ['Contact us', 'Collection and returns', 'Privacy', 'Cookies']);
  assert.deepEqual(links.map(href), [`${BASE}/contact`, `${BASE}/collection-returns`, `${BASE}/privacy`, `${BASE}/cookies`]);
  assert.equal(document.title, 'Shop · North Street Cycles');
});

test('the chip names the chosen shop from the wh_shop cookie, and ignores a shop the business doesn’t have', async () => {
  r = await renderWebsite({ cookie: 'wh_shop=1' });
  const chip = await r.ui.findByRole('button', { name: 'Collecting from North Street Cycles, Bolton — change the shop' });
  assert.equal(chip.textContent, 'Collecting from Bolton · Change');
  assert.equal(chip.querySelector('strong')?.textContent, 'Bolton');
  r.ui.unmount();
  r.client.clear();
  r.uninstall();
  r = await renderWebsite({ cookie: 'wh_shop=99' });
  assert.ok(await r.ui.findByRole('button', { name: 'Choose a shop to collect from' }));
});

test('the shop’s uploaded logo shows beside its name, with the name as the link', async () => {
  r = await renderWebsite({ site: { ...TWO_SHOPS, logo: '/uploads/logo.png' } });
  const home = await r.ui.findByRole('link', { name: 'North Street Cycles' });
  const img = home.querySelector('img');
  assert.equal(img?.getAttribute('src'), '/uploads/logo.png');
  assert.equal(img?.getAttribute('alt'), '');
});

test('one shop says Find us, with no chip, and the footer names the one shop', async () => {
  r = await renderWebsite({ site: ONE_SHOP });
  const nav = await r.ui.findByRole('navigation', { name: 'Website' });
  assert.deepEqual([...nav.querySelectorAll('a')].map((a) => a.textContent), ['Shop', 'Book a repair', 'Find us']);
  assert.ok(r.ui.queryByRole('button', { name: /Choose a shop|Collecting from/ }) === null);
  assert.ok(r.ui.queryByRole('link', { name: /Choose a shop|Collecting from/ }) === null);
  assert.equal(r.ui.getByRole('combobox', { name: 'Search the shop' }).getAttribute('placeholder'), 'Search the shop');
  const line = document.querySelector('footer').firstElementChild;
  assert.equal(line.textContent, 'North Street Cycles · Bolton');
});

test('the main colour (site-ocean): the header takes the colour, and Book a repair leaves the menu for a white button', async () => {
  r = await renderWebsite({ site: { ...TWO_SHOPS, mainColour: '#1A3F66' } });
  const nav = await r.ui.findByRole('navigation', { name: 'Website' });
  assert.deepEqual([...nav.querySelectorAll('a')].map((a) => a.textContent), ['Shop', 'Our shops']);
  const header = document.querySelector('header');
  assert.equal(header.style.backgroundColor, 'rgb(26, 63, 102)');
  assert.equal(header.style.color, 'var(--wh-on-brand)');
  const book = [...header.querySelectorAll('a')].filter((a) => a.textContent === 'Book a repair');
  assert.equal(book.length, 1);
  assert.ok(header.lastElementChild === book[0], 'Book a repair ends the header');
  assert.equal(book[0].style.color, 'rgb(26, 63, 102)');
  assert.equal(book[0].style.backgroundColor, 'var(--wh-on-brand)');
  // One colour for header and accent: the page's own buttons use it too.
  const root = header.parentElement;
  assert.equal(root.style.getPropertyValue('--accent'), '#1A3F66');
  // White, the theme's own token (no raw colours in the app).
  assert.equal(root.style.backgroundColor, 'var(--wh-on-brand)');
});

test('Soft sand’s own charcoal is the default look, Book a repair in the menu', async () => {
  r = await renderWebsite({ site: { ...TWO_SHOPS, mainColour: '#2A2822' } });
  const nav = await r.ui.findByRole('navigation', { name: 'Website' });
  assert.deepEqual([...nav.querySelectorAll('a')].map((a) => a.textContent), ['Shop', 'Book a repair', 'Our shops']);
  assert.equal(document.querySelector('header').style.backgroundColor, '');
});

test('on a tablet the header uses icons with the same names', async () => {
  r = await renderWebsite({ media: TABLET });
  await r.ui.findByRole('navigation', { name: 'Website' });
  assert.ok(r.ui.getByRole('button', { name: 'Search the shop' }));
  assert.equal(r.ui.getByRole('link', { name: 'Your account' }).textContent, '');
  assert.equal(r.ui.getByRole('link', { name: 'Basket, 0 items' }).textContent, '');
  // The chip moves to the top of the page on narrower screens.
  const chip = r.ui.getByRole('button', { name: /Choose a shop to collect from/ });
  assert.ok(document.getElementById('main-content').contains(chip));
});

test('the phone menu (site-menu) opens, closes on Esc and returns focus to the menu button', async () => {
  r = await renderWebsite({ media: PHONE, cookie: 'wh_shop=1' });
  const { ui } = r;
  const { fireEvent } = await import('@testing-library/react');
  const button = await ui.findByRole('button', { name: 'Open menu' });
  assert.equal(button.textContent, 'Menu');
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.ok(ui.queryByRole('navigation', { name: 'Website' }) === null);
  assert.ok(ui.getByRole('button', { name: 'Search the shop' }));
  assert.ok(ui.getByRole('link', { name: 'Basket, 0 items' }));
  // On a phone the chip is a line at the top of the page.
  const chip = ui.getByRole('button', { name: /Collecting from Bolton/ });
  assert.ok(chip.textContent.includes('Change'));

  fireEvent.click(button);
  assert.equal(button.getAttribute('aria-label'), 'Close menu');
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  const nav = ui.getByRole('navigation', { name: 'Website' });
  assert.deepEqual([...nav.querySelectorAll('a')].map((a) => a.textContent), ['Shop', 'Book a repair', 'Our shops', 'Account']);

  fireEvent.keyDown(document, { key: 'Escape' });
  assert.ok(ui.queryByRole('navigation', { name: 'Website' }) === null);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.ok(document.activeElement === button);

  // The close button shuts it too.
  fireEvent.click(button);
  fireEvent.click(ui.getByRole('button', { name: 'Close menu' }));
  assert.ok(ui.queryByRole('navigation', { name: 'Website' }) === null);
});

test('a link chosen in the phone menu closes it', async () => {
  r = await renderWebsite({ media: PHONE });
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(await r.ui.findByRole('button', { name: 'Open menu' }));
  fireEvent.click(r.ui.getByRole('navigation', { name: 'Website' }).querySelector('a'));
  assert.ok(r.ui.queryByRole('navigation', { name: 'Website' }) === null);
  assert.equal(r.router.state.location.pathname, `${BASE}/shop`);
});

test('the phone menu in the main colour (site-ocean-menu) starts with a Book a repair button', async () => {
  r = await renderWebsite({ media: PHONE, site: { ...TWO_SHOPS, mainColour: '#1A3F66' } });
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(await r.ui.findByRole('button', { name: 'Open menu' }));
  const links = [...r.ui.getByRole('navigation', { name: 'Website' }).querySelectorAll('a')];
  assert.deepEqual(links.map((a) => a.textContent), ['Book a repair', 'Shop', 'Our shops', 'Account']);
  assert.equal(links[0].style.backgroundColor, 'rgb(26, 63, 102)');
  assert.equal(href(links[0]), '/book/north');
  assert.equal(document.querySelector('header').style.backgroundColor, 'rgb(26, 63, 102)');
});

test('Book a repair names the chosen shop when there are several', async () => {
  r = await renderWebsite({ cookie: 'wh_shop=2' });
  const nav = await r.ui.findByRole('navigation', { name: 'Website' });
  assert.equal(href([...nav.querySelectorAll('a')][1]), '/book/north?site=2');
});

test('following a link moves focus to the new page, as a full page load would', async () => {
  r = await renderWebsite({ url: '/' });
  const { fireEvent } = await import('@testing-library/react');
  const nav = await r.ui.findByRole('navigation', { name: 'Website' });
  assert.ok(document.activeElement !== document.getElementById('main-content'), 'not on first load');
  fireEvent.click(nav.querySelector('a'));
  await r.ui.findByRole('heading', { level: 1, name: 'Shop' });
  assert.ok(document.activeElement === document.getElementById('main-content'));
});
