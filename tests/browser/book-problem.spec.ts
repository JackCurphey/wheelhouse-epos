import { test, expect } from '@playwright/test';

// d2 moved this check to d3: with a phone's on-screen keyboard open, the box
// being typed in must sit entirely above the pinned Continue.
//
// Playwright cannot open a real on-screen keyboard. What a keyboard does to
// the page is shrink the visible height and then scroll the focused box into
// view, and the frame's scroll-padding-bottom keeps that scroll clear of the
// pinned area. This test imitates both: it cuts a 320x568 phone's viewport to
// 320x300 (about what shows above a keyboard), then scrolls the focused box
// into view the way the browser does. It is not a real keyboard.
//
// /services is answered here and the draft seeded, so no seeded shop is needed.
// Spec: docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md
const question = (id: string, wording: string) =>
  ({ id, wording, kind: 'choice', required: true, choices: ['Squeaking', 'Not stopping well'], allowNotSure: true });

test('with the keyboard open, the focused box is entirely above the pinned Continue', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route('**/api/portal/*/services', (route) =>
    route.fulfill({
      json: {
        shopName: 'Test shop', showPrices: true, full: [], categories: [],
        uncategorised: [{
          id: 1, name: 'Brake service', price: 20, minutes: 30,
          questions: [question('b1', "What's wrong with the front brake?"), question('b2', "What's wrong with the rear brake?")],
        }],
      },
    }));
  // The problem screen needs a chosen service (RequireDraft), read from the tab's draft.
  await page.addInitScript(() => window.sessionStorage.setItem('wh-book-draft:any-shop', JSON.stringify({ serviceIds: [1] })));
  await page.goto('/book/any-shop/problem');

  const box = page.getByRole('textbox', { name: 'Anything else we should know? (optional)' });
  await box.focus();
  // The keyboard opens: the visible height drops (imitated; see above) and the
  // browser brings the focused box into view.
  await page.setViewportSize({ width: 320, height: 300 });
  await box.evaluate((el) => el.scrollIntoView({ block: 'nearest' }));

  const field = await box.boundingBox();
  const pinned = await page.locator('[data-book-pinned]').boundingBox();
  expect(field).not.toBeNull();
  expect(pinned).not.toBeNull();
  expect(field!.y).toBeGreaterThanOrEqual(0);
  expect(field!.y + field!.height).toBeLessThanOrEqual(pinned!.y);
});
