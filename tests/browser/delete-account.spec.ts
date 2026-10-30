// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { runWithShop, prepare } from '../../server/db.js';

// Deleting an account in real browsers (openspec/changes/delete-account;
// ac-delete, ac-delete-sent, ac-account-delete-pending, cs-privacy,
// cs-privacy-delete): Maya asks from her account; the Owner finds the request
// from Customers and deletes her details; Maya's account is gone.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000 });

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

for (const [size, viewport] of [['a computer', { width: 1440, height: 900 }], ['a phone', { width: 375, height: 812 }]] as const) {
  test(`on ${size}: Maya asks, the Owner deletes her details, her account is gone`, async ({ page, browser }) => {
    await page.setViewportSize(viewport);
    const email = `maya-delete-${randomUUID().slice(0, 8)}@example.test`;
    const maya = (await staffRequest(server!.baseUrl, owner.cookie, '/api/customers', { method: 'POST', body: { name: 'Maya Patel', email } })).body;
    await runWithShop(owner.shop.id, () => prepare('UPDATE customers SET email_from_customer = true WHERE id = ?').run(maya.id));

    // Maya signs in and asks.
    await page.goto(`${server!.baseUrl}/book/${owner.shop.slug}/sign-in?from=${encodeURIComponent(`/book/${owner.shop.slug}/account`)}`);
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Email me a code' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Enter your code' })).toBeVisible();
    const { code } = await runWithShop(owner.shop.id, () => prepare('SELECT code FROM pretend_signin_codes WHERE email = ? AND used_at IS NULL').get(email));
    await page.getByRole('textbox', { name: 'Your 6-digit code' }).fill(code);
    await expect(page).toHaveURL(new RegExp(`/book/${owner.shop.slug}/account$`));
    await page.getByRole('button', { name: 'Ask us to delete your account' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Ask to delete' }).click();
    await expect(page.getByRole('dialog', { name: 'Request sent' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByText(/^You asked us to delete your account on /).first()).toBeVisible();
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/delete-asked-${viewport.width}.png`, fullPage: true });

    // The Owner, from Customers.
    const staffContext = await browser.newContext({ viewport });
    const staff = await staffContext.newPage();
    const [name, value] = owner.cookie.split('=');
    await staffContext.addCookies([{ name, value, url: server!.baseUrl }]);
    await staff.goto(`${server!.baseUrl}/workshop/customers`);
    await staff.getByRole('link', { name: /^Privacy requests · \d+ open$/ }).click();
    await expect(staff.getByRole('heading', { level: 2, name: 'Privacy requests' })).toBeVisible();
    const row = staff.getByRole('listitem').filter({ hasText: 'Maya Patel · Delete their details' });
    await row.getByRole('button', { name: 'Delete their details' }).click();
    await staff.getByRole('dialog', { name: 'Delete Maya Patel’s details?' }).getByRole('button', { name: 'Delete their details' }).click();
    await expect(staff.getByRole('listitem').filter({ hasText: /^PR-\d+ · Delete their details/ }).first()).toBeVisible();
    // Opened straight from its address, it shows the same.
    await staff.goto(`${server!.baseUrl}/workshop/customers/privacy`);
    await expect(staff.getByRole('listitem').filter({ hasText: /^PR-\d+ · Delete their details/ }).first()).toBeVisible();
    expect(await staff.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (process.env.WH_SHOTS) await staff.screenshot({ path: `${process.env.WH_SHOTS}/privacy-requests-${viewport.width}.png`, fullPage: true });
    await staffContext.close();

    // Maya's account is gone: back to sign in.
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/book/${owner.shop.slug}/sign-in`));
  });
}
