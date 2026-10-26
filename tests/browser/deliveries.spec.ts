// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Purchase orders in a real browser (openspec/changes/deliveries-orders;
// rs-hub, rs-order, rs-order-ordered): New order, scan the pads, Mark as
// ordered, and the order on the hub, at computer and phone widths, with
// nothing scrolling sideways. The pads are the drawing's (B05S-RX, £28.00).
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const staff = (path: string, body: unknown) => staffRequest(server!.baseUrl, owner.cookie, path, { method: 'POST', body });
  expect((await staff('/api/suppliers', { name: '[Supplier]', adapterType: 'mock_csv' })).status).toBe(201);
  expect((await staff('/api/products', { name: 'Shimano brake pads', sku: 'B05S-RX', price: 28, cost: 28 })).status).toBe(201);
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

for (const [size, viewport] of [['computer', { width: 1280, height: 900 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`at ${size} width: make an order, mark it as ordered, and see it on Deliveries and orders`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/deliveries`);
    const main = page.getByRole('main');
    await main.getByRole('link', { name: '+ New order' }).click();
    await expect(page).toHaveURL(`${server!.baseUrl}/workshop/deliveries/new-order`);
    // A new shop also has the pretend Madison supplier, so pick ours.
    await main.getByText('[Supplier]', { exact: true }).click();
    await expect(main.getByRole('radio', { name: '[Supplier]', exact: true })).toBeChecked();
    const box = main.getByRole('searchbox', { name: 'Add a product: scan, or type to search' });
    await box.fill('B05S-RX');
    await expect(main.getByRole('option', { name: /Shimano brake pads/ })).toBeVisible();
    await box.press('Enter');
    await main.getByRole('button', { name: 'One more: Shimano brake pads' }).click();
    await expect(main.getByText(/^Total cost/)).toContainText('£56.00');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await main.getByRole('button', { name: 'Mark as ordered' }).click();

    await expect(main.getByRole('heading', { level: 2, name: /^\[Supplier\] · ordered / })).toBeVisible();
    await expect(main.getByRole('list', { name: 'Lines' })).toContainText('B05S-RX · ordered 2 · arrived 0');
    await expect(main.getByText(/^Total cost/)).toContainText('£56.00');
    await expect(main.getByText('Ordered', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    // The order's own page opened straight from its address, as a saved link would.
    const orderId = page.url().split('/').pop();
    await page.goto(`${server!.baseUrl}/workshop/deliveries/orders/${orderId}`);
    await expect(main.getByRole('heading', { level: 2, name: /^\[Supplier\] · ordered / })).toBeVisible();
    await expect(main.getByRole('list', { name: 'Lines' })).toContainText('B05S-RX · ordered 2 · arrived 0');

    await main.getByRole('link', { name: 'Deliveries and orders' }).click();
    await expect(main.getByRole('list', { name: 'Orders' }).getByRole('link', { name: /^Open the order from \[Supplier\], ordered / }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}
