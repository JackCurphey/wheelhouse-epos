// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// To return to [Supplier], with Returned, in a real browser
// (openspec/changes/to-return; rs-hub; receiving decisions 9 and 10): a
// damaged pad set aside at booking in is listed second on Deliveries and
// orders, and Returned takes it off, at computer and phone widths, with
// nothing scrolling sideways.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000 });
test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
});
test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

const asOwner = (path: string, body?: unknown) => staffRequest(server!.baseUrl, owner.cookie, path, body === undefined ? undefined : { method: 'POST', body });

for (const [size, viewport] of [['computer', { width: 1280, height: 900 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`at ${size} width: a damaged pad is listed to return, and Returned takes it off`, async ({ page, context }) => {
    const supplierName = `[Supplier] ${size}`;
    const supplier = await asOwner('/api/suppliers', { name: supplierName, adapterType: 'mock_csv' });
    expect(supplier.status).toBe(201);
    const pads = await asOwner('/api/products', { name: 'Shimano brake pads', sku: `B05S-RX-${size}`, price: 28, cost: 28 });
    expect(pads.status).toBe(201);
    // Booked in not on an order: 2 in stock, 1 set aside as damaged.
    const booked = await asOwner('/api/deliveries/receive', { supplierId: supplier.body.id, items: [{ productId: pads.body.id, qty: 2 }], problems: [{ productId: pads.body.id, kind: 'damaged', qty: 1 }] });
    expect(booked.status).toBe(200);

    await page.setViewportSize(viewport);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/deliveries`);
    const section = page.getByRole('region', { name: `To return to ${supplierName}` });
    await expect(section).toContainText('Shimano brake pads');
    await expect(section).toContainText(/Damaged · 1 · from the delivery on \w{3} \d{1,2} \w{3}/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await section.getByRole('button', { name: 'Returned: Shimano brake pads, damaged' }).click();
    await expect(section).toHaveCount(0);
    await expect(page.getByRole('main').getByRole('heading', { name: 'Orders', exact: true })).toBeVisible();
  });
}
