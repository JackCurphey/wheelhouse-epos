// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { runWithShop, prepare } from '../../server/db.js';

// "Download a copy of your data" in a real browser (openspec/changes/
// your-data-copy; ac-account, ac-download): the Your data card under History
// on a computer and last on a phone, and pressing it saves a zip named for
// the shop and the day, with the green bar naming it.
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
  test(`on ${size}: Maya downloads a copy of her data`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const email = `maya-data-${viewport.width}@example.test`;
    await page.goto(`${server!.baseUrl}/book/${shop.slug}/sign-in?from=${encodeURIComponent(`/book/${shop.slug}/account`)}`);
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Email me a code' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Enter your code' })).toBeVisible();
    const { code } = await runWithShop(shop.id, () => prepare('SELECT code FROM pretend_signin_codes WHERE email = ? AND used_at IS NULL').get(email));
    await page.getByRole('textbox', { name: 'Your 6-digit code' }).fill(code);
    await expect(page).toHaveURL(new RegExp(`/book/${shop.slug}/account$`));

    const history = page.getByRole('region', { name: 'History' });
    const details = page.getByRole('region', { name: 'Your details' });
    const data = page.getByRole('region', { name: 'Your data' });
    await expect(data).toBeVisible();
    const [h, d, y] = await Promise.all([history.boundingBox(), details.boundingBox(), data.boundingBox()]);
    // Under History on a computer; last on a phone.
    expect(y!.y).toBeGreaterThan(h!.y + h!.height - 1);
    if (viewport.width > 1000) {
      // Straight under History, not pushed down below Your details.
      expect(Math.round(y!.x)).toBe(Math.round(h!.x));
      expect(y!.y - (h!.y + h!.height)).toBeLessThan(40);
    } else expect(y!.y).toBeGreaterThan(d!.y + d!.height - 1);

    const saving = page.waitForEvent('download');
    await data.getByRole('button', { name: 'Download a copy of your data' }).click();
    const file = await saving;
    expect(file.suggestedFilename()).toBe(`${shop.slug}-your-data-2026-09-01.zip`);
    await expect(page.getByRole('status')).toHaveText(`Your data is downloading as one file, ${shop.slug}-your-data-2026-09-01.zip — details, bikes, jobs, purchases, messages and what you agreed to. Not started? Download it again`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/your-data-${viewport.width}.png`, fullPage: true });
  });
}
