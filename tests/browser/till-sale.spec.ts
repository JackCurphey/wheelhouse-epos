// The till in the React staff app (journey 11, piece 1), against the real
// server: a card sale from a quick button and a scanned part sold past its
// stock, then a cash sale with change. Each is saved and stock comes off.
// Spec: docs/superpowers/specs/2026-10-03-till-sale-design.md
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jo: { employeeId: number; cookie: string };
let padsId: number;

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });
const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Till Cycles' });
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' } });
  jo = { employeeId: made.body.employeeId, cookie: await staffFreshCookie(made.body.loginId) };
  await staff('/api/workshop-services', { method: 'POST', body: { name: 'Fit & adjust brakes', price: 18, minutes: 30 } });
  padsId = (await staff('/api/products', { method: 'POST', body: { name: 'Shimano brake pads', price: 28, sku: 'B05S-RX', barcode: '4524667', stockQty: 1 } })).body.id;
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

const stockOfPads = async () => (await staff('/api/products?search=Shimano')).body.find((p: { id: number }) => p.id === padsId).stockQty;

test('a card sale and a cash sale, saved, with stock taken off', async ({ page, context }) => {
  const [name, value] = jo.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/till`);
  const sale = page.getByRole('region', { name: 'Sale' });

  await page.getByRole('group', { name: 'Workshop quick buttons' }).getByRole('button', { name: /^Fit & adjust brakes/ }).click();
  const box = page.getByLabel('Search products or services, or scan a barcode');
  await box.fill('4524667');
  await expect(page.getByRole('button', { name: /^Shimano brake pads/ })).toBeVisible();
  await box.press('Enter');
  await sale.getByRole('button', { name: 'One more Shimano brake pads' }).click();
  await expect(sale.getByText('Stock says 1 — sold anyway')).toBeVisible();
  await sale.getByRole('button', { name: 'Take payment · £74.00' }).click();
  const pay = page.getByRole('dialog');
  await expect(pay.getByText('Jo Taylor serving · 3 items')).toBeVisible();
  await pay.getByRole('button', { name: /^Card · £74.00/ }).click();
  await pay.getByRole('button', { name: 'Card approved' }).click();
  await expect(pay.getByRole('heading', { name: 'Paid' })).toBeVisible();
  await pay.getByRole('button', { name: 'No receipt' }).click();
  await expect(sale.getByText('Nothing in the sale yet')).toBeVisible();
  expect(await stockOfPads()).toBe(-1);

  await page.getByRole('group', { name: 'Workshop quick buttons' }).getByRole('button', { name: /^Fit & adjust brakes/ }).click();
  await sale.getByRole('button', { name: 'Take payment · £18.00' }).click();
  await pay.getByRole('button', { name: /^Cash/ }).click();
  await pay.getByRole('group', { name: 'Amount handed over' }).getByRole('button', { name: '£20.00' }).click();
  await pay.getByRole('button', { name: 'Cash taken' }).click();
  await expect(pay.getByText('Change to give £2.00')).toBeVisible();

  const sales = (await staff(`/api/sales?cashierId=${jo.employeeId}`)).body;
  expect(sales.map((s: { total: number; cardAmount: number; cashAmount: number }) => [Number(s.total), Number(s.cardAmount), Number(s.cashAmount)]).sort())
    .toEqual([[18, 0, 18], [74, 74, 0]]);
});
