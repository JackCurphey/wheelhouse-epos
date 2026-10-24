// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import type { BrowserContext, Page } from '@playwright/test';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Customers in a real browser (openspec/changes/customers-list and
// customer-page; cs-list, cs-add, cs-page, cs-edit): add someone, open their
// page, edit them, start a new job for them, and find them from the header.
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

async function signIn(page: Page, context: BrowserContext, path: string) {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}${path}`);
}

test.describe('on a computer', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('add a customer, see their page, edit them, and start a new job for them', async ({ page, context }) => {
    await signIn(page, context, '/workshop/customers');
    await page.getByRole('button', { name: '+ Add a customer' }).click();
    const add = page.getByRole('dialog', { name: 'Add a customer' });
    await add.getByLabel('Name').fill('Maya Patel');
    await add.getByLabel('Phone').fill('07700 900142');
    await add.getByLabel('Postcode (optional)').fill('BL1 2AB');
    await add.getByRole('button', { name: 'Add the customer' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Maya Patel' })).toBeVisible();
    await expect(page).toHaveURL(/\/workshop\/customers\/\d+$/);
    await expect(page.getByRole('region', { name: 'History' })).toContainText('Nothing yet');

    await page.getByRole('button', { name: 'Edit' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit Maya Patel’s details' });
    await edit.getByLabel('Email').fill('maya@example.com');
    await edit.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('07700 900142 · maya@example.com')).toBeVisible();

    await page.getByRole('link', { name: 'New job' }).first().click();
    const newJob = page.getByRole('dialog', { name: 'New job' });
    await expect(newJob).toBeVisible();
    await expect(newJob).toContainText('Maya Patel');
  });

  test('a second Maya with her number is caught before she’s added twice, and the header finds her by postcode', async ({ page, context }) => {
    await signIn(page, context, '/workshop/customers');
    await page.getByRole('button', { name: '+ Add a customer' }).click();
    const add = page.getByRole('dialog', { name: 'Add a customer' });
    await add.getByLabel('Name').fill('Maya P.');
    await add.getByLabel('Phone').fill('07700900142');
    await expect(add.getByText('Maya Patel already has this number')).toBeVisible();
    await add.getByRole('link', { name: 'Use Maya Patel' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Maya Patel' })).toBeVisible();
    await page.getByRole('banner').getByRole('searchbox', { name: 'Search jobs and customers' }).fill('bl12ab');
    await expect(page.getByRole('region', { name: 'Search results' }).getByRole('link', { name: 'Maya Patel' })).toBeVisible();
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Customers and a customer’s page fit the screen', async ({ page, context }) => {
    await signIn(page, context, '/workshop/customers');
    await page.getByRole('link', { name: /Maya Patel/ }).first().click();
    await expect(page.getByRole('heading', { level: 2, name: 'Maya Patel' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
