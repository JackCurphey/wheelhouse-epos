// The website's checkout, up to where paying starts (openspec/changes/
// website-buy-online, tasks 12.1, 12.2 and 12.5; on-checkout,
// on-checkout-errors, on-checkout-credit and on-checkout-covered in
// online.mjs). The wallets and the card form come with paying's screens (task
// 12.3); until then the server makes the order (task 4.5) and the page says
// paying online isn't ready yet beside the button.
//
// Example data from the drawings: Shimano brake pads B05S-RX at £28.00 × 2,
// "[Product]", Bolton, North Street Cycles, Maya Patel, maya@example.test,
// 07700 900 142. "[Product]"'s £10.00 and the credit amounts stand in for the
// drawings' "[£ price]" and "£[credit]".
//
// POST /api/site/basket and /api/site/checkout are answered by small stand-ins
// for the server (server/online-orders/basket.js and checkout.js).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderWebsite, BASE, ONE_SHOP, TWO_SHOPS, PARTS } from '../helpers/site-screen.js';

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
const MAYA = { name: 'Maya Patel', email: 'maya@example.test', phone: '07700 900 142' };
const LINES = [
  { productId: 101, name: 'Shimano brake pads B05S-RX', code: 'B05S-RX', size: null, colour: null, photo: null, pricePence: 2800, qty: 2, linePence: 5600, stock: { line: 'ready', shop: 'Bolton', qty: 3 }, note: null, gone: false },
  { productId: 102, name: '[Product]', code: null, size: null, colour: null, photo: null, pricePence: 1000, qty: 1, linePence: 1000, stock: { line: 'ready', shop: 'Bolton', qty: 5 }, note: null, gone: false },
];
const basket = (extra = {}) => ({
  taking: true, notTaking: null, shop: { id: 1, name: 'Bolton' }, lines: LINES, count: 3, totalPence: 6600,
  changed: null, blocked: null, you: null, credit: null, ...extra,
});
const CHANGED = 'Something in your basket changed. Sort the lines marked below before checking out.';
// The server's answer once the order is made (task 4.5): its private link and the held card part.
const NOT_BUILT = { status: 200, body: { ref: '[order link]', totalPence: 6600, creditPence: 0, cardPence: 6600, payment: { provider: 'pretend', ref: '[payment ref]' } } };

// `pay` answers POST /api/site/checkout: a { status, body } or a function of the body sent.
const serving = (answer, pay = NOT_BUILT) => (pathname, { body }) => {
  if (pathname === `${BASE}/api/site/basket`) return { status: 200, body: typeof answer === 'function' ? answer(JSON.parse(body)) : answer };
  if (pathname === `${BASE}/api/site/checkout`) return typeof pay === 'function' ? pay(JSON.parse(body)) : pay;
  return undefined;
};
const checkoutAsks = () => r.requests.filter((q) => q.url.endsWith('/api/site/checkout')).map((q) => JSON.parse(q.body));
const openCheckout = ({ answer = basket(), pay, cookie = 'wh_shop=1; wh_basket=101:2.102:1', ...extra } = {}) =>
  renderWebsite({ url: '/checkout', site: ONE_SHOP, cookie, answer: serving(answer, pay), ...extra });
const orderRows = (ui, within) => within(ui.getByRole('region', { name: 'Your order' })).getAllByRole('term')
  .map((dt) => `${dt.textContent} | ${dt.nextElementSibling.textContent}`);
const typeIn = async (ui, label, value) => {
  const { fireEvent } = await rtl();
  fireEvent.change(ui.getByRole('textbox', { name: label }), { target: { value } });
};

// ---------- 12.1 on-checkout ----------

test('on-checkout, as a guest: How you’ll get it, Your details, Your order, Pay £66.00 and the terms line; no wallets, card form or gift card yet', async () => {
  r = await openCheckout();
  const { ui } = r;
  const { within } = await rtl();
  await ui.findByRole('region', { name: 'Your order' });
  assert.ok(ui.getByRole('heading', { level: 1, name: 'Checkout' }));
  assert.equal(document.title.startsWith('Checkout'), true);

  const how = ui.getByRole('group', { name: 'How you’ll get it' });
  const collect = within(how).getByRole('radio', { name: /^Collect from North Street Cycles, Bolton/ });
  assert.equal(collect.checked, true);
  const sub = how.textContent;
  assert.match(sub, /Free · Open today \[open\]–\[close\] · \[Shop address\]/);
  assert.doesNotMatch(sub, /ready in about/);

  const name = ui.getByRole('textbox', { name: 'Name' });
  assert.equal(name.getAttribute('autocomplete'), 'name');
  assert.equal(ui.getByRole('textbox', { name: 'Phone' }).getAttribute('autocomplete'), 'tel');
  assert.equal(ui.getByRole('textbox', { name: 'Phone' }).getAttribute('type'), 'tel');
  const email = ui.getByRole('textbox', { name: 'Email' });
  assert.equal(email.getAttribute('type'), 'email');
  assert.equal(email.getAttribute('autocomplete'), 'email');
  const hint = document.getElementById(email.getAttribute('aria-describedby'));
  assert.equal(hint.textContent, 'For your receipt and to tell you when it’s ready.');
  const signIn = ui.getByRole('link', { name: 'Sign in' });
  assert.equal(signIn.getAttribute('href'), '/book/north/account');
  assert.equal(signIn.closest('p').textContent, 'Bought here before? Sign in to fill this in.');

  assert.deepEqual(orderRows(ui, within), [
    'Shimano brake pads B05S-RX × 2 | £56.00',
    '[Product] | £10.00',
    'Collect from Bolton | Free',
    'Total (includes VAT) | £66.00',
  ]);
  assert.ok(ui.getByRole('button', { name: 'Pay £66.00' }));
  assert.ok(ui.getByText(/By paying you agree to our/).textContent.endsWith('You can cancel for a full refund until your order is ready.'));
  assert.ok(ui.queryByText(/Apple Pay|Google Pay|or pay by card|Card number|gift card/i) === null);
  assert.ok(ui.queryByText('Your store credit is only used once the order is paid.') === null);
});

test('Pay sends the details, the basket, the shop and a request key; the server’s “not ready yet” shows beside the button', async () => {
  r = await openCheckout();
  const { ui } = r;
  const { fireEvent } = await rtl();
  await ui.findByRole('region', { name: 'Your order' });
  await typeIn(ui, 'Name', MAYA.name);
  await typeIn(ui, 'Phone', MAYA.phone);
  await typeIn(ui, 'Email', MAYA.email);
  fireEvent.click(ui.getByRole('button', { name: 'Pay £66.00' }));
  const said = await ui.findByRole('alert');
  assert.equal(said.textContent, 'Paying online isn’t ready yet');
  const [sent] = checkoutAsks();
  assert.match(sent.requestKey, /^[A-Za-z0-9_-]{32,128}$/);
  delete sent.requestKey;
  assert.deepEqual(sent, { shop: 1, lines: [{ productId: 101, qty: 2 }, { productId: 102, qty: 1 }], ...MAYA, useCredit: false });
  // The bar holds the button and its answer together (on a phone, along the bottom).
  assert.ok(said.closest('[data-pay-bar]') === ui.getByRole('button', { name: 'Pay £66.00' }).closest('[data-pay-bar]'));
});

test('on-checkout, signed in: the account’s name, email and phone, with Not you? and Change; no boxes to fill, and none sent', async () => {
  r = await openCheckout({ answer: basket({ you: MAYA }) });
  const { ui } = r;
  const { fireEvent } = await rtl();
  const name = await ui.findByText('Maya Patel');
  assert.equal(name.tagName, 'STRONG');
  assert.ok(ui.getByText('maya@example.test ·', { exact: false }));
  assert.ok(ui.getByText('07700 900 142'));
  assert.equal(ui.getByRole('link', { name: 'Not you?' }).getAttribute('href'), '/book/north/account');
  assert.equal(ui.getByRole('link', { name: 'Change' }).getAttribute('href'), '/book/north/account');
  assert.ok(ui.queryByRole('textbox', { name: 'Name' }) === null);
  assert.ok(ui.queryByRole('link', { name: 'Sign in' }) === null);
  fireEvent.click(ui.getByRole('button', { name: 'Pay £66.00' }));
  await ui.findByRole('alert');
  const [sent] = checkoutAsks();
  assert.equal('name' in sent, false);
  assert.equal('email' in sent, false);
  assert.equal('phone' in sent, false);
});

// ---------- 12.2 on-checkout-errors ----------

test('the boxes come before Pay for the keyboard and screen readers, and Enter in a box presses Pay', async () => {
  r = await openCheckout();
  const { ui } = r;
  const { fireEvent } = await rtl();
  await ui.findByRole('region', { name: 'Your order' });
  const pay = ui.getByRole('button', { name: 'Pay £66.00' });
  for (const label of ['Name', 'Phone', 'Email']) {
    assert.ok(ui.getByRole('textbox', { name: label }).compareDocumentPosition(pay) & Node.DOCUMENT_POSITION_FOLLOWING, `${label} before Pay`);
  }
  await typeIn(ui, 'Name', MAYA.name);
  const form = ui.getByRole('textbox', { name: 'Email' }).closest('form');
  assert.ok(form !== null, 'the boxes and Pay are one form');
  assert.ok(form.contains(pay));
  fireEvent.submit(form);
  await ui.findByRole('alert');
  assert.equal(checkoutAsks().length, 1);
});

test('Pay pressed again with nothing changed keeps its request key; unticking the credit makes a new one', async () => {
  r = await openCheckout({ answer: basket({ you: MAYA, credit: { availablePence: 1000, usePence: 1000, leftToPayPence: 5600, coversAll: null } }) });
  const { ui } = r;
  const { fireEvent, waitFor } = await rtl();
  await ui.findByRole('region', { name: 'Your order' });
  fireEvent.click(ui.getByRole('button', { name: 'Pay £56.00' }));
  await ui.findByRole('alert');
  await waitFor(() => assert.ok(!ui.getByRole('button', { name: 'Pay £56.00' }).disabled));
  fireEvent.click(ui.getByRole('button', { name: 'Pay £56.00' }));
  await waitFor(() => assert.equal(checkoutAsks().length, 2));
  await waitFor(() => assert.ok(!ui.getByRole('button', { name: 'Pay £56.00' }).disabled));
  fireEvent.click(ui.getByRole('checkbox', { name: /Use my store credit/ }));
  fireEvent.click(ui.getByRole('button', { name: 'Pay £66.00' }));
  await waitFor(() => assert.equal(checkoutAsks().length, 3));
  const [first, again, unticked] = checkoutAsks();
  assert.equal(again.requestKey, first.requestKey);
  assert.notEqual(unticked.requestKey, first.requestKey);
});

test('with several shops and none chosen, How you’ll get it asks for a shop instead of choosing one', async () => {
  r = await openCheckout({ site: TWO_SHOPS, cookie: 'wh_basket=101:2.102:1', answer: basket({ shop: null }) });
  const { ui } = r;
  const { fireEvent } = await rtl();
  await ui.findByRole('region', { name: 'Your order' });
  assert.ok(ui.queryByRole('radio') === null);
  fireEvent.click(ui.getByRole('button', { name: 'Choose a shop' }));
  assert.ok(await ui.findByRole('dialog', { name: 'Which shop will you collect from?' }));
});

test('an account missing its phone shows only the Phone box, and sends only the phone', async () => {
  r = await openCheckout({ answer: basket({ you: { ...MAYA, phone: null } }) });
  const { ui } = r;
  const { fireEvent } = await rtl();
  await ui.findByRole('region', { name: 'Your order' });
  assert.ok(ui.getByText('maya@example.test'));
  assert.ok(ui.queryByRole('textbox', { name: 'Name' }) === null);
  assert.ok(ui.queryByRole('textbox', { name: 'Email' }) === null);
  await typeIn(ui, 'Phone', MAYA.phone);
  fireEvent.click(ui.getByRole('button', { name: 'Pay £66.00' }));
  await ui.findByRole('alert');
  const [sent] = checkoutAsks();
  assert.equal(sent.phone, MAYA.phone);
  assert.equal('name' in sent, false);
  assert.equal('email' in sent, false);
});

test('a refusal with no boxes to mark shows the server’s words beside Pay', async () => {
  r = await openCheckout({ pay: { status: 400, body: { error: 'Choose which shop to collect from' } } });
  const { ui } = r;
  const { fireEvent } = await rtl();
  await ui.findByRole('region', { name: 'Your order' });
  fireEvent.click(ui.getByRole('button', { name: 'Pay £66.00' }));
  const said = await ui.findByRole('alert');
  assert.equal(said.textContent, 'Choose which shop to collect from');
  assert.ok(said.closest('[data-pay-bar]') !== null);
});

test('a basket that changed before checkout opened goes straight to the basket page', async () => {
  r = await openCheckout({ answer: basket({ changed: CHANGED, lines: [LINES[0], { ...LINES[1], gone: true, linePence: 0, note: 'No longer in stock at Bolton — remove it to carry on' }], blocked: 'Remove the item that’s no longer in stock first.' }) });
  const { ui } = r;
  await ui.findByRole('heading', { level: 1, name: 'Your basket' });
  assert.ok(ui.queryByRole('button', { name: /^Pay/ }) === null);
});


test('on-checkout-errors: “Check the 2 boxes marked below.” above the boxes, each box’s own message, and focus on the summary', async () => {
  const refused = { status: 400, body: { error: 'Check the 2 boxes marked below.', fields: { name: 'Enter your name', email: 'Check your email address — it needs an @ and a dot, like name@example.com' } } };
  r = await openCheckout({ pay: refused });
  const { ui } = r;
  const { fireEvent, waitFor } = await rtl();
  await ui.findByRole('region', { name: 'Your order' });
  await typeIn(ui, 'Phone', MAYA.phone);
  await typeIn(ui, 'Email', 'maya@example');
  fireEvent.click(ui.getByRole('button', { name: 'Pay £66.00' }));
  const summary = await ui.findByText('Check the 2 boxes marked below.');
  await waitFor(() => assert.ok(document.activeElement === summary.closest('[tabindex]')));
  // Read out as soon as it shows, not only when focus lands on it.
  assert.equal(summary.closest('[tabindex]').getAttribute('role'), 'alert');
  const name = ui.getByRole('textbox', { name: 'Name' });
  assert.equal(name.getAttribute('aria-invalid'), 'true');
  assert.equal(document.getElementById(name.getAttribute('aria-describedby')).textContent, 'Enter your name');
  const email = ui.getByRole('textbox', { name: 'Email' });
  assert.equal(email.getAttribute('aria-invalid'), 'true');
  assert.match(email.getAttribute('aria-describedby'), /\S/);
  assert.ok(email.getAttribute('aria-describedby').split(' ').some((id) => document.getElementById(id).textContent === 'Check your email address — it needs an @ and a dot, like name@example.com'));
  assert.ok(ui.getByRole('textbox', { name: 'Phone' }).getAttribute('aria-invalid') === null);
  // Fixing a box clears its mark.
  await typeIn(ui, 'Name', MAYA.name);
  assert.ok(name.getAttribute('aria-invalid') === null);
});

// ---------- 12.2 on-checkout-credit, on-checkout-covered ----------

const CREDIT = { availablePence: 1000, usePence: 1000, leftToPayPence: 5600, coversAll: null };

test('on-checkout-credit: “Use my store credit · £10.00” ticked for you, the order takes it off, Pay £56.00 and the note; unticking puts it back', async () => {
  r = await openCheckout({ answer: basket({ you: MAYA, credit: CREDIT }) });
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  const box = await ui.findByRole('checkbox', { name: /Use my store credit · £10\.00/ });
  assert.equal(box.checked, true);
  assert.ok(within(ui.getByRole('region', { name: 'Pay' })).getByText('Ticked for you. The rest goes on your card.'));
  assert.deepEqual(orderRows(ui, within).slice(3), ['Total (includes VAT) | £66.00', 'Store credit | −£10.00', 'Left to pay | £56.00']);
  assert.ok(ui.getByRole('button', { name: 'Pay £56.00' }));
  assert.ok(ui.getByText('Your store credit is only used once the order is paid.'));

  fireEvent.click(box);
  assert.equal(box.checked, false);
  assert.deepEqual(orderRows(ui, within).slice(3), ['Total (includes VAT) | £66.00']);
  assert.ok(ui.queryByText('Your store credit is only used once the order is paid.') === null);
  fireEvent.click(ui.getByRole('button', { name: 'Pay £66.00' }));
  await ui.findByRole('alert');
  assert.equal(checkoutAsks()[0].useCredit, false);
});

test('ticked credit is sent as useCredit: true', async () => {
  r = await openCheckout({ answer: basket({ you: MAYA, credit: CREDIT }) });
  const { ui } = r;
  const { fireEvent } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: 'Pay £56.00' }));
  await ui.findByRole('alert');
  assert.equal(checkoutAsks()[0].useCredit, true);
});

test('on-checkout-covered: the credit covers it all, “nothing to pay by card”, Left to pay £0.00 and Place order', async () => {
  const covers = { availablePence: 9000, usePence: 6600, leftToPayPence: 0, coversAll: 'Your store credit covers the whole order — nothing to pay by card.' };
  r = await openCheckout({ answer: basket({ you: MAYA, credit: covers }) });
  const { ui } = r;
  const { within } = await rtl();
  assert.ok(await ui.findByRole('checkbox', { name: /Use my store credit · £90\.00/ }));
  assert.ok(within(ui.getByRole('region', { name: 'Pay' })).getByText('Your store credit covers the whole order — nothing to pay by card.'));
  assert.deepEqual(orderRows(ui, within).slice(3), ['Total (includes VAT) | £66.00', 'Store credit | −£66.00', 'Left to pay | £0.00']);
  assert.ok(ui.getByRole('button', { name: 'Place order' }));
});

// ---------- 12.5 the terms ----------

test('“terms” opens the shop’s Collection and returns words over checkout; closing keeps what was typed', async () => {
  r = await openCheckout();
  const { ui } = r;
  const { fireEvent, within } = await rtl();
  await ui.findByRole('region', { name: 'Your order' });
  await typeIn(ui, 'Name', MAYA.name);
  fireEvent.click(ui.getByRole('button', { name: 'terms' }));
  const dialog = await ui.findByRole('dialog', { name: 'Collection and returns' });
  assert.ok(within(dialog).getByText(PARTS.collectionReturns));
  fireEvent.click(within(dialog).getByRole('button', { name: /close/i }));
  assert.equal(ui.getByRole('textbox', { name: 'Name' }).value, MAYA.name);
});

// ---------- the basket changing, an empty basket, not taking orders ----------

test('a basket that changed since it was opened goes back to the basket page, which says what changed', async () => {
  let sold = false;
  const answer = () => (sold ? basket({ changed: CHANGED, lines: [LINES[0], { ...LINES[1], gone: true, linePence: 0, note: 'No longer in stock at Bolton — remove it to carry on' }], blocked: 'Remove the item that’s no longer in stock first.' }) : basket());
  r = await openCheckout({ answer, pay: () => { sold = true; return { status: 409, body: { error: CHANGED, basket: answer() } }; } });
  const { ui } = r;
  const { fireEvent } = await rtl();
  await ui.findByRole('region', { name: 'Your order' });
  await typeIn(ui, 'Name', MAYA.name);
  await typeIn(ui, 'Phone', MAYA.phone);
  await typeIn(ui, 'Email', MAYA.email);
  fireEvent.click(ui.getByRole('button', { name: 'Pay £66.00' }));
  await ui.findByRole('heading', { level: 1, name: 'Your basket' });
  assert.ok(await ui.findByText('Something in your basket changed.'));
});

test('with nothing in the basket, checkout says so, as the basket does', async () => {
  r = await openCheckout({ cookie: 'wh_shop=1' });
  const { ui } = r;
  assert.ok(await ui.findByText('Your basket is empty.'));
  assert.equal(ui.getByRole('link', { name: 'Carry on shopping' }).getAttribute('href'), `${BASE}/shop`);
  assert.ok(ui.queryByRole('button', { name: /^Pay/ }) === null);
});

test('a shop not taking online orders says so where Pay would be', async () => {
  r = await openCheckout({ answer: basket({ taking: false, notTaking: 'Not taking online orders right now. Ask in the shop, or call us, to buy this' }) });
  const { ui } = r;
  assert.ok(await ui.findByText('Not taking online orders right now.'));
  assert.ok(ui.queryByRole('button', { name: /^Pay/ }) === null);
});

test('a lost connection on Pay says “Something went wrong — try again” and keeps what was typed', async () => {
  r = await openCheckout({ pay: () => { throw new TypeError('Failed to fetch'); } });
  const { ui } = r;
  const { fireEvent } = await rtl();
  await ui.findByRole('region', { name: 'Your order' });
  await typeIn(ui, 'Name', MAYA.name);
  fireEvent.click(ui.getByRole('button', { name: 'Pay £66.00' }));
  assert.equal((await ui.findByRole('alert')).textContent, 'Something went wrong — try again');
  assert.equal(ui.getByRole('textbox', { name: 'Name' }).value, MAYA.name);
});
