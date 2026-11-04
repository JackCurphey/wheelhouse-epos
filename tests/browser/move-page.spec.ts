// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
// @ts-expect-error a plain helper with no types
import { xlsxOf } from '../helpers/xlsx.js';

// Moving from Citrus Lime in a real browser (openspec/changes/citrus-import-screens;
// mv-start, mv-progress-failed, mv-summary): a made-up Excel file dropped in comes
// across by itself and shows in Stock, a file that isn't a report says so, at
// computer and phone widths, with nothing scrolling sideways. The pads are the
// drawing's (B05S-RX, £28.00).
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
const shops: { shop: { id: number } }[] = [];

test.describe.configure({ timeout: 90_000 });
test.beforeAll(async () => { server = await startLiveServer({ env: { WH_MOVE_TICK_MS: '200' } }); });
test.afterAll(async () => {
  try {
    for (const s of shops) await deleteTestShop(s.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

const PRICE_LIST = xlsxOf([
  ['Price List - Store Level'],
  ['Store', 'Department', 'Category', 'Supplier', 'Item Lookup Code', 'Description', 'Store Cost', 'Price', 'Tax Rate', 'Qty On Hand'],
  ['[Shop]', 'Brakes', null, '[Supplier]', 'B05S-RX', 'Shimano brake pads', 14, 28, 20, 6],
  ['[Shop]', 'Brakes', null, '[Supplier]', '[Supplier code]', '[Product]', 1, null, 20, 1],
]);

for (const [size, viewport] of [['computer', { width: 1280, height: 900 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`at ${size} width: drop a file, see it come across, and a bad one asks for another`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles' });
    shops.push(owner);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/moving`);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 2, name: 'Bring your data from Citrus Lime' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: test.info().outputPath(`mv-start-${size}.png`) });

    await main.getByLabel('Choose files').setInputFiles({ name: 'Price List.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: PRICE_LIST });
    await expect(main.getByRole('heading', { level: 2, name: 'Here’s what came across' })).toBeVisible({ timeout: 30_000 });
    await expect(main.getByRole('listitem').filter({ hasText: 'Products' })).toContainText('1 brought across');
    await expect(main.getByRole('listitem').filter({ hasText: 'Products' })).toContainText('1 need a look');
    await expect(main.getByRole('listitem').filter({ hasText: 'Stock levels' })).toContainText('1 brought across');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: test.info().outputPath(`mv-summary-${size}.png`) });

    const found = await staffRequest(server!.baseUrl, owner.cookie, '/api/products?search=B05S-RX');
    expect(found.body[0]).toMatchObject({ name: 'Shimano brake pads', stockQty: 6, price: 28 });

    await main.getByLabel('Choose files').setInputFiles({ name: '[file name].xlsx', mimeType: 'text/plain', buffer: Buffer.from('not a spreadsheet') });
    await expect(main.getByText('Wheelhouse couldn’t read this file')).toBeVisible();
    await expect(main.getByRole('button', { name: 'Choose another file for [file name].xlsx' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: test.info().outputPath(`mv-failed-${size}.png`) });
  });
}
