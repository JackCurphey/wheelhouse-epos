// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// The old app (public/app.js) is the one screen where staff could add or change a product
// (openspec/changes/product-editing; stock control decision 11). Refused now, it says so
// in the server's words, plainly, and nothing is added. Jo Taylor as drawn.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jo: string;

test.describe.configure({ timeout: 60_000 });
test.use({ viewport: { width: 1400, height: 900 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  expect(made.status, JSON.stringify(made.body)).toBe(201);
  jo = await staffFreshCookie(made.body.loginId);
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('staff adding a product on the old Stockroom are told only the owner can, and nothing is added', async ({ page, context }) => {
  const [name, value] = jo.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/#office/inventory`);
  await page.locator('#add-product-btn').click();
  await page.locator('#f-name').fill('[Product]');
  await page.locator('#f-price').fill('1');
  await page.locator('#product-form button[type="submit"]').click();
  await expect(page.locator('#toast')).toHaveText('Only the shop’s owner can add or change products');
  const list = await staffRequest(server!.baseUrl, owner.cookie, '/api/products');
  expect(list.body.some((p: { name: string }) => p.name === '[Product]')).toBe(false);
});
