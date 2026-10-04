// The mockup page itself, in a real browser (issue #123, Codex review point
// 11; docs/superpowers/specs/2026-10-04-mockup-review-fixes.md). Needs the
// built mockup (node mockup/build-mockup.mjs) and Playwright's Chromium.
// Run: node --test 'mockup/browser/*.test.mjs' (from the generator folder).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const out = new URL('../../out-mockup/', import.meta.url);
assert.ok(existsSync(new URL('manifest.json', out)), 'build the mockup first: node mockup/build-mockup.mjs');
const M = JSON.parse(readFileSync(new URL('manifest.json', out), 'utf8'));
const fileOf = (id, size = 'desktop') => M.screens[id].sizes[size].file;
const TYPES = { html: 'text/html', json: 'application/json' };

let server, base, browser;
before(async () => {
  server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname.slice(1)) || 'index.html';
    const f = new URL(path, out);
    if (path.includes('..') || !existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.split('.').pop()] ?? 'application/octet-stream' });
    res.end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/index.html`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

// A fresh page with nothing remembered; `stored` presets the bar's boxes.
async function open(hash = '', { stored = {}, viewport, colorScheme } = {}) {
  const ctx = await browser.newContext({ viewport: viewport ?? { width: 1400, height: 900 }, colorScheme });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem('wh-mockup-' + k, v); }, stored);
  const page = await ctx.newPage();
  await page.goto(base + (hash ? '#' + hash : ''));
  return page;
}
const shown = (page) => page.evaluate(() => document.querySelector('#stage .frame')?.dataset.screen ?? null);
const showing = (page, id) => page.waitForFunction((id) => document.querySelector('#stage .frame')?.dataset.screen === id, id, { timeout: 5000 });
const hash = (page) => page.evaluate(() => location.hash.slice(1));
const value = (page, sel) => page.$eval(sel, (e) => e.value);
const settle = (page) => page.waitForTimeout(300);

test('1: a drawing that arrives late never replaces the screen opened after it', async () => {
  const page = await open('map');
  await showing(page, 'map');
  let release;
  const held = new Promise((r) => { release = r; });
  await page.route(`**/data/${fileOf('wb-home')}.json`, async (r) => { await held; await r.continue(); });
  await page.evaluate(() => { location.hash = 'wb-home'; });
  await page.evaluate(() => { location.hash = 'bk-service'; });
  await showing(page, 'bk-service');
  release();
  await settle(page);
  assert.equal(await shown(page), 'bk-service');
  assert.equal(await page.textContent('#title'), M.screens['bk-service'].title);
  assert.equal(await hash(page), 'bk-service');
  await page.context().close();
});

test('2: Person moves only between the screen and its views for a person', async () => {
  const page = await open('op-today', { stored: { person: 'Manager', shop: 'Bolton' } });
  await showing(page, 'op-today');
  await page.selectOption('#person', 'Staff');
  await settle(page);
  assert.equal(await shown(page), 'op-today-staff');
  await page.selectOption('#person', 'Owner');
  await settle(page);
  assert.equal(await shown(page), 'op-today');
  await page.context().close();
});

// Codex's point 3 is about clicks into a screen: on-settings's sidebar links
// to op-today and rp-home.
test('3: a click into a screen opens its view for the chosen shop, or the person’s own view, and says so', async () => {
  const page = await open('on-settings', { stored: { person: 'Owner', shop: 'All shops' } });
  await showing(page, 'on-settings');
  await page.click('#stage [data-go="op-today"] >> nth=0');
  await settle(page);
  assert.equal(await shown(page), 'ms-today-all');
  const p2 = await open('on-settings', { stored: { person: 'Staff', shop: 'All shops' } });
  await showing(p2, 'on-settings');
  await p2.click('#stage [data-go="rp-home"] >> nth=0');
  await settle(p2);
  assert.equal(await shown(p2), 'rp-home-staff');
  assert.match(await p2.textContent('#note'), /No All shops view/);
  await page.context().close(); await p2.context().close();
});

test('4: Back takes a story back a step; choosing a person off the path keeps them', async () => {
  const page = await open('map');
  await showing(page, 'map');
  await page.selectOption('#story', '1');
  const [s0, s1, s2] = M.stories.find((s) => s.n === 1).steps;
  await showing(page, s0.id);
  await page.click('#next');
  await showing(page, s1.id);
  await page.click('#back');
  await showing(page, s0.id);
  assert.match(await page.textContent('#stepText'), /step 1 of/);
  await page.click('#next');
  await showing(page, s1.id);
  assert.match(await page.textContent('#stepText'), /step 2 of/);
  assert.notEqual(await shown(page), s2.id);
  await page.selectOption('#story', '2');
  await showing(page, 'till-checkin');
  await page.selectOption('#person', 'Mechanic');
  await settle(page);
  assert.equal(await value(page, '#person'), 'Mechanic');
  await page.context().close();
});

test('5: changing Size keeps the screen, and the address names what is shown', async () => {
  const page = await open('rp-home', { stored: { person: 'Owner', shop: 'All shops' } });
  await showing(page, 'rp-home');
  await page.selectOption('#size', 'tablet');
  await settle(page);
  assert.equal(await shown(page), 'rp-home');
  assert.equal(await hash(page), 'rp-home');
  await page.context().close();
});

test('6: the first screen is recorded, so Back returns to it', async () => {
  const page = await open();
  await showing(page, 'map');
  assert.equal(await hash(page), 'map');
  await page.evaluate(() => { location.hash = 'op-today'; });
  await showing(page, 'op-today');
  await page.click('#back');
  await showing(page, 'map');
  await page.context().close();
});

test('7: “Back at Bolton” sets the shop to Bolton, and Back restores [Second site]', async () => {
  const page = await open('ms-request-from-shop', { stored: { person: 'Staff', shop: 'Bolton' } });
  await showing(page, 'ms-request-from-shop');
  assert.equal(await value(page, '#shop'), '[Second site]');
  await page.click('#stage [data-go="ms-request-answered"]');
  await showing(page, 'ms-request-answered');
  assert.equal(await value(page, '#shop'), 'Bolton');
  await page.click('#back');
  await showing(page, 'ms-request-from-shop');
  assert.equal(await value(page, '#shop'), '[Second site]');
  await page.context().close();
});

test('8: a drawing that fails to load says so, leaves the screen as it was, and can be tried again', async () => {
  const page = await open('map');
  await showing(page, 'map');
  let asked = 0;
  await page.route(`**/data/${fileOf('rp-home')}.json`, (r) => (++asked === 1 ? r.fulfill({ status: 500, body: 'no' }) : r.continue()));
  await page.evaluate(() => { location.hash = 'rp-home'; });
  await page.waitForSelector('#retry:not([hidden])', { timeout: 5000 });
  assert.match(await page.textContent('#note'), /couldn’t load/i);
  assert.equal(await shown(page), 'map');
  assert.equal(await page.textContent('#title'), M.screens.map.title);
  await page.click('#retry');
  await showing(page, 'rp-home');
  assert.equal(asked, 2);
  await page.context().close();
});

const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
test('9: on a phone the bar fits the screen, and Actual size scrolls inside the drawing only', async () => {
  const page = await open('map', { viewport: { width: 390, height: 844 } });
  await showing(page, 'map');
  await page.selectOption('#story', String(M.stories[0].n));
  await showing(page, M.stories[0].steps[0].id);
  await page.selectOption('#size', 'desktop');
  await page.evaluate(() => { location.hash = 'map'; });
  await showing(page, 'map');
  assert.ok(await noSideScroll(page), 'the page scrolls sideways at 390px');
  await page.click('#zoom');
  await settle(page);
  assert.equal(await page.$eval('#stage .frame', (f) => f.style.transform), 'scale(1)');
  assert.ok(await page.$eval('#stage', (s) => s.scrollWidth > s.clientWidth), 'the drawing area scrolls sideways at actual size');
  assert.ok(await noSideScroll(page), 'the page scrolls sideways at actual size');
  await page.context().close();
});

// A drawing with a skip link, from the built data.
const SKIP = (() => { for (const [id, s] of Object.entries(M.screens)) { if (!s.sizes.desktop) continue; const h = JSON.parse(readFileSync(new URL(`data/${s.sizes.desktop.file}.json`, out), 'utf8'))[id]; if (/Skip to the main content/.test(h) && /id="main-content"/.test(h)) return id; } })();
test('10: a keyboard click moves focus to the new screen’s title; the skip link reaches the content', async () => {
  const page = await open('op-today', { stored: { person: 'Manager', shop: 'Bolton' } });
  await showing(page, 'op-today');
  await page.focus('#stage [data-go="ms-switch-open"]');
  await page.keyboard.press('Enter');
  await showing(page, 'ms-switch-open');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'title');
  assert.ok(SKIP, 'a drawing with a skip link');
  await page.evaluate((id) => { location.hash = id; }, SKIP);
  await showing(page, SKIP);
  const skip = page.locator('#stage a', { hasText: 'Skip to the main content' }).first();
  await skip.focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.$eval('#stage .frame', (f) => f.shadowRoot.activeElement?.id), 'main-content');
  await page.context().close();
});

test('13: in dark mode the drawings stay light', async () => {
  const page = await open('map', { colorScheme: 'dark' });
  await showing(page, 'map');
  assert.equal(await page.$eval('#stage .frame', (f) => getComputedStyle(f).colorScheme), 'light');
  await page.context().close();
});

// Every story, step by step with Next, shows each step and its counter.
test('every story walks start to finish with Next', async () => {
  const page = await open('map');
  await showing(page, 'map');
  const bad = [];
  for (const st of M.stories) {
    await page.selectOption('#story', String(st.n));
    for (let i = 0; i < st.steps.length; i++) {
      if (i) await page.click('#next');
      try { await showing(page, st.steps[i].id); } catch { bad.push(`story ${st.n}, step ${i + 1}: showing ${await shown(page)}, want ${st.steps[i].id}`); break; }
      if (!(await page.textContent('#stepText')).includes(`step ${i + 1} of`)) bad.push(`story ${st.n}, step ${i + 1}: counter says ${await page.textContent('#stepText')}`);
    }
  }
  assert.deepEqual(bad, []);
  await page.context().close();
});

// The fresh review of the first fixes (4 Oct), each reproduced before fixing.
const hold = async (page, file) => { let release; const held = new Promise((r) => { release = r; }); await page.route(`**/data/${file}.json`, async (r) => { await held; await r.continue(); }); return release; };

test('review 1: the shop switcher stays itself for an owner at any shop', async () => {
  const page = await open('op-today', { stored: { person: 'Owner', shop: 'Bolton' } });
  await showing(page, 'op-today');
  await page.click('#stage [data-go="ms-switch-open"] >> nth=0');
  await showing(page, 'ms-switch-open');
  assert.equal(await value(page, '#shop'), 'Bolton');
  await page.selectOption('#shop', 'All shops');
  await page.selectOption('#shop', 'Bolton');
  await settle(page);
  assert.equal(await shown(page), 'ms-switch-open');
  await page.context().close();
});

test('review 2: a person chosen while a screen loads is kept', async () => {
  const page = await open('map', { stored: { person: 'Owner', shop: 'Bolton' } });
  await showing(page, 'map');
  const release = await hold(page, fileOf('rp-vat'));
  await page.evaluate(() => { location.hash = 'rp-vat'; });
  await page.selectOption('#person', 'Mechanic');
  release();
  await showing(page, 'rp-vat');
  await settle(page);
  assert.equal(await value(page, '#person'), 'Mechanic');
  await page.context().close();
});

test('review 3: at All shops a manager gets the all-shops view where one is drawn', async () => {
  const page = await open('op-today', { stored: { person: 'Manager', shop: 'Bolton' } });
  await showing(page, 'op-today');
  await page.selectOption('#shop', 'All shops');
  await settle(page);
  assert.equal(await shown(page), 'ms-today-all');
  await page.context().close();
});

test('review 4: a story whose first drawing fails leaves the bar and Back as they were', async () => {
  const page = await open('map', { stored: { person: 'Owner', shop: 'Bolton' } });
  await showing(page, 'map');
  await page.evaluate(() => { location.hash = 'rp-sales'; });
  await showing(page, 'rp-sales');
  const st = M.stories.find((s) => s.n === 2);
  await page.route(`**/data/${fileOf(st.steps[0].id, st.size || 'desktop')}.json`, (r) => r.fulfill({ status: 500, body: 'no' }));
  await page.selectOption('#story', '2');
  await page.waitForSelector('#retry:not([hidden])', { timeout: 5000 });
  assert.equal(await value(page, '#person'), 'Owner');
  assert.equal(await shown(page), 'rp-sales');
  await page.click('#back');
  await showing(page, 'map');
  await page.context().close();
});

test('review 5: a list of screens that fails to load says so and can be tried again', async () => {
  const ctx = await browser.newContext();
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  let asked = 0;
  await ctx.route('**/manifest.json', (r) => (++asked === 1 ? r.fulfill({ status: 500, body: 'no' }) : r.continue()));
  const page = await ctx.newPage();
  await page.goto(base);
  await page.waitForSelector('#retry:not([hidden])', { timeout: 5000 });
  await page.click('#retry');
  await showing(page, 'map');
  await ctx.close();
});

test('review 6: changing Size while a screen loads still opens that screen', async () => {
  const page = await open('map');
  await showing(page, 'map');
  const release = await hold(page, fileOf('rp-vat'));
  await page.evaluate(() => { location.hash = 'rp-vat'; });
  await page.selectOption('#size', 'tablet');
  await showing(page, 'rp-vat');
  release();
  await settle(page);
  assert.equal(await shown(page), 'rp-vat');
  await page.context().close();
});

test('review 7: Back clears an old note; an unknown address is put back', async () => {
  const page = await open('map', { stored: { person: 'Owner', shop: 'Bolton' } });
  await showing(page, 'map');
  await page.evaluate(() => { location.hash = 'rp-sales'; });
  await showing(page, 'rp-sales');
  await page.selectOption('#shop', '[Second site]');
  await settle(page);
  assert.equal(await page.isHidden('#note'), false);
  await page.click('#back');
  await showing(page, 'map');
  assert.equal(await page.isHidden('#note'), true);
  await page.evaluate(() => { location.hash = 'nope'; });
  await settle(page);
  assert.equal(await hash(page), 'map');
  await page.context().close();
});

test('review 8: going back to the screen shown while a story loads cancels the story', async () => {
  const page = await open('map');
  await showing(page, 'map');
  const st = M.stories[0];
  const release = await hold(page, fileOf(st.steps[0].id, st.size || 'desktop'));
  await page.selectOption('#story', String(st.n));
  await page.evaluate(() => { location.hash = 'op-today'; location.hash = 'map'; });
  await settle(page);
  release();
  await settle(page);
  assert.equal(await shown(page), 'map');
  assert.equal(await hash(page), 'map');
  await page.context().close();
});
