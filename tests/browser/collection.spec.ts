// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import type { BrowserContext, Page } from '@playwright/test';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { runWithShop, prepare } from '../../server/db.js';

// A bike left uncollected in a real browser against the real server
// (openspec/changes/uncollected-bike; cp-setting, cp-today-uncollected):
// the day counts saved from Settings, and the bike's line on Today with
// Contacted, at a computer's width and a phone's.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London' });

function staff(path: string, options?: object) {
  return staffRequest(server!.baseUrl, owner.cookie, path, options);
}

// A finished job, ready this many days ago.
async function readyBike(name: string, phone: string, daysAgo: number) {
  const alex = await seedMechanic(owner.shop.id, { name: `Alex ${name}` });
  const customer = (await staff('/api/customers', { method: 'POST', body: { name, phone } })).body;
  let job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Safety check', jobDate: '2026-09-01', mechanicId: alex, customerId: customer.id } })).body;
  for (const step of ['book-in', 'start']) job = (await staff(`/api/workshop-jobs/${job.id}/${step}`, { method: 'POST', body: { version: job.version } })).body;
  const done = await staff(`/api/workshop-jobs/${job.id}/finish`, { method: 'POST', body: { version: job.version, signedOffBy: alex } });
  expect(done.status, JSON.stringify(done.body)).toBe(200);
  await runWithShop(owner.shop.id, () => prepare(`UPDATE workshop_jobs SET signed_off_at = now() - interval '${daysAgo} days' WHERE id = ?`).run(job.id));
  return job as { id: number; reference: string };
}

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

async function signIn(page: Page, context: BrowserContext, path: string) {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}${path}`);
}

test.describe('on a computer', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Settings › Workshop › Collection saves both counts, raising the reminder past Today’s', async ({ page, context }) => {
    await signIn(page, context, '/workshop/settings?room=workshop');
    await page.getByRole('button', { name: /^Collection/ }).click();
    const remind = page.getByLabel('Remind the customer after');
    await expect(remind).toHaveValue('3');
    await remind.fill('10');
    await remind.blur();
    await expect(page.getByText('Show it on Today after more days than the reminder.')).toBeVisible();
    const today = page.getByLabel('Show it on Today after');
    await today.fill('14');
    await today.blur();
    await expect(page.getByText('Saved.')).toBeVisible();
    const saved = (await staff('/api/workshop-settings')).body;
    expect([saved.collectionReminderDays, saved.collectionTodayDays]).toEqual([10, 14]);
    expect((await staff('/api/workshop-settings', { method: 'PUT', body: { collectionReminderDays: 3, collectionTodayDays: 7 } })).status).toBe(200);
  });

  test('Today lists a bike left uncollected; Contacted takes it off', async ({ page, context }) => {
    const job = await readyBike('Aisha Khan', '07700 900300', 8);
    await signIn(page, context, '/workshop/today');
    const attention = page.getByRole('region', { name: /^Needs attention/ });
    await expect(attention).toContainText(`${job.reference} · Aisha Khan — ready since`);
    await expect(attention.getByRole('link', { name: '07700 900300' })).toHaveAttribute('href', 'tel:07700900300');
    await attention.getByRole('button', { name: `Contacted: ${job.reference}` }).click();
    await expect(attention).not.toContainText(job.reference);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the line and Contacted fit the screen', async ({ page, context }) => {
    const job = await readyBike('Sam Reed', '07700 900500', 9);
    await signIn(page, context, '/workshop/today');
    const button = page.getByRole('button', { name: `Contacted: ${job.reference}` });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
