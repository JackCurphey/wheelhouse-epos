// The chosen shop, Our shops and each shop's page (openspec/changes/
// website-browse, tasks 7.1-7.4; wb-choose-shop, the chip, wb-shops,
// wb-shop-page, wb-shop-collect and wb-find-us in browse.mjs). Example data
// from the drawings: North Street Cycles, Bolton and "[Second site]". The
// shared address, phone and hours are on the first shop only (Jack's answer
// 1, 12 Nov). The opening times, today's date (a Thursday, as drawn) and the
// closure's dates are stand-ins for the drawings' "[opening hours]",
// "[(today)]" and "[holiday dates]".
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

const rtl = () => import('@testing-library/react');
const href = (el) => el.getAttribute('href');

// Open Monday to Saturday; today is Thursday 3 Sep 2026; closed 25 and 26 Dec.
const WEEK = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, open: '[open]', close: '[close]' }));
const BOLTON = {
  id: 1, name: 'Bolton', address: '[Shop address]', phone: '[shop phone]', email: '[shop email]',
  hours: WEEK, todayDate: '2026-09-03', today: { open: '[open]', close: '[close]' }, nextOpening: null,
  closures: [{ from: '2026-12-25', to: '2026-12-26' }],
};
const SECOND = { id: 2, name: '[Second site]' };
const SHOPS = { ...TWO_SHOPS, shops: [BOLTON, SECOND] };
const ONE = { ...TWO_SHOPS, shops: [BOLTON] };

const open = (url, extra = {}) => renderWebsite({ url, site: SHOPS, ...extra });

/** Every string written to document.cookie from now on (each still reaches the page). */
function recordCookies() {
  let owner = document;
  let real;
  while (owner && !(real = Object.getOwnPropertyDescriptor(owner, 'cookie'))) owner = Object.getPrototypeOf(owner);
  const writes = [];
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get() { return real.get.call(document); },
    set(value) { writes.push(value); real.set.call(document, value); },
  });
  return writes;
}
const shopAsks = () => r.requests.map((q) => new URL(q.url, 'http://localhost')).filter((u) => u.pathname.startsWith(`${BASE}/api/site/`)).map((u) => u.searchParams.get('shop'));

// ---------- 7.1 the wh_shop cookie ----------

test('choosing a shop sets wh_shop: the site id, a year, SameSite=Lax, for this shop’s address only', async () => {
  r = await open('/');
  const { fireEvent } = await rtl();
  const chip = await r.ui.findByRole('button', { name: 'Choose a shop to collect from' });
  const writes = recordCookies();
  fireEvent.click(chip);
  fireEvent.click(r.ui.getByRole('button', { name: /^Bolton/ }));
  assert.deepEqual(writes, [`wh_shop=1; Max-Age=31536000; Path=${BASE}; SameSite=Lax`]);
  assert.ok(document.cookie.includes('wh_shop=1'));
  // A needed cookie, read by the page itself: never HttpOnly (design 4).
  assert.ok(!/httponly/i.test(writes[0]));
  // The page now asks for that shop's stock.
  await r.ui.findByRole('button', { name: 'Collecting from North Street Cycles, Bolton — change the shop' });
  assert.equal(shopAsks().at(-1), '1');
});

test('the cookie is read on every visit: the chip and every answer name the remembered shop', async () => {
  r = await open('/', { cookie: 'wh_shop=2' });
  const chip = await r.ui.findByRole('button', { name: 'Collecting from North Street Cycles, [Second site] — change the shop' });
  assert.equal(chip.textContent, 'Collecting from [Second site] · Change');
  await r.ui.findByRole('link', { name: /Shimano brake pads/ });
  assert.ok(shopAsks().includes('2'));
});

test('a cookie naming a shop the business doesn’t have is ignored: Choose a shop, and no answer asks for it', async () => {
  r = await open('/', { cookie: 'wh_shop=99' });
  await r.ui.findByRole('button', { name: 'Choose a shop to collect from' });
  await r.ui.findByRole('link', { name: /Shimano brake pads/ });
  assert.ok(!shopAsks().includes('99'), JSON.stringify(shopAsks()));
  assert.ok(shopAsks().every((s) => s === null));
});

// ---------- 7.2 the chip and wb-choose-shop ----------

test('the chip says Choose a shop and opens "Which shop will you collect from?" (wb-choose-shop)', async () => {
  r = await open('/');
  const { fireEvent, within } = await rtl();
  const chip = await r.ui.findByRole('button', { name: 'Choose a shop to collect from' });
  assert.equal(chip.textContent, 'Choose a shop');
  assert.equal(chip.querySelector('strong')?.textContent, 'Choose a shop');
  assert.ok(r.ui.queryByRole('dialog') === null);

  fireEvent.click(chip);
  const box = r.ui.getByRole('dialog', { name: 'Which shop will you collect from?' });
  const sub = document.getElementById(box.getAttribute('aria-describedby'));
  assert.equal(sub?.textContent, 'We’ll remember it, and show when things are ready there');
  const group = within(box).getByRole('group', { name: 'Which shop will you collect from?' });
  const shops = within(group).getAllByRole('button');
  assert.deepEqual(shops.map((b) => b.firstElementChild.textContent), ['Bolton', '[Second site]']);
  // The shared address and today's hours on the first shop only (Jack's answer 1).
  assert.equal(shops[0].lastElementChild.textContent, '[Shop address] · Open today [open]–[close]');
  assert.equal(shops[1].children.length, 1);
  assert.ok(within(box).getByRole('button', { name: 'Cancel' }));
  assert.ok(within(box).getByRole('button', { name: 'Close' }));

  // One tap chooses: the box closes, the chip names the shop, and focus is back on the chip.
  fireEvent.click(shops[0]);
  assert.ok(r.ui.queryByRole('dialog') === null);
  const chosen = r.ui.getByRole('button', { name: 'Collecting from North Street Cycles, Bolton — change the shop' });
  assert.equal(chosen.textContent, 'Collecting from Bolton · Change');
  assert.equal(chosen.querySelector('strong')?.textContent, 'Bolton');
  assert.ok(document.activeElement === chosen);
});

test('Change picks another shop; Cancel, Close and Esc leave the choice as it was', async () => {
  r = await open('/', { cookie: 'wh_shop=1' });
  const { fireEvent } = await rtl();
  const chip = await r.ui.findByRole('button', { name: /Collecting from North Street Cycles, Bolton/ });
  for (const how of ['Cancel', 'Close', 'Escape']) {
    fireEvent.click(chip);
    const box = r.ui.getByRole('dialog');
    if (how === 'Escape') fireEvent.keyDown(box, { key: 'Escape' });
    else fireEvent.click(r.ui.getByRole('button', { name: how }));
    assert.ok(r.ui.queryByRole('dialog') === null, how);
    assert.ok(document.activeElement === chip, how);
    assert.equal(chip.textContent, 'Collecting from Bolton · Change');
  }
  fireEvent.click(chip);
  fireEvent.click(r.ui.getByRole('button', { name: '[Second site]' }));
  assert.equal(r.ui.getByRole('button', { name: /change the shop/ }).textContent, 'Collecting from [Second site] · Change');
  assert.ok(document.cookie.includes('wh_shop=2'));
});

test('on a phone the chip is a line at the top of the page, and opens the same box', async () => {
  r = await open('/', { media: (q) => /max-width:\s*(767|1023)px/.test(q) });
  const { fireEvent } = await rtl();
  const line = await r.ui.findByRole('button', { name: 'Choose a shop to collect from' });
  assert.ok(document.getElementById('main-content').contains(line));
  fireEvent.click(line);
  fireEvent.click(r.ui.getByRole('button', { name: /^Bolton/ }));
  const chosen = r.ui.getByRole('button', { name: /Collecting from/ });
  assert.equal(chosen.textContent, 'Collecting from Bolton' + 'Change');
});

// ---------- 7.3 wb-shops and wb-shop-page ----------

test('Our shops (wb-shops): a card for each shop, with today’s hours, Book a repair here and Directions', async () => {
  r = await open('/shops');
  const { within } = await rtl();
  await r.ui.findByRole('heading', { level: 1, name: 'Our shops' });
  assert.equal(document.title, 'Our shops · North Street Cycles');
  const nav = r.ui.getByRole('navigation', { name: 'Website' });
  assert.equal(within(nav).getByRole('link', { name: 'Our shops' }).getAttribute('aria-current'), 'page');

  const [bolton, second] = r.ui.getAllByRole('heading', { level: 3 });
  assert.deepEqual([bolton.textContent, second.textContent], ['Bolton', '[Second site]']);
  assert.equal(href(within(bolton).getByRole('link')), `${BASE}/shops/1`);
  assert.equal(href(within(second).getByRole('link')), `${BASE}/shops/2`);
  const boltonCard = bolton.parentElement.parentElement;
  assert.ok(boltonCard.textContent.includes('[Shop address]'));
  assert.ok(boltonCard.textContent.includes('Open today [open]–[close]'));
  assert.equal(href(within(boltonCard).getByRole('link', { name: '[shop phone]' })), 'tel:[shopphone]');
  assert.equal(href(within(boltonCard).getByRole('link', { name: 'Book a repair here' })), '/book/north?site=1');
  const directions = within(boltonCard).getByRole('link', { name: 'Directions to Bolton (opens your maps app)' });
  assert.equal(href(directions), 'https://www.google.com/maps/dir/?api=1&destination=%5BShop%20address%5D');
  assert.equal(directions.getAttribute('target'), '_blank');
  // The second shop has its name only until Multiple sites (Jack's answer 1).
  const secondCard = second.parentElement.parentElement;
  assert.equal(href(within(secondCard).getByRole('link', { name: 'Book a repair here' })), '/book/north?site=2');
  assert.ok(within(secondCard).queryByRole('link', { name: /Directions/ }) === null);
  assert.ok(!secondCard.textContent.includes('[Shop address]'));
});

test('a closed day’s card says when the shop next opens', async () => {
  r = await open('/shops', { site: { ...SHOPS, shops: [{ ...BOLTON, today: null, nextOpening: { date: '2026-09-04', open: '[open]' } }, SECOND] } });
  await r.ui.findByRole('heading', { level: 1, name: 'Our shops' });
  assert.ok(r.ui.getByText((_, el) => el?.textContent === 'Closed today · opens Friday [open]' && el.tagName === 'SPAN'));
});

test('a shop’s page (wb-shop-page): its details, the week with today in bold, its closures, and Collect from here', async () => {
  r = await open('/shops/1');
  const { within } = await rtl();
  await r.ui.findByRole('heading', { level: 1, name: 'North Street Cycles, Bolton' });
  assert.equal(document.title, 'Bolton · North Street Cycles');
  const crumbs = r.ui.getByRole('navigation', { name: 'You are here' });
  assert.equal(crumbs.textContent, 'Our shops › Bolton');
  assert.equal(href(within(crumbs).getByRole('link', { name: 'Our shops' })), `${BASE}/shops`);
  assert.equal(within(crumbs).getByText('Bolton').getAttribute('aria-current'), 'page');
  // Our shops stays marked in the menu on a shop's own page.
  assert.equal(within(r.ui.getByRole('navigation', { name: 'Website' })).getByRole('link', { name: 'Our shops' }).getAttribute('aria-current'), 'page');

  assert.equal(r.ui.getByText('[Shop address]').tagName, 'STRONG');
  assert.equal(href(r.ui.getByRole('link', { name: '[shop phone]' })), 'tel:[shopphone]');
  assert.equal(href(r.ui.getByRole('link', { name: '[shop email]' })), 'mailto:[shop email]');
  assert.equal(href(r.ui.getByRole('link', { name: 'Book a repair here' })), '/book/north?site=1');
  assert.ok(r.ui.getByRole('link', { name: 'Directions to Bolton (opens your maps app)' }));
  assert.ok(r.ui.getByRole('button', { name: 'Collect from here' }));

  const table = r.ui.getByRole('table', { name: 'Opening hours' });
  const rows = within(table).getAllByRole('row');
  assert.deepEqual(rows.map((row) => row.textContent), [
    'Monday[open]–[close]', 'Tuesday[open]–[close]', 'Wednesday[open]–[close]', 'Thursday (today)[open]–[close]',
    'Friday[open]–[close]', 'Saturday[open]–[close]', 'SundayClosed',
  ]);
  // Today in bold, and only today.
  assert.deepEqual(rows.map((row) => row.classList.contains('font-bold')), [false, false, false, true, false, false, false]);
  assert.ok(r.ui.getByText('Closed 25 December to 26 December.'));
});

test('a closure of one day reads as one date, and several are listed in order', async () => {
  r = await open('/shops/1', { site: { ...SHOPS, shops: [{ ...BOLTON, closures: [{ from: '2026-09-07', to: '2026-09-07' }, { from: '2026-10-01', to: '2026-10-02' }] }, SECOND] } });
  await r.ui.findByRole('heading', { level: 1, name: 'North Street Cycles, Bolton' });
  assert.ok(r.ui.getByText('Closed 7 September and 1 October to 2 October.'));
});

test('with no closures and no hours set, neither line nor table shows', async () => {
  r = await open('/shops/1', { site: { ...SHOPS, shops: [{ ...BOLTON, hours: [], today: null, closures: [] }, SECOND] } });
  await r.ui.findByRole('heading', { level: 1, name: 'North Street Cycles, Bolton' });
  assert.ok(r.ui.queryByRole('table') === null);
  assert.ok(r.ui.queryByText(/^Closed /) === null);
});

test('the second shop’s page shows its name, Book a repair here and Collect from here, until it has its own details', async () => {
  r = await open('/shops/2');
  await r.ui.findByRole('heading', { level: 1, name: 'North Street Cycles, [Second site]' });
  assert.equal(href(r.ui.getByRole('link', { name: 'Book a repair here' })), '/book/north?site=2');
  assert.ok(r.ui.getByRole('button', { name: 'Collect from here' }));
  assert.ok(r.ui.queryByText('[Shop address]') === null);
  assert.ok(r.ui.queryByRole('table') === null);
  assert.ok(r.ui.queryByRole('link', { name: /Directions/ }) === null);
});

test('a shop the business doesn’t have opens "We can’t find that page"', async () => {
  for (const url of ['/shops/99', '/shops/abc']) {
    r = await open(url);
    await r.ui.findByRole('heading', { level: 1, name: 'We can’t find that page' });
    r.ui.unmount();
    r.client.clear();
    r.uninstall();
  }
  r = undefined;
});

// ---------- 7.4 wb-shop-collect and wb-find-us ----------

test('Collect from here (wb-shop-collect) chooses the shop: the drawn sentence, the chip changes, the cookie is set', async () => {
  r = await open('/shops/1');
  const { fireEvent } = await rtl();
  const collect = await r.ui.findByRole('button', { name: 'Collect from here' });
  assert.ok(r.ui.getByRole('button', { name: 'Choose a shop to collect from' }));
  const writes = recordCookies();
  fireEvent.click(collect);
  const said = r.ui.getByRole('status');
  assert.equal(said.textContent, 'Collecting from Bolton — what you see now shows when it’s ready here.');
  assert.ok(r.ui.queryByRole('button', { name: 'Collect from here' }) === null);
  // The button it replaced is gone, so focus moves to the sentence.
  assert.ok(document.activeElement === said);
  assert.equal(r.ui.getByRole('button', { name: /change the shop/ }).textContent, 'Collecting from Bolton · Change');
  assert.deepEqual(writes, [`wh_shop=1; Max-Age=31536000; Path=${BASE}; SameSite=Lax`]);
});

test('a shop already chosen says so on its page, in place of Collect from here; the other shop still offers it', async () => {
  r = await open('/shops/1', { cookie: 'wh_shop=1' });
  await r.ui.findByRole('heading', { level: 1, name: 'North Street Cycles, Bolton' });
  assert.equal(r.ui.getByRole('status').textContent, 'Collecting from Bolton — what you see now shows when it’s ready here.');
  assert.ok(r.ui.queryByRole('button', { name: 'Collect from here' }) === null);
  r.ui.unmount();
  r.client.clear();
  r.uninstall();
  r = await open('/shops/2', { cookie: 'wh_shop=1' });
  await r.ui.findByRole('heading', { level: 1, name: 'North Street Cycles, [Second site]' });
  assert.ok(r.ui.getByRole('button', { name: 'Collect from here' }));
});

test('one shop (wb-find-us): Find us is the shop’s page, without Collect from here or a path', async () => {
  for (const url of ['/shops', '/shops/1']) {
    r = await open(url, { site: ONE });
    const { within } = await rtl();
    await r.ui.findByRole('heading', { level: 1, name: 'Find us' });
    assert.equal(document.title, 'Find us · North Street Cycles');
    assert.ok(r.ui.queryByRole('navigation', { name: 'You are here' }) === null, url);
    assert.equal(within(r.ui.getByRole('navigation', { name: 'Website' })).getByRole('link', { name: 'Find us' }).getAttribute('aria-current'), 'page');
    assert.equal(r.ui.getByText('North Street Cycles', { selector: 'strong' }).tagName, 'STRONG');
    assert.ok(r.ui.getByText('[Shop address]'));
    assert.equal(href(r.ui.getByRole('link', { name: 'Book a repair here' })), '/book/north');
    assert.ok(r.ui.getByRole('link', { name: 'Directions to North Street Cycles (opens your maps app)' }));
    assert.ok(r.ui.queryByRole('button', { name: 'Collect from here' }) === null, url);
    assert.ok(r.ui.queryByRole('button', { name: /Choose a shop|Collecting from/ }) === null);
    assert.ok(r.ui.getByRole('table', { name: 'Opening hours' }));
    r.ui.unmount();
    r.client.clear();
    r.uninstall();
  }
  r = undefined;
});
