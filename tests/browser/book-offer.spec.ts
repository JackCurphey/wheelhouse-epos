// Offer another time end to end (Jack, 20 Oct, docs/decisions/2026-10-20-offer-another-time.md;
// openspec/changes/offer-another-time), against the real server: staff offer a
// request another time; the customer sees it on their page and accepts it.
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


test('staff offer another time and the customer accepts it on their booking page', async ({ page }) => {
  const job = (await staff('/api/workshop-jobs')).body.find((j: { bookingState: string }) => j.bookingState === 'pending');
  const offered = await staff(`/api/workshop-jobs/${job.id}/offer`, { method: 'POST', body: { version: job.version, jobDate: futureDate(3), startTime: '14:00', mechanicId: job.mechanicId, message: 'Would this suit?' } });
  expect(offered.status, JSON.stringify(offered.body)).toBe(200);
  await page.goto(`${server!.baseUrl}${link}`);
  await expect(page.getByText('The shop has suggested another time', { exact: true })).toBeVisible();
  await expect(page.getByText(/can’t do .* at 11:00\. They suggest:$/)).toBeVisible();
  await expect(page.getByText('“Would this suit?”')).toBeVisible();
  await page.getByRole('button', { name: 'Accept this time' }).click();
  await expect(page.getByText('Booking confirmed', { exact: true })).toBeVisible();
  const after = (await staff(`/api/workshop-jobs/${job.id}`)).body;
  expect(after.bookingState).toBe('scheduled');
  expect(after.startTime).toBe('14:00');
});

// Declining a time already offered (Jack, 20 Oct, offered-decline-reoffer;
// drawn as request-offered and request-offered-decline): from its block in
// the diary, with a message the customer sees on their page.
test('staff open an offered booking from the diary and decline it with a message', async ({ page, context }) => {
  const customer = await portalSignup(server!.baseUrl, owner.shop.slug, {});
  const types = await seedJobTypes(owner.shop.id);
  const alex = (await staff('/api/workshop-jobs')).body[0].mechanicId;
  const booked = await portalRequest(server!.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
    method: 'POST',
    body: { mechanicId: alex, jobDate: futureDate(4), startTime: '11:00', description: 'Gears slip', newBike: { make: 'Giant', model: 'Escape 2' }, serviceIds: [types.service], ...BOOKING_CONTACT },
  });
  expect(booked.status, JSON.stringify(booked.body)).toBe(201);
  const job = (await staff(`/api/workshop-jobs/${booked.body.id}`)).body;
  const offered = await staff(`/api/workshop-jobs/${job.id}/offer`, { method: 'POST', body: { version: job.version, jobDate: futureDate(5), startTime: '14:00', mechanicId: alex, message: 'Would Friday suit?' } });
  expect(offered.status, JSON.stringify(offered.body)).toBe(200);
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${futureDate(5)}`);
  await page.getByRole('button', { name: /Giant Escape 2.*Time offered/ }).first().click();
  const pop = page.getByRole('dialog', { name: /· Giant Escape 2$/ });
  await expect(pop.getByText('“Would Friday suit?”').or(pop.getByText('Would Friday suit?'))).toBeVisible();
  await pop.getByRole('button', { name: 'Decline' }).click();
  const decline = page.getByRole('dialog', { name: 'Decline request' });
  await decline.getByRole('textbox').fill('Sorry, we’re full that week.');
  await decline.getByRole('button', { name: 'Decline & notify customer' }).click();
  await expect(decline).toBeHidden();
  expect((await staff(`/api/workshop-jobs/${job.id}`)).body.bookingState).toBe('declined');
  await page.goto(`${server!.baseUrl}${booked.body.privateLink}`);
  await expect(page.getByText(/Sorry, we’re full that week\./)).toBeVisible();
});
