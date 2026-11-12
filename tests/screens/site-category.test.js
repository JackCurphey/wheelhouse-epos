// The customer website's category pages (openspec/changes/website-browse,
// tasks 4.1-4.6; wb-category, wb-category-filtered, wb-category-empty,
// wb-category-parent, wb-category-child and wb-category-no-shop in
// browse.mjs). Example data from the drawings: North Street Cycles, Bolton,
// "[Second site]", Bearings (inner diameter, outer diameter, height, brand),
// Drivetrain › Derailleurs (number of gears), "[Bearing]", "[Derailleur]",
// "[Brand]". The measurements and prices are stand-ins for the drawings'
// "[n] mm" and "£[price]", there only so the answers differ.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderWebsite, TWO_SHOPS, ONE_SHOP, BASE, PHONE } from '../helpers/site-screen.js';

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

// ---------- A pretend /api/site/products, answering as the server does ----------

const BEARING_DETAILS = [
  { id: 1, name: 'Inner diameter', kind: 'number', unit: 'mm' },
  { id: 2, name: 'Outer diameter', kind: 'number', unit: 'mm' },
  { id: 3, name: 'Height', kind: 'number', unit: 'mm' },
];
// Twelve bearings: inner 10, 15, 30, 35 mm in turn; height 7 or 10 mm; the
// first eight one brand, the rest another; every third one sold out at Bolton.
const BEARINGS = Array.from({ length: 12 }, (_, i) => ({
  id: 200 + i, name: '[Bearing]', brand: i < 8 ? '[Brand]' : '[Second brand]', pricePence: 1000 + 100 * i, ready: i % 3 !== 0,
  d: { 1: [10, 15, 30, 35][i % 4], 2: [22, 42][i % 2], 3: [7, 10][i % 2] },
}));
const DERAILLEURS = Array.from({ length: 4 }, (_, i) => ({ id: 300 + i, name: '[Derailleur]', brand: '[Brand]', pricePence: 3000 + 100 * i, ready: true, d: { 5: [10, 11, 12, 12][i] } }));
const OTHER = Array.from({ length: 3 }, (_, i) => ({ id: 400 + i, name: '[Product]', brand: '[Brand]', pricePence: 2000 + 100 * i, ready: true, d: {} }));
// The first [Product] has details in two units, for the card's line.
OTHER[0].cardDetails = [{ name: '[Length]', value: 120, unit: 'mm' }, { name: '[Weight]', value: 300, unit: 'g' }];

const CATS = {
  10: { category: { id: 10, name: 'Bearings', path: 'Bearings', parentId: null }, types: [], details: BEARING_DETAILS, items: BEARINGS },
  20: { category: { id: 20, name: 'Drivetrain', path: 'Drivetrain', parentId: null }, types: [{ id: 21, name: 'Derailleurs', products: 4 }, { id: 22, name: '[Category]', products: 3 }], details: [], items: [...DERAILLEURS, ...OTHER] },
  21: { category: { id: 21, name: 'Derailleurs', path: 'Drivetrain › Derailleurs', parentId: 20 }, types: [], details: [{ id: 5, name: 'Number of gears', kind: 'number', unit: null }], items: DERAILLEURS },
  22: { category: { id: 22, name: '[Category]', path: 'Drivetrain › [Category]', parentId: 20 }, types: [], details: [], items: OTHER },
};
const SHOPS = { 1: 'Bolton', 2: '[Second site]' };

function productsAnswer(url) {
  const q = new URL(url, 'http://localhost').searchParams;
  const cat = CATS[q.get('category')];
  if (!cat) return { status: 404, body: { error: 'We can’t find that page' } };
  const shop = SHOPS[q.get('shop')] ? { id: Number(q.get('shop')), name: SHOPS[q.get('shop')] } : null;
  const ticks = new Map();
  for (const [key, value] of q.entries()) {
    const id = /^d(\d+)$/.exec(key)?.[1];
    if (id) ticks.set(Number(id), [...(ticks.get(Number(id)) ?? []), Number(value)]);
  }
  const brands = q.getAll('brand');
  const from = q.get('from') ? Number(q.get('from')) * 100 : null;
  const to = q.get('to') ? Number(q.get('to')) * 100 : null;
  const ready = q.get('ready') === '1' && shop;
  const passes = (p, skip) => [...ticks].every(([id, vs]) => skip === id || vs.includes(p.d[id]))
    && (skip === 'brand' || !brands.length || brands.includes(p.brand))
    && (from === null || p.pricePence >= from) && (to === null || p.pricePence <= to)
    && (skip === 'ready' || !ready || p.ready);
  const found = cat.items.filter((p) => passes(p));
  const sort = q.get('sort');
  const sorted = [...found].sort(sort === 'price-asc' ? (a, b) => a.pricePence - b.pricePence
    : sort === 'price-desc' ? (a, b) => b.pricePence - a.pricePence
      : sort === 'newest' ? (a, b) => b.id - a.id : (a, b) => a.id - b.id);
  const after = Number(q.get('after') ?? 0);
  const counts = (list, of) => { const m = new Map(); for (const p of list) { const v = of(p); if (v != null) m.set(v, (m.get(v) ?? 0) + 1); } return [...m].map(([value, count]) => ({ value, count })); };
  return {
    status: 200,
    body: {
      category: cat.category,
      types: cat.types,
      products: sorted.slice(after, after + 6).map((p) => ({
        id: p.id, name: p.name, brand: p.brand, photo: null, pricePence: p.pricePence, priceHighPence: null,
        details: p.cardDetails ?? cat.details.filter((x) => p.d[x.id] != null).map((x) => ({ name: x.name, value: p.d[x.id], unit: x.unit })),
        stock: shop ? { line: p.ready ? 'ready' : 'sold-out', shop: shop.name } : { line: 'none' },
      })),
      total: sorted.length,
      after: after + 6 < sorted.length ? after + 6 : null,
      filters: {
        details: cat.details.map((x) => ({ ...x, values: counts(cat.items.filter((p) => passes(p, x.id)), (p) => p.d[x.id]).sort((a, b) => a.value - b.value) })),
        brands: counts(cat.items.filter((p) => passes(p, 'brand')), (p) => p.brand),
        price: found.length ? { lowPence: Math.min(...found.map((p) => p.pricePence)), highPence: Math.max(...found.map((p) => p.pricePence)) } : null,
        ready: shop ? { shop: shop.name, count: cat.items.filter((p) => passes(p, 'ready') && p.ready).length } : null,
      },
      shop,
    },
  };
}

const open = (url, extra = {}) => renderWebsite({ url, products: productsAnswer, cookie: 'wh_shop=1', ...extra });
const asked = () => r.requests.map((q) => new URL(q.url, 'http://localhost')).filter((u) => u.pathname === `${BASE}/api/site/products`);
const lastAsked = () => asked().at(-1).searchParams;
const search = () => new URLSearchParams(r.router.state.location.search);
const cards = () => [...main().querySelectorAll('a[href*="/products/"]')];
const filters = () => r.ui.getByRole('complementary', { name: 'Filters' });
const legends = (root) => [...root.querySelectorAll('fieldset > legend')].map((l) => l.textContent);
const countLine = async (text) => r.ui.findByText(text, { selector: '[aria-live="polite"]' });
const rtl = () => import('@testing-library/react');
async function cleanupNow() {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  r.client.clear();
  r.uninstall();
  r = undefined;
}
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
// An answer held back until `release()`, for asks `match` picks out.
function holding(match) {
  const gate = deferred();
  return { answer: (url) => (match(new URL(url, 'http://localhost').searchParams) ? gate.promise.then(() => productsAnswer(url)) : productsAnswer(url)), release: () => gate.resolve() };
}

// ---------- 4.1 wb-category and wb-category-filtered ----------

test('a category (wb-category): six products, "Showing 6 of [n] products", the filters with nothing ticked', async () => {
  r = await open('/shop/10');
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Bearings' }));
  assert.ok(await countLine('12 products'));
  assert.equal(document.title, 'Bearings · North Street Cycles');
  const crumbs = ui.getByRole('navigation', { name: 'You are here' });
  assert.equal(crumbs.textContent, 'Shop › Bearings');
  assert.equal(href(crumbs.querySelector('a')), `${BASE}/shop`);
  assert.equal(crumbs.querySelector('[aria-current="page"]').textContent, 'Bearings');
  assert.equal(cards().length, 6);
  assert.equal(href(cards()[0]), `${BASE}/products/200`);
  assert.ok(cards()[1].textContent.includes('Ready today at Bolton'));
  assert.ok(ui.getByText('Showing 6 of 12 products').getAttribute('aria-live') === 'polite');
  // The filters, in the drawn order, each a group with its heading.
  assert.deepEqual(legends(filters()), ['Availability', 'Inner diameter', 'Outer diameter', 'Height', 'Brand', 'Price']);
  // Nothing is ticked to start (audit M6).
  const boxes = [...filters().querySelectorAll('input[type="checkbox"]')];
  assert.ok(boxes.length > 0);
  assert.ok(boxes.every((b) => !b.checked));
  assert.ok(ui.queryByRole('button', { name: 'Clear all' }) === null);
  // Each value shows its count; a number with its unit.
  const ready = ui.getByRole('checkbox', { name: /^Ready today at Bolton/ });
  assert.ok(ready.closest('label').textContent.includes('8'));
  const inner = [...filters().querySelectorAll('fieldset')][1];
  const shown = within(inner).getAllByRole('checkbox').map((b) => b.closest('label').textContent);
  assert.equal(shown.length, 3);
  assert.ok(shown[0].startsWith('10 mm3') && shown[1].startsWith('15 mm3') && shown[2].startsWith('30 mm3'), shown.join(' | '));
  // A group shows three values, then "Show [n] more".
  const more = within(inner).getByRole('button', { name: 'Show 1 more' });
  assert.equal(more.getAttribute('aria-expanded'), 'false');
  fireEvent.click(more);
  assert.equal(inner.querySelectorAll('input[type="checkbox"]').length, 4);
  assert.equal(within(inner).getByRole('button', { expanded: true }).getAttribute('aria-expanded'), 'true');
  // Sort: A to Z to start.
  assert.equal(ui.getByRole('combobox', { name: 'Sort by' }).value, 'az');
});

test('Show more adds the next six below and moves focus to the first of them', async () => {
  r = await open('/shop/10');
  const { ui } = r;
  const { fireEvent } = await rtl();
  await countLine('12 products');
  fireEvent.click(ui.getByRole('button', { name: 'Show more' }));
  await ui.findByText((_, el) => el?.tagName === 'A' && href(el) === `${BASE}/products/206`);
  assert.equal(cards().length, 12);
  assert.ok(document.activeElement === cards()[6]);
  assert.equal(lastAsked().get('after'), '6');
  // All shown: no Show more; `after` is never in the page's address.
  assert.ok(ui.queryByRole('button', { name: 'Show more' }) === null);
  assert.ok(!search().has('after'));
});

test('ticking filters (wb-category-filtered): the count, chips "Remove filter …", and Clear all', async () => {
  r = await open('/shop/10');
  const { ui } = r;
  const { fireEvent } = await rtl();
  await countLine('12 products');
  fireEvent.click(ui.getByRole('checkbox', { name: /^Ready today at Bolton/ }));
  fireEvent.click(ui.getByRole('checkbox', { name: /^30 mm/ }));
  assert.ok(await countLine('2 products match'));
  assert.equal(search().get('ready'), '1');
  assert.deepEqual(search().getAll('inner-diameter'), ['30']);
  assert.equal(lastAsked().get('ready'), '1');
  assert.deepEqual(lastAsked().getAll('d1'), ['30']);
  assert.equal(lastAsked().get('shop'), '1');
  assert.ok(ui.getByRole('checkbox', { name: /^30 mm/ }).checked);
  const ready = ui.getByRole('button', { name: 'Remove filter Ready today at Bolton' });
  assert.equal(ready.textContent, 'Ready today at Bolton');
  assert.equal(ui.getByRole('button', { name: 'Remove filter Inner diameter: 30 mm' }).textContent, 'Inner diameter: 30 mm');
  fireEvent.click(ready);
  assert.ok(await countLine('3 products match'));
  assert.ok(!search().has('ready'));
  assert.ok(ui.queryByRole('button', { name: 'Remove filter Ready today at Bolton' }) === null);
  fireEvent.click(ui.getByRole('button', { name: 'Clear all' }));
  assert.ok(await countLine('12 products'));
  assert.ok(ui.queryByRole('button', { name: /^Remove filter/ }) === null);
  assert.equal(search().toString(), '');
});

test('details combine: two values of one detail find either, with another detail both', async () => {
  r = await open('/shop/10');
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  await countLine('12 products');
  const inner = [...filters().querySelectorAll('fieldset')][1];
  fireEvent.click(within(inner).getByRole('checkbox', { name: /^10 mm/ }));
  fireEvent.click(within(inner).getByRole('checkbox', { name: /^30 mm/ }));
  const height = [...filters().querySelectorAll('fieldset')].find((f) => f.querySelector('legend').textContent === 'Height');
  fireEvent.click(within(height).getByRole('checkbox', { name: /^7 mm/ }));
  assert.ok(await countLine('6 products match'));
  assert.deepEqual(lastAsked().getAll('d1'), ['10', '30']);
  assert.deepEqual(lastAsked().getAll('d3'), ['7']);
  assert.ok(ui.getByRole('button', { name: 'Remove filter Height: 7 mm' }));
});

test('brand ticks show as a chip and are sent as brand', async () => {
  r = await open('/shop/10');
  const { ui } = r;
  const { fireEvent } = await rtl();
  await countLine('12 products');
  fireEvent.click(ui.getByRole('checkbox', { name: /^\[Second brand\]/ }));
  assert.ok(await countLine('4 products match'));
  assert.deepEqual(search().getAll('brand'), ['[Second brand]']);
  assert.deepEqual(lastAsked().getAll('brand'), ['[Second brand]']);
  assert.ok(ui.getByRole('button', { name: 'Remove filter Brand: [Second brand]' }));
});

// ---------- 4.2 wb-category-parent, wb-category-child, wb-category-no-shop ----------

test('a parent category (wb-category-parent): its types under the heading, and only Availability, Brand and Price', async () => {
  r = await open('/shop/20');
  const { ui } = r;
  await ui.findByRole('heading', { level: 1, name: 'Drivetrain' });
  await countLine('7 products');
  const types = ui.getByRole('navigation', { name: 'Types of drivetrain' });
  const links = [...types.querySelectorAll('a')];
  assert.deepEqual(links.map((a) => a.textContent), ['Derailleurs', '[Category]']);
  assert.deepEqual(links.map(href), [`${BASE}/shop/21`, `${BASE}/shop/22`]);
  assert.deepEqual(legends(filters()), ['Availability', 'Brand', 'Price']);
  assert.equal(ui.getByRole('navigation', { name: 'You are here' }).textContent, 'Shop › Drivetrain');
});

test('a subcategory (wb-category-child): the path "Shop › Drivetrain › Derailleurs" and its own details', async () => {
  r = await open('/shop/21');
  const { ui } = r;
  await ui.findByRole('heading', { level: 1, name: 'Derailleurs' });
  const crumbs = await ui.findByRole('navigation', { name: 'You are here' });
  await ui.findByText('Drivetrain', { selector: 'nav a' });
  assert.equal(crumbs.textContent, 'Shop › Drivetrain › Derailleurs');
  const links = [...crumbs.querySelectorAll('a')];
  assert.deepEqual(links.map((a) => a.textContent), ['Shop', 'Drivetrain']);
  assert.deepEqual(links.map(href), [`${BASE}/shop`, `${BASE}/shop/20`]);
  assert.equal(crumbs.querySelector('[aria-current="page"]').textContent, 'Derailleurs');
  assert.deepEqual(legends(filters()), ['Availability', 'Number of gears', 'Brand', 'Price']);
  // A number with no unit is shown as written.
  assert.ok(ui.getByRole('checkbox', { name: /^11\b/ }));
  assert.ok(ui.queryByRole('navigation', { name: /^Types of/ }) === null);
});

test('before a shop is chosen (wb-category-no-shop): Availability asks for a shop, and no stock line shows', async () => {
  r = await renderWebsite({ url: '/shop/10', products: productsAnswer, site: TWO_SHOPS });
  const { ui } = r;
  const { within } = await rtl();
  await countLine('12 products');
  assert.ok(!lastAsked().has('shop'));
  const availability = [...filters().querySelectorAll('fieldset')][0];
  assert.equal(availability.querySelector('legend').textContent, 'Availability');
  assert.ok(availability.querySelector('input') === null);
  // It opens the chip's "Which shop will you collect from?" (pull request 7).
  const choose = within(availability).getByRole('button', { name: 'Choose a shop to collect from' });
  const { fireEvent } = await rtl();
  fireEvent.click(choose);
  assert.ok(ui.getByRole('dialog', { name: 'Which shop will you collect from?' }));
  fireEvent.click(ui.getByRole('button', { name: 'Cancel' }));
  assert.equal(cards().length, 6);
  assert.ok(cards().every((c) => !c.textContent.includes('Ready today') && !c.textContent.includes('Sold out')));
});

test('with one shop, that shop is the one Availability names', async () => {
  r = await renderWebsite({ url: '/shop/10', products: productsAnswer, site: ONE_SHOP });
  await countLine('12 products');
  assert.equal(lastAsked().get('shop'), '1');
  assert.ok(r.ui.getByRole('checkbox', { name: /^Ready today at Bolton/ }));
});

// ---------- 4.3 wb-category-empty ----------

test('nothing matches (wb-category-empty): the sentence naming what is ticked, Clear all filters, Ask the shop in place', async () => {
  r = await open('/shop/10?ready=1&inner-diameter=30&height=10');
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  assert.ok(await countLine('Nothing matches'));
  // The address names details; their ids are learned from an answer first.
  const all = asked();
  assert.ok(![...all[0].searchParams.keys()].some((k) => /^d\d+$/.test(k)), 'the first ask has no detail ticks');
  assert.deepEqual(lastAsked().getAll('d1'), ['30']);
  assert.deepEqual(lastAsked().getAll('d3'), ['10']);
  const status = ui.getByRole('status');
  assert.equal(status.textContent, 'Nothing is ready today at Bolton with an inner diameter of 30 mm and a height of 10 mm.');
  assert.equal(status.querySelector('strong').textContent, 'Nothing is ready today at Bolton');
  assert.equal(cards().length, 0);
  assert.ok(ui.queryByText(/Show ones ready/) === null, 'not until WP-6.3 (Jack’s answer 2)');
  assert.ok(ui.getByRole('button', { name: 'Remove filter Height: 10 mm' }));
  const ask = ui.getByRole('button', { name: 'Ask the shop about it' });
  assert.equal(ask.getAttribute('aria-expanded'), 'false');
  assert.ok(ui.queryByRole('region', { name: 'Ask the shop' }) === null);
  fireEvent.click(ask);
  const region = ui.getByRole('region', { name: 'Ask the shop' });
  assert.equal(ask.getAttribute('aria-expanded'), 'true');
  assert.equal(region.querySelector('strong').textContent, 'Ask the shop');
  // Two shops: each line names its shop; only the first has details yet (Jack's answer 1).
  assert.ok(region.textContent.includes('Bolton: Call [shop phone] or email [shop email]'));
  assert.equal(href(within(region).getByRole('link', { name: '[shop phone]' })), 'tel:[shopphone]');
  assert.equal(href(within(region).getByRole('link', { name: '[shop email]' })), 'mailto:[shop email]');
  fireEvent.click(ui.getByRole('button', { name: 'Clear all filters' }));
  assert.ok(await countLine('12 products'));
  assert.equal(search().toString(), '');
});

test('nothing matches with no ready tick: "Nothing has …"; with one shop, no shop name before Call', async () => {
  r = await renderWebsite({ url: '/shop/10?inner-diameter=30&height=10', products: productsAnswer, site: ONE_SHOP });
  const { ui } = r;
  const { fireEvent } = await rtl();
  assert.ok(await countLine('Nothing matches'));
  const status = ui.getByRole('status');
  assert.equal(status.textContent, 'Nothing has an inner diameter of 30 mm and a height of 10 mm.');
  assert.equal(status.querySelector('strong').textContent, 'Nothing');
  fireEvent.click(ui.getByRole('button', { name: 'Ask the shop about it' }));
  const region = ui.getByRole('region', { name: 'Ask the shop' });
  assert.ok(region.textContent.endsWith('Call [shop phone] or email [shop email]'));
  assert.ok(!region.textContent.includes('Bolton:'));
});

test('an address naming a detail the category doesn’t have ignores it', async () => {
  r = await open('/shop/10?no-such-detail=3');
  assert.ok(await countLine('12 products'));
  assert.ok(![...lastAsked().keys()].some((k) => /^d\d+$/.test(k)));
});

test('a category with no products online, nothing ticked, says so', async () => {
  const none = (url) => {
    const a = productsAnswer(url);
    return { status: 200, body: { ...a.body, products: [], total: 0, after: null, filters: { details: [], brands: [], price: null, ready: { shop: 'Bolton', count: 0 } } } };
  };
  r = await renderWebsite({ url: '/shop/22', products: none, cookie: 'wh_shop=1' });
  const { ui } = r;
  await ui.findByRole('heading', { level: 1, name: '[Category]' });
  assert.ok(await ui.findByText('This shop hasn’t put any products in [Category] online yet.'));
  assert.ok(ui.queryByRole('button', { name: 'Clear all filters' }) === null);
});

test('a category that isn’t there opens "We can’t find that page"', async () => {
  r = await open('/shop/99');
  assert.ok(await r.ui.findByRole('heading', { level: 1, name: 'We can’t find that page' }));
});

// ---------- 4.4 Sorting, and the address ----------

test('the sort menu offers the four sorts; the address keeps filters and sort for Back and a shared link', async () => {
  r = await open('/shop/10');
  const { ui, router } = r;
  const { fireEvent, act } = await rtl();
  await countLine('12 products');
  const sort = ui.getByRole('combobox', { name: 'Sort by' });
  assert.deepEqual([...sort.options].map((o) => o.textContent), ['A to Z', 'Price, low to high', 'Price, high to low', 'Newest']);
  assert.deepEqual([...sort.options].map((o) => o.value), ['az', 'price-asc', 'price-desc', 'newest']);
  fireEvent.click(ui.getByRole('checkbox', { name: /^30 mm/ }));
  await countLine('3 products match');
  fireEvent.change(sort, { target: { value: 'price-desc' } });
  await ui.findByText((_, el) => el?.tagName === 'A' && href(el) === `${BASE}/products/210` && el === cards()[0]);
  assert.equal(search().toString(), 'inner-diameter=30&sort=price-desc');
  assert.equal(lastAsked().get('sort'), 'price-desc');
  // Back steps back through the sort, then the tick.
  await act(() => router.navigate(-1));
  await ui.findByText((_, el) => el?.tagName === 'A' && href(el) === `${BASE}/products/202` && el === cards()[0]);
  assert.equal(ui.getByRole('combobox', { name: 'Sort by' }).value, 'az');
  assert.ok(ui.getByRole('checkbox', { name: /^30 mm/ }).checked);
  await act(() => router.navigate(-1));
  assert.ok(await countLine('12 products'));
  assert.ok(!ui.getByRole('checkbox', { name: /^30 mm/ }).checked);
});

test('a shared link opens with its filters ticked and its sort chosen', async () => {
  r = await open('/shop/10?inner-diameter=30&sort=price-asc');
  const { ui } = r;
  assert.ok(await countLine('3 products match'));
  assert.ok(ui.getByRole('checkbox', { name: /^30 mm/ }).checked);
  assert.equal(ui.getByRole('combobox', { name: 'Sort by' }).value, 'price-asc');
  assert.equal(lastAsked().get('sort'), 'price-asc');
  assert.deepEqual(lastAsked().getAll('d1'), ['30']);
  assert.equal(href(cards()[0]), `${BASE}/products/202`);
});

// ---------- 4.5 Price ----------

test('Price From and To apply when the box is left or Enter is pressed, not while typing', async () => {
  r = await open('/shop/10');
  const { ui } = r;
  const { fireEvent } = await rtl();
  await countLine('12 products');
  const from = ui.getByRole('textbox', { name: 'From' });
  const to = ui.getByRole('textbox', { name: 'To' });
  assert.equal(from.getAttribute('placeholder'), '£');
  const hint = document.getElementById(from.getAttribute('aria-describedby'));
  assert.equal(hint.textContent, 'Applies when you leave the box or press Enter');
  const before = asked().length;
  fireEvent.change(from, { target: { value: '20' } });
  assert.equal(asked().length, before);
  assert.ok(!search().has('from'));
  fireEvent.keyDown(from, { key: 'Enter' });
  assert.ok(await countLine('2 products match'));
  assert.equal(search().get('from'), '20');
  assert.equal(lastAsked().get('from'), '20');
  assert.ok(ui.getByRole('button', { name: 'Remove filter From £20.00' }));
  fireEvent.change(to, { target: { value: '20.50' } });
  assert.ok(!search().has('to'));
  fireEvent.blur(to);
  assert.ok(await countLine('1 product matches'));
  assert.equal(search().get('to'), '20.50');
  assert.ok(ui.getByRole('button', { name: 'Remove filter To £20.50' }));
  // Emptied or not a price: the filter goes.
  fireEvent.change(from, { target: { value: '' } });
  fireEvent.blur(from);
  fireEvent.change(to, { target: { value: 'abc' } });
  fireEvent.keyDown(to, { key: 'Enter' });
  assert.ok(await countLine('12 products'));
  assert.ok(!search().has('from') && !search().has('to'));
});

// ---------- 4.6 The phone Filter panel ----------

test('on a phone, the Filter panel’s ticks change nothing until "Show [n] products" is pressed', async () => {
  r = await open('/shop/10', { media: PHONE });
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  await countLine('12 products');
  assert.ok(ui.queryByRole('complementary', { name: 'Filters' }) === null, 'no side panel on a phone');
  const filter = ui.getByRole('button', { name: 'Filter' });
  fireEvent.click(filter);
  const panel = ui.getByRole('dialog', { name: 'Filter' });
  assert.equal(panel.getAttribute('aria-modal'), 'true');
  assert.deepEqual(legends(panel), ['Availability', 'Inner diameter', 'Outer diameter', 'Height', 'Brand', 'Price']);
  assert.ok(within(panel).getByRole('button', { name: 'Show 12 products' }));
  fireEvent.click(within(panel).getByRole('checkbox', { name: /^30 mm/ }));
  assert.ok(await within(panel).findByRole('button', { name: 'Show 3 products' }));
  // The page hasn't changed.
  assert.equal(search().toString(), '');
  assert.ok(ui.getByText('12 products', { selector: '[aria-live="polite"]' }));
  assert.ok(ui.queryByRole('button', { name: /^Remove filter/ }) === null);
  fireEvent.click(within(panel).getByRole('button', { name: 'Show 3 products' }));
  assert.ok(await countLine('3 products match'));
  assert.ok(ui.queryByRole('dialog', { name: 'Filter' }) === null);
  assert.equal(search().toString(), 'inner-diameter=30');
  assert.ok(document.activeElement === ui.getByRole('button', { name: 'Filter' }));
  assert.ok(ui.getByRole('button', { name: 'Remove filter Inner diameter: 30 mm' }));
});

test('on a phone, Close filters and Esc throw the panel’s ticks away and give focus back to Filter', async () => {
  r = await open('/shop/10?inner-diameter=30', { media: PHONE });
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  await countLine('3 products match');
  fireEvent.click(ui.getByRole('button', { name: 'Filter' }));
  let panel = ui.getByRole('dialog', { name: 'Filter' });
  const tick = within(panel).getByRole('checkbox', { name: /^30 mm/ });
  assert.ok(tick.checked, 'the panel starts from what is ticked');
  fireEvent.click(tick);
  fireEvent.click(within(panel).getByRole('button', { name: 'Close filters' }));
  assert.ok(ui.queryByRole('dialog', { name: 'Filter' }) === null);
  assert.ok(document.activeElement === ui.getByRole('button', { name: 'Filter' }));
  assert.equal(search().toString(), 'inner-diameter=30');
  fireEvent.click(ui.getByRole('button', { name: 'Filter' }));
  panel = ui.getByRole('dialog', { name: 'Filter' });
  assert.ok(within(panel).getByRole('checkbox', { name: /^30 mm/ }).checked, 'the thrown-away tick is back');
  fireEvent.click(within(panel).getByRole('button', { name: 'Clear all' }));
  fireEvent.keyDown(panel, { key: 'Escape' });
  assert.ok(ui.queryByRole('dialog', { name: 'Filter' }) === null);
  assert.ok(document.activeElement === ui.getByRole('button', { name: 'Filter' }));
  assert.equal(search().toString(), 'inner-diameter=30');
});

// ---------- Review fixes ----------

test('while a new answer loads, the old one never shows the empty-category words or a wrong count', async () => {
  let hold = null;
  r = await open('/shop/10?ready=1&inner-diameter=30&height=10', { products: (url) => (hold ? hold.answer(url) : productsAnswer(url)) });
  const { ui } = r;
  const { fireEvent } = await rtl();
  assert.ok(await countLine('Nothing matches'));
  const seen = [];
  const watch = new window.MutationObserver(() => { seen.push(main()?.textContent ?? ''); });
  watch.observe(document.body, { subtree: true, childList: true, characterData: true });
  hold = holding((q) => !q.has('d1'));
  fireEvent.click(ui.getByRole('button', { name: 'Clear all filters' }));
  await new Promise((done) => setTimeout(done, 20));
  assert.ok(!main().textContent.includes('hasn’t put any products'), 'no empty-category words while loading');
  hold.release();
  assert.ok(await countLine('12 products'));
  watch.disconnect();
  assert.ok(!seen.some((t) => t.includes('hasn’t put any products')), 'the empty-category words never appeared');

  // Ticking: until the answer comes, the count keeps its last wording.
  hold = holding((q) => q.has('d1'));
  fireEvent.click(ui.getByRole('checkbox', { name: /^30 mm/ }));
  await new Promise((done) => setTimeout(done, 20));
  assert.ok(ui.queryByText('12 products match', { selector: '[aria-live="polite"]' }) === null, 'never the old total as "match"');
  assert.ok(ui.getByText('12 products', { selector: '[aria-live="polite"]' }));
  const more = ui.queryByRole('button', { name: 'Show more' });
  assert.ok(more === null || more.disabled, 'Show more waits for the new answer');
  hold.release();
  assert.ok(await countLine('3 products match'));
});

test('Back to an address ticking a value past the first three opens its group', async () => {
  r = await open('/shop/10');
  const { ui } = r;
  const { act } = await rtl();
  await countLine('12 products');
  await act(() => r.router.navigate('/shop/10?inner-diameter=35'));
  assert.ok(await countLine('3 products match'));
  const box = ui.getByRole('checkbox', { name: /^35 mm/ });
  assert.ok(box.checked);
});

test('a ticked value no product has keeps its unit, and "30.0" in the address ticks 30', async () => {
  r = await open('/shop/10?height=10&inner-diameter=30.0');
  const { ui } = r;
  assert.ok(await countLine('Nothing matches'));
  const box = ui.getByRole('checkbox', { name: /^30 mm/ });
  assert.ok(box.checked);
  assert.ok(box.closest('label').textContent.startsWith('30 mm0'), box.closest('label').textContent);
  assert.deepEqual(lastAsked().getAll('d1'), ['30']);
});

test('a filter change after Show more doesn’t move focus to a product later', async () => {
  let hold = null;
  r = await open('/shop/10', { products: (url) => (hold ? hold.answer(url) : productsAnswer(url)) });
  const { ui } = r;
  const { fireEvent } = await rtl();
  await countLine('12 products');
  hold = holding((q) => q.get('after') === '6');
  fireEvent.click(ui.getByRole('button', { name: 'Show more' }));
  fireEvent.click(ui.getByRole('checkbox', { name: /^30 mm/ }));
  assert.ok(await countLine('3 products match'));
  hold.release();
  await new Promise((done) => setTimeout(done, 20));
  fireEvent.click(ui.getByRole('button', { name: 'Remove filter Inner diameter: 30 mm' }));
  assert.ok(await countLine('12 products'));
  await new Promise((done) => setTimeout(done, 20));
  assert.ok(document.activeElement === ui.getByRole('heading', { level: 1, name: 'Bearings' }), `focus is on ${document.activeElement?.outerHTML.slice(0, 80)}`);
});

test('on a phone, a failed count reads "Show products", and widening the window closes the panel', async () => {
  let fail = false;
  r = await open('/shop/10', { media: PHONE, products: (url) => (fail ? { status: 500, body: { error: '[error]' } } : productsAnswer(url)) });
  const { ui, setMedia } = r;
  const { fireEvent, within, act } = await rtl();
  await countLine('12 products');
  fireEvent.click(ui.getByRole('button', { name: 'Filter' }));
  let panel = ui.getByRole('dialog', { name: 'Filter' });
  fail = true;
  fireEvent.click(within(panel).getByRole('checkbox', { name: /^30 mm/ }));
  assert.ok(await within(panel).findByRole('button', { name: 'Show products' }));
  assert.ok(within(panel).queryByRole('button', { name: /^Show \d+ products?$/ }) === null);
  fail = false;
  fireEvent.click(within(panel).getByRole('checkbox', { name: /^30 mm/ }));
  assert.ok(await within(panel).findByRole('button', { name: 'Show 12 products' }));
  fireEvent.click(within(panel).getByRole('checkbox', { name: /^15 mm/ }));
  act(() => setMedia(() => false));
  assert.ok(ui.queryByRole('dialog', { name: 'Filter' }) === null, 'the panel closes on a wide window');
  assert.equal(search().toString(), '', 'its ticks are thrown away');
  assert.ok(await ui.findByRole('complementary', { name: 'Filters' }));
  act(() => setMedia(PHONE));
  fireEvent.click(ui.getByRole('button', { name: 'Filter' }));
  panel = ui.getByRole('dialog', { name: 'Filter' });
  assert.ok(!within(panel).getByRole('checkbox', { name: /^15 mm/ }).checked);
});

test('a utm_ key in the address is not a detail: no extra ask, nothing ticked, and it stays', async () => {
  r = await open('/shop/10?utm_source=[source]');
  const { ui } = r;
  const { fireEvent } = await rtl();
  assert.ok(await countLine('12 products'));
  assert.equal(asked().length, 1);
  fireEvent.click(ui.getByRole('checkbox', { name: /^30 mm/ }));
  assert.ok(await countLine('3 products match'));
  assert.equal(search().get('utm_source'), '[source]');
});

test('a category page’s cards show their details: one unit once at the end, mixed units each with its own', async () => {
  r = await open('/shop/10');
  const { ui } = r;
  await countLine('12 products');
  const line = (card) => [...card.querySelectorAll('span')].map((x) => x.textContent);
  assert.ok(line(cards()[0]).includes('10 × 22 × 7 mm'), line(cards()[0]).join(' | '));
  await cleanupNow();
  r = await open('/shop/22');
  await countLine('3 products');
  assert.ok(line(cards()[0]).includes('120 mm · 300 g'), line(cards()[0]).join(' | '));
  assert.equal(cards()[1].querySelectorAll('span').length, line(cards()[1]).length);
  assert.ok(!line(cards()[1]).some((t) => / × | · /.test(t)));
  void ui;
});

test('removing a chip moves focus to the next chip, then to the heading; Clear all moves it to the heading', async () => {
  r = await open('/shop/10?ready=1&inner-diameter=30');
  const { ui } = r;
  const { fireEvent } = await rtl();
  assert.ok(await countLine('2 products match'));
  fireEvent.click(ui.getByRole('button', { name: 'Remove filter Ready today at Bolton' }));
  assert.ok(await countLine('3 products match'));
  assert.ok(document.activeElement === ui.getByRole('button', { name: 'Remove filter Inner diameter: 30 mm' }));
  fireEvent.click(ui.getByRole('button', { name: 'Remove filter Inner diameter: 30 mm' }));
  assert.ok(await countLine('12 products'));
  assert.ok(document.activeElement === ui.getByRole('heading', { level: 1, name: 'Bearings' }));
  fireEvent.click(ui.getByRole('checkbox', { name: /^30 mm/ }));
  assert.ok(await countLine('3 products match'));
  fireEvent.click(ui.getByRole('button', { name: 'Clear all' }));
  assert.ok(await countLine('12 products'));
  assert.ok(document.activeElement === ui.getByRole('heading', { level: 1, name: 'Bearings' }));
});

test('on a phone, one result reads "Show 1 product"', async () => {
  r = await open('/shop/10', { media: PHONE });
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  await countLine('12 products');
  fireEvent.click(ui.getByRole('button', { name: 'Filter' }));
  const panel = ui.getByRole('dialog', { name: 'Filter' });
  fireEvent.click(within(panel).getByRole('checkbox', { name: /^30 mm/ }));
  fireEvent.click(within(panel).getByRole('checkbox', { name: /^\[Second brand\]/ }));
  assert.ok(await within(panel).findByRole('button', { name: 'Show 1 product' }));
});
