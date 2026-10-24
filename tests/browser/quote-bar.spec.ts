import { test, expect } from '@playwright/test';

// The quote's answer bar (openspec/changes/quote-pinned-bar; Jack, 1 Oct,
// decision 8): on a 320px-wide phone the bar is pinned along the bottom and
// covers nothing - the end of the page sits above it, as the booking pages'
// own pinned button does (book-service-list.spec.ts). The page's replies are
// answered here, so the test needs no seeded shop.
const CODE = 'b'.repeat(64);
const LINK = {
  reference: 'WH-1042', shopName: 'North Street Cycles', jobDate: '2026-10-05', startTime: '09:30', description: null, bikeNote: null,
  answers: [], bike: null, stage: 'in_workshop', photoCount: 0, services: [{ name: 'Standard service', price: 65 }], totalPrice: 65,
  shop: { address: null, phone: '[shop phone]' },
};
const line = (over: Record<string, unknown>) => ({
  id: 1, kind: 'part', description: 'Shimano brake pads', productId: 40, quantity: 1, unitAmount: 28, decision: 'pending', lineTotal: 28,
  need: 'needed', reason: 'Rear pads worn — replacing', decidedVia: null, decidedAt: null, decidedByName: null, addedToOrderAt: null,
  goesWithLineId: null, without: null, photoId: null, ...over,
});
const QUOTE = {
  id: 9, workshopJobId: 1, revision: 2, state: 'sent', createdAt: '2026-10-05T09:00:00Z', sentAt: '2026-10-05T10:15:00Z',
  lines: [
    line({}),
    line({ id: 2, kind: 'labour', description: 'Fit & adjust brakes', productId: null, unitAmount: 18, lineTotal: 18, reason: 'Goes together with the new pads', goesWithLineId: 1 }),
    line({ id: 3, description: 'Replace gear cable', productId: null, unitAmount: 12, lineTotal: 12, need: 'optional', reason: 'Cable still serviceable' }),
  ],
  totals: { all: 58, approved: 0, pending: 58, declined: 0 },
};

test('at 320px the quote\'s answer bar is pinned and the end of the page sits above it', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route('**/api/portal/*/services', (route) =>
    route.fulfill({ json: { shopName: 'North Street Cycles', showPrices: true, full: [], categories: [], uncategorised: [] } }));
  await page.route(`**/api/portal/*/booking-links/${CODE}**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/quote')) return route.fulfill({ json: QUOTE });
    if (path.endsWith('/notes')) return route.fulfill({ json: [] });
    return route.fulfill({ json: LINK });
  });
  await page.goto(`/book/north/booking/${CODE}`);
  const bar = page.locator('[data-book-pinned]');
  await expect(bar.getByRole('button', { name: 'Approve £111.00' })).toBeVisible();
  await expect(bar.getByText('Your answers are final once sent.')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const end = await page.evaluate(() => document.querySelector('main')!.lastElementChild!.getBoundingClientRect().bottom);
  const pinned = await bar.boundingBox();
  expect(pinned).not.toBeNull();
  expect(end).toBeLessThanOrEqual(pinned!.y);
});

test('at 320px a failed send\'s message in the bar still covers nothing', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route('**/api/portal/*/services', (route) =>
    route.fulfill({ json: { shopName: 'North Street Cycles', showPrices: true, full: [], categories: [], uncategorised: [] } }));
  await page.route(`**/api/portal/*/booking-links/${CODE}**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/quote/answer')) return route.fulfill({ status: 409, json: { error: 'this link is for revision 2; the current quote is revision 3', code: 'illegal' } });
    if (path.endsWith('/quote')) return route.fulfill({ json: QUOTE });
    if (path.endsWith('/notes')) return route.fulfill({ json: [] });
    return route.fulfill({ json: LINK });
  });
  await page.goto(`/book/north/booking/${CODE}`);
  const bar = page.locator('[data-book-pinned]');
  await bar.getByRole('button', { name: 'Approve £111.00' }).click();
  await expect(bar.getByText('The quote has changed since you opened it. Please look at it again.')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const end = await page.evaluate(() => document.querySelector('main')!.lastElementChild!.getBoundingClientRect().bottom);
  const pinned = await bar.boundingBox();
  expect(end).toBeLessThanOrEqual(pinned!.y);
});
