import { test, expect } from '@playwright/test';

// d4: on a 320px-wide phone with three mechanics, the one-day diary is the
// longest thing on the date screen. Scrolled to the bottom, its last row must
// sit entirely above the pinned summary and Continue.
//
// /services, /mechanics and /availability are answered here and the draft
// seeded, so no seeded shop is needed. The page's clock is pinned to Monday
// 5 October 2026 so the calendar opens on a known month.
//
// MonthCalendar names its day buttons with Intl's en-GB weekday formatter
// (src/components/ui/month-calendar.tsx DAY_NAME), which renders a comma
// after the weekday in Chromium ("Monday, 5 October 2026") - unlike the
// screen's own dayLabel copy, which never has one. The day button is
// therefore located with a comma-tolerant regex rather than the brief's
// literal string.
// Spec: docs/superpowers/specs/2026-09-26-book-d4-date-screen-design.md
const mechanics = [
  { id: 1, name: 'Alex', workingDays: [1, 2, 3, 4, 5] },
  { id: 2, name: 'Jo', workingDays: [1, 2, 3, 4, 5] },
  { id: 3, name: 'Sam', workingDays: [1, 2, 3, 4, 5] },
];
// Every half hour a 30-minute job can start between 08:00 and 18:00.
const allDay = Array.from({ length: 20 }, (_, i) => {
  const t = 8 * 60 + i * 30;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
});

test("at 320px with three mechanics, the diary's last row is fully above the pinned Continue", async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-05T10:00:00'));
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route('**/api/portal/*/services', (route) =>
    route.fulfill({
      json: {
        shopName: 'Test shop', showPrices: true, full: [], categories: [],
        uncategorised: [{ id: 1, name: 'Brake service', price: 20, minutes: 30, questions: [] }],
      },
    }));
  await page.route('**/api/portal/*/mechanics', (route) =>
    route.fulfill({ json: { mechanics, openingTime: '08:00', closingTime: '18:00', openingDays: [1, 2, 3, 4, 5] } }));
  await page.route(/\/api\/portal\/[^/]+\/availability\?/, (route) =>
    route.fulfill({
      json: {
        busy: [], fullDays: [],
        days: [{ date: '2026-10-05', mode: 'timed', mechanics: mechanics.map((m) => ({ mechanicId: m.id, startTimes: allDay })) }],
      },
    }));
  // The date screen needs a finished problem screen (RequireDraft with
  // hasProblem); a service with no questions needs nothing more.
  await page.addInitScript(() => window.sessionStorage.setItem('wh-book-draft:any-shop', JSON.stringify({ serviceIds: [1] })));
  await page.goto('/book/any-shop/date');

  await page.getByRole('button', { name: /^Monday,?\s+5 October 2026$/ }).click();
  await page.getByRole('button', { name: 'Alex, 09:00' }).click();
  await expect(page.getByText('Monday 5 October, 09:00 with Alex')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  const pinned = await page.locator('[data-book-pinned]').boundingBox();
  expect(pinned).not.toBeNull();
  for (const name of ['Alex', 'Jo', 'Sam']) {
    const column = await page.getByRole('group', { name, exact: true }).boundingBox();
    expect(column, name).not.toBeNull();
    expect(column!.y + column!.height, `${name}'s last row`).toBeLessThanOrEqual(pinned!.y);
  }
});
