// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Stock and a product's page in a real browser (openspec/changes/stock-list;
// st-list, st-product): the list, Below zero, a search, the product's page
// with its history, at computer and phone widths, nothing scrolling sideways.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let pads: { id: number };

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);
  // Shimano brake pads B05S-RX £28.00 as drawn; everything else bracketed.
  pads = (await staff('/api/products', { method: 'POST', body: { name: 'Shimano brake pads', sku: 'B05S-RX', barcode: '[barcode]', category: '[Category]', supplier: '[Supplier]', price: 28, cost: 14, stockQty: 6 } })).body;
  await staff(`/api/products/${pads.id}/stock`, { method: 'POST', body: { change: -1, type: 'adjustment', note: 'Damaged' } });
  await staff('/api/products', { method: 'POST', body: { name: '[Product with a long name that has to wrap on a phone]', sku: '[Supplier code]', category: '[Category]', supplier: '[Supplier]', price: 10, cost: 5, stockQty: 2 } });
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

const sideways = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [width, height, label] of [[1280, 900, 'computer'], [375, 812, 'phone']] as const) {
  test(`Stock → a product's page, on a ${label}`, async ({ page, context }) => {
    await page.setViewportSize({ width, height });
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/stock`);
    const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: /Shimano brake pads/ }) });
    await expect(row).toContainText('B05S-RX · [Category] · [Supplier]');
    await expect(row).toContainText('£28.00');
    await expect(page.getByText('2 products')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: '[Product with a long name' })).toContainText('Running low');
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/stock-list-${label}.png` });

    await page.getByRole('searchbox', { name: 'Search stock' }).fill('B05S');
    await expect(page.getByText('1 product', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: /Shimano brake pads/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Shimano brake pads' })).toBeVisible();
    const history = page.getByRole('region', { name: 'Stock history' });
    await expect(history.getByRole('listitem')).toHaveCount(2);
    await expect(history.getByRole('listitem').first()).toContainText('Adjusted');
    await expect(page.getByRole('region', { name: 'Price and cost' })).toContainText('40%');
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/stock-product-${label}.png`, fullPage: true });

    await page.goto(`${server!.baseUrl}/workshop/stock/${pads.id}`);
    await expect(page.getByRole('heading', { level: 2, name: 'Shimano brake pads' })).toBeVisible();
  });
}
