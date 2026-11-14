// The website's Add to basket and basket screens (openspec/changes/
// website-buy-online, tasks 11.1-11.5; on-product, on-product-added,
// on-product-out, on-product-out-other, on-product-no-shop, on-choose-shop,
// on-product-off, on-basket, on-basket-changed and on-basket-empty in
// online.mjs). Example data from the drawings: Shimano brake pads B05S-RX at
// £28.00, "[Product]", Bolton and "[Second site]". Stock counts and
// "[Product]"'s price are stand-ins for the drawings' "[n]" and "[£ price]".
//
// POST /api/site/basket is answered by a small stand-in for the server
// (server/online-orders/basket.js), from what the page sends.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderWebsite, BASE, ONE_SHOP } from '../helpers/site-screen.js';

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
const PADS = {
  id: 101, name: 'Shimano brake pads B05S-RX', brand: 'Shimano', description: '[The shop’s description]',
  pricePence: 2800, priceHighPence: null, category: null, photos: ['/uploads/pads.jpg'],
  specifications: [], sizes: [], colours: [], items: [], stock: { line: 'ready', shop: 'Bolton', qty: 3 },
};
const answering = (body) => (url) => {
  const id = new URL(url, 'http://localhost').pathname.split('/').pop();
  return String(body.id) === id ? { status: 200, body } : { status: 404, body: { error: 'We can’t find that page' } };
};

// The stand-in shelf: how many each shop has of each product.
const SHELF = {
  101: { name: 'Shimano brake pads B05S-RX', code: 'B05S-RX', pricePence: 2800, photo: '/uploads/pads.jpg', at: { 1: 3, 2: 0 } },
  102: { name: '[Product]', code: null, size: '[Size or colour]', pricePence: 1000, photo: null, at: { 1: 5, 2: 5 } },
};
const SHOPS = [{ id: 1, name: 'Bolton' }, { id: 2, name: '[Second site]' }];
function basketServer({ taking = true, shelf = SHELF } = {}) {
  return (body) => {
    const shop = SHOPS.find((s) => s.id === body.shop) ?? null;
    const lines = body.lines.map(({ productId, qty }) => {
      const p = shelf[productId];
      if (!p) return { productId, name: null, code: null, size: null, colour: null, photo: null, pricePence: null, qty, linePence: 0, stock: null, note: null, gone: true };
      const have = shop ? p.at[shop.id] : null;
      const line = { productId, name: p.name, code: p.code, size: p.size ?? null, colour: null, photo: p.photo, pricePence: p.pricePence, qty, stock: shop ? (have > 0 ? { line: 'ready', shop: shop.name, qty: have } : { line: 'sold-out', shop: shop.name }) : { line: 'none' }, note: null, gone: false };
      if (shop && have === 0) Object.assign(line, { gone: true, note: `No longer in stock at Bolton or [Second site] — remove it to carry on` });
      else if (shop && have < qty) Object.assign(line, { qty: have, note: `Only ${have} left at ${shop.name} — we’ve changed it to ${have}` });
      line.linePence = line.gone ? 0 : line.pricePence * line.qty;
      return line;
    });
    const changed = lines.some((l, i) => l.gone || l.qty !== body.lines[i].qty);
    return {
      taking, notTaking: taking ? null : 'Not taking online orders right now. Ask in the shop, or call us, to buy this',
      shop, lines, count: lines.reduce((n, l) => n + l.qty, 0), totalPence: lines.reduce((n, l) => n + l.linePence, 0),
      changed: changed ? 'Something in your basket changed. Sort the lines marked below before checking out.' : null,
      blocked: lines.some((l) => l.gone) ? 'Remove the item that’s no longer in stock first.' : null,
      you: null, credit: null,
    };
  };
}
const serving = (server) => (pathname, { body }) => (pathname === `${BASE}/api/site/basket` ? { status: 200, body: server(JSON.parse(body)) } : undefined);
const basketAsks = () => r.requests.filter((q) => q.url.endsWith('/api/site/basket')).map((q) => JSON.parse(q.body));
const basketCookie = () => document.cookie.split('; ').find((c) => c.startsWith('wh_basket='))?.slice('wh_basket='.length) ?? null;
const openProduct = (product = PADS, { cookie = 'wh_shop=1', server = basketServer(), ...extra } = {}) =>
  renderWebsite({ url: `/products/${product.id}`, product: answering(product), cookie, answer: serving(server), ...extra });

// ---------- 11.1 on-product, on-product-added ----------

test('Add to basket (on-product-added): adds 2, says "Added 2 × …" with View basket, and the header counts 3', async () => {
  r = await openProduct(PADS, { cookie: 'wh_shop=1; wh_basket=102:1' });
  const { ui } = r;
  const { fireEvent, within, waitFor } = await rtl();
  await ui.findByRole('heading', { level: 1, name: 'Shimano brake pads B05S-RX' });
  assert.ok(ui.getByRole('link', { name: 'Basket, 1 item' }));
  const qty = ui.getByRole('group', { name: 'Quantity of Shimano brake pads B05S-RX' });
  fireEvent.click(within(qty).getByRole('button', { name: 'One more Shimano brake pads B05S-RX' }));
  fireEvent.click(await ui.findByRole('button', { name: 'Add to basket' }));
  const added = await ui.findByText('Added 2 × Shimano brake pads B05S-RX');
  assert.equal(added.closest('[role="status"]').textContent, 'Added 2 × Shimano brake pads B05S-RX View basket');
  assert.equal(href(within(added.closest('[role="status"]')).getByRole('link', { name: 'View basket' })), `${BASE}/basket`);
  await waitFor(() => assert.ok(ui.getByRole('link', { name: 'Basket, 3 items' })));
  assert.equal(basketCookie(), '102:1.101:2');
  // Adding the same again adds to its line.
  fireEvent.click(ui.getByRole('button', { name: 'Add to basket' }));
  await waitFor(() => assert.equal(basketCookie(), '102:1.101:4'));
});

test('on a computer the header reads "Basket · 3"; with nothing in it, "Basket"', async () => {
  r = await openProduct(PADS, { cookie: 'wh_shop=1; wh_basket=101:2.102:1' });
  const link = await r.ui.findByRole('link', { name: 'Basket, 3 items' });
  assert.equal(link.textContent, 'Basket · 3');
});

test('a product with sizes adds the chosen size, and can’t be added before one is chosen', async () => {
  const SIZED = {
    ...PADS, id: 501, name: '[Product with sizes]', sizes: ['S', 'M'], stock: null,
    items: [{ id: 501, size: 'S', colour: null, pricePence: 3000, stock: { line: 'ready', shop: 'Bolton', qty: 2 } }, { id: 502, size: 'M', colour: null, pricePence: 3000, stock: { line: 'ready', shop: 'Bolton', qty: 2 } }],
  };
  r = await openProduct(SIZED);
  const { ui } = r;
  const { fireEvent } = await rtl();
  await ui.findByRole('heading', { level: 1, name: '[Product with sizes]' });
  const add = await ui.findByRole('button', { name: 'Add to basket' });
  assert.equal(add.disabled, true);
  fireEvent.click(ui.getByRole('radio', { name: 'M' }));
  fireEvent.click(add);
  await ui.findByText('Added 1 × [Product with sizes]');
  assert.equal(basketCookie(), '502:1');
});

// ---------- 11.2 on-product-out, on-product-out-other, on-product-off ----------

test('sold out at Bolton (on-product-out): "Sold out at Bolton", no quantity and no Add to basket', async () => {
  r = await openProduct({ ...PADS, stock: { line: 'sold-out', shop: 'Bolton' } });
  const { ui } = r;
  await ui.findByText('Sold out at Bolton');
  await new Promise((done) => setTimeout(done, 20));
  assert.ok(ui.queryByRole('button', { name: 'Add to basket' }) === null);
  assert.ok(ui.queryByRole('group', { name: /^Quantity of/ }) === null);
});

test('in stock at the other shop (on-product-out-other): Collect from [Second site] instead chooses that shop', async () => {
  let shop = 1;
  const product = (url) => {
    shop = Number(new URL(url, 'http://localhost').searchParams.get('shop'));
    return { status: 200, body: { ...PADS, stock: shop === 2 ? { line: 'ready', shop: '[Second site]', qty: 4 } : { line: 'elsewhere', shop: 'Bolton', at: '[Second site]' } } };
  };
  r = await renderWebsite({ url: '/products/101', product, cookie: 'wh_shop=1', answer: serving(basketServer()) });
  const { ui } = r;
  const { fireEvent } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: 'Collect from [Second site] instead' }));
  await ui.findByText('Ready today at [Second site]');
  assert.equal(shop, 2);
  assert.match(document.cookie, /wh_shop=2/);
  assert.ok(await ui.findByRole('button', { name: 'Add to basket' }));
});

test('not taking online orders (on-product-off): the drawn line, and no Add to basket', async () => {
  r = await openProduct(PADS, { server: basketServer({ taking: false }) });
  const { ui } = r;
  const line = await ui.findByText('Not taking online orders right now.');
  assert.equal(line.tagName, 'STRONG');
  assert.equal(line.parentElement.textContent, 'Not taking online orders right now. Ask in the shop, or call us, to buy this');
  assert.ok(ui.queryByRole('button', { name: 'Add to basket' }) === null);
  assert.ok(ui.queryByText(/Ready today at/) === null, 'the line takes the stock line’s place');
  assert.ok(ui.getByRole('button', { name: 'Ask the shop about this' }));
});

test('a basket of 50 different things: Add to basket says it’s full instead of "Added"', async () => {
  const fifty = Array.from({ length: 50 }, (_, i) => `${1000 + i}:1`).join('.');
  r = await openProduct(PADS, { cookie: `wh_shop=1; wh_basket=${fifty}` });
  const { ui } = r;
  const { fireEvent } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: 'Add to basket' }));
  assert.ok(await ui.findByText('Your basket is full: it holds 50 different things. Remove one to add this.'));
  assert.ok(ui.queryByText(/^Added/) === null);
  assert.equal(basketCookie(), fifty);
});

test('with 98 in the basket, adding 2 says "Added 1" — 99 of one thing at most', async () => {
  r = await openProduct(PADS, { cookie: 'wh_shop=1; wh_basket=101:98' });
  const { ui } = r;
  const { fireEvent } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: 'One more Shimano brake pads B05S-RX' }));
  fireEvent.click(ui.getByRole('button', { name: 'Add to basket' }));
  assert.ok(await ui.findByText('Added 1 × Shimano brake pads B05S-RX'));
  fireEvent.click(ui.getByRole('button', { name: 'Add to basket' }));
  assert.ok(await ui.findByText('Your basket already has 99 of these, the most for one order.'));
  assert.equal(basketCookie(), '101:99');
});

test('the header’s count asks the server nothing: only the basket page does', async () => {
  r = await openProduct(PADS, { cookie: 'wh_shop=1; wh_basket=101:2.102:1' });
  await r.ui.findByRole('link', { name: 'Basket, 3 items' });
  await new Promise((done) => setTimeout(done, 50));
  assert.deepEqual(basketAsks().map((a) => a.lines.length), [0], 'one ask, with an empty basket, for whether the shop is taking orders');
});

// ---------- 11.3 on-product-no-shop, on-choose-shop ----------

test('no shop chosen (on-product-no-shop, on-choose-shop): one tap on a shop chooses it, remembers it and adds', async () => {
  r = await openProduct({ ...PADS, stock: { line: 'none' } }, { cookie: '' });
  const { ui } = r;
  const { fireEvent, within, waitFor } = await rtl();
  await ui.findByText('Choose a shop to see when it’s ready');
  fireEvent.click(await ui.findByRole('button', { name: 'Add to basket' }));
  const box = await ui.findByRole('dialog', { name: 'Which shop will you collect from?' });
  assert.equal(box.getAttribute('aria-describedby') && document.getElementById(box.getAttribute('aria-describedby')).textContent, 'We’ll add it to your basket, remember the shop, and show when things are ready there');
  fireEvent.click(within(box).getByRole('button', { name: /^Bolton/ }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
  assert.match(document.cookie, /wh_shop=1/);
  assert.equal(basketCookie(), '101:1');
  assert.ok(await ui.findByText('Added 1 × Shimano brake pads B05S-RX'));
});

test('Cancel on "Which shop will you collect from?" adds nothing', async () => {
  r = await openProduct({ ...PADS, stock: { line: 'none' } }, { cookie: '' });
  const { ui } = r;
  const { fireEvent, within, waitFor } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: 'Add to basket' }));
  const box = await ui.findByRole('dialog', { name: 'Which shop will you collect from?' });
  fireEvent.click(within(box).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
  assert.equal(basketCookie(), null);
  assert.ok(ui.queryByText(/^Added/) === null);
});

test('the chip’s own chooser keeps its own words', async () => {
  r = await openProduct(PADS, { cookie: '' });
  const { ui } = r;
  const { fireEvent } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: 'Choose a shop to collect from' }));
  const box = await ui.findByRole('dialog', { name: 'Which shop will you collect from?' });
  assert.equal(document.getElementById(box.getAttribute('aria-describedby')).textContent, 'We’ll remember it, and show when things are ready there');
});

// ---------- 11.4 on-basket, on-basket-changed, on-basket-empty ----------

test('the basket (on-basket): each line, Your order, and Go to checkout', async () => {
  r = await renderWebsite({ url: '/basket', cookie: 'wh_shop=1; wh_basket=101:2.102:1', answer: serving(basketServer()) });
  const { ui } = r;
  const { within } = await rtl();
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Your basket' }));
  assert.equal(document.title, 'Your basket · North Street Cycles');
  assert.deepEqual(basketAsks()[0], { shop: 1, lines: [{ productId: 101, qty: 2 }, { productId: 102, qty: 1 }] });
  const pads = (await ui.findByRole('heading', { level: 2, name: 'Shimano brake pads B05S-RX' })).closest('li');
  assert.ok(within(pads).getByRole('img', { name: 'Photo of Shimano brake pads B05S-RX' }));
  for (const words of ['B05S-RX', 'Ready today at Bolton', '£28.00 each', '£56.00']) assert.ok(within(pads).getByText(words), words);
  assert.equal(within(pads).getByRole('group', { name: 'Quantity of Shimano brake pads B05S-RX' }).querySelector('[aria-live="polite"]').textContent, '2');
  assert.equal(within(pads).getByRole('button', { name: 'Remove Shimano brake pads B05S-RX' }).textContent, 'Remove');
  const other = ui.getByRole('heading', { level: 2, name: '[Product]' }).closest('li');
  assert.ok(within(other).getByText('[Size or colour]'));
  const order = ui.getByRole('region', { name: 'Your order' });
  const rows = [...order.querySelectorAll('dl > div')].map((d) => d.textContent);
  assert.deepEqual(rows, ['3 items£66.00', 'Collect from BoltonFree', 'Total (includes VAT)£66.00']);
  assert.equal(href(within(order).getByRole('link', { name: 'Go to checkout' })), `${BASE}/checkout`);
  assert.ok(ui.getByRole('link', { name: 'Basket, 3 items' }));
  assert.ok(ui.queryByText(/can’t take orders online yet/) === null);
  assert.ok(ui.queryByText(/Ready to collect when the last item is/) === null, 'shelf only (decided while planning 11)');
});

test('changing a quantity on the basket asks again with the new number', async () => {
  r = await renderWebsite({ url: '/basket', cookie: 'wh_shop=1; wh_basket=101:1', answer: serving(basketServer()) });
  const { ui } = r;
  const { fireEvent, waitFor } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: 'One more Shimano brake pads B05S-RX' }));
  await waitFor(() => assert.equal(ui.getByRole('region', { name: 'Your order' }).querySelector('dl > div:last-child dd').textContent, '£56.00'));
  assert.equal(basketCookie(), '101:2');
});

test('two quick taps on One more both count, before the server has answered the first', async () => {
  r = await renderWebsite({ url: '/basket', cookie: 'wh_shop=1; wh_basket=101:1', answer: serving(basketServer()) });
  const { ui } = r;
  const { fireEvent, waitFor } = await rtl();
  const more = await ui.findByRole('button', { name: 'One more Shimano brake pads B05S-RX' });
  fireEvent.click(more);
  fireEvent.click(more);
  assert.equal(basketCookie(), '101:3');
  await waitFor(() => assert.equal(ui.getByRole('region', { name: 'Your order' }).querySelector('dl > div:last-child dd').textContent, '£84.00'));
});

test('Go to checkout takes the server’s cut quantity, and the header counts what the server priced (decided while building 2 and 10)', async () => {
  // Bolton has 3; the cookie asks for 5.
  r = await renderWebsite({ url: '/basket', cookie: 'wh_shop=1; wh_basket=101:5', answer: serving(basketServer()) });
  const { ui } = r;
  const { fireEvent, waitFor } = await rtl();
  assert.ok(await ui.findByText('Only 3 left at Bolton — we’ve changed it to 3'));
  await waitFor(() => assert.ok(ui.getByRole('link', { name: 'Basket, 3 items' })));
  fireEvent.click(ui.getByRole('link', { name: 'Go to checkout' }));
  assert.equal(basketCookie(), '101:3');
});

test('Go to checkout straight after One more keeps the new number, not the answer still on screen', async () => {
  r = await renderWebsite({ url: '/basket', cookie: 'wh_shop=1; wh_basket=101:1', answer: serving(basketServer()) });
  const { ui } = r;
  const { fireEvent } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: 'One more Shimano brake pads B05S-RX' }));
  fireEvent.click(ui.getByRole('link', { name: 'Go to checkout' }));
  assert.equal(basketCookie(), '101:2');
});

test('a change made in another tab isn’t lost when this tab removes a line', async () => {
  r = await renderWebsite({ url: '/basket', cookie: 'wh_shop=1; wh_basket=101:2', answer: serving(basketServer()) });
  const { ui } = r;
  const { fireEvent } = await rtl();
  await ui.findByRole('heading', { level: 2, name: 'Shimano brake pads B05S-RX' });
  document.cookie = `wh_basket=101:2.102:1; Path=${BASE}`;
  fireEvent.click(ui.getByRole('button', { name: 'Remove Shimano brake pads B05S-RX' }));
  assert.equal(basketCookie(), '102:1');
});

test('a line of one shows its price; a line of more shows its total with the price each beneath (basketLine)', async () => {
  r = await renderWebsite({ url: '/basket', cookie: 'wh_shop=1; wh_basket=101:2.102:1', answer: serving(basketServer()) });
  const { ui } = r;
  const { within } = await rtl();
  const other = (await ui.findByRole('heading', { level: 2, name: '[Product]' })).closest('li');
  assert.ok(within(other).getByText('£10.00'));
  assert.ok(within(other).queryByText(/each/) === null);
  assert.ok(within(other).getByRole('img', { name: 'Photo of [Product]' }), 'the stand-in for a missing photo is named as the drawing names it');
});

test('a changed basket (on-basket-changed): the banner, each line’s note, One more held, and Go to checkout held', async () => {
  const shelf = { ...SHELF, 101: { ...SHELF[101], at: { 1: 1, 2: 0 } }, 102: { ...SHELF[102], at: { 1: 0, 2: 0 } } };
  r = await renderWebsite({ url: '/basket', cookie: 'wh_shop=1; wh_basket=101:2.102:1', answer: serving(basketServer({ shelf })) });
  const { ui } = r;
  const { within } = await rtl();
  const banner = (await ui.findByText('Something in your basket changed.')).closest('[role="status"]');
  assert.equal(banner.textContent, 'Something in your basket changed.Sort the lines marked below before checking out.');
  const pads = ui.getByRole('heading', { level: 2, name: 'Shimano brake pads B05S-RX' }).closest('li');
  assert.ok(within(pads).getByText('Only 1 left at Bolton — we’ve changed it to 1'));
  assert.equal(within(pads).getByRole('button', { name: 'One more Shimano brake pads B05S-RX' }).getAttribute('aria-disabled'), 'true');
  assert.ok(ui.getByText('No longer in stock at Bolton or [Second site] — remove it to carry on'));
  const order = ui.getByRole('region', { name: 'Your order' });
  assert.equal(order.querySelector('dl > div').textContent, '2 items£28.00');
  const go = within(order).getByRole('button', { name: 'Go to checkout' });
  assert.equal(go.getAttribute('aria-disabled'), 'true');
  assert.equal(document.getElementById(go.getAttribute('aria-describedby')).textContent, 'Remove the item that’s no longer in stock first.');
});

test('Remove, then Undo (on-basket-empty): "Removed …" with Undo, "Your basket is empty." and Carry on shopping', async () => {
  r = await renderWebsite({ url: '/basket', cookie: 'wh_shop=1; wh_basket=101:2', answer: serving(basketServer()) });
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: 'Remove Shimano brake pads B05S-RX' }));
  const removed = (await ui.findByText(/^Removed Shimano brake pads B05S-RX\./)).closest('[role="status"]');
  assert.equal(removed.textContent, 'Removed Shimano brake pads B05S-RX. Undo');
  assert.ok(ui.getByText('Your basket is empty.'));
  assert.equal(href(ui.getByRole('link', { name: 'Carry on shopping' })), `${BASE}/shop`);
  assert.equal(basketCookie(), null);
  assert.ok(ui.getByRole('link', { name: 'Basket, 0 items' }));
  fireEvent.click(within(removed).getByRole('button', { name: 'Undo' }));
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Shimano brake pads B05S-RX' }));
  assert.equal(basketCookie(), '101:2');
});

test('an empty basket asks the server nothing', async () => {
  r = await renderWebsite({ url: '/basket', site: ONE_SHOP, answer: serving(basketServer()) });
  const { ui } = r;
  assert.ok(await ui.findByText('Your basket is empty.'));
  assert.equal(basketAsks().length, 0);
});

test('a basket while the shop isn’t taking orders says so instead of Go to checkout', async () => {
  r = await renderWebsite({ url: '/basket', cookie: 'wh_shop=1; wh_basket=101:1', answer: serving(basketServer({ taking: false })) });
  const { ui } = r;
  assert.ok(await ui.findByText('Not taking online orders right now.'));
  assert.ok(ui.queryByRole('link', { name: 'Go to checkout' }) === null);
});

// ---------- 11.5 the wh_basket cookie ----------

test('wh_basket is read strictly: a broken entry is skipped, and it is written for this shop’s address only', async () => {
  const { readBasket, basketCookieText } = await import(new URL('../../.test-build/website/basket.js', import.meta.url).href);
  assert.deepEqual(readBasket('wh_basket=101:2.abc.0:1.7:0.8:1e2.9:3'), [{ productId: 101, qty: 2 }, { productId: 9, qty: 3 }]);
  assert.deepEqual(readBasket('other=1'), []);
  assert.equal(basketCookieText([{ productId: 101, qty: 2 }], { base: '/store/north', slug: 'north' }, true), 'wh_basket=101:2; Path=/store/north; SameSite=Lax; Secure');
  assert.equal(basketCookieText([], { base: '', slug: 'north' }, false), 'wh_basket=; Max-Age=0; Path=/; SameSite=Lax');
});

test('wh_basket is on the Cookies page, lasting "[n] days" until Jack says', async () => {
  r = await renderWebsite({ url: '/cookies' });
  const table = await r.ui.findByRole('table', { name: 'Cookies this website sets' });
  const row = [...table.querySelectorAll('tbody tr')].find((tr) => tr.firstElementChild.textContent === 'wh_basket');
  assert.ok(row, 'listed');
  assert.deepEqual([...row.children].map((td) => td.textContent), ['wh_basket', 'Remembers what’s in your basket', '[n] days']);
});
