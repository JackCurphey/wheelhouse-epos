// Telling the customer when to drop the bike off (Jack, 19 Oct,
// docs/decisions/2026-10-19-retire-old-workshop-settings.md answers 3 and 7),
// against the real server: once the shop accepts a set-time booking, the
// customer's booking page says to drop the bike off by the lead time before it.
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
  const job = (await staff('/api/workshop-jobs')).body.find((j: { reference: string }) => j.reference === booked.body.reference);
  const accepted = await staff(`/api/workshop-jobs/${job.id}/accept`, { method: 'POST', body: { version: job.version } });
  expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('the confirmed booking page says when to drop the bike off', async ({ page }) => {
  await page.goto(`${server!.baseUrl}${link}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Confirmed' })).toBeVisible();
  await expect(page.getByText('Drop your Trek Domane AL 3 off by 10:30, half an hour before your booking at 11:00.')).toBeVisible();
});
