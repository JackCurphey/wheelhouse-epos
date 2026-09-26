import { test, expect } from '@playwright/test';

// d1 deferred this check to the first long book screen (d2): on a 320px-wide
// phone, the pinned summary and Continue must not cover the last service.
// /services is answered here so the test needs no seeded shop.
// Spec: docs/superpowers/specs/2026-09-26-book-d2-service-screens-design.md
test('at 320px the last service is fully above the pinned Continue', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const services = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Service ${i + 1}`, price: 20, minutes: 30, questions: [] }));
  await page.route('**/api/portal/*/services', (route) =>
    route.fulfill({ json: { shopName: 'Test shop', showPrices: true, full: [], categories: [], uncategorised: services } }));
  await page.goto('/book/any-shop/services');
  // Matched by visible title, not accessible name: ChoiceCard currently runs
  // title and price together with no space, so exact text keeps 1 distinct
  // from 10/11/12 where the accessible name can't.
  const service1 = page.locator('button', { has: page.getByText('Service 1', { exact: true }) });
  await service1.click();
  await expect(page.getByText('1 service · from £20')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  // Matched by visible title, not accessible name: same reason as above.
  const last = await page.locator('button', { has: page.getByText('Service 12', { exact: true }) }).boundingBox();
  const pinned = await page.locator('[data-book-pinned]').boundingBox();
  expect(last).not.toBeNull();
  expect(pinned).not.toBeNull();
  expect(last!.y + last!.height).toBeLessThanOrEqual(pinned!.y);
});
