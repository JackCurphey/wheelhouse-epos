// The customer website's product page and photo viewer (openspec/changes/
// website-browse, tasks 5.1-5.6; wb-product, wb-product-sizes,
// wb-product-size-other, wb-product-held and wb-product-photos in
// browse.mjs). Example data from the drawings: Shimano brake pads B05S-RX at
// £28.00, "[Product with sizes]" in S, M, L, XL and "[Colour 1]", "[Colour 2]",
// "[Bike]", Bolton and "[Second site]". The quantities and the sized
// product's prices are stand-ins for the drawings' "[n]" and "£[price]".
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderWebsite, BASE } from '../helpers/site-screen.js';

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
const href = (el) => el.getAttribute('href');
const CATEGORY = { id: 22, name: '[Category]', path: 'Drivetrain › [Category]' };

const PADS = {
  id: 101, name: 'Shimano brake pads B05S-RX', brand: 'Shimano', description: '[The shop’s description]',
  pricePence: 2800, priceHighPence: null, category: CATEGORY,
  photos: ['/uploads/pads-1.jpg', '/uploads/pads-2.jpg', '/uploads/pads-3.jpg', '/uploads/pads-4.jpg'],
  specifications: [{ name: '[Detail]', value: '[value]', unit: '[unit]' }],
  sizes: [], colours: [], items: [],
  stock: { line: 'ready', shop: 'Bolton', qty: 3 },
};
const SIZES = ['S', 'M', 'L', 'XL'];
const COLOURS = ['[Colour 1]', '[Colour 2]'];
// Every size ready at Bolton but M in [Colour 1], which only [Second site] has.
const SIZED = {
  id: 501, name: '[Product with sizes]', brand: '[Brand]', description: '[The shop’s description]',
  pricePence: 3000, priceHighPence: 4000, category: CATEGORY, photos: ['/uploads/sized.jpg'],
  specifications: [{ name: '[Detail]', value: '[value]', unit: null }],
  sizes: SIZES, colours: COLOURS,
  items: COLOURS.flatMap((colour, c) => SIZES.map((size, s) => ({
    id: 501 + c * 4 + s, size, colour, pricePence: 3000 + 250 * s,
    stock: size === 'M' && c === 0 ? { line: 'elsewhere', shop: 'Bolton', at: '[Second site]' } : { line: 'ready', shop: 'Bolton', qty: 2 },
  }))),
  stock: null,
};
const BIKE = { ...PADS, id: 601, name: '[Bike]', brand: '[Brand]', photos: [], stock: { line: 'sold-out', shop: 'Bolton' } };

const answering = (body) => (url) => {
  const id = new URL(url, 'http://localhost').pathname.split('/').pop();
  return String(body.id) === id ? { status: 200, body } : { status: 404, body: { error: 'We can’t find that page' } };
};
const open = (product, extra = {}) => renderWebsite({ url: `/products/${product.id}`, product: answering(product), cookie: 'wh_shop=1', ...extra });
const productAsks = () => r.requests.map((q) => new URL(q.url, 'http://localhost')).filter((u) => u.pathname.startsWith(`${BASE}/api/site/products/`));
const line = () => r.ui.getByRole('status');

// ---------- 5.1 wb-product ----------

test('a product (wb-product): price, "Includes VAT · Shimano", the stock line, buying, About it and Specifications', async () => {
  r = await open(PADS);
  const { ui } = r;
  const { fireEvent, within, waitFor } = await rtl();
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Shimano brake pads B05S-RX' }));
  assert.equal(productAsks()[0].searchParams.get('shop'), '1');
  assert.equal(document.title, 'Shimano brake pads B05S-RX · North Street Cycles');
  const crumbs = ui.getByRole('navigation', { name: 'You are here' });
  // The step above the category comes from the categories, which may answer after the product.
  await waitFor(() => assert.equal(crumbs.textContent, 'Shop › Drivetrain › [Category] › Shimano brake pads B05S-RX'));
  assert.equal(href(within(crumbs).getByRole('link', { name: '[Category]' })), `${BASE}/shop/22`);
  assert.equal(crumbs.querySelector('[aria-current="page"]').textContent, 'Shimano brake pads B05S-RX');
  assert.ok(ui.getByText('£28.00'));
  assert.ok(ui.getByText('Includes VAT · Shimano'));
  assert.equal(line().textContent, 'Ready today at Bolton · 3 in stock');
  assert.equal(line().querySelector('strong').textContent, 'Ready today at Bolton');
  const qty = ui.getByRole('group', { name: 'Quantity of Shimano brake pads B05S-RX' });
  fireEvent.click(within(qty).getByRole('button', { name: 'One more Shimano brake pads B05S-RX' }));
  assert.equal(qty.querySelector('[aria-live="polite"]').textContent, '2');
  fireEvent.click(within(qty).getByRole('button', { name: 'One fewer Shimano brake pads B05S-RX' }));
  assert.equal(qty.querySelector('[aria-live="polite"]').textContent, '1');
  // Until WP-6.3 the basket path says the shop can't take orders online yet (written line 1).
  assert.equal(href(ui.getByRole('link', { name: 'Add to basket' })), `${BASE}/basket`);
  const ask = ui.getByRole('button', { name: 'Ask the shop about this' });
  assert.ok(ui.queryByRole('region', { name: 'Ask the shop' }) === null);
  fireEvent.click(ask);
  assert.ok(ui.getByRole('region', { name: 'Ask the shop' }).textContent.includes('Bolton: Call [shop phone] or email [shop email]'));
  const about = ui.getByRole('region', { name: 'About it' });
  assert.ok(about.textContent.includes('[The shop’s description]'));
  const specs = ui.getByRole('table', { name: 'Specifications' });
  const rows = [...specs.querySelectorAll('tbody tr')].map((tr) => [tr.querySelector('th').textContent, tr.querySelector('td').textContent]);
  assert.deepEqual(rows, [['[Detail]', '[value] [unit]'], ['Brand', 'Shimano']]);
  assert.ok(ui.queryByText(/in \[?\d*\]? ?days|We order it in/) === null, 'not until WP-6.3 (Jack’s answer 2)');
});

test('a product with no brand still says "Includes VAT", with nothing after it', async () => {
  r = await open({ ...PADS, brand: null });
  const { ui } = r;
  await ui.findByRole('heading', { level: 1, name: 'Shimano brake pads B05S-RX' });
  assert.ok(ui.getByText('Includes VAT'));
  assert.ok(ui.queryByText(/Includes VAT ·/) === null);
});

test('with no shop chosen there is no stock line, and Add to basket stays', async () => {
  r = await renderWebsite({ url: '/products/101', product: answering({ ...PADS, stock: { line: 'none' } }) });
  const { ui } = r;
  await ui.findByRole('heading', { level: 1, name: 'Shimano brake pads B05S-RX' });
  assert.equal(productAsks()[0].searchParams.get('shop'), null);
  assert.ok(ui.queryByRole('status') === null);
  assert.ok(ui.getByRole('link', { name: 'Add to basket' }));
});

// ---------- 5.2 wb-product-sizes ----------

test('a product with sizes (wb-product-sizes): nothing chosen, "Choose a colour and size …", then the stock line once both are chosen', async () => {
  r = await open(SIZED);
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  await ui.findByRole('heading', { level: 1, name: '[Product with sizes]' });
  assert.ok(ui.getByText('£30.00 to £40.00'));
  assert.ok(ui.getByText('Includes VAT · [Brand]'));
  const colour = ui.getByRole('radiogroup', { name: 'Colour' });
  const size = ui.getByRole('radiogroup', { name: 'Size' });
  assert.ok(within(colour).getByText('Colour: choose one'));
  assert.ok(within(size).getByText('Size: choose one'));
  assert.deepEqual(within(colour).getAllByRole('radio').map((b) => b.textContent), COLOURS);
  assert.deepEqual(within(size).getAllByRole('radio').map((b) => b.textContent), SIZES);
  assert.ok(ui.getAllByRole('radio').every((b) => b.getAttribute('aria-checked') === 'false'));
  assert.equal(line().textContent, 'Choose a colour and size to see when it’s ready');
  assert.ok(ui.getByRole('link', { name: 'Add to basket' }));
  // A size alone isn't enough.
  fireEvent.click(within(size).getByRole('radio', { name: 'L' }));
  assert.ok(within(size).getByText('Size: L'));
  assert.equal(line().textContent, 'Choose a colour and size to see when it’s ready');
  fireEvent.click(within(colour).getByRole('radio', { name: '[Colour 2]' }));
  assert.ok(within(colour).getByText('Colour: [Colour 2]'));
  assert.equal(within(colour).getByRole('radio', { name: '[Colour 2]' }).getAttribute('aria-checked'), 'true');
  assert.equal(within(size).getByRole('radio', { name: 'L' }).getAttribute('aria-checked'), 'true');
  assert.equal(line().textContent, 'Ready today at Bolton · 2 in stock');
  // The chosen size's own price.
  assert.ok(ui.getByText('£35.00'));
  const rows = [...ui.getByRole('table', { name: 'Specifications' }).querySelectorAll('tbody tr')].map((tr) => [tr.querySelector('th').textContent, tr.querySelector('td').textContent]);
  assert.deepEqual(rows, [['Sizes', 'S, M, L, XL'], ['Colours', '[Colour 1], [Colour 2]'], ['[Detail]', '[value]'], ['Brand', '[Brand]']]);
});

test('a product with sizes and no shop chosen: the prompt until both are chosen, then no stock line at all', async () => {
  const none = { ...SIZED, items: SIZED.items.filter((i) => !(i.colour === '[Colour 2]' && i.size === 'XL')).map((i) => ({ ...i, stock: { line: 'none' } })) };
  r = await renderWebsite({ url: '/products/501', product: answering(none) });
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  await ui.findByRole('heading', { level: 1, name: '[Product with sizes]' });
  assert.equal(line().textContent, 'Choose a colour and size to see when it’s ready');
  fireEvent.click(ui.getByRole('radio', { name: '[Colour 1]' }));
  assert.equal(line().textContent, 'Choose a colour and size to see when it’s ready');
  const size = ui.getByRole('radiogroup', { name: 'Size' });
  // With no shop, no size is judged out.
  assert.ok(within(size).getAllByRole('radio').every((b) => !b.className.includes('line-through') && !b.textContent.includes('not in stock')));
  fireEvent.click(within(size).getByRole('radio', { name: 'M' }));
  assert.ok(ui.queryByRole('status') === null, 'no prompt and no stock line once both are chosen');
  assert.ok(ui.getByRole('link', { name: 'Add to basket' }));
  // A pair the shop doesn't have, with no shop chosen, is no different.
  fireEvent.click(ui.getByRole('radio', { name: '[Colour 2]' }));
  fireEvent.click(within(size).getByRole('radio', { name: 'XL' }));
  assert.ok(ui.queryByRole('status') === null);
  assert.ok(ui.getByRole('link', { name: 'Add to basket' }));
});

test('a colour and size pair the shop doesn’t have counts as sold out at the chosen shop', async () => {
  const gap = { ...SIZED, items: SIZED.items.filter((i) => !(i.colour === '[Colour 2]' && i.size === 'XL')) };
  r = await open(gap);
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  await ui.findByRole('heading', { level: 1, name: '[Product with sizes]' });
  fireEvent.click(ui.getByRole('radio', { name: '[Colour 2]' }));
  const size = ui.getByRole('radiogroup', { name: 'Size' });
  const xl = within(size).getByRole('radio', { name: 'XL — not in stock at Bolton' });
  assert.ok(xl.className.includes('line-through'));
  fireEvent.click(xl);
  assert.equal(line().textContent, 'Sold out at Bolton');
  assert.ok(ui.queryByRole('link', { name: 'Add to basket' }) === null);
  assert.ok(ui.getByRole('button', { name: 'Ask the shop about this' }));
});

test('the colour and size choosers work as radio groups from the keyboard: one tab stop, arrows move and choose, going round', async () => {
  r = await open(SIZED);
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  await ui.findByRole('heading', { level: 1, name: '[Product with sizes]' });
  const size = ui.getByRole('radiogroup', { name: 'Size' });
  const colour = ui.getByRole('radiogroup', { name: 'Colour' });
  const tabs = (group) => within(group).getAllByRole('radio').map((b) => b.tabIndex);
  const chosen = (group) => within(group).getAllByRole('radio').filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => b.textContent);
  // Nothing chosen: the first is the one tab stop.
  assert.deepEqual(tabs(size), [0, -1, -1, -1]);
  assert.deepEqual(tabs(colour), [0, -1]);
  const radio = (name) => within(size).getByRole('radio', { name });
  fireEvent.keyDown(radio('S'), { key: 'ArrowRight' });
  assert.deepEqual(chosen(size), ['M']);
  assert.ok(document.activeElement === radio('M'));
  assert.deepEqual(tabs(size), [-1, 0, -1, -1]);
  fireEvent.keyDown(radio('M'), { key: 'ArrowDown' });
  assert.deepEqual(chosen(size), ['L']);
  fireEvent.keyDown(radio('L'), { key: 'ArrowUp' });
  assert.deepEqual(chosen(size), ['M']);
  fireEvent.keyDown(radio('M'), { key: 'ArrowLeft' });
  assert.deepEqual(chosen(size), ['S']);
  // Round from the first to the last, and back.
  fireEvent.keyDown(radio('S'), { key: 'ArrowLeft' });
  assert.deepEqual(chosen(size), ['XL']);
  assert.ok(document.activeElement === radio('XL'));
  assert.deepEqual(tabs(size), [-1, -1, -1, 0]);
  fireEvent.keyDown(radio('XL'), { key: 'ArrowRight' });
  assert.deepEqual(chosen(size), ['S']);
  assert.ok(within(size).getByText('Size: S'));
  // The colours the same way.
  fireEvent.keyDown(within(colour).getByRole('radio', { name: '[Colour 1]' }), { key: 'ArrowLeft' });
  assert.deepEqual(chosen(colour), ['[Colour 2]']);
  assert.deepEqual(tabs(colour), [-1, 0]);
  assert.equal(line().textContent, 'Ready today at Bolton · 2 in stock');
});

test('a product with sizes but no colours asks only for a size', async () => {
  const sizesOnly = { ...SIZED, colours: [], items: SIZED.items.slice(0, 4).map((i) => ({ ...i, colour: null })) };
  r = await open(sizesOnly);
  const { ui } = r;
  const { fireEvent } = await rtl();
  await ui.findByRole('heading', { level: 1, name: '[Product with sizes]' });
  assert.ok(ui.queryByRole('radiogroup', { name: 'Colour' }) === null);
  assert.equal(line().textContent, 'Choose a size to see when it’s ready');
  fireEvent.click(ui.getByRole('radio', { name: 'S' }));
  assert.equal(line().textContent, 'Ready today at Bolton · 2 in stock');
});

// ---------- 5.3 wb-product-size-other ----------

test('a size at the other shop (wb-product-size-other): struck, read out " — not in stock at Bolton", and the drawn sentence', async () => {
  r = await open(SIZED);
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  await ui.findByRole('heading', { level: 1, name: '[Product with sizes]' });
  const size = ui.getByRole('radiogroup', { name: 'Size' });
  // Before a colour is chosen no size is out.
  assert.ok(within(size).getAllByRole('radio').every((b) => !b.textContent.includes('not in stock')));
  fireEvent.click(ui.getByRole('radio', { name: '[Colour 1]' }));
  const m = within(size).getByRole('radio', { name: 'M — not in stock at Bolton' });
  assert.ok(m.className.includes('line-through'), 'struck through while not chosen');
  const s = within(size).getByRole('radio', { name: 'S' });
  assert.ok(!s.className.includes('line-through'));
  fireEvent.click(m);
  assert.equal(m.getAttribute('aria-checked'), 'true');
  assert.ok(!m.className.includes('line-through'), 'once chosen it carries the thick border, not the strike (drawing)');
  assert.ok(within(size).getByText('Size: M'));
  assert.equal(document.getElementById(m.getAttribute('aria-describedby')).textContent, 'M isn’t in stock at Bolton in [Colour 1].');
  assert.equal(line().textContent, 'M isn’t in stock at Bolton in [Colour 1] — it’s in stock at our [Second site] shop');
  assert.equal(line().querySelector('strong').textContent, 'M isn’t in stock at Bolton');
  assert.equal(href(ui.getByRole('link', { name: 'Collect from [Second site] instead' })), `${BASE}/shops/2`);
  assert.ok(ui.queryByRole('link', { name: 'Add to basket' }) === null);
  assert.ok(ui.queryByRole('group', { name: /^Quantity of/ }) === null);
  assert.ok(ui.getByRole('button', { name: 'Ask the shop about this' }));
  // Another colour: M is in stock again.
  fireEvent.click(ui.getByRole('radio', { name: '[Colour 2]' }));
  assert.ok(within(size).getByRole('radio', { name: 'M' }));
  assert.equal(line().textContent, 'Ready today at Bolton · 2 in stock');
});

// ---------- 5.4 wb-product-held ----------

test('sold out at the chosen shop (wb-product-held): "Sold out at Bolton", no Add to basket, Ask the shop', async () => {
  r = await open(BIKE);
  const { ui } = r;
  await ui.findByRole('heading', { level: 1, name: '[Bike]' });
  assert.equal(line().textContent, 'Sold out at Bolton');
  assert.equal(line().querySelector('strong').textContent, 'Sold out at Bolton');
  assert.ok(ui.queryByRole('link', { name: 'Add to basket' }) === null);
  assert.ok(ui.getByRole('button', { name: 'Ask the shop about this' }));
});

// ---------- 5.5 wb-product-photos ----------

test('the photo viewer (wb-product-photos): "Photo 2 of 4", the arrows, and Esc returning focus to the photo pressed', async () => {
  r = await open(PADS);
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  await ui.findByRole('heading', { level: 1, name: 'Shimano brake pads B05S-RX' });
  const thumbs = ui.getByRole('group', { name: 'Photos' });
  const buttons = within(thumbs).getAllByRole('button');
  assert.deepEqual(buttons.map((b) => b.getAttribute('aria-label')), [1, 2, 3, 4].map((n) => `Show photo ${n} of 4`));
  assert.equal(buttons[0].getAttribute('aria-current'), 'true');
  const big = ui.getByRole('button', { name: 'Open larger photo 1 of 4' });
  assert.equal(big.querySelector('img').getAttribute('alt'), 'Photo 1 of 4 — Shimano brake pads B05S-RX');
  fireEvent.click(buttons[1]);
  assert.equal(buttons[1].getAttribute('aria-current'), 'true');
  assert.ok(buttons[0].getAttribute('aria-current') === null);
  assert.equal(big.getAttribute('aria-label'), 'Open larger photo 2 of 4');
  assert.equal(big.querySelector('img').getAttribute('src'), '/uploads/pads-2.jpg');

  fireEvent.click(big);
  const viewer = ui.getByRole('dialog', { name: 'Photo 2 of 4' });
  assert.equal(viewer.querySelector('img').getAttribute('alt'), 'Photo 2 of 4 — Shimano brake pads B05S-RX');
  assert.ok(within(viewer).getByText('Left and right arrows change photo · Esc closes'));
  assert.ok(within(viewer).getByRole('button', { name: 'Close photos' }));
  fireEvent.keyDown(viewer, { key: 'ArrowRight' });
  assert.ok(ui.getByRole('dialog', { name: 'Photo 3 of 4' }));
  assert.equal(viewer.querySelector('img').getAttribute('src'), '/uploads/pads-3.jpg');
  fireEvent.click(within(viewer).getByRole('button', { name: 'Next photo' }));
  assert.ok(ui.getByRole('dialog', { name: 'Photo 4 of 4' }));
  fireEvent.keyDown(viewer, { key: 'ArrowLeft' });
  fireEvent.click(within(viewer).getByRole('button', { name: 'Previous photo' }));
  assert.ok(ui.getByRole('dialog', { name: 'Photo 2 of 4' }));
  fireEvent.keyDown(viewer, { key: 'Escape' });
  assert.ok(ui.queryByRole('dialog') === null);
  assert.ok(document.activeElement === big, 'focus is back on the photo that opened it');

  // Close photos does the same.
  fireEvent.click(big);
  fireEvent.click(within(ui.getByRole('dialog')).getByRole('button', { name: 'Close photos' }));
  assert.ok(ui.queryByRole('dialog') === null);
  assert.ok(document.activeElement === big);
});

test('the photo viewer goes round from the last photo to the first and back, by keys and by buttons', async () => {
  r = await open(PADS);
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  await ui.findByRole('heading', { level: 1, name: 'Shimano brake pads B05S-RX' });
  const buttons = within(ui.getByRole('group', { name: 'Photos' })).getAllByRole('button');
  fireEvent.click(buttons[3]);
  fireEvent.click(ui.getByRole('button', { name: 'Open larger photo 4 of 4' }));
  const viewer = ui.getByRole('dialog', { name: 'Photo 4 of 4' });
  fireEvent.keyDown(viewer, { key: 'ArrowRight' });
  assert.ok(ui.getByRole('dialog', { name: 'Photo 1 of 4' }));
  assert.equal(viewer.querySelector('img').getAttribute('src'), '/uploads/pads-1.jpg');
  fireEvent.keyDown(viewer, { key: 'ArrowLeft' });
  assert.ok(ui.getByRole('dialog', { name: 'Photo 4 of 4' }));
  assert.equal(viewer.querySelector('img').getAttribute('src'), '/uploads/pads-4.jpg');
  fireEvent.click(within(viewer).getByRole('button', { name: 'Next photo' }));
  assert.ok(ui.getByRole('dialog', { name: 'Photo 1 of 4' }));
  fireEvent.click(within(viewer).getByRole('button', { name: 'Previous photo' }));
  assert.ok(ui.getByRole('dialog', { name: 'Photo 4 of 4' }));
});

test('closing the viewer after moving leaves the larger photo on the one last seen, with focus on it', async () => {
  r = await open(PADS);
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  await ui.findByRole('heading', { level: 1, name: 'Shimano brake pads B05S-RX' });
  const buttons = within(ui.getByRole('group', { name: 'Photos' })).getAllByRole('button');
  fireEvent.click(buttons[1]);
  const big = ui.getByRole('button', { name: 'Open larger photo 2 of 4' });
  fireEvent.click(big);
  fireEvent.keyDown(ui.getByRole('dialog'), { key: 'ArrowRight' });
  fireEvent.keyDown(ui.getByRole('dialog'), { key: 'ArrowRight' });
  assert.ok(ui.getByRole('dialog', { name: 'Photo 4 of 4' }));
  fireEvent.keyDown(ui.getByRole('dialog'), { key: 'Escape' });
  assert.ok(ui.queryByRole('dialog') === null);
  assert.equal(big.getAttribute('aria-label'), 'Open larger photo 4 of 4');
  assert.equal(big.querySelector('img').getAttribute('src'), '/uploads/pads-4.jpg');
  assert.deepEqual(buttons.map((b) => b.getAttribute('aria-current')), [null, null, null, 'true']);
  assert.ok(document.activeElement === big);
  // Close photos does the same, and it opens again where it was left.
  fireEvent.click(big);
  fireEvent.click(within(ui.getByRole('dialog', { name: 'Photo 4 of 4' })).getByRole('button', { name: 'Previous photo' }));
  fireEvent.click(within(ui.getByRole('dialog')).getByRole('button', { name: 'Close photos' }));
  assert.equal(big.getAttribute('aria-label'), 'Open larger photo 3 of 4');
  assert.deepEqual(buttons.map((b) => b.getAttribute('aria-current')), [null, null, 'true', null]);
  assert.ok(document.activeElement === big);
});

test('one photo shows without the viewer; no photo shows the name in a tile', async () => {
  r = await open({ ...PADS, photos: ['/uploads/pads-1.jpg'] });
  const { ui } = r;
  await ui.findByRole('heading', { level: 1, name: 'Shimano brake pads B05S-RX' });
  assert.equal(ui.getByRole('img', { name: 'Photo of Shimano brake pads B05S-RX' }).getAttribute('src'), '/uploads/pads-1.jpg');
  assert.ok(ui.queryByRole('button', { name: /^Open larger photo/ }) === null);
  assert.ok(ui.queryByRole('group', { name: 'Photos' }) === null);
  const { cleanup } = await rtl();
  cleanup();
  r.client.clear();
  r.uninstall();

  r = await open(BIKE);
  await r.ui.findByRole('heading', { level: 1, name: '[Bike]' });
  const main = document.getElementById('main-content');
  assert.ok(main.querySelector('img') === null);
  const tile = main.querySelector('[aria-hidden="true"][data-name-tile]');
  assert.ok(tile !== null);
  assert.equal(tile.textContent, '[Bike]');
});

// ---------- 5.6 Not online ----------

test('a product that isn’t online opens "We can’t find that page" (wb-not-found)', async () => {
  r = await renderWebsite({ url: '/products/999', product: answering(PADS), cookie: 'wh_shop=1' });
  assert.ok(await r.ui.findByRole('heading', { level: 1, name: 'We can’t find that page' }));
});

test('an address that isn’t a product number opens "We can’t find that page" without asking', async () => {
  r = await renderWebsite({ url: '/products/abc', product: answering(PADS) });
  assert.ok(await r.ui.findByRole('heading', { level: 1, name: 'We can’t find that page' }));
  assert.equal(productAsks().length, 0);
});
