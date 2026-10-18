// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import type { BrowserContext } from '@playwright/test';
import { startLiveServer, TEST_CLOCK_PIN } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { futureDate } from '../helpers/workshopFixtures.js';

// The old app (public/app.js) after its workshop diary was retired
// (docs/decisions/2026-10-18-retire-old-diary.md): its Workshop tab opens the
// new diary, and the old job form, still opened from an order, lists the
// shop's mechanics without the old diary having loaded them first.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jobTitle: string;
let jobId: number;

test.describe.configure({ timeout: 60_000 });
test.use({ timezoneId: 'Europe/London', viewport: { width: 1400, height: 900 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Old App Cycles' });
  const sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  jobTitle = `Brake check ${owner.shop.id}`;
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-jobs', {
    method: 'POST',
    body: { title: jobTitle, jobDate: futureDate(2, new Date(TEST_CLOCK_PIN)), startTime: '10:00', endTime: '11:00', mechanicId: sam },
  });
  expect(made.status, JSON.stringify(made.body)).toBe(201);
  jobId = made.body.id;
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

function staff(path: string, options?: object) {
  return staffRequest(server!.baseUrl, owner.cookie, path, options);
}

async function signIn(context: BrowserContext) {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
}

test('an old #workshop address opens the new diary', async ({ page, context }) => {
  await signIn(context);
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));
  await page.goto(`${server!.baseUrl}/#workshop`);
  await expect(page).toHaveURL(/\/workshop\/diary$/);
});

test("the old app's Workshop tab opens the new diary", async ({ page, context }) => {
  await signIn(context);
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));
  await page.goto(`${server!.baseUrl}/#till`);
  await page.locator('#nav button[data-nav="workshop"]').click();
  await expect(page).toHaveURL(/\/workshop\/diary$/);
});

test("an order's workshop job opens the old form with the shop's mechanics", async ({ page, context }) => {
  await signIn(context);
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));
  await page.goto(`${server!.baseUrl}/#till`);
  await page.locator('#view-orders-btn').click();
  const row = page.locator('#order-table-body tr', { hasText: jobTitle });
  await row.locator('button[data-open]').click();
  await page.locator('#doc-view-job-btn').click();
  await expect(page.locator('#workshop-job-form')).toBeVisible();
  await expect(page.locator('#wj-mechanic option', { hasText: 'Sam' })).toHaveCount(1);
});

async function openOrdersJob(page: import('@playwright/test').Page) {
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));
  await page.goto(`${server!.baseUrl}/#till`);
  await page.locator('#view-orders-btn').click();
  await page.locator('#order-table-body tr', { hasText: jobTitle }).locator('button[data-open]').click();
  await page.locator('#doc-view-job-btn').click();
  await expect(page.locator('#workshop-job-form')).toBeVisible();
}

// Moved here from the retired old-diary tests: the form now opens only from
// an order.
test('marking complete a job changed elsewhere is refused and the form closes', async ({ page, context }) => {
  await signIn(context);
  await openOrdersJob(page);
  // Someone else saves the job after the form opened.
  const changed = await staff(`/api/workshop-jobs/${jobId}`, { method: 'PUT', body: { notes: 'Changed elsewhere' } });
  expect(changed.status, JSON.stringify(changed.body)).toBe(200);
  await page.locator('#wj-complete-toggle').click();
  await expect(page.locator('#toast')).toContainText('This job changed while you were looking at it.');
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
});

test('saving a job changed elsewhere is refused in plain words and the form closes', async ({ page, context }) => {
  await signIn(context);
  await openOrdersJob(page);
  const changed = await staff(`/api/workshop-jobs/${jobId}`, { method: 'PUT', body: { notes: 'Changed again' } });
  expect(changed.status, JSON.stringify(changed.body)).toBe(200);
  await page.locator('#workshop-job-form button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('This job changed while you were looking at it.');
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
});
