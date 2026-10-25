// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Staff sign in through WorkOS, in a real browser against the real server and
// the pretend WorkOS (openspec/changes/staff-signin-workos-screens; auth-signedout,
// auth-expired): opening a page signed out goes to sign-in and back to it,
// Sign out ends on "You've signed out", and the page fits a computer and a phone.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { email: string; shop: { id: number } };

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

test('the diary, signed out: Continue with Google, the pretend page, back on the diary, then sign out', async ({ page }) => {
  await page.goto(`${server!.baseUrl}/workshop/diary`);
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in to Wheelhouse' })).toBeVisible();
  await page.getByRole('link', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('heading', { name: 'Pretend WorkOS · Google' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Email' }).fill(owner.email);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${server!.baseUrl}/workshop/diary`);
  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await expect(page).toHaveURL(`${server!.baseUrl}/workshop/signed-out`);
  await expect(page.getByRole('heading', { level: 1, name: 'You’ve signed out' })).toBeVisible();
});

for (const [size, viewport] of [['computer', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`“You’ve signed out” on a ${size}: as drawn, nothing off the side`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${server!.baseUrl}/workshop/signed-out`);
    await expect(page.getByRole('heading', { level: 1, name: 'You’ve signed out' })).toBeVisible();
    await expect(page.getByText('Close this window, or sign in again.')).toBeVisible();
    const button = page.getByRole('link', { name: 'Sign in again' });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('href', '/workshop/sign-in');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('a session that has run out: “Please sign in again”, and back to the page after', async ({ page, context }) => {
  await context.addCookies([{ name: 'wh_session', value: '0'.repeat(64), url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary`);
  await expect(page.getByRole('heading', { level: 1, name: 'Please sign in again' })).toBeVisible();
  await page.getByRole('link', { name: 'Sign in again' }).click();
  await page.getByRole('link', { name: 'Sign in with email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill(owner.email);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${server!.baseUrl}/workshop/diary`);
});

for (const [size, viewport] of [['computer', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`“Sign in to Wheelhouse” on a ${size}: as drawn, nothing off the side`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${server!.baseUrl}/workshop/sign-in`);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to Wheelhouse' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in with email' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
