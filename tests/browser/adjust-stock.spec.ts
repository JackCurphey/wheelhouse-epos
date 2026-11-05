// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Adjust stock in a real browser (openspec/changes/adjust-stock; st-adjust):
// the Owner opens the box from a product's page, picks Damaged, adjusts, and
// the stock and history change, at computer and phone widths, with nothing
// scrolling sideways.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
const pads: Record<string, { id: number }> = {};

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);
  // Shimano brake pads B05S-RX £28.00 as drawn, one for each width.
  for (const label of ['computer', 'phone']) {
    pads[label] = (await staff('/api/products', { method: 'POST', body: { name: 'Shimano brake pads', sku: `B05S-RX-${label}`, category: '[Category]', supplier: '[Supplier]', price: 28, cost: 14, stockQty: 6 } })).body;
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
  test(`Adjust stock, Damaged, on a ${label}`, async ({ page, context }) => {
    await page.setViewportSize({ width, height });
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/stock/${pads[label].id}`);
    const inStock = page.getByRole('region', { name: 'In stock' });
    await inStock.getByRole('button', { name: 'Adjust stock' }).click();
    const box = page.getByRole('dialog', { name: 'Adjust stock' });
    await expect(box).toBeVisible();
    await expect(box.getByRole('textbox', { name: 'In stock after' })).toHaveValue('5');
    await expect(box.getByText('Pick a reason to adjust')).toBeVisible();
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    await box.getByRole('radio', { name: 'Damaged' }).click();
    await box.getByRole('textbox', { name: 'Note (needed for Other)' }).fill('[note]');
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/adjust-stock-${label}.png` });
    await box.getByRole('button', { name: 'Adjust' }).click();
    await expect(box).toBeHidden();
    await expect(inStock).toContainText('5');
    const first = page.getByRole('region', { name: 'Stock history' }).getByRole('listitem').first();
    await expect(first).toContainText('Adjusted · Damaged');
    await expect(first).toContainText('Note: [note] · Jack Lewis');
    expect(await sideways(page)).toBeLessThanOrEqual(0);
  });
}

// A product's stock at each shop (openspec/changes/stock-per-shop; tr-sites).
for (const [width, height, label] of [[1280, 900, 'computer'], [375, 812, 'phone']] as const) {
  test(`stock at two shops on a ${label}: each listed, and the first shop Adjust changes`, async ({ page, context }) => {
    await page.setViewportSize({ width, height });
    const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);
    const sites = await staff('/api/sites');
    if (sites.body.length === 1) expect((await staff('/api/sites', { method: 'POST', body: { name: '[Second site]', code: 'S' } })).status).toBe(201);
    const made = await staff('/api/products', { method: 'POST', body: { name: 'Shimano brake pads', sku: `B05S-RX-two-${label}`, category: '[Category]', stockQty: 6, price: 28 } });
    expect(made.status).toBe(201);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/stock/${made.body.id}`);
    const inStock = page.getByRole('region', { name: 'In stock' });
    await expect(inStock).toContainText(`${sites.body[0].name}6`);
    await expect(inStock).toContainText(/\[Second site\]Running low0/);
    await expect(inStock).toContainText(/Low-stock level\d+ each/);
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    await inStock.getByRole('button', { name: 'Adjust stock' }).click();
    const box = page.getByRole('dialog', { name: 'Adjust stock' });
    await expect(box.getByRole('textbox', { name: 'In stock after' })).toHaveValue('5');
    await box.getByRole('radio', { name: 'Damaged' }).click();
    await box.getByRole('button', { name: 'Adjust' }).click();
    await expect(box).toBeHidden();
    await expect(inStock).toContainText(`${sites.body[0].name}5`);
    await expect(inStock).toContainText(/\[Second site\]Running low0/);
  });
}
