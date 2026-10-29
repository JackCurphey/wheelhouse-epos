// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import type { BrowserContext, Page } from '@playwright/test';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { runWithShop, prepare } from '../../server/db.js';

// Today's stock warnings in a real browser against the real server
// (openspec/changes/stock-warnings-on-today; st-setting-adjust,
// st-today-adjust, st-today-below): the Owner sets the amount in Settings ›
// Stockroom; an adjustment worth more shows on Today and Seen clears it;
// products below zero show with See them and Count them, which opens a
// below-zero count. On a phone the below-zero line's buttons sit under its
// words, and nothing scrolls sideways. The pads are the drawing's (B05S-RX,
// £28.00); the cost is the test's own.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let padsId: number;

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London' });

const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const res = await staff('/api/products', { method: 'POST', body: { name: 'Shimano brake pads', sku: 'B05S-RX', price: 28, cost: 14, stockQty: 6 } });
  expect(res.status).toBe(201);
  padsId = res.body.id;
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

async function signIn(page: Page, context: BrowserContext, path: string) {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}${path}`);
}

test.describe('on a computer', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('set the amount; a big adjustment shows on Today and Seen clears it; Count them opens a below-zero count', async ({ page, context }) => {
    await signIn(page, context, '/workshop/settings?room=stockroom');
    await expect(page.getByRole('heading', { level: 2, name: 'Stockroom' })).toBeVisible();
    const box = page.getByLabel(/Show on Today when an adjustment is worth more than/);
    await box.fill('20.00');
    await box.blur();
    await expect(page.getByText('Saved.')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Stock adjustments/ })).toContainText('Show on Today over £20.00');

    // −2 at £14.00 is £28.00, more than £20.00.
    expect((await staff(`/api/products/${padsId}/stock`, { method: 'POST', body: { type: 'adjustment', change: -2, reason: 'damaged' } })).status).toBe(200);
    await page.goto(`${server!.baseUrl}/workshop/today`);
    const attention = page.getByRole('region', { name: /^Needs attention/ });
    const line = attention.getByRole('listitem').filter({ hasText: 'Stock adjusted:' });
    await expect(line).toContainText('Stock adjusted: Shimano brake pads −2 · £28.00');
    await expect(line).toContainText(/Damaged · by .+ at \d\d:\d\d/);
    await line.getByRole('button', { name: 'Seen' }).click();
    await expect(attention.getByText('Stock adjusted:')).toHaveCount(0);

    // Below zero: See them, then Count them.
    await runWithShop(owner.shop.id, () => prepare('UPDATE products SET stock_qty = -1 WHERE id = ?').run(padsId));
    await page.reload();
    const below = attention.getByRole('listitem').filter({ hasText: '1 product below zero' });
    await expect(below).toContainText('Sold more than Wheelhouse thought were here · Count them starts a count straight away');
    await below.getByRole('link', { name: 'See them' }).click();
    await expect(page).toHaveURL(/\/workshop\/stock\?show=below-zero$/);
    await expect(page.getByRole('button', { name: 'Below zero' })).toHaveAttribute('aria-pressed', 'true');
    await page.goBack();
    await below.getByRole('button', { name: 'Count them' }).click();
    await expect(page).toHaveURL(new RegExp(`${server!.baseUrl}/workshop/stocktake/\\d+$`));
    const id = Number(page.url().split('/').pop());
    expect((await staff(`/api/stock-takes/${id}`)).body.kind).toBe('below_zero');
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the below-zero line’s buttons sit under its words; nothing wider than the screen', async ({ page, context }) => {
    await runWithShop(owner.shop.id, () => prepare('UPDATE products SET stock_qty = -1 WHERE id = ?').run(padsId));
    await signIn(page, context, '/workshop/today');
    const below = page.getByRole('listitem').filter({ hasText: /product below zero/ });
    const words = below.getByText(/product below zero/);
    const see = below.getByRole('link', { name: 'See them' });
    await expect(below.getByRole('button', { name: 'Count them' })).toBeVisible();
    // Under the words, from their left edge, not beside them.
    const [w, s] = [await words.boundingBox(), await see.boundingBox()];
    expect(s!.y).toBeGreaterThan(w!.y + w!.height - 1);
    expect(Math.abs(s!.x - w!.x)).toBeLessThan(12);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
