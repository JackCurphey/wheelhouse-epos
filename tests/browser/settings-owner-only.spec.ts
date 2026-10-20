// Settings for the Owner only, until roles are built (Jack, 19 Oct,
// docs/decisions/2026-10-19-owner-only-settings.md): a staff login that types
// the Settings address sees the not-part-of-your-role card; the Owner sees Settings.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jo: { cookie: string };

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' } });
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
});
test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('a staff login sees Settings aren’t part of your role; the Owner sees Settings', async ({ browser }) => {
  for (const [who, cookie] of [['staff', jo.cookie], ['owner', owner.cookie]] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const [name, value] = cookie.split('=');
      await ctx.addCookies([{ name, value, url: server!.baseUrl }]);
      const page = await ctx.newPage();
      await page.goto(`${server!.baseUrl}/workshop/settings?room=office`);
      if (who === 'staff') {
        await expect(page.getByRole('heading', { name: 'Settings aren’t part of your role' })).toBeVisible();
        await expect(page.getByLabel('Shop name')).toHaveCount(0);
      } else {
        await expect(page.getByLabel('Shop name')).toBeVisible();
      }
    } finally {
      await ctx.close();
    }
  }
});
