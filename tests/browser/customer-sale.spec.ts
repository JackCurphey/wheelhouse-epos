// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// A sale opens from a customer's history, in a real browser (cs-sale;
// openspec/changes/customer-sale-dialog), at a computer and a phone width.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let mayaId: number;
let saleId: number;

test.describe.configure({ timeout: 90_000, mode: 'serial' });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const staff = (path: string, body: object) => staffRequest(server!.baseUrl, owner.cookie, path, { method: 'POST', body });
  mayaId = (await staff('/api/customers', { name: 'Maya Patel', phone: '07700 900142' })).body.id;
  const jo = (await staff('/api/team', { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' })).body;
  const tube = (await staff('/api/products', { name: 'Inner tube', price: 5, sku: `TUBE-${randomUUID().slice(0, 6)}`, stockQty: 10 })).body;
  saleId = (await staff('/api/sales', { cashierId: jo.employeeId, customerId: mayaId, items: [{ productId: tube.id, qty: 2 }], cashAmount: 10, cashTendered: 10 })).body.id;
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

for (const [size, viewport] of [['computer', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`on a ${size}, Maya’s sale opens with its lines, total and Print the receipt`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/customers/${mayaId}`);
    await page.getByRole('button', { name: new RegExp(`Sale ${saleId}`) }).click();
    const dialog = page.getByRole('dialog', { name: `Sale ${saleId}` });
    await expect(dialog.getByText('Inner tube')).toBeVisible();
    await expect(dialog.getByText('Total')).toBeVisible();
    await expect(dialog.getByText('Paid by')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Print the receipt' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
  });
}
