// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Store credit in a real browser (openspec/changes/finish-customers, task 2.3; set-pay-ways,
// cs-credit): the Owner turns Store credit on in Settings › Payments, then Jo adds credit to
// Maya Patel with a reason, at a computer and a phone width.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jo: string;

test.describe.configure({ timeout: 90_000, mode: 'serial' });
test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  jo = await staffFreshCookie(made.body.loginId);
  // Not Jo's first sign-in: Your till PIN would open by itself over the page (whos-in-and-first-pin).
  expect((await staffRequest(server.baseUrl, jo, '/api/your-settings/till-pin/ask', { method: 'POST' })).status).toBe(200);
});
test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
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
  test(`on a ${size}, the Owner turns Store credit on and Jo adds credit to Maya Patel`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    await signIn(context, owner.cookie);
    await page.goto(`${server!.baseUrl}/workshop/settings?room=front-desk`);
    const fold = page.getByRole('button', { name: /^Ways to pay/ });
    if ((await fold.getAttribute('aria-expanded')) !== 'true') await fold.click();
    const sw = page.getByRole('switch', { name: 'Store credit' });
    if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await noSideScroll(page);

    const maya = await staffRequest(server!.baseUrl, owner.cookie, '/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: 'maya@example.test' } });
    await signIn(context, jo);
    await page.goto(`${server!.baseUrl}/workshop/customers/${maya.body.id}`);
    await page.getByRole('button', { name: /Store credit/ }).click();
    const box = page.getByRole('dialog', { name: 'Maya Patel’s store credit' });
    await expect(box.getByText('Has £0.00 now')).toBeVisible();
    await box.getByLabel('Amount').fill('5.00');
    await box.getByLabel('Reason', { exact: true }).fill('[reason]');
    await box.getByRole('button', { name: 'Add the credit' }).click();
    await expect(box).toBeHidden();
    await expect(page.getByRole('button', { name: /Store credit/ })).toContainText('£5.00');
    await expect(page.getByText('Store credit added')).toBeVisible();
    await expect(page.getByText(/\[reason\] · by Jo Taylor/)).toBeVisible();
    await noSideScroll(page);
  });
}
