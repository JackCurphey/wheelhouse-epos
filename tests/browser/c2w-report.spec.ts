// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { runWithShop, prepare } from '../../server/db.js';

// Cycle to Work: owed and paid, in a real browser (openspec/changes/
// cycle-to-work task 10.3; rp-c2w): opened from its card on Reports, the four
// figures, the table by provider and the link to the Owed page, at computer
// and phone widths with nothing scrolling sideways. The server's clock is
// pinned to 1 Sep 2026, so a bike marked paid that day counts in This month.
// The order is put straight into "paid" (Mark paid has its own spec).
// Providers and numbers stay bracketed or are made-up test values.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 120_000, mode: 'serial' });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const staff = (path: string, body: unknown, method = 'POST') => staffRequest(server!.baseUrl, owner.cookie, path, { method, body });
  expect((await staff('/api/c2w/settings', { holdDays: 7, remindDays: 2, quoteValidDays: 30 }, 'PUT')).status).toBe(200);
  const provider = await staff('/api/c2w/providers', { name: '[Provider]', commissionKind: 'percent', commissionValue: 500, paysInDays: 30 });
  expect(provider.status).toBe(201);
  const product = await staff('/api/products', { name: '[Bike] · [Size]', sku: 'C2W-REPORT', price: 1000, stockQty: 4 });
  expect(product.status).toBe(201);
  const maya = await staff('/api/customers', { name: 'Maya Patel', phone: '07700 900 142', email: `maya-${owner.shop.id}@example.test` });
  expect(maya.status).toBe(201);
  const made = await staff('/api/c2w/orders', { customerId: maya.body.id, providerId: provider.body.provider.id, productId: product.body.id ?? product.body.product?.id, accessoryIds: [] });
  expect(made.status, JSON.stringify(made.body)).toBe(201);
  // £1,000 certificate, £950 paid today: £50 commission.
  await runWithShop(owner.shop.id, () => prepare(
    "UPDATE c2w_orders SET stage = 'paid', certificate_pence = 100000, expected_pence = 95000, paid_pence = 95000, paid_on = '2026-09-01', collected_at = '2026-08-03T10:00:00Z' WHERE id = ? RETURNING id",
  ).get(made.body.order.id));
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

for (const [size, viewport] of [['computer', { width: 1280, height: 900 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`at ${size} width: the card on Reports opens owed and paid, by provider, with the link to the Owed page`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    const wide = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    await page.goto(`${server!.baseUrl}/workshop/reports`);
    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: /^Cycle to Work: owed and paid/ })).toHaveAttribute('href', '/workshop/reports/c2w');
    await page.goto(`${server!.baseUrl}/workshop/reports/c2w`);
    await expect(main.getByRole('heading', { name: 'Cycle to Work: owed and paid' })).toBeVisible();
    await expect(main.getByRole('group', { name: 'Paid' })).toContainText('£950.00');
    await expect(main.getByRole('group', { name: 'Commission' })).toContainText('£50.00');
    const row = main.getByRole('row', { name: /\[Provider\]/ });
    await expect(row).toContainText('£950.00');
    await expect(main.getByRole('row', { name: /All providers/ })).toContainText('£50.00');
    await wide();

    await main.getByRole('link', { name: 'See what Cycle to Work providers owe now' }).click();
    await expect(page).toHaveURL(/\/workshop\/c2w\/owed$/);
  });
}
