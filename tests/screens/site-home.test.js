// The customer website's home page (openspec/changes/website-browse, task 3.5;
// wb-home, wb-home-lower, wb-home-one-shop and wb-first-visit in browse.mjs).
// Example data from the drawings: North Street Cycles, Bolton, "[Second site]",
// Shimano brake pads B05S-RX at £28.00, Bearings, Drivetrain › Derailleurs,
// Standard service £65.00, Brake service and Gear adjustment.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderWebsite, TWO_SHOPS, ONE_SHOP, PARTS, HOME, BASE } from '../helpers/site-screen.js';

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
const headings = (level) => [...main().querySelectorAll(level)].map((h) => h.textContent);
const homeAsked = () => r.requests.filter((q) => new URL(q.url, 'http://localhost').pathname === `${BASE}/api/site/home`);

test('the top of the home page (wb-home): big photo, headline, about line, categories and featured products', async () => {
  r = await renderWebsite({ cookie: 'wh_shop=1' });
  const { ui } = r;
  const h1 = await ui.findByRole('heading', { level: 1, name: '[Headline]' });
  const hero = h1.closest('section');
  assert.equal(hero.getAttribute('aria-labelledby'), h1.id);
  assert.ok(hero.textContent.includes('[A line about the shop]'));
  const photo = hero.querySelector('img');
  assert.equal(photo.getAttribute('src'), '/uploads/big.jpg');
  assert.equal(photo.getAttribute('alt'), '[Big photo of the shop]');
  const heroLinks = [...hero.querySelectorAll('a')];
  assert.deepEqual(heroLinks.map((a) => a.textContent), ['Book a repair', 'Shop']);
  assert.equal(href(heroLinks[0]), '/book/north?site=1');
  assert.equal(href(heroLinks[1]), `${BASE}/shop`);

  // The sections in the drawn order.
  await ui.findByRole('heading', { level: 2, name: 'Featured products' });
  assert.deepEqual(headings('h2'), ['Shop by category', 'Featured products', 'Book a repair', 'Our shops', 'About us']);

  const cats = ui.getByRole('region', { name: 'Shop by category' });
  const bearings = [...cats.querySelectorAll('a')].find((a) => a.textContent.startsWith('Bearings'));
  assert.equal(bearings.textContent, 'Bearings12 products');
  assert.equal(href(bearings), `${BASE}/shop/10`);
  const drivetrain = [...cats.querySelectorAll('a')].find((a) => a.textContent.startsWith('Drivetrain'));
  assert.equal(drivetrain.textContent, 'DrivetrainDerailleurs and 1 more');
  // Only top categories; a type sits under its parent.
  assert.ok(![...cats.querySelectorAll('a')].some((a) => a.textContent.startsWith('Derailleurs')));
  assert.equal(href(ui.getByRole('link', { name: 'All categories' })), `${BASE}/shop`);

  const featured = ui.getByRole('region', { name: 'Featured products' });
  const pads = [...featured.querySelectorAll('a')][0];
  assert.equal(href(pads), `${BASE}/products/101`);
  assert.equal(pads.querySelector('img').getAttribute('alt'), 'Photo of Shimano brake pads B05S-RX');
  assert.ok(pads.textContent.includes('Shimano brake pads B05S-RX'));
  assert.ok(pads.textContent.includes('£28.00'));
  assert.ok(pads.textContent.includes('Ready today at Bolton'));
  // The chosen shop goes with the request, so stock lines name it.
  assert.equal(new URL(homeAsked()[0].url, 'http://localhost').searchParams.get('shop'), '1');
});

test('further down (wb-home-lower): the repairs box, Our shops and the shop’s own words', async () => {
  r = await renderWebsite({ cookie: 'wh_shop=1' });
  const { ui } = r;
  const repairs = (await ui.findByRole('heading', { level: 2, name: 'Book a repair' })).closest('section');
  assert.ok(repairs.textContent.includes('[The shop’s words about its workshop]'));
  await ui.findByText('Standard service');
  const rows = [...repairs.querySelectorAll('li')].map((li) => li.textContent);
  assert.deepEqual(rows, ['Brake service', 'Gear adjustment', 'Standard service£65.00']);
  const book = [...repairs.querySelectorAll('a')].find((a) => a.textContent === 'Book a repair');
  assert.equal(href(book), '/book/north?site=1');

  const shops = ui.getByRole('region', { name: 'Our shops' });
  assert.equal(href(ui.getByRole('link', { name: 'All shops' })), `${BASE}/shops`);
  assert.deepEqual([...shops.querySelectorAll('h3')].map((h) => h.textContent), ['Bolton', '[Second site]']);
  const bolton = shops.querySelector('h3').parentElement.parentElement;
  assert.equal(href(bolton.querySelector('h3 a')), `${BASE}/shops/1`);
  assert.ok(bolton.textContent.includes('[Shop address]'));
  assert.ok(bolton.textContent.includes('Open today [open]–[close]'));
  assert.equal(href(ui.getByRole('link', { name: '[shop phone]' })), 'tel:[shopphone]');
  const here = [...shops.querySelectorAll('a')].filter((a) => a.textContent === 'Book a repair here');
  assert.deepEqual(here.map(href), ['/book/north?site=1', '/book/north?site=2']);
  const directions = ui.getByRole('link', { name: 'Directions to Bolton (opens your maps app)' });
  assert.equal(href(directions), 'https://www.google.com/maps/dir/?api=1&destination=%5BShop%20address%5D');
  assert.equal(directions.getAttribute('target'), '_blank');
  // The second shop has no details of its own yet (Jack's answer 1): no directions.
  assert.ok(ui.queryByRole('link', { name: /Directions to \[Second site\]/ }) === null);

  const words = ui.getByRole('region', { name: 'About us' });
  assert.ok(words.textContent.includes(PARTS.shopWords));
  assert.equal(words.querySelector('img').getAttribute('alt'), '[A photo the shop adds]');
});

test('one shop (wb-home-one-shop): Find us, the shop under the business’s name, no Book a repair here', async () => {
  r = await renderWebsite({ site: ONE_SHOP });
  const { ui } = r;
  const find = await ui.findByRole('region', { name: 'Find us' });
  assert.deepEqual([...find.querySelectorAll('h3')].map((h) => h.textContent), ['North Street Cycles']);
  assert.ok(ui.queryByRole('link', { name: 'All shops' }) === null);
  assert.ok(ui.queryByRole('link', { name: 'Book a repair here' }) === null);
  assert.ok(ui.getByRole('link', { name: 'Directions to North Street Cycles (opens your maps app)' }));
  assert.equal(href(ui.getAllByRole('link', { name: 'Book a repair' })[0]), '/book/north');
  // With one shop, every stock line names it.
  assert.equal((await ui.findAllByText('Ready today at Bolton')).length, 2);
  assert.equal(new URL(homeAsked()[0].url, 'http://localhost').searchParams.get('shop'), '1');
});

test('a first visit with two shops (wb-first-visit): no shop asked for and no stock line', async () => {
  r = await renderWebsite({ home: HOME({ line: 'none' }) });
  const { ui } = r;
  await ui.findByRole('heading', { level: 2, name: 'Featured products' });
  assert.ok(ui.getByRole('link', { name: 'Choose a shop to collect from' }));
  assert.equal(new URL(homeAsked()[0].url, 'http://localhost').searchParams.has('shop'), false);
  assert.ok(!main().textContent.includes('Ready today'));
});

test('a closed day says when the shop next opens', async () => {
  const shops = [{ ...TWO_SHOPS.shops[0], today: null, nextOpening: { date: '2026-09-07', open: '[time]' } }, TWO_SHOPS.shops[1]];
  r = await renderWebsite({ site: { ...TWO_SHOPS, shops } });
  const region = await r.ui.findByRole('region', { name: 'Our shops' });
  assert.ok(region.textContent.includes('Closed today · opens Monday [time]'));
});

test('an empty section is left out, and with no headline the shop’s name heads the page', async () => {
  const parts = { ...PARTS, headline: '', aboutLine: '', bigPhoto: null, workshopWords: '', shopWords: '', shopPhoto: null };
  r = await renderWebsite({ site: { ...TWO_SHOPS, parts }, categories: [], home: { featured: [], repairs: [] } });
  const { ui } = r;
  const h1 = await ui.findByRole('heading', { level: 1, name: 'North Street Cycles' });
  assert.ok(h1.closest('section').querySelector('img') === null);
  await ui.findByRole('region', { name: 'Our shops' });
  assert.deepEqual(headings('h2'), ['Our shops']);
});

test('categories with nothing online are left out', async () => {
  const categories = [{ id: 10, name: 'Bearings', parentId: null, path: 'Bearings', products: 0 }, { id: 20, name: 'Drivetrain', parentId: null, path: 'Drivetrain', products: 7 }];
  r = await renderWebsite({ categories });
  const cats = await r.ui.findByRole('region', { name: 'Shop by category' });
  assert.ok(!cats.textContent.includes('Bearings'));
  assert.ok(cats.textContent.includes('Drivetrain7 products'));
});

test('a failed read of the products and repairs says so with Try again, and keeps the rest of the page', async () => {
  let fail = true;
  r = await renderWebsite({ home: () => (fail ? { status: 503, body: { error: 'Something went wrong — try again' } } : { status: 200, body: HOME() }) });
  const { ui } = r;
  const { fireEvent } = await import('@testing-library/react');
  const alert = await ui.findByRole('alert');
  assert.ok(alert.textContent.includes('Something went wrong — try again'));
  assert.ok(ui.getByRole('region', { name: 'Shop by category' }));
  fail = false;
  fireEvent.click(ui.getByRole('button', { name: 'Try again' }));
  await ui.findByRole('region', { name: 'Featured products' });
  assert.ok(ui.queryByRole('alert') === null);
});
