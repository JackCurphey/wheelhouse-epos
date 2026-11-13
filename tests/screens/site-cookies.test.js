// The customer website's cookie choices (openspec/changes/website-browse,
// design 4; tasks 8.1-8.3; screens wb-cookies-banner, wb-cookies-choose,
// wb-cookies-saved, wb-cookies-page and wb-cookies-page-plain in browse.mjs).
// The site answer gives each tracking tool's ID only once the visitor's
// wh_cookies choice turns its kind on (server/routes/site.js), so these tests
// answer the same way, reading the page's cookie as the server would.
// Example data from the drawings: North Street Cycles; the tools are the
// registry's own (Google Analytics, Meta (Facebook) Pixel) with bracketed IDs.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderWebsite, TWO_SHOPS, PHONE } from '../helpers/site-screen.js';

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

const GA = { kind: 'Statistics', name: 'Google Analytics', tool: 'google_analytics', id: '[G-ID]' };
const META = { kind: 'Marketing', name: 'Meta (Facebook) Pixel', tool: 'meta_pixel', id: '[Pixel ID]' };
const choices = () => /(?:^|;\s*)wh_cookies=([^;]*)/.exec(document.cookie)?.[1] ?? '';
/** The site answer as the server gives it: kind and name, and the ID once that kind is chosen. */
const withTools = (...tools) => () => {
  const on = new Set(choices().split('.').filter((p) => p.endsWith('-on')).map((p) => p.slice(0, -3)));
  const kindOn = { Statistics: 'measuring', Marketing: 'advertising' };
  return {
    status: 200,
    body: { ...TWO_SHOPS, tracking: tools.map((t) => (on.has(kindOn[t.kind]) ? t : { kind: t.kind, name: t.name })) },
  };
};
const scripts = () => [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src'));
const gaScript = () => scripts().find((src) => src.includes('googletagmanager.com'));
const metaScript = () => scripts().find((src) => src.includes('connect.facebook.net'));
// jsdom has no showModal; the native dialog opens as a browser's would.
// Called after renderWebsite, which makes each test's window.
const stubDialog = () => {
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; this.dispatchEvent(new window.Event('close')); };
};

test('wb-cookies-banner: a shop with a tracking tool asks first, and no tool script is on the page until Accept all', async () => {
  r = await renderWebsite({ site: withTools(GA) });
  const { ui } = r;
  const banner = await ui.findByRole('region', { name: 'Cookie choices' });
  assert.ok(banner.querySelector('h2')?.textContent === 'Cookies on this website');
  assert.match(banner.textContent, /We use the cookies the site needs to work\. With your OK, we’d also like to use Google Analytics to see how people use the site\./);
  const about = ui.getByRole('link', { name: 'About cookies' });
  assert.equal(about.getAttribute('href'), '/store/north/cookies');
  const buttons = [...banner.querySelectorAll('button')].map((b) => b.textContent);
  assert.deepEqual(buttons, ['Reject all', 'Accept all', 'Choose']);
  assert.equal(gaScript(), undefined, 'nothing loads before the visitor says yes');

  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(ui.getByRole('button', { name: 'Accept all' }));
  // wb-cookies-saved: the banner goes, the toast says so, and the tool loads with its ID.
  const toast = await ui.findByRole('status');
  assert.equal(toast.textContent, 'Your cookie choices are saved');
  assert.ok(ui.queryByRole('region', { name: 'Cookie choices' }) === null);
  assert.match(choices(), /^measuring-on\.advertising-on$/);
  await ui.findByText('Your cookie choices are saved');
  await waitFor(() => gaScript());
  assert.equal(gaScript(), 'https://www.googletagmanager.com/gtm.js?id=%5BG-ID%5D');
  // The saved message goes by itself after about 5 seconds (decided while building).
  const { waitFor: wait } = await import('@testing-library/react');
  await wait(() => assert.ok(ui.queryByRole('status') === null), { timeout: 7000 });
});

test('Reject all is remembered in wh_cookies: no banner on the next visit, and no tool script', async () => {
  r = await renderWebsite({ site: withTools(GA, META) });
  const { ui } = r;
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(await ui.findByRole('button', { name: 'Reject all' }));
  await ui.findByText('Your cookie choices are saved');
  assert.equal(choices(), 'measuring-off.advertising-off');
  assert.equal(gaScript(), undefined);
  assert.equal(metaScript(), undefined);
  // The next page load: the choice is read back and the banner stays away.
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  r.client.clear();
  const kept = document.cookie;
  r.uninstall();
  r = await renderWebsite({ site: withTools(GA, META), cookie: kept });
  await r.ui.findByRole('link', { name: 'North Street Cycles' });
  assert.ok(r.ui.queryByRole('region', { name: 'Cookie choices' }) === null);
  assert.equal(gaScript(), undefined);
});

test('no tracking tool: no banner and no Cookie choices button (wb-cookies-page-plain’s shop)', async () => {
  r = await renderWebsite();
  const { ui } = r;
  await ui.findByRole('link', { name: 'North Street Cycles' });
  assert.ok(ui.queryByRole('region', { name: 'Cookie choices' }) === null);
  assert.ok(ui.queryByRole('button', { name: 'Cookie choices' }) === null);
  assert.equal(choices(), '', 'no choice cookie is written for a shop that needs none');
});

test('wb-cookies-choose: rows for the kinds the shop has; Save my choices turns on only what was switched on', async () => {
  r = await renderWebsite({ site: withTools(GA, META) });
  stubDialog();
  const { ui } = r;
  const { fireEvent, within } = await import('@testing-library/react');
  fireEvent.click(await ui.findByRole('button', { name: 'Choose' }));
  const dialog = await ui.findByRole('dialog', { name: 'Choose cookies' });
  const d = within(dialog);
  d.getByText('Change these any time from “Cookie choices” at the bottom of every page');
  d.getByText('Needed for the site to work');
  d.getByText('Your basket, signing in, the shop you’ve chosen, and these choices.');
  d.getByText('Always on');
  d.getByText('Google Analytics, added by North Street Cycles, to count visits and see which pages are used.');
  d.getByText('Meta (Facebook) Pixel, added by North Street Cycles, to show you its adverts elsewhere.');
  const measuring = d.getByRole('switch', { name: 'Measuring visits' });
  const advertising = d.getByRole('switch', { name: 'Advertising' });
  assert.equal(measuring.getAttribute('aria-checked'), 'false');
  assert.equal(advertising.getAttribute('aria-checked'), 'false');
  assert.match(measuring.textContent, /Off/);
  fireEvent.click(measuring);
  assert.equal(measuring.getAttribute('aria-checked'), 'true');
  assert.match(measuring.textContent, /On/);
  assert.deepEqual([...dialog.querySelectorAll('button')].slice(-2).map((b) => b.textContent), ['Reject all', 'Save my choices']);
  fireEvent.click(d.getByRole('button', { name: 'Save my choices' }));
  await ui.findByText('Your cookie choices are saved');
  assert.equal(choices(), 'measuring-on.advertising-off');
  await waitFor(() => gaScript());
  assert.equal(metaScript(), undefined, 'advertising stayed off');
});

test('Choose cookies shows only the kinds the shop has, and the footer’s Cookie choices opens it again', async () => {
  r = await renderWebsite({ site: withTools(GA), cookie: 'wh_cookies=measuring-off.advertising-off' });
  stubDialog();
  const { ui } = r;
  const { fireEvent, within } = await import('@testing-library/react');
  // A choice made: no banner; the footer button reopens the choices.
  const reopen = await ui.findByRole('button', { name: 'Cookie choices' });
  assert.ok(ui.queryByRole('region', { name: 'Cookie choices' }) === null);
  fireEvent.click(reopen);
  const d = within(await ui.findByRole('dialog', { name: 'Choose cookies' }));
  d.getByRole('switch', { name: 'Measuring visits' });
  assert.ok(d.queryByRole('switch', { name: 'Advertising' }) === null);
});

test('wb-cookies-page: the table from the one list in the code, the tools added, what was chosen, Change cookie choices', async () => {
  r = await renderWebsite({ url: '/cookies', site: withTools(GA), cookie: 'wh_cookies=measuring-off.advertising-off' });
  stubDialog();
  const { ui } = r;
  await ui.findByRole('heading', { level: 1, name: 'Cookies' });
  assert.equal(document.title.split(' · ')[0], 'Cookies');
  ui.getByRole('heading', { level: 2, name: 'What this website uses' });
  const table = ui.getByRole('table', { name: 'Cookies this website sets' });
  const head = [...table.querySelectorAll('th[scope="col"]')].map((th) => th.textContent);
  assert.deepEqual(head, ['Cookie', 'What it’s for', 'How long']);
  const rows = [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent));
  assert.deepEqual(rows, [
    ['wh_customer_session', 'Keeps you signed in', '30 days'],
    ['wh_shop', 'Remembers the shop you collect from', '1 year'],
    ['wh_cookies', 'Remembers your cookie choices', '6 months'],
  ]);
  ui.getByText('These are needed for the site to work, so they don’t need your OK.');
  ui.getByRole('heading', { level: 2, name: 'Tools the shop has added' });
  ui.getByText('Google Analytics — measuring visits.');
  assert.equal(ui.getByText('You said no to measuring visits.').tagName, 'STRONG');
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(ui.getByRole('button', { name: 'Change cookie choices' }));
  await ui.findByRole('dialog', { name: 'Choose cookies' });
});

test('wb-cookies-page before any choice, and after a yes: what it says for each kind', async () => {
  r = await renderWebsite({ url: '/cookies', site: withTools(GA, META) });
  const { ui } = r;
  await ui.findByRole('heading', { level: 1, name: 'Cookies' });
  ui.getByText('Google Analytics — measuring visits.');
  ui.getByText('Meta (Facebook) Pixel — advertising.');
  assert.equal(ui.getByText('You haven’t chosen yet about measuring visits.').tagName, 'STRONG');
  ui.getByText('You haven’t chosen yet about advertising.');
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(ui.getByRole('button', { name: 'Accept all' }));
  await ui.findByText('You said yes to measuring visits.');
  ui.getByText('You said yes to advertising.');
});

test('wb-cookies-page-plain: a shop with no tool lists only what the site needs, with nothing to choose', async () => {
  r = await renderWebsite({ url: '/cookies' });
  const { ui } = r;
  await ui.findByRole('heading', { level: 1, name: 'Cookies' });
  const rows = [...ui.getByRole('table', { name: 'Cookies this website sets' }).querySelectorAll('tbody tr')].map((tr) => tr.firstElementChild.textContent);
  assert.deepEqual(rows, ['wh_customer_session', 'wh_shop'], 'no choice cookie for a shop that asks nothing');
  ui.getByText('This website doesn’t use any other cookies, so there’s nothing for you to choose.');
  assert.ok(ui.queryByRole('button', { name: 'Change cookie choices' }) === null);
});

test('on a phone the banner is fixed to the bottom, full width, with its buttons two to a row', async () => {
  r = await renderWebsite({ site: withTools(GA), media: PHONE });
  const banner = await r.ui.findByRole('region', { name: 'Cookie choices' });
  assert.match(banner.className, /\bfixed\b/);
  assert.match(banner.className, /\binset-x-0\b/);
  assert.match(banner.className, /\bbottom-0\b/);
  assert.match(banner.querySelector('button').parentElement.className, /\bgrid-cols-2\b/);
});

test('the Cookies page’s list matches what the server really sets', async () => {
  const { COOKIES } = await import(new URL('../../.test-build/website/cookie-list.js', import.meta.url).href);
  const { CUSTOMER_SESSION_COOKIE, CUSTOMER_SESSION_MAX_AGE_SECONDS } = await import('../../server/customer-auth.js');
  const { COOKIE_CHOICES, CHOICE_FOR_KIND: serverKinds } = await import('../../server/routes/site.js');
  const { CHOICE_FOR_KIND } = await import(new URL('../../.test-build/website/cookie-list.js', import.meta.url).href);
  assert.deepEqual(CHOICE_FOR_KIND, serverKinds, 'the page offers a row for every kind the server holds an ID back for');
  const byName = new Map(COOKIES.map((c) => [c.name, c]));
  assert.equal(byName.get(CUSTOMER_SESSION_COOKIE)?.seconds, CUSTOMER_SESSION_MAX_AGE_SECONDS);
  assert.ok(byName.has(COOKIE_CHOICES));
  assert.ok(byName.has('wh_shop'));
});

async function waitFor(check) {
  const { waitFor: wait } = await import('@testing-library/react');
  return wait(() => assert.ok(check()));
}
