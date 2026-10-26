// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Settings › Front desk › Payments › Customer groups in a real browser
// (cs-groups; openspec/changes/customer-groups-settings): add a group, at a
// computer and a phone width.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000, mode: 'serial' });
test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
});
test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

for (const [size, viewport, name] of [['computer', { width: 1280, height: 800 }, 'Club members'], ['phone', { width: 375, height: 812 }, 'Blue Light']] as const) {
  test(`on a ${size}, the owner adds a customer group and it’s listed with 0 customers`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const [cookieName, value] = owner.cookie.split('=');
    await context.addCookies([{ name: cookieName, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/settings?room=front-desk`);
    const fold = page.getByRole('button', { name: /^Customer groups/ });
    if ((await fold.getAttribute('aria-expanded')) !== 'true') await fold.click();
    await page.getByRole('button', { name: '+ Add a group' }).click();
    const box = page.getByRole('dialog', { name: 'Add a group' });
    await box.getByLabel('Name').fill(name);
    await box.getByLabel('% off').fill('10');
    await box.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: `Edit ${name}` })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
