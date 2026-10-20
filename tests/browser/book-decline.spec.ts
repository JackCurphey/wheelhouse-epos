// Declining with a message end to end (Workshop day 15; Jack, 20 Oct;
// openspec/changes/decline-message), against the real server: staff decline a
// request with a message; the customer's page shows it.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { portalSignup, portalRequest } from '../helpers/portal.js';
import { seedJobTypes, BOOKING_CONTACT } from '../helpers/bookable.js';
import { futureDate } from '../helpers/workshopFixtures.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let link: string;

test.describe.configure({ timeout: 90_000 });
const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  const types = await seedJobTypes(owner.shop.id);
  const customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  expect((await staff('/api/workshop-settings', { method: 'PUT', body: { bookingMode: 'timed', timedLeadMinutes: 30 } })).status).toBe(200);
  const booked = await portalRequest(server.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
    method: 'POST',
    body: { mechanicId: alex, jobDate: futureDate(2), startTime: '11:00', description: 'Squeaky brakes', newBike: { make: 'Trek', model: 'Domane AL 3' }, serviceIds: [types.service], ...BOOKING_CONTACT },
  });
  expect(booked.status, JSON.stringify(booked.body)).toBe(201);
  link = booked.body.privateLink;
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});


test('staff decline a request with a message and the customer sees it', async ({ page }) => {
  const job = (await staff('/api/workshop-jobs')).body.find((j: { bookingState: string }) => j.bookingState === 'pending');
  const declined = await staff(`/api/workshop-jobs/${job.id}/decline`, { method: 'POST', body: { version: job.version, message: 'Fully booked that week, sorry.' } });
  expect(declined.status, JSON.stringify(declined.body)).toBe(200);
  await page.goto(`${server!.baseUrl}${link}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Sorry, we can’t fit this booking in' })).toBeVisible();
  await expect(page.getByText('“Fully booked that week, sorry.”')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Choose another date' })).toBeVisible();
});
