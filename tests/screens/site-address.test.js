// The website's address helpers: the wh_shop cookie as written and as read
// (openspec/changes/website-browse, design 4; task 7.1). Run from the
// .test-build that `npm run pretest` makes.
import test from 'node:test';
import assert from 'node:assert/strict';

const address = () => import(new URL('../../.test-build/website/address.js', import.meta.url).href);
const at = (base) => ({ base, slug: 'north', storefrontSlug: null });

test('the wh_shop cookie as written: the site id, a year, SameSite=Lax, the shop’s own path, Secure on https only', async () => {
  const { chosenShopCookieText } = await address();
  assert.equal(chosenShopCookieText(1, at('/store/north'), false), 'wh_shop=1; Max-Age=31536000; Path=/store/north; SameSite=Lax');
  // On the shop's own address the base is '' and the cookie covers the whole address.
  assert.equal(chosenShopCookieText(2, at(''), false), 'wh_shop=2; Max-Age=31536000; Path=/; SameSite=Lax');
  assert.equal(chosenShopCookieText(2, at(''), true), 'wh_shop=2; Max-Age=31536000; Path=/; SameSite=Lax; Secure');
  assert.equal(chosenShopCookieText(1, at('/store/north'), true), 'wh_shop=1; Max-Age=31536000; Path=/store/north; SameSite=Lax; Secure');
  assert.ok(!/httponly/i.test(chosenShopCookieText(1, at(''), true)));
});

test('reading wh_shop gives a positive whole-number id, or null', async () => {
  const { chosenShopCookie } = await address();
  assert.equal(chosenShopCookie('wh_shop=1'), 1);
  assert.equal(chosenShopCookie('other=x; wh_shop=12; more=y'), 12);
  assert.equal(chosenShopCookie(''), null);
  assert.equal(chosenShopCookie('other=1'), null);
  for (const bad of ['abc', '0', '-1', '1.5', '1e0', '', ' ', '0x1', '+1']) {
    assert.equal(chosenShopCookie(`wh_shop=${bad}`), null, JSON.stringify(bad));
  }
});

test('a malformed wh_shop is skipped, so a valid one after it still counts', async () => {
  const { chosenShopCookie } = await address();
  assert.equal(chosenShopCookie('wh_shop=abc; wh_shop=2'), 2);
  assert.equal(chosenShopCookie('wh_shop=; wh_shop=3'), 3);
  assert.equal(chosenShopCookie('wh_shop=1e0; other=1; wh_shop=4'), 4);
  // The first valid one wins, as the browser lists the most specific path first.
  assert.equal(chosenShopCookie('wh_shop=5; wh_shop=6'), 5);
});
