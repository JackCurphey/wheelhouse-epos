// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { runWithShop, prepare } from '../../server/db.js';

// Signing in with a code sent by email, in a real browser (openspec/changes/
// customer-signin-screens; cust-signin, cust-code): the pretend provider's
// code, typed into the box drawn as six, and back to the page it came from.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let shop: { id: number; slug: string };

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer({ env: { CUSTOMER_SIGNIN_PROVIDER: 'pretend' } });
  shop = (await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' })).shop;
});

test.afterAll(async () => {
  try {
    if (shop) await deleteTestShop(shop.id);
  } finally {
    if (server) await server.stop();
  }
});

for (const [size, viewport] of [['a computer', { width: 1440, height: 900 }], ['a phone', { width: 375, height: 812 }]] as const) {
  test(`on ${size}: an email, the code, and back to the page it came from`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const email = `maya-${viewport.width}@example.test`;
    await page.goto(`${server!.baseUrl}/book/${shop.slug}/sign-in?from=${encodeURIComponent(`/book/${shop.slug}/services`)}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your account' })).toBeVisible();
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Email me a code' }).click();
    const box = page.getByRole('textbox', { name: 'Your 6-digit code' });
    // The frame puts the keyboard on the new heading (d2); a tap puts it in the box.
    await expect(page.getByRole('heading', { level: 1, name: 'Enter your code' })).toBeFocused();
    await box.click();
    const { code } = await runWithShop(shop.id, () => prepare('SELECT code FROM pretend_signin_codes WHERE email = ? AND used_at IS NULL').get(email));
    await box.pressSequentially(code.slice(0, 3));
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/sign-in-code-${viewport.width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await box.pressSequentially(code.slice(3));
    await expect(page).toHaveURL(new RegExp(`/book/${shop.slug}/services$`));
    const me = await page.request.get(`${server!.baseUrl}/api/portal/${shop.slug}/me`);
    expect((await me.json()).email).toBe(email);
  });
}

test('a wrong code says so under the boxes', async ({ page }) => {
  await page.goto(`${server!.baseUrl}/book/${shop.slug}/sign-in`);
  await page.getByLabel('Email').fill('lena@example.test');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Enter your code' })).toBeVisible();
  const { code } = await runWithShop(shop.id, () => prepare('SELECT code FROM pretend_signin_codes WHERE email = ? AND used_at IS NULL').get('lena@example.test'));
  await page.getByRole('textbox', { name: 'Your 6-digit code' }).fill(code === '000000' ? '111111' : '000000');
  await expect(page.getByRole('alert')).toHaveText('That code isn’t right. Check it, or send a new one');
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/sign-in-wrong.png` });
});
