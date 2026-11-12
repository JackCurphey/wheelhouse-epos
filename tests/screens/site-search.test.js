// The customer website's search (openspec/changes/website-browse, tasks
// 6.1-6.3; wb-search-typing, wb-search-no-suggestions, wb-search-results,
// wb-search-measure and wb-search-none in browse.mjs): the shell's search box
// suggesting as the customer types, after a 250 ms wait, as a WAI-ARIA
// combobox with a listbox inside role="search"; and the results page. Example
// data from the drawings: North Street Cycles, Bolton, "[Second site]",
// Shimano brake pads B05S-RX at £28.00, Brake service, Collection and returns,
// Bearings with an inner diameter of 30 mm, "[Product]", "[Category]",
// "[Bearing]". The prices and counts of the placeholders are stand-ins for the
// drawings' "£[price]" and "[n]", there only so the answers differ.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderWebsite, CATEGORIES, BASE, PHONE } from '../helpers/site-screen.js';

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

const rtl = () => import('@testing-library/react');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const href = (el) => el.getAttribute('href');
const main = () => document.getElementById('main-content');
const asks = (path) => r.requests.map((q) => new URL(q.url, 'http://localhost')).filter((u) => u.pathname === `${BASE}/api/site/${path}`);
const where = () => `${r.router.state.location.pathname}${r.router.state.location.search}`;
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

// A category matching "brake", so the Categories group has one ("[Category]" and "[n] products").
const TREE = [...CATEGORIES, { id: 30, name: '[Category]', parentId: null, path: '[Category]', products: 5 }, { id: 31, name: '[Another category]', parentId: null, path: '[Another category]', products: 4 }];

// ---------- A pretend /api/site/suggest, answering as the server does ----------

const READY = { line: 'ready', shop: 'Bolton' };
const BRAKE_SUGGESTIONS = {
  products: [
    { id: 101, name: 'Shimano brake pads', code: 'B05S-RX', pricePence: 2800, stock: READY },
    { id: 102, name: '[Product]', code: null, pricePence: 1000, stock: READY },
  ],
  repairs: [{ id: 1, name: 'Brake service', pricePence: null }],
  categories: [{ id: 30, name: '[Category]', path: '[Category]' }],
  pages: [{ key: 'collection-returns', name: 'Collection and returns' }],
};
const NONE = { products: [], repairs: [], categories: [], pages: [] };
// "br" finds something else, so a late answer for it would show.
const BR_SUGGESTIONS = { ...NONE, products: [{ id: 109, name: '[An older answer]', code: null, pricePence: 500, stock: READY }] };

function suggestAnswer(url) {
  const q = new URL(url, 'http://localhost').searchParams.get('q');
  return { status: 200, body: q === 'brake' ? BRAKE_SUGGESTIONS : q === 'br' ? BR_SUGGESTIONS : NONE };
}

// ---------- A pretend /api/site/search ----------

const card = (id, name, pricePence, stock, details = []) => ({ id, name, brand: '[Brand]', photo: null, pricePence, priceHighPence: null, details, stock });
const INNER = { id: 1, name: 'Inner diameter', kind: 'number', unit: 'mm' };

function searchAnswer(url) {
  const p = new URL(url, 'http://localhost').searchParams;
  const q = p.get('q');
  const shop = p.get('shop') === '1' ? { id: 1, name: 'Bolton' } : null;
  const stock = (ready) => (shop ? { line: ready ? 'ready' : 'sold-out', shop: 'Bolton' } : { line: 'none' });
  const page = (products, filters, extra = {}) => ({
    status: 200,
    body: { products, total: products.length, after: null, filters: { details: [], brands: [], price: null, ready: shop ? { shop: 'Bolton', count: products.length } : null, categories: [], ...filters }, shop, repairs: [], pages: [], measure: null, ...extra },
  });
  if (q === 'brake' && !p.get('category')) {
    const products = [card(101, 'Shimano brake pads B05S-RX', 2800, stock(true)), card(102, '[Product]', 1000, stock(true)), card(103, '[Product]', 1200, stock(false))];
    return page(p.get('ready') === '1' ? products.slice(0, 2) : products, {
      brands: [{ value: '[Brand]', count: 3 }],
      price: { lowPence: 1000, highPence: 2800 },
      ready: shop ? { shop: 'Bolton', count: 2 } : null,
      categories: [{ id: 30, name: '[Category]', count: 2 }, { id: 31, name: '[Another category]', count: 1 }],
    }, { repairs: [{ id: 1, name: 'Brake service', pricePence: null }], pages: [{ key: 'collection-returns', name: 'Collection and returns' }] });
  }
  if (q === 'brake' && p.get('category') === '30') {
    return page([card(101, 'Shimano brake pads B05S-RX', 2800, stock(true)), card(102, '[Product]', 1000, stock(true))], {
      details: [{ id: 7, name: '[Detail]', kind: 'text', unit: null, values: [{ value: '[value]', count: 2 }] }],
      brands: [{ value: '[Brand]', count: 2 }],
      categories: [{ id: 30, name: '[Category]', count: 2 }, { id: 31, name: '[Another category]', count: 1 }],
    }, { repairs: [{ id: 1, name: 'Brake service', pricePence: null }] });
  }
  if (q === 'bearing 30mm') {
    const ticked = p.getAll('d1');
    const values = ticked.length ? ticked.map(Number) : [30];
    const bearings = [card(201, '[Bearing]', 1000, stock(true)), card(202, '[Bearing]', 1100, stock(false)), card(203, '[Bearing]', 1200, stock(true))];
    return page(values.includes(30) ? bearings : bearings.slice(0, 1), {
      details: [{ ...INNER, values: [{ value: 25, count: 2 }, { value: 30, count: 3 }] }],
      brands: [{ value: '[Brand]', count: 3 }],
      categories: [{ id: 10, name: 'Bearings', count: 3 }],
    }, { measure: { category: { id: 10, name: 'Bearings' }, detail: { id: 1, name: 'Inner diameter', unit: 'mm' }, value: 30 } });
  }
  if (q === 'bearing') {
    return page([card(201, '[Bearing]', 1000, stock(true))], { details: [{ ...INNER, values: [{ value: 25, count: 2 }, { value: 30, count: 3 }] }], categories: [{ id: 10, name: 'Bearings', count: 1 }] });
  }
  return page([], {});
}

const open = (url, extra = {}) => renderWebsite({ url, categories: TREE, suggest: suggestAnswer, search: searchAnswer, cookie: 'wh_shop=1', ...extra });

/** Types `text` a letter at a time, as fast as the events go. */
async function typeFast(input, text) {
  const { fireEvent } = await rtl();
  for (let i = 1; i <= text.length; i += 1) fireEvent.change(input, { target: { value: text.slice(0, i) } });
}

// ---------- 6.1 wb-search-typing ----------

test('typing "brake" asks once, 250 ms after the last letter, and lists Products, Repairs, Categories and Pages (wb-search-typing)', async () => {
  r = await open('/');
  const { ui } = r;
  const { within, waitFor } = await rtl();
  const box = await ui.findByRole('combobox', { name: 'Search the shop' });
  assert.equal(box.getAttribute('type'), 'search');
  assert.equal(box.getAttribute('aria-autocomplete'), 'list');
  assert.equal(box.getAttribute('aria-expanded'), 'false');
  assert.ok(box.closest('[role="search"]') !== null);

  await typeFast(box, 'brake');
  await wait(150);
  assert.equal(asks('suggest').length, 0, 'nothing is asked before the wait is over');
  const list = await ui.findByRole('listbox', { name: 'Suggestions' });
  // One ask for all five letters, for what was typed last, for the chosen shop.
  await wait(300);
  assert.equal(asks('suggest').length, 1);
  assert.equal(asks('suggest')[0].searchParams.get('q'), 'brake');
  assert.equal(asks('suggest')[0].searchParams.get('shop'), '1');

  // The listbox sits inside the search area, named by the box.
  assert.ok(list.closest('[role="search"]') === box.closest('[role="search"]'));
  assert.equal(box.getAttribute('aria-expanded'), 'true');
  assert.equal(box.getAttribute('aria-controls'), list.id);
  assert.ok(!box.hasAttribute('aria-activedescendant'), 'nothing is picked until an arrow key is pressed');

  const groups = within(list).getAllByRole('group');
  assert.deepEqual(groups.map((g) => g.getAttribute('aria-label')), ['Products', 'Repairs', 'Categories', 'Pages']);
  const options = within(list).getAllByRole('option');
  assert.equal(options.length, 6);
  assert.ok(options.every((o) => o.getAttribute('aria-selected') === 'false'));
  // Products: name and part code, the stock line, the price.
  assert.ok(options[0].textContent.includes('Shimano brake pads B05S-RX'));
  assert.ok(options[0].textContent.includes('Ready today at Bolton'));
  assert.ok(options[0].textContent.includes('£28.00'));
  assert.equal(href(options[0]), `${BASE}/products/101`);
  assert.ok(options[1].textContent.includes('[Product]'));
  // Repairs: the service and "Book a repair", leading to the booking for the chosen shop.
  assert.ok(within(groups[1]).getByText('Brake service'));
  assert.ok(within(groups[1]).getByText('Book a repair'));
  assert.equal(href(options[2]), '/book/north?site=1');
  // Categories: the name and its count from the tree.
  assert.ok(within(groups[2]).getByText('[Category]'));
  assert.ok(within(groups[2]).getByText('5 products'));
  assert.equal(href(options[3]), `${BASE}/shop/30`);
  // Pages: the page's name and "Page".
  assert.ok(within(groups[3]).getByText('Collection and returns'));
  assert.ok(within(groups[3]).getByText('Page'));
  assert.equal(href(options[4]), `${BASE}/collection-returns`);
  // Last, outside the groups: See all results.
  assert.equal(options[5].textContent, 'See all results for “brake”');
  assert.equal(href(options[5]), `${BASE}/search?q=brake`);
  assert.ok(options[5].closest('[role="group"]') === null);
  // Screen readers hear how many there are.
  await waitFor(() => assert.ok(list.querySelector('[aria-live="polite"]')?.textContent === '6 suggestions'));
});

test('the arrow keys move through the suggestions, Enter opens the one picked, Escape closes the list', async () => {
  r = await open('/');
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  const box = await ui.findByRole('combobox', { name: 'Search the shop' });
  box.focus();
  await typeFast(box, 'brake');
  const list = await ui.findByRole('listbox', { name: 'Suggestions' });
  const options = within(list).getAllByRole('option');
  const picked = () => box.getAttribute('aria-activedescendant');

  fireEvent.keyDown(box, { key: 'ArrowDown' });
  assert.equal(picked(), options[0].id);
  assert.ok(options[0].id !== '');
  assert.equal(options[0].getAttribute('aria-selected'), 'true');
  fireEvent.keyDown(box, { key: 'ArrowDown' });
  assert.equal(picked(), options[1].id);
  assert.equal(options[0].getAttribute('aria-selected'), 'false');
  assert.equal(options[1].getAttribute('aria-selected'), 'true');
  fireEvent.keyDown(box, { key: 'ArrowUp' });
  assert.equal(picked(), options[0].id);
  // Round the ends: up from the first is See all results, down from it the first.
  fireEvent.keyDown(box, { key: 'ArrowUp' });
  assert.equal(picked(), options[5].id);
  fireEvent.keyDown(box, { key: 'ArrowDown' });
  assert.equal(picked(), options[0].id);
  // Focus stays in the box all along.
  assert.ok(document.activeElement === box);

  // Escape closes the list and keeps the words.
  fireEvent.keyDown(box, { key: 'Escape' });
  assert.ok(ui.queryByRole('listbox') === null);
  assert.equal(box.getAttribute('aria-expanded'), 'false');
  assert.ok(!box.hasAttribute('aria-activedescendant'));
  assert.equal(box.value, 'brake');
  assert.ok(document.activeElement === box);

  // Down opens it again; Enter on a picked suggestion opens it.
  fireEvent.keyDown(box, { key: 'ArrowDown' });
  const again = await ui.findByRole('listbox', { name: 'Suggestions' });
  assert.equal(picked(), within(again).getAllByRole('option')[0].id);
  fireEvent.keyDown(box, { key: 'Enter' });
  assert.equal(where(), '/store/north/products/101');
  assert.ok(ui.queryByRole('listbox') === null);
});

test('Enter with nothing picked goes to the results for what was typed', async () => {
  r = await open('/');
  const { ui } = r;
  const { fireEvent } = await rtl();
  const box = await ui.findByRole('combobox', { name: 'Search the shop' });
  await typeFast(box, 'brake');
  await ui.findByRole('listbox', { name: 'Suggestions' });
  fireEvent.keyDown(box, { key: 'Enter' });
  assert.equal(where(), '/store/north/search?q=brake');
  assert.ok(ui.queryByRole('listbox') === null);
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Results for “brake”' }));
  // The results keep the words in the box (audit M9).
  assert.equal(ui.getByRole('combobox', { name: 'Search the shop' }).value, 'brake');
});

test('one letter asks nothing; suggestions start from the second', async () => {
  r = await open('/');
  const { ui } = r;
  const box = await ui.findByRole('combobox', { name: 'Search the shop' });
  await typeFast(box, 'b');
  await wait(400);
  assert.equal(asks('suggest').length, 0);
  assert.ok(ui.queryByRole('listbox') === null);
  assert.equal(box.getAttribute('aria-expanded'), 'false');
});

test('a late answer for older words never replaces the answer for newer ones', async () => {
  const late = deferred();
  r = await open('/', {
    suggest: async (url) => {
      if (new URL(url, 'http://localhost').searchParams.get('q') === 'br') await late.promise;
      return suggestAnswer(url);
    },
  });
  const { ui } = r;
  const { fireEvent, within, waitFor } = await rtl();
  const box = await ui.findByRole('combobox', { name: 'Search the shop' });
  await typeFast(box, 'br');
  await waitFor(() => assert.equal(asks('suggest').length, 1));
  fireEvent.change(box, { target: { value: 'brake' } });
  const list = await ui.findByRole('listbox', { name: 'Suggestions' });
  await waitFor(() => assert.ok(within(list).queryByText('Shimano brake pads') !== null));
  // Now the answer for "br" arrives.
  late.resolve();
  await wait(50);
  assert.ok(ui.queryByText('[An older answer]') === null);
  assert.ok(within(ui.getByRole('listbox', { name: 'Suggestions' })).getByText('Shimano brake pads'));
  assert.equal(asks('suggest').length, 2);
});

test('leaving the search closes the list', async () => {
  r = await open('/');
  const { ui } = r;
  const { fireEvent } = await rtl();
  const box = await ui.findByRole('combobox', { name: 'Search the shop' });
  box.focus();
  await typeFast(box, 'brake');
  await ui.findByRole('listbox', { name: 'Suggestions' });
  const outside = ui.getByRole('link', { name: 'Your account' });
  fireEvent.blur(box, { relatedTarget: outside });
  assert.ok(ui.queryByRole('listbox') === null);
  assert.equal(box.getAttribute('aria-expanded'), 'false');
});

test('on a phone, Search the shop opens a search across the top; Cancel closes it and gives focus back', async () => {
  r = await open('/', { media: PHONE });
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  const button = await ui.findByRole('button', { name: 'Search the shop' });
  assert.ok(ui.queryByRole('combobox', { name: 'Search the shop' }) === null);
  fireEvent.click(button);
  const box = ui.getByRole('combobox', { name: 'Search the shop' });
  assert.ok(document.activeElement === box);
  const area = box.closest('[role="search"]');
  assert.ok(area !== null);
  await typeFast(box, 'brake');
  const list = await ui.findByRole('listbox', { name: 'Suggestions' });
  assert.ok(area.contains(list));
  assert.equal(within(list).getAllByRole('option').length, 6);
  fireEvent.click(within(area).getByRole('button', { name: 'Cancel' }));
  assert.ok(ui.queryByRole('combobox', { name: 'Search the shop' }) === null);
  assert.ok(document.activeElement === button);
});

test('on a phone, Enter goes to the results and the search across the top closes', async () => {
  r = await open('/', { media: PHONE });
  const { ui } = r;
  const { fireEvent } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: 'Search the shop' }));
  const box = ui.getByRole('combobox', { name: 'Search the shop' });
  await typeFast(box, 'brake');
  fireEvent.keyDown(box, { key: 'Enter' });
  assert.equal(where(), '/store/north/search?q=brake');
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Results for “brake”' }));
  assert.ok(ui.queryByRole('combobox', { name: 'Search the shop' }) === null);
});

// ---------- 6.2 wb-search-no-suggestions ----------

test('nothing matches (wb-search-no-suggestions): "No suggestions for …", heard as "No suggestions"; Enter still searches', async () => {
  r = await open('/');
  const { ui } = r;
  const { fireEvent, within, waitFor } = await rtl();
  const box = await ui.findByRole('combobox', { name: 'Search the shop' });
  await typeFast(box, 'zzq');
  const list = await ui.findByRole('listbox', { name: 'Suggestions' });
  await waitFor(() => assert.ok(within(list).queryByText('No suggestions for “zzq” — press Enter to search.') !== null));
  assert.equal(within(list).queryAllByRole('option').length, 0);
  assert.equal(list.querySelector('[aria-live="polite"]').textContent, 'No suggestions');
  fireEvent.keyDown(box, { key: 'ArrowDown' });
  assert.ok(!box.hasAttribute('aria-activedescendant'));
  fireEvent.keyDown(box, { key: 'Enter' });
  assert.equal(where(), '/store/north/search?q=zzq');
});

// ---------- 6.3 wb-search-results, wb-search-measure, wb-search-none ----------

test('the results (wb-search-results): "Results for “brake”", Repairs for “brake”, and the products by Best match', async () => {
  r = await open('/search?q=brake');
  const { ui } = r;
  const { within } = await rtl();
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Results for “brake”' }));
  assert.equal(document.title, 'Results for “brake” · North Street Cycles');
  assert.ok(await ui.findByText('3 products', { selector: '[aria-live="polite"]' }));
  // Best match is first and chosen; nothing asks for another sort.
  const sort = ui.getByRole('combobox', { name: 'Sort by' });
  assert.deepEqual([...sort.options].map((o) => o.textContent), ['Best match', 'A to Z', 'Price, low to high', 'Price, high to low', 'Newest']);
  assert.equal(sort.options[sort.selectedIndex].textContent, 'Best match');
  const asked = asks('search').at(-1).searchParams;
  assert.equal(asked.get('q'), 'brake');
  assert.equal(asked.get('shop'), '1');
  assert.ok(!asked.has('sort'));

  // The repairs and pages that match, above the products.
  const strip = ui.getByText('Repairs for “brake”').parentElement;
  const repair = within(strip).getByRole('link', { name: /Brake service/ });
  assert.equal(href(repair), '/book/north?site=1');
  const page = within(strip).getByRole('link', { name: 'Page: Collection and returns' });
  assert.equal(href(page), `${BASE}/collection-returns`);

  // The products in the server's Best match order.
  const cards = [...main().querySelectorAll('a[href*="/products/"]')];
  assert.equal(cards.length, 3);
  assert.ok(cards[0].textContent.includes('Shimano brake pads B05S-RX'));
  assert.ok(cards[0].textContent.includes('£28.00'));
  assert.ok(cards[2].textContent.includes('Sold out at Bolton'));
  assert.ok(strip.compareDocumentPosition(cards[0]) & 4, 'the repairs come before the products');

  // The filters as drawn: Availability, Category, Price.
  const filters = ui.getByRole('complementary', { name: 'Filters' });
  assert.deepEqual([...filters.querySelectorAll('fieldset > legend')].map((l) => l.textContent), ['Availability', 'Category', 'Price']);
  assert.ok(within(filters).getByRole('checkbox', { name: /\[Category\]/ }));
  assert.ok(within(filters).getByRole('checkbox', { name: /\[Another category\]/ }));
});

test('choosing a sort keeps it in the address; Best match takes it out again', async () => {
  r = await open('/search?q=brake');
  const { ui } = r;
  const { fireEvent, waitFor } = await rtl();
  await ui.findByRole('heading', { level: 1, name: 'Results for “brake”' });
  const sort = ui.getByRole('combobox', { name: 'Sort by' });
  fireEvent.change(sort, { target: { value: 'az' } });
  assert.equal(where(), '/store/north/search?q=brake&sort=az');
  await waitFor(() => assert.equal(asks('search').at(-1).searchParams.get('sort'), 'az'));
  fireEvent.change(sort, { target: { value: 'best' } });
  assert.equal(where(), '/store/north/search?q=brake');
});

test('ticking a category narrows to it: its chip, its own filters, and Brand', async () => {
  r = await open('/search?q=brake');
  const { ui } = r;
  const { fireEvent, within, waitFor } = await rtl();
  await ui.findByRole('heading', { level: 1, name: 'Results for “brake”' });
  fireEvent.click(within(ui.getByRole('complementary', { name: 'Filters' })).getByRole('checkbox', { name: /^\[Category\]/ }));
  assert.equal(where(), '/store/north/search?q=brake&category=30');
  const chip = await ui.findByRole('button', { name: 'Remove filter Category: [Category]' });
  await waitFor(() => assert.equal(asks('search').at(-1).searchParams.get('category'), '30'));
  const filters = ui.getByRole('complementary', { name: 'Filters' });
  await waitFor(() => assert.deepEqual([...filters.querySelectorAll('fieldset > legend')].map((l) => l.textContent), ['Availability', '[Detail]', 'Brand', 'Price']));
  fireEvent.click(chip);
  assert.equal(where(), '/store/north/search?q=brake');
});

test('a measurement search (wb-search-measure): the category with the measurement ticked, and removable', async () => {
  r = await open(`/search?q=${encodeURIComponent('bearing 30mm')}`);
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Results for “bearing 30mm”' }));
  assert.ok(await ui.findByText('Bearings with an inner diameter of 30 mm · 3 products', { selector: '[aria-live="polite"]' }));
  assert.ok(ui.getByRole('button', { name: 'Remove filter Category: Bearings' }));
  const chip = ui.getByRole('button', { name: 'Remove filter Inner diameter: 30 mm' });
  const filters = ui.getByRole('complementary', { name: 'Filters' });
  assert.equal(within(filters).getByRole('checkbox', { name: /^30 mm/ }).checked, true);
  assert.equal(within(filters).getByRole('checkbox', { name: /^25 mm/ }).checked, false);
  assert.ok(ui.queryByText(/^Repairs for/) === null, 'no repairs, no repairs line');
  // Removing the measurement searches the other words inside the category.
  fireEvent.click(chip);
  assert.equal(where(), '/store/north/search?q=bearing&category=10');
});

test('removing the measurement’s category searches the other words everywhere', async () => {
  r = await open(`/search?q=${encodeURIComponent('bearing 30mm')}`);
  const { ui } = r;
  const { fireEvent } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: 'Remove filter Category: Bearings' }));
  assert.equal(where(), '/store/north/search?q=bearing');
});

test('no results (wb-search-none): the words, what to try, Book a repair, and Ask the shop open', async () => {
  r = await open('/search?q=zzq');
  const { ui } = r;
  const { within } = await rtl();
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'No results for “zzq”' }));
  assert.ok(ui.getByText('Check the spelling, try a shorter word, or look through the categories.'));
  assert.equal(href(within(main()).getByRole('link', { name: 'Book a repair' })), '/book/north?site=1');
  const ask = ui.getByRole('region', { name: 'Ask the shop' });
  assert.ok(ask.textContent.includes('Bolton: Call [shop phone] or email [shop email]'));
  assert.equal(href(within(ask).getByRole('link', { name: '[shop phone]' })), 'tel:[shopphone]');
  // Shop by category, as the home page has it.
  assert.ok(ui.getByRole('heading', { level: 2, name: 'Shop by category' }));
  assert.ok(ui.queryByRole('combobox', { name: 'Sort by' }) === null);
  assert.equal(ui.getByRole('combobox', { name: 'Search the shop' }).value, 'zzq');
});

test('on a phone, the results’ Filter panel asks the search for its count and applies on Show [n] products', async () => {
  r = await open('/search?q=brake', { media: PHONE });
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  await ui.findByRole('heading', { level: 1, name: 'Results for “brake”' });
  fireEvent.click(ui.getByRole('button', { name: 'Filter' }));
  const panel = ui.getByRole('dialog', { name: 'Filter' });
  fireEvent.click(within(panel).getByRole('checkbox', { name: /Ready today at Bolton/ }));
  assert.equal(where(), '/store/north/search?q=brake', 'nothing changes until Show is pressed');
  const show = await within(panel).findByRole('button', { name: 'Show 2 products' });
  assert.equal(asks('search').at(-1).searchParams.get('ready'), '1');
  fireEvent.click(show);
  assert.equal(where(), '/store/north/search?q=brake&ready=1');
});
