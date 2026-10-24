// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Settings › Workshop › Online booking › Deposits in a real browser against
// the real server (bk-settings-deposits; openspec/changes/deposit-settings):
// switched on, a fixed amount typed in pounds, saved in pence, and the fold's
// summary saying it.
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

const stored = async () => (await staffRequest(server!.baseUrl, owner.cookie, '/api/workshop-settings')).body as { depositOn: boolean; depositKind: string; depositFixedPence: number | null };

test('deposits switched on, a fixed £15 saved as 1500 pence, and the fold says it', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/settings?room=workshop`);
  const fold = page.getByRole('button', { name: /^Online booking/ });
  if ((await fold.getAttribute('aria-expanded')) !== 'true') await fold.click();
  await page.getByRole('switch', { name: 'Take a deposit when booking' }).click();
  await expect.poll(async () => (await stored()).depositOn).toBe(true);
  await page.getByRole('radio', { name: 'A fixed amount' }).click();
  await expect.poll(async () => (await stored()).depositKind).toBe('fixed');
  const box = page.getByLabel('How much');
  await box.fill('15');
  await box.blur();
  await expect.poll(async () => (await stored()).depositFixedPence).toBe(1500);
  await expect(box).toHaveValue('15.00');
  await expect(fold).toContainText('deposit £15.00');
});
