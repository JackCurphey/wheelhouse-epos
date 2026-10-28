// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Receiving a delivery in a real browser (openspec/changes/receive-delivery;
// rs-receive, rs-problem): a staff member opens Receive a delivery from the
// hub, scans the drawing's pads (B05S-RX), marks one damaged and books the
// rest in, at computer and phone widths, with nothing scrolling sideways.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jo: string;

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  expect(made.status).toBe(201);
  jo = await staffFreshCookie(made.body.loginId);
  // Not Jo's first sign-in: Your till PIN would open by itself over the page (whos-in-and-first-pin).
  expect((await staffRequest(server.baseUrl, jo, '/api/your-settings/till-pin/ask', { method: 'POST' })).status).toBe(200);
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
  test(`at ${size} width: a staff member scans the pads in, marks one damaged and books the rest in`, async ({ page, context }) => {
    // An order of 3 pads from a supplier of its own, so this test's pill is the only one by that name.
    const supplierName = `[Supplier] ${size}`;
    const supplier = await asOwner('/api/suppliers', { name: supplierName, adapterType: 'mock_csv' });
    expect(supplier.status).toBe(201);
    const pads = await asOwner('/api/products', { name: 'Shimano brake pads', sku: `B05S-RX-${size}`, price: 28, cost: 28 });
    expect(pads.status).toBe(201);
    const made = await asOwner('/api/purchase-orders', { supplierId: supplier.body.id, items: [{ productId: pads.body.id, qty: 3, unitCost: 28 }] });
    expect(made.status).toBe(201);
    expect((await asOwner(`/api/purchase-orders/${made.body.id}/mark-ordered`, {})).status).toBe(200);

    await page.setViewportSize(viewport);
    const [name, value] = jo.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/deliveries`);
    const main = page.getByRole('main');
    await main.getByRole('link', { name: 'Receive a delivery' }).click();
    expect(page.url().split('?')[0]).toBe(`${server!.baseUrl}/workshop/deliveries/receive`);
    await main.getByText(supplierName, { exact: true }).click();
    await expect(main.getByRole('radio', { name: supplierName, exact: true })).toBeChecked();
    await expect(main.getByRole('list', { name: 'Still to come on the order' })).toContainText('3 to come');

    const box = main.getByRole('searchbox', { name: 'Scan a barcode, or type to search' });
    for (let i = 0; i < 3; i++) {
      await box.fill(`B05S-RX-${size}`);
      await box.press('Enter');
      await expect(main.getByRole('textbox', { name: 'How many: Shimano brake pads' })).toHaveValue(String(i + 1));
    }
    await main.getByRole('button', { name: 'Problem with Shimano brake pads' }).click();
    const dialog = page.getByRole('dialog', { name: 'Something wrong?' });
    await expect(dialog.getByText('3 scanned')).toBeVisible();
    await dialog.getByRole('button', { name: 'Mark as damaged' }).click();
    await expect(main.getByRole('list', { name: 'Scanned' })).toContainText('Damaged · 1, set aside');
    await expect(main.getByText('2 items to book in · 1 set aside')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    await main.getByRole('button', { name: 'Book in 2 items' }).click();
    await expect(main.getByText('2 items booked in · stock updated')).toBeVisible();
    // 2 booked in and 1 set aside: nothing is left to come (second review, 26
    // Oct); the supplier stays picked (receive-without-order).
    await expect(main.getByRole('list', { name: 'Still to come on the order' })).toHaveCount(0);
    await expect(main.getByRole('radio', { name: supplierName, exact: true })).toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    const found = await asOwner(`/api/products?search=B05S-RX-${size}`);
    expect(found.body.find((p: { id: number }) => p.id === pads.body.id).stockQty).toBe(2);
  });
}

// Without an order (openspec/changes/receive-without-order; receiving
// decision 2): a shop that orders on the supplier's website picks the
// supplier, scans a product it has no order for, and books it in.
for (const [size, viewport] of [['computer', { width: 1280, height: 900 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`at ${size} width: a staff member books in a delivery with no order`, async ({ page, context }) => {
    const supplierName = `[Supplier 2] ${size}`;
    const supplier = await asOwner('/api/suppliers', { name: supplierName, adapterType: 'mock_csv' });
    expect(supplier.status).toBe(201);
    const thing = await asOwner('/api/products', { name: `[Product] ${size}`, sku: `[Supplier code]-${size}`, price: 28, cost: 28 });
    expect(thing.status).toBe(201);

    await page.setViewportSize(viewport);
    const [name, value] = jo.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/deliveries`);
    const main = page.getByRole('main');
    await expect(main.getByText('Scan each item as it comes out of the box. Works with or without an order.')).toBeVisible();
    await main.getByRole('link', { name: 'Receive a delivery' }).click();
    const pill = main.getByRole('radio', { name: supplierName, exact: true });
    if (!(await pill.count())) await main.getByRole('button', { name: 'Other…' }).click();
    await main.getByText(supplierName, { exact: true }).click();
    await expect(pill).toBeChecked();

    const box = main.getByRole('searchbox', { name: 'Scan a barcode, or type to search' });
    for (let i = 0; i < 2; i++) {
      await box.fill(`[Supplier code]-${size}`);
      await box.press('Enter');
      await expect(main.getByRole('textbox', { name: `How many: [Product] ${size}` })).toHaveValue(String(i + 1));
    }
    await expect(main.getByRole('list', { name: 'Scanned' })).toContainText(`[Supplier code]-${size} · not on an order`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await main.getByRole('button', { name: 'Book in 2 items' }).click();
    await expect(main.getByText('2 items booked in · stock updated')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    const found = await asOwner(`/api/products?search=${encodeURIComponent(`[Supplier code]-${size}`)}`);
    expect(found.body.find((p: { id: number }) => p.id === thing.body.id).stockQty).toBe(2);
  });
}
