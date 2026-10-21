// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer, TEST_CLOCK_PIN } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { portalSignup } from '../helpers/portal.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { seedJobTypes } from '../helpers/bookable.js';
import { bookOnline } from '../helpers/linkActions.js';
import { futureDate } from '../helpers/workshopFixtures.js';

// Confirming online bookings automatically, end to end against the real server
// (Jack, 19 Oct, docs/decisions/2026-10-19-auto-confirm.md; openspec/changes/auto-confirm
// task 2.3): with the switch on, a customer's booking is confirmed at once, sits
// in the diary marked new, and the mark goes once the job is opened.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let booked: { id: number };
const DAY = futureDate(3, new Date(TEST_CLOCK_PIN));

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London', viewport: { width: 1440, height: 900 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  const types = await seedJobTypes(owner.shop.id);
  const on = await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-settings', { method: 'PUT', body: { confirmBookingsAutomatically: true } });
  expect(on.status, JSON.stringify(on.body)).toBe(200);
  const customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  booked = await bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, { mechanicId: sam, jobDate: DAY, startTime: '10:00', serviceIds: [types.service] });
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('a booking confirmed at once is marked New online in the diary until it is opened', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${DAY}`);
  const block = page.getByRole('button', { name: /, new, booked online$/ });
  await expect(block).toBeVisible();
  await expect(block).toContainText('New online');
  // Not waiting for the shop: a normal booking, not a request.
  expect((await staffRequest(server!.baseUrl, owner.cookie, `/api/workshop-jobs/${booked.id}`)).body.bookingState).toBe('scheduled');

  await block.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(async () => (await staffRequest(server!.baseUrl, owner.cookie, `/api/workshop-jobs/${booked.id}`)).body.newOnline).toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /, new, booked online$/ })).toHaveCount(0);
});
