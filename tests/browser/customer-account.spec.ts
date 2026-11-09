// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Customer accounts in a real browser (openspec/changes/finish-customers, task 4.3; cs-account,
// cs-transfer; Jack's 9 Nov answers 2 and 5): the Owner gives Maya Patel an account and enters
// what she owed before Wheelhouse, then Jo records a bank transfer of part of it and the
// statement shows both, at a computer and a phone width.
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
  expect((await staffRequest(server.baseUrl, owner.cookie, '/api/payment-settings', { method: 'PUT', body: { accountsOn: true, accountLimitPence: 25000 } })).status).toBe(200);
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
  test(`on a ${size}, the Owner gives Maya an account with what she owed, and Jo records a transfer of part of it`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const maya = await staffRequest(server!.baseUrl, owner.cookie, '/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: 'maya@example.test' } });
    await signIn(context, owner.cookie);
    await page.goto(`${server!.baseUrl}/workshop/customers/${maya.body.id}`);
    await page.getByRole('button', { name: /^Owes on account/ }).click();
    let box = page.getByRole('dialog', { name: 'Maya Patel’s account' });
    await box.getByRole('button', { name: 'Give Maya an account' }).click();
    await box.getByLabel('Owed from before Wheelhouse').fill('120.00');
    await box.getByRole('button', { name: 'Add it' }).click();
    await expect(box.getByText('Owed from before Wheelhouse')).toBeVisible();
    await expect(box.getByText('+£120.00')).toBeVisible();
    await noSideScroll(page);
    await box.getByRole('button', { name: 'Close' }).click();

    await signIn(context, jo);
    await page.goto(`${server!.baseUrl}/workshop/customers/${maya.body.id}`);
    await expect(page.getByText('Owes £120.00')).toBeVisible();
    await page.getByRole('button', { name: /^Owes on account/ }).click();
    box = page.getByRole('dialog', { name: 'Maya Patel’s account' });
    await box.getByRole('button', { name: 'Record a bank transfer' }).click();
    const bt = page.getByRole('dialog', { name: 'Record a bank transfer' });
    await expect(bt.getByLabel('Amount')).toHaveValue('120.00');
    await bt.getByLabel('Amount').fill('20.00');
    await bt.getByLabel('Reference').fill('[reference]');
    await noSideScroll(page);
    await bt.getByRole('button', { name: 'Record it' }).click();
    await expect(bt).toBeHidden();
    box = page.getByRole('dialog', { name: 'Maya Patel’s account' });
    await expect(box.getByText('Paid by bank transfer · [reference]')).toBeVisible();
    await expect(box.getByText('−£20.00')).toBeVisible();
    await expect(box.getByText('Owed from before Wheelhouse')).toBeVisible();
    await expect(box.getByText('£100.00')).toBeVisible();
    await noSideScroll(page);
  });
}
