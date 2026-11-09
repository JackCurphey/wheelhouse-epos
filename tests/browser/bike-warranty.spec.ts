// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Bike warranties in a real browser (openspec/changes/finish-customers, task 6.3; Jack's 9 Nov
// answers 3 and 4): the Owner adds Trek's lines in Settings › Stockroom › Bike warranties, Jo
// records that Maya Patel's Trek was bought here on a day, and her page and the bike's show each
// line, at a computer and a phone width. The server's clock is pinned to 1 Sep 2026.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
const shops: number[] = [];

test.describe.configure({ timeout: 90_000, mode: 'serial' });
test.beforeAll(async () => {
  server = await startLiveServer();
});
test.afterAll(async () => {
  try {
    for (const id of shops) await deleteTestShop(id);
  } finally {
    if (server) await server.stop();
  }
});

const signIn = async (context: import('@playwright/test').BrowserContext, cookie: string) => {
  await context.clearCookies();
  const [name, value] = cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
};
const noSideScroll = async (page: import('@playwright/test').Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

for (const [size, viewport] of [['computer', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`on a ${size}, the Owner adds Trek’s lines, Jo records Maya’s Trek bought here, and her page shows each line`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    // A shop of its own each time, so Trek is listed once in each.
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    shops.push(owner.shop.id);
    const made = await staffRequest(server!.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
    const jo = await staffFreshCookie(made.body.loginId);
    expect((await staffRequest(server!.baseUrl, jo, '/api/your-settings/till-pin/ask', { method: 'POST' })).status).toBe(200);
    const maya = await staffRequest(server!.baseUrl, owner.cookie, '/api/customers', { method: 'POST', body: { name: 'Maya Patel' } });
    const bike = await staffRequest(server!.baseUrl, owner.cookie, `/api/customers/${maya.body.id}/bikes`, { method: 'POST', body: { make: 'Trek', model: 'Domane AL 3', colour: 'Green' } });

    await signIn(context, owner.cookie);
    await page.goto(`${server!.baseUrl}/workshop/settings?room=stockroom`);
    const fold = page.getByRole('button', { name: /^Bike warranties/ });
    if ((await fold.getAttribute('aria-expanded')) !== 'true') await fold.click();
    await page.getByRole('button', { name: '+ Add a brand' }).click();
    const box = page.getByRole('dialog', { name: 'Add a brand' });
    await box.getByLabel('Brand').fill('Trek');
    await box.getByRole('radiogroup', { name: 'Frame' }).getByRole('radio', { name: 'Lifetime' }).click();
    await box.getByRole('radiogroup', { name: 'Components' }).getByRole('radio', { name: 'Years' }).click();
    await box.getByLabel('Components, years').fill('2');
    await noSideScroll(page);
    await box.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Frame lifetime · Components 2 years')).toBeVisible();

    await signIn(context, jo);
    await page.goto(`${server!.baseUrl}/workshop/bikes/${bike.body.id}`);
    await page.getByRole('button', { name: 'Edit' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit bike' });
    await edit.getByLabel('Bought here on').fill('2026-01-15');
    await expect(edit.getByLabel('Brand')).toHaveValue('Trek');
    await noSideScroll(page);
    await edit.getByRole('button', { name: 'Save' }).click();
    await expect(edit).toBeHidden();
    const warranty = page.getByRole('region', { name: 'Warranty' });
    await expect(warranty.getByText('15 Jan 2026')).toBeVisible();
    await expect(warranty.getByText('Under warranty')).toBeVisible();
    await expect(warranty.getByText('Frame: lifetime')).toBeVisible();
    await expect(warranty.getByText('Components: until 15 Jan 2028, 16 months left')).toBeVisible();
    await noSideScroll(page);

    await page.goto(`${server!.baseUrl}/workshop/customers/${maya.body.id}`);
    const bikes = page.getByRole('region', { name: 'Bikes' });
    await expect(bikes.getByText('Green · bought here 15 Jan 2026')).toBeVisible();
    await expect(bikes.getByText('Under warranty · Frame: lifetime · Components: until 15 Jan 2028, 16 months left')).toBeVisible();
    await noSideScroll(page);
  });
}
