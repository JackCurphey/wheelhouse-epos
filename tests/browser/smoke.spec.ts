import { test, expect } from '@playwright/test';

test('the workshop app mounts in a real browser', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  // Signed out, /workshop goes straight on to sign-in (staff-signin-workos-screens
  // design 6), so the app is opened at its own signed-out page.
  await page.goto('/workshop/signed-out');
  await expect(page.locator('#wh-root')).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test('a deep link opened directly reaches its screen', async ({ page }) => {
  // The five edge screens are entered from outside the app, so the server and
  // the router must both honour a cold load of their URL.
  await page.goto('/workshop/link-expired');
  await expect(page.locator('#wh-root')).toContainText('expired');
});

test('the customer app mounts at /book in a real browser', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/book/any-shop');
  await expect(page.locator('#wh-book-root')).toContainText("We can't find this shop");
  expect(errors).toEqual([]);
});
