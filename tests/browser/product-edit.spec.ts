// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Edit on a product's page in a real browser (openspec/changes/product-page-sizes, design 2):
// the Owner changes Shimano brake pads' price from £28.00, the page shows the new price and
// the history's newest line says so, at computer and phone widths, nothing scrolling sideways.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
const pads: Record<string, { id: number }> = {};

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  for (const label of ['computer', 'phone']) {
    pads[label] = (await staffRequest(server.baseUrl, owner.cookie, '/api/products', { method: 'POST', body: { name: 'Shimano brake pads', sku: `B05S-RX-${label}`, category: '[Category]', supplier: '[Supplier]', pricePence: 2800, costPence: 1400 } })).body;
  }
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
  test(`the Owner changes the price on a ${label}`, async ({ page, context }) => {
    await page.setViewportSize({ width, height });
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/stock/${pads[label].id}`);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const box = page.getByRole('dialog', { name: 'Edit product' });
    await expect(box.getByLabel('Price')).toHaveValue('28.00');
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    await box.getByLabel('Price').fill('30.00');
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/product-edit-${label}.png` });
    await box.getByRole('button', { name: 'Save' }).click();
    await expect(box).toBeHidden();
    await expect(page.getByRole('region', { name: 'Price and cost' })).toContainText('£30.00');
    const first = page.getByRole('region', { name: 'Stock history' }).getByRole('listitem').first();
    await expect(first).toContainText('Price changed · £28.00 → £30.00');
    await expect(first).toContainText('Jack Lewis');
    expect(await sideways(page)).toBeLessThanOrEqual(0);
  });
}
