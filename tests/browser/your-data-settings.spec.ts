// Settings › Office › Your data › Download everything in a real browser
// (openspec/changes/your-data-download group 3; set-data-export): the Owner opens it from a
// link to the fold, presses the button and a zip named after the shop and its day arrives.
// tests/browser/your-data.spec.ts is the customer's own copy, from their account.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
const shops: number[] = [];

test.describe.configure({ timeout: 90_000, mode: 'serial' });
test.beforeAll(async () => { server = await startLiveServer(); });
test.afterAll(async () => {
  try {
    for (const id of shops) await deleteTestShop(id);
  } finally {
    if (server) await server.stop();
  }
});

for (const [size, viewport] of [['computer', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`on a ${size}, the Owner downloads everything from Settings › Office › Your data`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    shops.push(owner.shop.id);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);

    await page.goto(`${server!.baseUrl}/workshop/settings?room=office&fold=download-everything`);
    const rows = page.getByRole('list', { name: 'What the download holds' });
    await expect(rows.getByRole('listitem')).toHaveText(['Customers', 'Sales and refunds', 'Stock', 'Workshop jobs']);
    const saving = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download everything', exact: true }).click();
    const file = await saving;
    expect(file.suggestedFilename()).toBe(`${owner.shop.name} data 2026-09-01.zip`);
    await expect(page.getByRole('button', { name: 'Download everything', exact: true })).toBeEnabled();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
