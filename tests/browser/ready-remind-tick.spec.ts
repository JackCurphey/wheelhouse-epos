// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { runWithShop, prepare } from '../../server/db.js';
import { startLiveServer, TEST_CLOCK_PIN } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// The reminder tick on the in-shop ready page, end to end (openspec/changes/ready-remind-tick;
// Jack's answer 8 of 25 Oct): Maya, booked in by staff, ticks it on her phone
// when her bike is ready, and her yes is saved, from collection.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let customerId: number;
let link: string;

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London', viewport: { width: 375, height: 812 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);
  customerId = ((await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body as { id: number }).id;
  let job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-09-02', mechanicId: alex, customerId } })).body as { id: number; version: number };
  for (const step of ['book-in', 'start']) job = (await staff(`/api/workshop-jobs/${job.id}/${step}`, { method: 'POST', body: { version: job.version } })).body as typeof job;
  const done = await staff(`/api/workshop-jobs/${job.id}/finish`, { method: 'POST', body: { version: job.version, signedOffBy: alex } });
  expect(done.status, JSON.stringify(done.body)).toBe(200);
  link = ((await staff(`/api/workshop-jobs/${job.id}/private-link`, { method: 'POST', body: {} })).body as { privateLink: string }).privateLink;
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('Maya ticks the reminder box on her ready page, and her yes is saved from collection', async ({ page }) => {
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));
  await page.goto(`${server!.baseUrl}${new URL(link, server!.baseUrl).pathname}`);
  const card = page.getByRole('region', { name: 'To pay when you collect' });
  const tick = card.getByRole('checkbox', { name: /Remind me when my bike is due its next service/ });
  await expect(tick).not.toBeChecked();
  await tick.check();
  await expect.poll(async () => (await runWithShop(owner.shop.id, () => prepare('SELECT service_reminders, reminders_said_yes_via FROM customers WHERE id = ?').get(customerId))))
    .toMatchObject({ service_reminders: true, reminders_said_yes_via: 'collection' });
});
