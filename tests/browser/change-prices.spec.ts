// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Changing prices in bulk in a real browser (openspec/changes/bulk-price-change; st-list-ticked,
// st-prices, st-prices-done): the Owner searches a supplier, ticks all shown, changes them by a
// percentage ending .99, sees the new prices on Stock, and undoes it, at computer and phone
// widths, nothing scrolling sideways. Shimano brake pads B05S-RX £28.00 as drawn.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000 });

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

const sideways = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [width, height, label] of [[1280, 900, 'computer'], [375, 812, 'phone']] as const) {
  test(`ticking, Change prices and Undo, on a ${label}`, async ({ page, context }) => {
    const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);
    const supplier = `[Supplier ${label}]`;
    await staff('/api/products', { method: 'POST', body: { name: 'Shimano brake pads', sku: `B05S-RX-${label}`, category: '[Category]', supplier, price: 28, cost: 12.5, stockQty: 6 } });
    await staff('/api/products', { method: 'POST', body: { name: '[Product]', sku: `[Supplier code ${label}]`, category: '[Category]', supplier, price: 10, cost: 5, stockQty: 2 } });
    await page.setViewportSize({ width, height });
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/stock`);
    await page.getByRole('searchbox', { name: 'Search stock' }).fill(supplier);
    await expect(page.getByText('2 products', { exact: true })).toBeVisible();
    if (label === 'computer') await page.getByRole('checkbox', { name: 'Tick all 2 shown' }).check();
    else {
      await page.getByRole('checkbox', { name: 'Tick Shimano brake pads' }).check();
      await page.getByRole('checkbox', { name: 'Tick [Product]' }).check();
    }
    const bar = page.getByRole('region', { name: 'Ticked products' });
    await expect(bar).toContainText('2 ticked');
    expect(await sideways(page)).toBeLessThanOrEqual(0);

    await bar.getByRole('button', { name: 'Change prices' }).click();
    const dialog = page.getByRole('dialog', { name: 'Change prices' });
    await expect(dialog).toContainText(`2 products from ${supplier}`);
    await dialog.getByRole('textbox', { name: 'Percentage change' }).fill('+10');
    await expect(dialog).toContainText('£30.99');
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/change-prices-${label}.png` });
    await dialog.getByRole('button', { name: 'Change 2 prices' }).click();

    await expect(page.getByText('Prices changed · 2 products')).toBeVisible();
    const pads = page.getByRole('row').filter({ has: page.getByRole('link', { name: /Shimano brake pads/ }) });
    await expect(pads).toContainText('£30.99');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Prices put back · 2 products')).toBeVisible();
    await expect(pads).toContainText('£28.00');
    expect(await sideways(page)).toBeLessThanOrEqual(0);
  });
}
