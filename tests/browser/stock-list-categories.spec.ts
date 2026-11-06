// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Stock with a category picked, its details, and sizes, in a real browser
// (openspec/changes/stock-list-categories-sizes; st-filter-bearings, st-search-measure,
// st-list, st-search-size): Bearings picked and Outer diameter 30 typed by keyboard, "bearing
// 30 mm", a product with sizes and a size searched, at computer and phone widths, with nothing
// scrolling sideways. Names as drawn; the rest bracketed.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const call = async (path: string, method = 'GET', body?: object) => {
    const res = await staffRequest(server!.baseUrl, owner.cookie, path, { method, body });
    expect(res.status, `${method} ${path}: ${JSON.stringify(res.body)}`).toBeLessThan(300);
    return res.body;
  };
  const bearings = await call('/api/product-categories', 'POST', { name: 'Bearings' });
  const saved = await call(`/api/product-categories/${bearings.id}`, 'PUT', { details: ['Inner diameter', 'Outer diameter', 'Height'].map((name) => ({ name, kind: 'number', unit: 'mm' })) });
  const id = Object.fromEntries(saved.details.map((d: { id: number; name: string }) => [d.name, d.id]));
  const bearing = async (name: string, inner: number, outer: number, height: number) => {
    const p = await call('/api/products', 'POST', { name, sku: `[Supplier code ${name.slice(-2, -1)}]`, category: 'Bearings', supplier: '[Supplier]', price: 5, cost: 2, stockQty: 3 });
    await call(`/api/products/${p.id}/details`, 'PUT', { answers: [{ detailId: id['Inner diameter'], value: inner }, { detailId: id['Outer diameter'], value: outer }, { detailId: id.Height, value: height }] });
  };
  await bearing('[Bearing A]', 10, 30, 9);
  await bearing('[Bearing B]', 12, 30, 8);
  await bearing('[Bearing C]', 15, 32, 9);
  const size = (s: string, colour: string, pricePence: number) => ({ size: s, colour, sku: `JER-${randomUUID().slice(0, 6)}`, barcode: `7${randomUUID().replace(/\D/g, '').padEnd(12, '0').slice(0, 12)}`, pricePence, costPence: 1200 });
  await call('/api/product-groups', 'POST', { name: '[Product with sizes]', category: '[Category]', sizes: [size('M', '[Colour 1]', 3000), size('L', '[Colour 1]', 3000), size('M', '[Colour 2]', 3500)] });
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

const sideways = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [width, height, label] of [[1280, 900, 'computer'], [375, 812, 'phone']] as const) {
  test(`Stock by category and size, by keyboard, on a ${label}`, async ({ page, context }) => {
    await page.setViewportSize({ width, height });
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/stock`);

    // A product with sizes on one row; then a size searched on its own.
    const sized = page.getByRole('row').filter({ hasText: '[Product with sizes]' });
    await expect(sized).toContainText('[Category] · 2 sizes · 2 colours');
    await expect(sized).toContainText('£30.00–£35.00');
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/stock-sizes-${label}.png`, fullPage: true });
    const search = page.getByRole('searchbox', { name: 'Search stock' });
    await search.fill('[Product with sizes] M');
    await expect(page.getByText('2 sizes and colours')).toBeVisible();
    await expect(page.getByRole('link', { name: /Size M · \[Colour 2\]/ })).toBeVisible();
    await search.fill('');

    // Bearings, picked by keyboard; Outer diameter 30 typed.
    await page.getByRole('combobox', { name: 'Category' }).focus();
    await page.keyboard.type('bear');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Remove the Bearings filter' })).toBeVisible();
    await expect(page.getByText('3 in Bearings', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Outer diameter' }).focus();
    await page.keyboard.type('30');
    await expect(page.getByText('2 in Bearings with Outer diameter 30 mm')).toBeVisible();
    const a = page.getByRole('row').filter({ hasText: '[Bearing A]' });
    if (label === 'computer') {
      await expect(page.getByRole('columnheader', { name: 'Outer diameter' })).toBeVisible();
      await expect(a).toContainText('30 mm');
    } else {
      await expect(page.getByRole('columnheader')).toHaveCount(0);
      // No columns on a phone: a measurement searched still shows each row's details on its line.
      await search.fill('bearing 30 mm');
      await expect(a.locator('strong')).toHaveText('Outer diameter 30');
      await search.fill('');
    }
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/stock-bearings-${label}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Remove the Bearings filter' }).press('Enter');
    await expect(page.getByRole('combobox', { name: 'Category' })).toBeVisible();

    // "bearing 30 mm": each row's details on its line.
    await search.fill('bearing 30 mm');
    await expect(page.getByText('2 products', { exact: true })).toBeVisible();
    await expect(a).toContainText('Inner diameter 10 · Outer diameter 30 · Height 9 mm');
    await expect(a.locator('strong')).toHaveText('Outer diameter 30');
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/stock-measure-${label}.png`, fullPage: true });
  });
}
