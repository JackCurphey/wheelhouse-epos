// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// The restock list in a real browser (openspec/changes/restock-list; rs-hub, rs-restock): from
// Deliveries and orders' Running low, untick one, add the rest to an order, at computer and phone
// widths, with nothing scrolling sideways. The pads are the drawing's (B05S-RX); the rest are
// placeholders.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const staff = (path: string, body: unknown) => staffRequest(server!.baseUrl, owner.cookie, path, { method: 'POST', body });
  expect((await staff('/api/suppliers', { name: '[Supplier]', adapterType: 'mock_csv' })).status).toBe(201);
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

for (const [size, viewport] of [['computer', { width: 1280, height: 900 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`at ${size} width: open Running low, untick one, add the rest to an order`, async ({ page, context }) => {
    const staff = (path: string, body: unknown) => staffRequest(server!.baseUrl, owner.cookie, path, { method: 'POST', body });
    const pads = `Shimano brake pads ${size}`;
    const other = `[Product ${size}]`;
    for (const [name, sku] of [[pads, `B05S-RX-${size}`], [other, `[Supplier code ${size}]`]]) {
      const made = await staff('/api/products', { name, sku, price: 28, cost: 28, lowStockThreshold: 3, supplier: '[Supplier]' });
      expect(made.status, JSON.stringify(made.body)).toBe(201);
    }
    await page.setViewportSize(viewport);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/deliveries`);
    const main = page.getByRole('main');
    const section = main.getByRole('region', { name: 'Restock list' });
    await expect(section).toContainText('at or under their low-stock level');
    await section.getByRole('link', { name: 'See the list of products running low' }).click();
    await expect(page).toHaveURL(`${server!.baseUrl}/workshop/deliveries/restock?show=low`);
    await expect(main.getByRole('radio', { name: 'Running low' })).toBeChecked();

    const group = main.getByRole('region', { name: '[Supplier]' });
    await expect(group.getByText(pads)).toBeVisible();
    await expect(group.getByRole('textbox', { name: `How many: Reorder ${pads}` })).toHaveValue('3');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await group.getByRole('checkbox', { name: `Include ${other}` }).uncheck();
    await group.getByRole('button', { name: `One more: Reorder ${pads}` }).click();
    await group.getByRole('button', { name: 'Add to an order' }).click();

    await expect(main.getByRole('heading', { level: 2, name: '[Supplier] · draft' })).toBeVisible();
    await expect(main.getByRole('list', { name: 'Lines' })).toContainText(`B05S-RX-${size} · ordered 4 · arrived 0`);
    await expect(main.getByRole('list', { name: 'Lines' })).not.toContainText(other);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}
