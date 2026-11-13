// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { runWithShop, prepare } from '../../server/db.js';

// What Cycle to Work providers owe, in a real browser (openspec/changes/
// cycle-to-work task 8; cw-owed, cw-owed-reports, cw-owed-provider): the owed
// list opened from Reports, one provider's bikes, and Mark paid on a bike,
// after which nothing is owed. At computer and phone widths, nothing scrolling
// sideways. The bike is put straight into "collected" (the hand-over has its
// own spec); the server's clock is pinned to 1 Sep 2026, so a bike expected by
// 20 August is 12 days late. Providers and numbers stay bracketed.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let providerId: number;
let productId: number;
let mayaId: number;

test.describe.configure({ timeout: 120_000, mode: 'serial' });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const staff = (path: string, body: unknown, method = 'POST') => staffRequest(server!.baseUrl, owner.cookie, path, { method, body });
  expect((await staff('/api/c2w/settings', { holdDays: 7, remindDays: 2, quoteValidDays: 30 }, 'PUT')).status).toBe(200);
  const provider = await staff('/api/c2w/providers', { name: '[Provider]', commissionKind: 'percent', commissionValue: 500, paysInDays: 30 });
  expect(provider.status).toBe(201);
  providerId = provider.body.provider.id;
  const product = await staff('/api/products', { name: '[Bike] · [Size]', sku: 'C2W-OWED', price: 1000, stockQty: 4 });
  expect(product.status).toBe(201);
  productId = product.body.id ?? product.body.product?.id;
  const maya = await staff('/api/customers', { name: 'Maya Patel', phone: '07700 900 142', email: `maya-${owner.shop.id}@example.test` });
  expect(maya.status).toBe(201);
  mayaId = maya.body.id;
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

// A collected bike: £1,000 certificate, £950 expected by 20 August.
const collectedBike = async () => {
  const made = await staffRequest(server!.baseUrl, owner.cookie, '/api/c2w/orders', { method: 'POST', body: { customerId: mayaId, providerId, productId, accessoryIds: [] } });
  expect(made.status, JSON.stringify(made.body)).toBe(201);
  const id = made.body.order.id;
  await runWithShop(owner.shop.id, () => prepare(
    "UPDATE c2w_orders SET stage = 'collected', certificate_number = '[certificate]', certificate_pence = 100000, collected_at = '2026-08-03T10:00:00Z', expected_pence = 95000, expected_by = '2026-08-20' WHERE id = ? RETURNING id",
  ).get(id));
  return id;
};

for (const [size, viewport] of [['computer', { width: 1280, height: 900 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`at ${size} width: the owed list from Reports, one provider's bikes, and Mark paid`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    const wide = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await collectedBike();

    await page.goto(`${server!.baseUrl}/workshop/reports/c2w-owed`);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Owed by Cycle to Work providers' })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Reports' })).toBeVisible();
    const row = main.getByRole('row', { name: /\[Provider\]/ });
    await expect(row).toContainText('£950.00');
    await expect(row).toContainText('12 days');
    await wide();

    await page.goto(`${server!.baseUrl}/workshop/c2w/owed`);
    await expect(main.getByRole('link', { name: 'Cycle to Work' })).toBeVisible();
    await main.getByRole('link', { name: '[Provider]: bikes owed and Record a payment' }).click();
    await expect(page).toHaveURL(new RegExp(`/workshop/c2w/owed/${providerId}$`));
    await expect(main.getByRole('heading', { name: '[Provider] · 1 bike owed' })).toBeVisible();
    await expect(main.getByText('Commission 5% · pays in about 30 days · North Street Cycles')).toBeVisible();
    await expect(main.getByText('12 days late')).toBeVisible();
    await wide();

    await main.getByRole('button', { name: 'Mark paid: Maya Patel · [Provider]' }).click();
    const box = page.getByRole('dialog', { name: 'Mark paid' });
    await expect(box.getByLabel('Amount received')).toHaveValue('950.00');
    await box.getByRole('button', { name: 'Mark paid' }).click();
    await expect(box).toHaveCount(0);
    await expect(main.getByText('Marked paid.')).toBeVisible();
    await expect(main.getByText('Nothing is owed by [Provider] just now.')).toBeVisible();
    await expect(main.getByRole('heading', { name: '[Provider] · 0 bikes owed' })).toBeFocused();
    await wide();
  });
}
