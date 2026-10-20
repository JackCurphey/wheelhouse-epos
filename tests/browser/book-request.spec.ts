// The waiting-for-the-shop page (Jack, 1 Oct, decisions 10 and 12; 20 Oct;
// openspec/changes/booking-page-request), against the real server: a customer
// moves a request that isn't accepted yet, then cancels it.
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


test('a customer moves a request straight away, then cancels it', async ({ page }) => {
  await page.goto(`${server!.baseUrl}${link}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Your booking request' })).toBeVisible();
  await expect(page.getByText('Waiting for the shop to confirm', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Change the date' }).click();
  await page.getByRole('radiogroup', { name: 'Days' }).getByRole('radio', { name: / times? free$/ }).first().check({ force: true });
  const times = page.getByRole('radiogroup', { name: /choose a time$/ });
  const pick = await times.getByRole('radio').first().getAttribute('aria-label');
  await times.getByRole('radio', { name: pick!, exact: true }).check({ force: true });
  await page.getByRole('button', { name: 'Move my request' }).click();
  await expect(page.getByText(new RegExp(`, ${pick}$`))).toBeVisible();
  await expect(page.getByText('Waiting for the shop to confirm', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel request' }).click();
  await page.getByRole('dialog', { name: 'Cancel this request?' }).getByRole('button', { name: 'Cancel request' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your booking is cancelled' })).toBeVisible();
});
