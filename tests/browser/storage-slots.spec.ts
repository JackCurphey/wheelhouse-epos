// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer, TEST_CLOCK_PIN } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { futureDate } from '../helpers/workshopFixtures.js';

// Storage slots, end to end against the real server (Workshop day 27;
// openspec/changes/storage-slots): the Owner switches slots on and adds a
// hook; Book in on the job page asks where the bike is kept; the job and its
// diary block say so; collecting it clears the slot.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
const DAY = futureDate(3, new Date(TEST_CLOCK_PIN));

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London', viewport: { width: 1440, height: 900 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  const job = await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: DAY, startTime: '10:00', endTime: '11:30', mechanicId: alex } });
  expect(job.status, JSON.stringify(job.body)).toBe(201);
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('a hook added in Settings is chosen at Book in, shown on the job and the diary, and cleared at collection', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));

  await page.goto(`${server!.baseUrl}/workshop/settings?room=workshop`);
  await page.getByRole('button', { name: /^Storage slots/ }).click();
  await page.getByRole('switch', { name: 'Storage slots' }).click();
  await expect(page.getByRole('switch', { name: 'Storage slots' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: '+ Add a slot' }).click();
  await page.getByLabel('New slot').fill('Hook 3');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Hook 3' })).toBeVisible();

  await page.goto(`${server!.baseUrl}/workshop/diary?date=${DAY}`);
  await page.getByRole('button', { name: /^Bike, Standard service/ }).click();
  const jobPage = page.getByRole('dialog', { name: /Standard service/ });
  await jobPage.getByRole('button', { name: 'Book in', exact: true }).click();
  const box = page.getByRole('dialog', { name: /^Book in · job/ });
  await box.getByRole('radio', { name: 'Hook 3' }).click();
  await box.getByRole('button', { name: 'Done' }).click();
  await expect(jobPage.getByRole('button', { name: 'Kept on Hook 3' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('group', { name: /October|September/ }).getByText('Hook 3').first()).toBeVisible();

  const jobs = (await staffRequest(server!.baseUrl, owner.cookie, `/api/workshop-jobs?start=${DAY}&end=${DAY}`)).body as { id: number; version: number; storageSlotName: string | null }[];
  expect(jobs[0].storageSlotName).toBe('Hook 3');
  const collected = await staffRequest(server!.baseUrl, owner.cookie, `/api/workshop-jobs/${jobs[0].id}/collect`, { method: 'POST', body: { version: jobs[0].version } });
  expect(collected.status, JSON.stringify(collected.body)).toBe(200);
  expect(collected.body.storageSlotName).toBeNull();
});
