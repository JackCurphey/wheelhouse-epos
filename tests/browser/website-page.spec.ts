// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// The Website page in a real browser against the real server
// (openspec/changes/website-management, task 2; drawings ws-page-*): the
// Owner turns the website on, a saved change waits under Unpublished
// changes, and Publish puts it live. The browser-coverage rule (#351).
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: '[Shop name]' });
});

test.afterAll(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  await server?.stop();
});

test('the Owner turns the website on, then publishes a saved change', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/website`);
  await expect(page.getByRole('heading', { level: 1, name: 'Website' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your website is off' })).toBeVisible();

  await page.getByRole('button', { name: 'Turn it on' }).click();
  await expect(page.getByRole('heading', { name: 'Your website is on' })).toBeVisible();

  const saved = await staffRequest(server!.baseUrl, owner.cookie, '/api/website/parts/about_line', { method: 'PUT', body: { text: '[About line]' } });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  await page.reload();
  await page.getByRole('button', { name: '1 unpublished change' }).click();
  const changes = page.getByRole('region', { name: 'Unpublished changes' });
  await expect(changes).toBeVisible();
  await changes.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByRole('main').getByRole('status')).toContainText('Published — customers see it now');
  await expect(changes).toHaveCount(0);
  // What customers see now carries the change (the old settings follow what is published).
  const live = await staffRequest(server!.baseUrl, owner.cookie, '/api/storefront-settings');
  expect(live.body.tagline).toBe('[About line]');
});
