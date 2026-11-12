// Shopify in the new frame, the screens (openspec/changes/website-management,
// task 6.4; the drawings ws-start-shopify, ws-shopify-connect, -failed,
// -check, -sending, -on, -problem, -switch and ws-pay-shopify in
// docs/design/user-journeys/generator/website.mjs, lines 473-492 and 452-470).
// The answers are in the shapes server/routes/shopify-link.js sends.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openWebsite, closeWebsite, calls, NOT_SET_UP, OFF_NEVER, ON_CLEAN, HISTORY } from '../helpers/website-screen.js';

afterEach(closeWebsite);
const PAGE = '/workshop/website';
const ADDRESS = 'north-street.myshopify.com';
const posted = (path) => calls.filter((c) => c.path === path && c.method === 'POST');

// websiteState's `shopify` (shopify-link.js linkState) and the state around it.
const link = (over = {}) => ({ address: ADDRESS, state: 'idle', total: 0, sentCount: 0, lastSentAt: null, products: 0, problems: [], ...over });
const SHOPIFY = (over = {}) => ({ ...OFF_NEVER, kind: 'shopify', setUp: true, isOn: false, shopify: link(over) });
const SENT = { lastSentAt: '2026-09-17T09:12:00Z', products: 212, total: 212, sentCount: 212 };
const PREVIEW = {
  address: ADDRESS, count: 5, newPrices: 3, newPhotos: 2, newStock: 4, added: 1, onlyInShopify: 2, noPrice: 0,
  onlyInShopifyProducts: [{ sku: 'OLD-1', name: 'Old bell' }, { sku: 'OLD-2', name: 'Old pump' }],
  products: [{ id: 12, sku: 'HEL-1', name: 'Road helmet', changes: ['price', 'stock'] }],
};
const FAILED = `Couldn’t connect. Shopify didn’t find ${ADDRESS}, or the approval was cancelled. Nothing has changed.`;

async function open(start, path = PAGE, extra = {}) {
  let state = start;
  const opened = await openWebsite(path, {
    answers: {
      '/api/website': () => [200, state],
      '/api/website/history': () => [200, HISTORY],
      // A same-page address, so the test can see Connect go where the server says (jsdom only follows #changes).
      '/api/shopify/connect': (_q, _m, sent) => (sent.address ? [200, { address: `${window.location.href.split('#')[0]}#approve-${sent.address}` }] : [400, { error: 'Type your Shopify address' }]),
      '/api/shopify/preview': () => [200, PREVIEW],
      '/api/shopify/send': () => { state = SHOPIFY({ state: 'sending', total: 5, sentCount: 2 }); return [202, { shopify: state.shopify }]; },
      '/api/shopify/pause': () => { state = SHOPIFY({ ...SENT, state: 'paused' }); return [200, { shopify: state.shopify }]; },
      '/api/shopify/resume': () => { state = SHOPIFY({ ...SENT }); return [200, { shopify: state.shopify }]; },
      '/api/shopify/switch-to-wheelhouse': () => { state = OFF_NEVER; return [200, OFF_NEVER]; },
      ...extra,
    },
  });
  return { ...opened, set: (next) => { state = next; } };
}

test('ws-start-shopify: step 2 says what happens, Next waits for Connect first, and Connect opens Shopify with the address', async () => {
  const { ui, fireEvent, within, waitFor } = await open(NOT_SET_UP);
  fireEvent.click(await ui.findByRole('radio', { name: /Connect your Shopify shop/ }));
  fireEvent.click(ui.getByRole('button', { name: 'Next' }));
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Connect your Shopify shop' }));
  assert.ok(ui.getByText('SET UP YOUR WEBSITE · STEP 2 OF 3'));
  assert.ok(ui.getByText('Then choose which products to send. Your Shopify look stays as it is.'));
  assert.ok(ui.getByRole('heading', { level: 3, name: 'What happens' }));
  const happens = within(ui.getByRole('list', { name: 'What happens' }));
  assert.equal(happens.getAllByRole('listitem').length, 6);
  // Jack's default 2 (12 Nov) fills the drawn [what happens to them].
  assert.ok(happens.getByText('Products in Shopify that aren’t in Wheelhouse: left alone in Shopify, never hidden or deleted.'));
  assert.ok(happens.getByText('Shopify’s checkout takes the payment for those orders.'));
  const next = ui.getByRole('button', { name: 'Next' });
  assert.equal(next.getAttribute('aria-disabled'), 'true');
  assert.equal(next.getAttribute('title'), 'Connect first');
  fireEvent.click(next);
  assert.ok(ui.getByRole('heading', { level: 2, name: 'Connect your Shopify shop' }), 'Next does nothing until connected');
  assert.ok(ui.getByText('Opens Shopify to approve the connection, then brings you back here. Nothing is sent until you say so.'));
  const field = ui.getByRole('textbox', { name: 'Your Shopify address' });
  assert.equal(field.getAttribute('placeholder'), '[your-shop].myshopify.com');
  assert.ok(ui.getByRole('button', { name: 'Connect' }).className.includes('bg-[var(--accent)]'), 'drawn filled in the accent colour (ui.mjs button)');
  fireEvent.click(ui.getByRole('button', { name: 'Connect' }));
  assert.ok(await ui.findByText('Type your Shopify address'), 'the server’s words, by the field');
  fireEvent.change(field, { target: { value: ADDRESS } });
  fireEvent.click(ui.getByRole('button', { name: 'Connect' }));
  await waitFor(() => assert.equal(window.location.hash, `#approve-${ADDRESS}`), 'off to the address the server gave');
  assert.deepEqual(posted('/api/shopify/connect').map((c) => c.body), [{ address: '' }, { address: ADDRESS }]);
});

test('ws-shopify-failed during set-up: back from Shopify, step 2 says it couldn’t connect, with the address kept', async () => {
  const { ui } = await open(NOT_SET_UP, `${PAGE}?shopify=failed&address=${encodeURIComponent(ADDRESS)}`);
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Connect your Shopify shop' }));
  assert.ok(ui.getByText('SET UP YOUR WEBSITE · STEP 2 OF 3'));
  assert.ok(ui.getByText(FAILED).closest('[role="alert"]'));
  assert.equal(ui.getByRole('textbox', { name: 'Your Shopify address' }).value, ADDRESS);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(window.location.search, '', 'read once, then dropped from the address');
});

test('ws-shopify-connect: from the Website page’s Wheelhouse’s website or Shopify row, with Back to the Website page', async () => {
  const { ui, fireEvent, within } = await open(OFF_NEVER);
  fireEvent.click(await ui.findByRole('button', { name: /^Wheelhouse’s website or Shopify/ }));
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Connect your Shopify shop' }));
  assert.ok(ui.getByText('Keep your Shopify look, theme and checkout. Wheelhouse looks after what’s for sale.'));
  assert.equal(within(ui.getByRole('list', { name: 'What happens' })).getAllByRole('listitem').length, 6);
  assert.ok(ui.getByRole('textbox', { name: 'Your Shopify address' }));
  assert.ok(ui.queryByRole('alert') === null);
  fireEvent.click(ui.getByRole('button', { name: 'Website' }));
  assert.ok(await ui.findByRole('heading', { name: 'Your website is off' }));
});

// Jack's answer to Q3 (12 Nov, docs/decisions/2026-11-12-website-defaults-taken.md): one line
// above Connect, only when the website is live.
const SWITCHED_OFF = 'Your Wheelhouse website will be switched off when Shopify is connected.';
test('ws-shopify-connect with the website on: one line above Connect says the Wheelhouse website will be switched off', async () => {
  const { ui, fireEvent } = await open(ON_CLEAN);
  fireEvent.click(await ui.findByRole('button', { name: /^Wheelhouse’s website or Shopify/ }));
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Connect your Shopify shop' }));
  const line = ui.getByText(SWITCHED_OFF);
  const connect = ui.getByRole('button', { name: 'Connect' });
  assert.ok(line.compareDocumentPosition(connect) & Node.DOCUMENT_POSITION_FOLLOWING, 'the line sits above Connect');
});

test('ws-shopify-connect with the website off has no switched-off line', async () => {
  const { ui, fireEvent } = await open(OFF_NEVER);
  fireEvent.click(await ui.findByRole('button', { name: /^Wheelhouse’s website or Shopify/ }));
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Connect your Shopify shop' }));
  assert.ok(ui.queryByText(SWITCHED_OFF) === null);
});

test('ws-shopify-failed: back from Shopify on a set-up website, the connect page says it couldn’t connect', async () => {
  const { ui } = await open(OFF_NEVER, `${PAGE}?shopify=failed&address=${encodeURIComponent(ADDRESS)}`);
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Connect your Shopify shop' }));
  assert.ok(ui.getByText(FAILED).closest('[role="alert"]'));
  assert.equal(ui.getByRole('textbox', { name: 'Your Shopify address' }).value, ADDRESS);
});

test('ws-shopify-check: connected, nothing sent, how many products will change, the list, and Send', async () => {
  const { ui, fireEvent, within } = await open(SHOPIFY(), `${PAGE}?shopify=connected`);
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Ready to send to Shopify' }));
  assert.ok(ui.getByText(`Connected to ${ADDRESS}. Nothing has been sent yet.`));
  assert.ok(await ui.findByRole('heading', { level: 3, name: '5 products will change in your Shopify shop' }));
  const counts = within(ui.getByRole('list', { name: 'What will change' }));
  const line = (k) => counts.getByText(k).closest('li').textContent;
  assert.equal(line('New prices'), 'New prices3 products');
  assert.equal(line('New photos'), 'New photos2 products');
  assert.equal(line('New stock levels'), 'New stock levels4 products');
  assert.equal(line('Added'), 'Added1 product not in Shopify yet');
  assert.equal(line('Only in Shopify'), 'Only in Shopify2 products — left alone in Shopify');
  assert.ok(ui.queryByText('Old bell') === null);
  fireEvent.click(ui.getByRole('button', { name: 'See the list of products' }));
  assert.ok(ui.getByText('Road helmet'));
  assert.ok(ui.getByText('Old bell'));
  assert.ok(ui.getByText('Old pump'));
  assert.ok(ui.getByRole('button', { name: 'Send 5 products' }).className.includes('bg-[var(--accent)]'), 'drawn filled in the accent colour');
  fireEvent.click(ui.getByRole('button', { name: 'Send 5 products' }));
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Sending to your Shopify shop' }));
  assert.equal(posted('/api/shopify/send').length, 1);
});

test('ws-shopify-check: Not now leaves it connected with nothing sent, and See what will change comes back', async () => {
  const { ui, fireEvent } = await open(SHOPIFY());
  fireEvent.click(await ui.findByRole('button', { name: 'Not now' }));
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Connected to your Shopify shop' }));
  assert.ok(ui.getByText(`${ADDRESS} · nothing sent yet`));
  assert.equal(posted('/api/shopify/send').length, 0);
  fireEvent.click(ui.getByRole('button', { name: 'See what will change' }));
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Ready to send to Shopify' }));
});

test('ws-shopify-sending: the progress bar and how many are sent, then the connected page when it finishes', async () => {
  const { ui, set } = await open(SHOPIFY({ state: 'sending', total: 5, sentCount: 2 }));
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Sending to your Shopify shop' }));
  assert.ok(ui.getByText(ADDRESS));
  assert.equal(ui.getByRole('progressbar', { name: 'Products sent' }).getAttribute('aria-valuenow'), '40');
  assert.ok(ui.getByText('2 of 5 products sent. You can leave this page — it carries on.').closest('[role="status"]'));
  set(SHOPIFY({ ...SENT }));
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Connected to your Shopify shop' }, { timeout: 4000 }));
});

test('ws-shopify-on: the connected page, its rows and note, Open Shopify, and Pause then Resume sending', async () => {
  const { ui, fireEvent, within } = await open(SHOPIFY({ ...SENT }));
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Connected to your Shopify shop' }));
  assert.ok(ui.getByText(`${ADDRESS} · last sent 17 Sept, 10:12 · 212 products · sent when you press Send`));
  const shop = ui.getByRole('link', { name: 'Open Shopify' });
  assert.equal(shop.getAttribute('href'), `https://${ADDRESS}/admin`);
  assert.equal(shop.getAttribute('target'), '_blank');
  const rows = within(ui.getByRole('list', { name: 'Your website' }));
  assert.ok(rows.getByText('In Front desk › Online orders, with your other orders'));
  assert.ok(rows.getByText('“Show on website” on each category and product, in Stock'));
  assert.equal(rows.getByRole('link', { name: /^Taking payments/ }).getAttribute('href'), '/workshop/settings?room=front-desk&fold=paying-online');
  assert.ok(rows.getByText('Shopify’s checkout · Wheelhouse’s for “Pay now” on repairs'));
  assert.ok(rows.getByText('Your Shopify shop · switch to Wheelhouse’s website'));
  assert.ok(ui.getByText('Change products, prices and stock here in Wheelhouse — changes to them made in Shopify are replaced. Your Shopify theme, pages, cookies and tracking are set in Shopify.'));
  assert.ok(ui.queryByRole('heading', { name: 'Words and photos' }) === null, 'Shopify’s own pages are set in Shopify');
  fireEvent.click(ui.getByRole('button', { name: 'Pause sending' }));
  fireEvent.click(await ui.findByRole('button', { name: 'Resume sending' }));
  assert.ok(await ui.findByRole('button', { name: 'Pause sending' }));
  assert.equal(posted('/api/shopify/pause').length, 1);
  assert.equal(posted('/api/shopify/resume').length, 1);
});

test('ws-shopify-problem: the products that couldn’t be sent, why, Fix in Stock, and Try sending again', async () => {
  const problems = [
    { productId: 12, sku: 'HEL-1', name: 'Road helmet', kind: 'no_price', reason: 'No price yet' },
    { productId: 13, sku: 'LCK-1', name: 'D lock', kind: 'no_photo', reason: 'No photo — Shopify needs one for this category' },
    { productId: 14, sku: 'PMP-1', name: 'Track pump', kind: 'no_answer', reason: 'Shopify didn’t answer — try sending again' },
  ];
  const { ui, fireEvent, within } = await open(SHOPIFY({ ...SENT, problems }));
  const alert = within((await ui.findByText('3 products couldn’t be sent to Shopify')).closest('[role="alert"]'));
  assert.ok(alert.getByText('No price yet'));
  assert.ok(alert.getByText('No photo — Shopify needs one for this category'));
  assert.equal(alert.getByRole('link', { name: 'Fix Road helmet in Stock' }).getAttribute('href'), '/workshop/stock/12');
  assert.equal(alert.getByRole('link', { name: 'Fix D lock in Stock' }).textContent, 'Fix in Stock');
  fireEvent.click(alert.getByRole('button', { name: 'Try sending again' }));
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Sending to your Shopify shop' }));
  assert.equal(posted('/api/shopify/send').length, 1);
});

test('ws-shopify-switch: what changes, Cancel keeps Shopify, and Switch makes Wheelhouse’s website, switched off', async () => {
  const { ui, fireEvent, within } = await open(SHOPIFY({ ...SENT }));
  fireEvent.click(await ui.findByRole('button', { name: /^Wheelhouse’s website or Shopify/ }));
  const ask = within(await ui.findByRole('dialog', { name: 'Switch to Wheelhouse’s website?' }));
  assert.ok(ask.getByText('From your Shopify shop'));
  assert.ok(ask.getByText('Wheelhouse stops sending to Shopify. Your Shopify shop stays as it is — close it in Shopify when you’re ready.'));
  assert.ok(ask.getByText('Orders already placed on Shopify stay in Online orders.'));
  fireEvent.click(ask.getByRole('button', { name: 'Cancel' }));
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(ui.queryByRole('dialog') === null);
  fireEvent.click(ui.getByRole('button', { name: /^Wheelhouse’s website or Shopify/ }));
  const doIt = within(await ui.findByRole('dialog')).getByRole('button', { name: 'Switch' });
  assert.ok(doIt.className.includes('bg-[var(--accent)]'), 'drawn filled in the accent colour');
  fireEvent.click(doIt);
  assert.ok(await ui.findByRole('heading', { name: 'Your website is off' }));
  assert.equal(posted('/api/shopify/switch-to-wheelhouse').length, 1);
});

test('a Switch that fails says why once, in the pop-up, and the pop-up stays open', async () => {
  const { ui, fireEvent, within } = await open(SHOPIFY({ ...SENT }), PAGE, {
    '/api/shopify/switch-to-wheelhouse': () => [409, { error: 'Wheelhouse is still sending to Shopify. Wait for it to finish.', code: 'shopify_sending' }],
  });
  fireEvent.click(await ui.findByRole('button', { name: /^Wheelhouse’s website or Shopify/ }));
  const ask = within(await ui.findByRole('dialog'));
  fireEvent.click(ask.getByRole('button', { name: 'Switch' }));
  assert.ok(await ask.findByText('Wheelhouse is still sending to Shopify. Wait for it to finish.'));
  assert.equal(ui.getAllByText('Wheelhouse is still sending to Shopify. Wait for it to finish.').length, 1, 'not again behind the pop-up');
  fireEvent.click(ask.getByRole('button', { name: 'Cancel' }));
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(ui.queryByText('Wheelhouse is still sending to Shopify. Wait for it to finish.') === null, 'gone with the pop-up');
});

test('problems with no product in Wheelhouse each show, without Fix in Stock, and without React key clashes', async () => {
  const problems = [
    { productId: null, sku: 'A-1', name: 'Front light', kind: 'no_answer', reason: 'Shopify didn’t answer — try sending again' },
    { productId: null, sku: 'A-2', name: 'Rear light', kind: 'no_answer', reason: 'Shopify didn’t answer — try sending again' },
  ];
  const said = [];
  const was = console.error;
  console.error = (...a) => { said.push(a.join(' ')); };
  try {
    const { ui, within } = await open(SHOPIFY({ ...SENT, problems }));
    const alert = within((await ui.findByText('2 products couldn’t be sent to Shopify')).closest('[role="alert"]'));
    assert.ok(alert.getByText('Front light'));
    assert.ok(alert.getByText('Rear light'));
    assert.ok(alert.queryByRole('link', { name: /Fix/ }) === null);
  } finally {
    console.error = was;
  }
  assert.deepEqual(said.filter((t) => /same key/.test(t)), []);
});

test('ws-pay-shopify: Online orders settings says Shopify takes the website’s payments, and the provider is for Pay now on repairs', async () => {
  const payments = {
    state: 'tested', connected: true, providerName: null, connectedByName: 'Jack Lewis', connectedAt: '2026-09-10T10:00:00Z',
    testPaidAt: '2026-09-10T10:05:00Z', payoutLast4: null, payoutTiming: null, needsDetailsBy: null, needsWhat: null,
  };
  const { ui, within } = await openWebsite('/workshop/settings?room=front-desk&fold=paying-online', {
    answers: {
      '/api/workshop-settings': () => [200, { openingHours: [] }],
      '/api/shop-details': () => [200, { name: 'North Street Cycles', receiptFooter: null }],
      '/api/online-orders-settings': () => [200, { buyingOnline: true, payments }],
      '/api/website': () => [200, SHOPIFY({ ...SENT })],
    },
  });
  await ui.findByRole('heading', { level: 3, name: 'Online orders' });
  const box = within(ui.getByRole('region', { name: 'Online orders' }));
  assert.ok(await box.findByText((_, el) => el?.tagName === 'SPAN' && el.textContent === 'Shopify takes the payment for orders on your Shopify shop. Wheelhouse’s payments are only for “Pay now” on repairs.'));
  assert.ok(box.getByText('Connected to [payment provider] by Jack Lewis on Thu 10 Sep · for “Pay now” on repairs'));
  const fold = ui.getByRole('button', { name: /^Paying online/ });
  assert.ok(fold.textContent.includes('Shopify for website orders · [Payment provider] for repairs'));
});
