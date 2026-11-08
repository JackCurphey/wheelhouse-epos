// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// A product with sizes' page in a real browser (openspec/changes/product-page-sizes, design 3;
// st-product-sizes): the grid, sizes across and colours down, at computer and phone widths with
// nothing scrolling sideways, and a cell opening that size's own page.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let groupId: number;

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const sizes = ['S', 'M', 'L', 'XL'].flatMap((size) => ['[Colour 1]', '[Colour 2]'].map((colour) => ({ size, colour, pricePence: 3000 })));
  groupId = (await staffRequest(server.baseUrl, owner.cookie, '/api/product-groups', { method: 'POST', body: { name: '[Product with sizes]', category: '[Category]', sizes } })).body.id;
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
  test(`the grid on a ${label}, a cell opening its size`, async ({ page, context }) => {
    await page.setViewportSize({ width, height });
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/stock/sizes/${groupId}`);
    const grid = page.getByRole('table', { name: 'Stock by size and colour' });
    await expect(grid.getByRole('columnheader')).toHaveText(['Colour', 'S', 'M', 'L', 'XL']);
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/sizes-page-${label}.png` });
    await grid.getByRole('link', { name: '[Colour 1], size M: none in stock' }).click();
    await expect(page.getByRole('heading', { level: 2, name: '[Product with sizes] M [Colour 1]' })).toBeVisible();
  });
}
