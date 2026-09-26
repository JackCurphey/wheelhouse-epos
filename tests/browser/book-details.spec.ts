import { test, expect, type Locator, type Page } from '@playwright/test';

// d5: on a 320x568 phone, scrolled to the bottom of the details screen, the
// last field (Email) and the terms box must sit entirely above the pinned
// Request booking - before any message shows, and again once every message
// shows (the pinned area grows by a line).
//
// /services and /mechanics are answered here and the draft seeded, so no
// seeded shop is needed. A timed day, so /availability isn't asked for.
// Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
const DRAFT = {
  serviceIds: [1], answers: [], bikeNote: 'Blue Trek road bike', date: '2026-10-05', mechanicId: 1, startTime: '09:30',
};

async function bottomOf(locator: Locator, what: string) {
  const box = await locator.boundingBox();
  expect(box, what).not.toBeNull();
  return box!.y + box!.height;
}

async function expectClearOfPinned(page: Page, extra: Locator[] = []) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const pinned = await page.locator('[data-book-pinned]').boundingBox();
  expect(pinned).not.toBeNull();
  const email = page.getByRole('textbox', { name: /^Email/ });
  const terms = page.getByRole('checkbox', { name: 'I agree to the booking terms' }).locator('xpath=ancestor::label[1]');
  expect(await bottomOf(email, 'the email field')).toBeLessThanOrEqual(pinned!.y);
  expect(await bottomOf(terms, 'the terms box')).toBeLessThanOrEqual(pinned!.y);
  for (const locator of extra) expect(await bottomOf(locator, 'the terms message')).toBeLessThanOrEqual(pinned!.y);
}

test('at 320px the last field and the terms box stay above the pinned Request booking', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route('**/api/portal/*/services', (route) =>
    route.fulfill({
      json: {
        shopName: 'Test shop', showPrices: true, full: [], categories: [],
        uncategorised: [{ id: 1, name: 'Brake service', price: 20, minutes: 30, questions: [] }],
      },
    }));
  await page.route('**/api/portal/*/mechanics', (route) =>
    route.fulfill({
      json: { mechanics: [{ id: 1, name: 'Alex', workingDays: [1, 2, 3, 4, 5] }], openingTime: '09:00', closingTime: '17:00', openingDays: [1, 2, 3, 4, 5] },
    }));
  await page.addInitScript((draft) => window.sessionStorage.setItem('wh-book-draft:any-shop', JSON.stringify(draft)), DRAFT);
  await page.goto('/book/any-shop/details');

  await expect(page.getByText('Monday 5 October, 09:30 with Alex')).toBeVisible();
  await expectClearOfPinned(page);

  await page.getByRole('button', { name: 'Request booking' }).click();
  const termsMessage = page.getByText('Please accept the booking terms');
  await expect(termsMessage).toBeVisible();
  await expectClearOfPinned(page, [termsMessage]);
});
