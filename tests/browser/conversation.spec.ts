// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { runWithShop, prepare } from '../../server/db.js';

// "Ask the shop a question" in a real browser against the real server
// (openspec/changes/ask-the-shop-screens; ac-ask, ac-account-question-sent,
// ac-question, ac-account-asked; day answers 2 and 8): signed out, the page
// goes to sign in and back; she sends a message; staff reply; she sees the
// reply, and her account's history says the shop replied. At a computer's and
// a phone's width, with nothing wider than the screen.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London' });

test.beforeAll(async () => {
  server = await startLiveServer({ env: { CUSTOMER_SIGNIN_PROVIDER: 'pretend' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

const noSideways = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const [size, viewport] of [['a computer', { width: 1440, height: 900 }], ['a phone', { width: 375, height: 812 }]] as const) {
  test(`on ${size}: she asks the shop a question, staff reply, and she sees it`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const slug = owner.shop.slug;
    const email = `maya-conversation-${viewport.width}@example.test`;
    await page.goto(`${server!.baseUrl}/book/${slug}/messages`);
    await expect(page).toHaveURL(new RegExp(`/book/${slug}/sign-in\\?from=`));
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Email me a code' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Enter your code' })).toBeVisible();
    const { code } = await runWithShop(owner.shop.id, () => prepare('SELECT code FROM pretend_signin_codes WHERE email = ? AND used_at IS NULL').get(email));
    await page.getByRole('textbox', { name: 'Your 6-digit code' }).fill(code);
    await expect(page).toHaveURL(new RegExp(`/book/${slug}/messages$`));

    // Nothing yet: the box asks the question.
    await expect(page.getByRole('heading', { level: 1, name: /^Messages with North Street Cycles/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Your account/ })).toBeVisible();
    await page.getByRole('textbox', { name: 'Ask the shop a question' }).fill('Do you fit mudguards?');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sent.' })).toHaveText(/^Sent. We’ll let you know when North Street Cycles.* replies.$/);
    const thread = page.getByRole('list', { name: /^Messages with North Street Cycles/ });
    await expect(thread.getByRole('listitem').last()).toContainText('Do you fit mudguards?');
    await expect(page.getByRole('textbox', { name: 'Your message' })).toBeVisible();
    expect(await noSideways(page)).toBe(true);

    // Staff reply from the inbox's route.
    const { customer_id: customerId } = await runWithShop(owner.shop.id, () => prepare('SELECT customer_id FROM customer_logins WHERE lower(email) = ?').get(email));
    const reply = await staffRequest(server!.baseUrl, owner.cookie, `/api/customer-conversations/${customerId}/messages`, { method: 'POST', body: { text: 'Yes, bring it in any morning.' } });
    expect(reply.status).toBe(201);

    await page.reload();
    const last = thread.getByRole('listitem').last();
    await expect(last).toContainText('Yes, bring it in any morning.');
    await expect(last).toContainText('North Street Cycles');
    // The shop's on the left, hers on the right.
    const [mine, theirs] = await Promise.all([thread.getByRole('listitem').first().getByText('Do you fit mudguards?').boundingBox(), last.getByText('Yes, bring it in any morning.').boundingBox()]);
    expect(theirs!.x).toBeLessThan(mine!.x);
    expect(await noSideways(page)).toBe(true);
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/conversation-${viewport.width}.png`, fullPage: true });

    // Her account: the row says the shop replied, and opens the conversation.
    await page.getByRole('link', { name: /Your account/ }).click();
    const row = page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Messages with North Street Cycles/ });
    await expect(row).toContainText(/North Street Cycles.* replied/);
    await expect(row).toContainText('Replied');
    expect(await noSideways(page)).toBe(true);
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/book/${slug}/messages$`));
    await page.goBack();
    await page.getByRole('link', { name: 'Ask the shop a question' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /^Messages with North Street Cycles/ })).toBeVisible();
  });
}
