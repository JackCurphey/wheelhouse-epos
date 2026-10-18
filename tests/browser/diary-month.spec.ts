// The React staff diary's month view (Jack, 18 Oct,
// docs/decisions/2026-10-18-old-diary-features.md answer 1 and its tablet and
// phone section), in a real browser: the grid fits the page, and on a
// tablet a tap on a day opens its list with finger-sized rows.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
const TUE = '2026-10-13';

test.describe.configure({ timeout: 90_000 });

const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Month Cycles' });
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  for (const [title, startTime, endTime] of [['Brake service', '09:00', '10:00'], ['Gear tune', '10:00', '11:00'], ['Wheel true', '11:00', '12:00'], ['Safety check', '14:00', '15:00']]) {
    const made = await staff('/api/workshop-jobs', { method: 'POST', body: { title, jobDate: TUE, startTime, endTime, mechanicId: alex } });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
  }
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

for (const width of [1280, 1024]) {
  test(`at ${width}px the month fits the page, with three jobs and "+1 more" on a busy day`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/diary?date=${TUE}&view=month`);
    const tue = page.getByRole('group', { name: 'Tuesday 13 October' });
    await expect(tue.getByText('+1 more')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test('on a tablet, a tap on a day opens its list, with finger-sized rows', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1024, height: 768 } });
  try {
    const [name, value] = owner.cookie.split('=');
    await ctx.addCookies([{ name, value, url: server!.baseUrl }]);
    const page = await ctx.newPage();
    await page.goto(`${server!.baseUrl}/workshop/diary?date=${TUE}&view=month`);
    const tue = page.getByRole('group', { name: 'Tuesday 13 October' });
    // On a tablet the jobs inside a day aren't tapped one by one.
    await expect(tue.getByRole('button', { name: /^09:00,/ })).toHaveCount(0);
    // The date's tap area is finger-sized.
    expect((await tue.getByRole('button', { name: /in the Day view$/ }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await tue.getByText('+1 more').tap();
    const list = page.getByRole('dialog', { name: 'Tuesday 13 October' });
    await expect(list).toBeVisible();
    const row = list.getByRole('button', { name: /Safety check/ });
    expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  } finally {
    await ctx.close();
  }
});
