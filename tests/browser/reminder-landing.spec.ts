// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { runWithShop, prepare } from '../../server/db.js';
import { startLiveServer, TEST_CLOCK_PIN } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { reminderBookLink } from '../../server/messaging/reminder-links.js';

// A service reminder's booking link, end to end against the real server
// (openspec/changes/finish-account design 4; ac-reminder-landing): Maya opens
// the link from her reminder on a phone, lands on "When?" with her Standard
// service and her Trek chosen and her details filled in, picks a time and
// books without typing her name or mobile; the booking is hers, for her bike.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let mayaId: number;
let bikeId: number;
let serviceId: number;
const BIKE = 'Trek Domane AL 3 · green · black mudguards';

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London', viewport: { width: 375, height: 812 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  await seedMechanic(owner.shop.id, { name: 'Sam' });
  const staff = (p: string, options: object) => staffRequest(server!.baseUrl, owner.cookie, p, options);
  const service = await staff('/api/workshop-services', { method: 'POST', body: { name: 'Standard service', price: 65, minutes: 60, kind: 'full', bookableOnline: true, reminderMonths: 6 } });
  expect(service.status, JSON.stringify(service.body)).toBe(201);
  serviceId = service.body.id;
  const maya = await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142', email: 'maya@example.test' } });
  mayaId = maya.body.id;
  bikeId = await runWithShop(owner.shop.id, async () => (await prepare("INSERT INTO customer_bikes (customer_id, make, model, colour) VALUES (?, 'Trek', 'Domane AL 3', 'green · black mudguards') RETURNING id").get(mayaId)).id);
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('Maya books from her reminder’s link without typing her details', async ({ page }) => {
  const link = await runWithShop(owner.shop.id, () => reminderBookLink(server!.baseUrl, owner.shop.slug, { customerId: mayaId, bikeId, serviceId }));
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));
  await page.goto(link);
  await expect(page.getByRole('heading', { level: 1, name: 'When can you drop in?' })).toBeVisible();
  await expect(page.getByText(`From your reminder: booking the next Standard service for your ${BIKE}. Change either above.`)).toBeVisible();
  await expect(page.getByText(/Your details are filled in from your reminder: Maya P\. · 07700 ••• 142/)).toBeVisible();

  await page.getByRole('button', { name: /^Wednesday,?\s+2 September 2026$/ }).click();
  await page.getByRole('button', { name: 'Sam, 10:00' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'How can we reach you?' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'I agree to the booking terms' }).check();
  await page.getByRole('button', { name: 'Request booking' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your booking request' })).toBeVisible({ timeout: 15_000 });

  const job = await runWithShop(owner.shop.id, () => prepare('SELECT customer_id, bike_id, job_date, start_time FROM workshop_jobs').get());
  expect(job).toMatchObject({ customer_id: mayaId, bike_id: bikeId, job_date: '2026-09-02', start_time: '10:00' });
});
