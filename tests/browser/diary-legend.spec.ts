// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// The diary's legend in a real browser (Jack, 26 Oct, option 2;
// openspec/changes/diary-legend-box): a box headed Legend above Waiting for
// you on a computer; under the toolbar on an upright tablet; gone once
// switched off in Your settings.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000, mode: 'serial' });
test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
});
test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

async function signIn(context: import('@playwright/test').BrowserContext) {
  const [cookieName, value] = owner.cookie.split('=');
  await context.addCookies([{ name: cookieName, value, url: server!.baseUrl }]);
}

test('on a computer, the legend is a box above Waiting for you', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(context);
  await page.goto(`${server!.baseUrl}/workshop/diary`);
  const box = page.getByRole('region', { name: 'Legend' });
  await expect(box).toBeVisible();
  const waiting = page.getByRole('region', { name: /^Waiting for you/ });
  const [b, w] = await Promise.all([box.boundingBox(), waiting.boundingBox()]);
  expect(w!.y).toBeGreaterThan(b!.y + b!.height - 1);
  expect(Math.round(w!.x)).toBe(Math.round(b!.x));
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/legend-1280.png` });
});

test('on an upright tablet, it sits under the toolbar; switched off, it goes', async ({ page, context }) => {
  await page.setViewportSize({ width: 834, height: 1112 });
  await signIn(context);
  await page.goto(`${server!.baseUrl}/workshop/diary`);
  await expect(page.getByRole('list', { name: 'Legend' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Legend' })).toHaveCount(0);
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/legend-834.png` });
  const res = await page.request.put(`${server!.baseUrl}/api/your-settings`, { data: { accessibility: { showLegend: false } } });
  expect(res.status()).toBe(200);
  await page.reload();
  await expect(page.getByRole('region', { name: /Workshop diary|Waiting/ }).first()).toBeAttached();
  await expect(page.getByRole('list', { name: 'Legend' })).toHaveCount(0);
});
