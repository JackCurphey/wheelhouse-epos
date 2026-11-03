// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// A delivery, once it's booked in, in a real browser, as the Owner
// (openspec/changes/delivery-booked-in; rs-booked, rs-delivery): what was set
// aside and what's still to come, with their links, and the delivery's costs,
// at computer and phone widths, with nothing scrolling sideways. Staff are in
// receive-delivery.spec.ts.
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

const asOwner = (path: string, body: unknown) => staffRequest(server!.baseUrl, owner.cookie, path, { method: 'POST', body });

for (const [size, viewport] of [['computer', { width: 1280, height: 900 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`at ${size} width: the Owner sees Delivery booked in, then the delivery with its costs`, async ({ page, context }) => {
    const supplierName = `[Supplier] ${size}`;
    const supplier = await asOwner('/api/suppliers', { name: supplierName, adapterType: 'mock_csv' });
    expect(supplier.status).toBe(201);
    const pads = await asOwner('/api/products', { name: 'Shimano brake pads', sku: `B05S-RX-${size}`, price: 28, cost: 28 });
    expect(pads.status).toBe(201);
    const made = await asOwner('/api/purchase-orders', { supplierId: supplier.body.id, items: [{ productId: pads.body.id, qty: 5, unitCost: 28 }] });
    expect(made.status).toBe(201);
    expect((await asOwner(`/api/purchase-orders/${made.body.id}/mark-ordered`, {})).status).toBe(200);
    const booked = await asOwner('/api/deliveries/receive', {
      supplierId: supplier.body.id,
      items: [{ productId: pads.body.id, itemId: made.body.items[0].id, qty: 2 }],
      problems: [{ itemId: made.body.items[0].id, kind: 'damaged', qty: 1, note: '' }],
    });
    expect(booked.status).toBe(200);
    const id = booked.body.deliveryId;

    await page.setViewportSize(viewport);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);

    await page.goto(`${server!.baseUrl}/workshop/deliveries/delivery/${id}/booked`);
    const main = page.getByRole('main');
    await expect(main.getByText('2 items booked in · stock updated')).toBeVisible();
    await expect(main.getByText('1 set aside as damaged')).toBeVisible();
    await expect(main.getByText(`On To return to ${supplierName}`)).toBeVisible();
    await expect(main.getByRole('list', { name: 'Booked in' })).toContainText('2 still to come on the order');
    await expect(main.getByRole('link', { name: `Open the order from ${supplierName}` })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    // Print labels (openspec/changes/delivery-labels; rs-labels): the pads have
    // no barcode of their own, so 2. Printing makes one page a label, at the
    // shop's 50 by 25 mm, in a real PDF of what the printer gets.
    await page.evaluate(() => { window.print = () => {}; });
    await main.getByRole('button', { name: 'Print labels' }).click();
    const box = page.getByRole('dialog', { name: 'Print labels' });
    await expect(box.getByText('No barcode of its own · 2 received')).toBeVisible();
    await expect(box.getByRole('textbox', { name: 'How many: Labels for Shimano brake pads' })).toHaveValue('2');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await box.getByRole('button', { name: 'Print 2 labels' }).click();
    await expect(box).toHaveCount(0);
    await expect(page.locator('#wh-print article[aria-label="Label"]')).toHaveCount(2);
    await expect(page.locator('#wh-print article[aria-label="Label"] svg rect').first()).toBeAttached();
    const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
    const pages = [...pdf.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)];
    expect(pages.length).toBe(2);
    expect(Math.round(Number(pages[0][1]) / 72 * 25.4)).toBe(50);
    expect(Math.round(Number(pages[0][2]) / 72 * 25.4)).toBe(25);

    await page.goto(`${server!.baseUrl}/workshop/deliveries/delivery/${id}`);
    await expect(main.getByRole('heading', { level: 2, name: `${supplierName} · 2 items` })).toBeVisible();
    await expect(main.getByRole('list', { name: 'Items in this delivery' })).toContainText(`B05S-RX-${size} · 2 × £28.00`);
    await expect(main.getByText('£56.00', { exact: true }).last()).toBeVisible();
    await expect(main.getByText('Booked-in cost, before VAT')).toBeVisible();
    await expect(main.getByRole('list', { name: 'Set aside as problems' })).toContainText('Damaged · 1 · £28.00');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}
