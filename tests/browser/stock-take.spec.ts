// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Stock take in a real browser (openspec/changes/stock-take; tk-hub,
// tk-start, tk-count): start a count of an area, scan the pads twice, say
// I've finished my part, and see the count ready on Stock take, at computer
// and phone widths, with nothing scrolling sideways and no stock figure
// shown. The pads are the drawing's (B05S-RX, £28.00).
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const res = await staffRequest(server.baseUrl, owner.cookie, '/api/products', { method: 'POST', body: { name: 'Shimano brake pads', sku: 'B05S-RX', price: 28, cost: 14, stockQty: 4321 } });
  expect(res.status).toBe(201);
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

for (const [size, viewport, area] of [['computer', { width: 1280, height: 900 }, '[Area]'], ['phone', { width: 375, height: 812 }, '[Area 2]']] as const) {
  test(`at ${size} width: start a count, scan, finish, and see it ready`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/stocktake`);
    const main = page.getByRole('main');
    await main.getByRole('button', { name: 'Start a count' }).click();
    const dialog = page.getByRole('dialog', { name: 'Start a count' });
    await dialog.getByLabel('Which area').fill(area);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await dialog.getByRole('button', { name: 'Start the count' }).click();
    await expect(page).toHaveURL(new RegExp(`${server!.baseUrl}/workshop/stocktake/\\d+$`));
    const id = page.url().split('/').pop();

    await expect(main.getByRole('heading', { level: 2, name: `Counting ${area}` })).toBeVisible();
    const box = main.getByRole('searchbox', { name: 'Scan each item, or type to find it' });
    await box.fill('B05S-RX');
    await box.press('Enter');
    await expect(main.getByRole('status')).toHaveText('Added Shimano brake pads · 1');
    await box.fill('B05S-RX');
    await box.press('Enter');
    await expect(main.getByRole('textbox', { name: 'How many: Shimano brake pads' })).toHaveValue('2');
    await expect(main.getByText('2 items counted by you')).toBeVisible();
    await expect(main).not.toContainText('4321');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    // The counting page opened straight from its address, as a saved link would.
    await page.goto(`${server!.baseUrl}/workshop/stocktake/${id}`);
    await expect(main.getByRole('textbox', { name: 'How many: Shimano brake pads' })).toHaveValue('2');
    await main.getByRole('button', { name: 'I’ve finished my part' }).click();

    await expect(page).toHaveURL(`${server!.baseUrl}/workshop/stocktake`);
    const line = main.getByRole('listitem').filter({ has: page.getByRole('link', { name: `Join the count of ${area}` }) });
    await expect(line).toContainText('2 items counted · everyone has finished');
    await expect(line).toContainText('Ready to check');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}
