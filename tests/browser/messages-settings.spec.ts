// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import type { BrowserContext } from '@playwright/test';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Settings › Front desk › Messages in a real browser against the real server
// (Jack, 20 Oct, docs/decisions/2026-10-20-messages-engine.md; #327): a
// message switched off and on, and its wording changed and put back. The
// browser-coverage rule (working agreement, #351) asks for one per screen.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });

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

const template = async (key: string) => ((await staffRequest(server!.baseUrl, owner.cookie, '/api/message-templates')).body as { key: string; enabled: boolean; wording: string; changed: boolean }[]).find((t) => t.key === key)!;
async function openMessages(context: BrowserContext, page: import('@playwright/test').Page) {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/settings?room=front-desk`);
  await page.getByRole('button', { name: /^Automatic messages/ }).click();
}

test('a message switched off and on again, saved each time', async ({ page, context }) => {
  await openMessages(context, page);
  await page.getByRole('button', { name: 'Bike ready: On' }).click();
  await expect(page.getByRole('button', { name: 'Bike ready: Off' })).toBeVisible();
  await expect.poll(async () => (await template('bike_ready')).enabled).toBe(false);
  await page.getByRole('button', { name: 'Bike ready: Off' }).click();
  await expect(page.getByRole('button', { name: 'Bike ready: On' })).toBeVisible();
  await expect.poll(async () => (await template('bike_ready')).enabled).toBe(true);
});

test('a message’s wording changed, then put back to Wheelhouse’s', async ({ page, context }) => {
  await openMessages(context, page);
  const original = (await template('quote_to_approve')).wording;
  await page.getByRole('button', { name: 'Edit the wording of Quote to approve' }).click();
  const dialog = page.getByRole('dialog', { name: 'Quote to approve' });
  await dialog.getByLabel('Wording').fill('Hi, your quote from North Street Cycles is ready to look at.');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await template('quote_to_approve')).wording).toBe('Hi, your quote from North Street Cycles is ready to look at.');

  await page.getByRole('button', { name: 'Edit the wording of Quote to approve' }).click();
  await page.getByRole('dialog', { name: 'Quote to approve' }).getByRole('button', { name: 'Go back to Wheelhouse’s wording' }).click();
  await expect.poll(async () => (await template('quote_to_approve')).wording).toBe(original);
});
