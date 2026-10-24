// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import type { BrowserContext, Page } from '@playwright/test';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// The header search in a real browser (openspec/changes/header-search;
// staff-search): on a computer the box's results drop down and a job opens in
// the diary; on a phone the search button opens the box over the page.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let job: { id: number; reference: string };

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);
  const maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-09-17', startTime: '11:30', endTime: '12:30', customerId: maya.id } })).body;
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

async function signIn(page: Page, context: BrowserContext, path: string) {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}${path}`);
}

test.describe('on a computer', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the results drop down under the box, over the page, and a job opens in the diary', async ({ page, context }) => {
    await signIn(page, context, '/workshop/today');
    const box = page.getByRole('banner').getByRole('searchbox', { name: 'Search jobs and customers' });
    await box.fill('maya');
    const results = page.getByRole('region', { name: 'Search results' });
    await expect(results.getByRole('link', { name: `${job.reference} · Maya Patel` })).toBeVisible();
    const [b, r] = [await box.boundingBox(), await results.boundingBox()];
    expect(r!.y).toBeGreaterThan(b!.y + b!.height - 1);
    await results.getByRole('link', { name: `${job.reference} · Maya Patel` }).click();
    await expect(page).toHaveURL(new RegExp(`/workshop/diary\\?job=${job.id}`));
    await expect(page.getByRole('dialog', { name: /Standard service/ })).toBeVisible();
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the search button opens the box across the top; Close search shuts it', async ({ page, context }) => {
    await signIn(page, context, '/workshop/today');
    await page.getByRole('button', { name: 'Search jobs and customers' }).click();
    const sheet = page.getByRole('dialog', { name: 'Search' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('searchbox').fill('maya');
    await expect(sheet.getByRole('link', { name: `${job.reference} · Maya Patel` })).toBeVisible();
    expect((await sheet.boundingBox())!.width).toBeGreaterThan(380);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await sheet.getByRole('button', { name: 'Close search' }).click();
    await expect(sheet).toHaveCount(0);
  });
});
