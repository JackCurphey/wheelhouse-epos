// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer, TEST_CLOCK_PIN } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { futureDate } from '../helpers/workshopFixtures.js';

// Service checklists, end to end against the real server (Jack, 22 Oct,
// docs/decisions/2026-10-22-service-checklists.md; openspec/changes/service-checklists):
// the Owner starts from the full service template and chooses Standard
// service for it; a job for that service shows the checklist under Notes,
// where an item is ticked and another noted.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
const DAY = futureDate(3, new Date(TEST_CLOCK_PIN));

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London', viewport: { width: 1440, height: 900 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  const service = await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-services', { method: 'POST', body: { name: 'Standard service', price: 65, minutes: 60 } });
  expect(service.status, JSON.stringify(service.body)).toBe(201);
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('a shop’s checklist from the template is ticked and noted on a job for its service', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));

  await page.goto(`${server!.baseUrl}/workshop/settings?room=workshop&fold=checklists`);
  await page.getByRole('button', { name: 'Use the full service template' }).click();
  await expect(page.getByText('10 items · not used for a service yet')).toBeVisible();
  await page.getByRole('button', { name: 'Edit Full service checklist' }).click();
  const box = page.getByRole('dialog', { name: 'Full service checklist' });
  await box.getByRole('group', { name: 'Used for' }).getByText('Standard service').click();
  await box.getByRole('button', { name: 'Save checklist' }).click();
  await expect(page.getByText('10 items · used for Standard service')).toBeVisible();

  const services = await staffRequest(server!.baseUrl, owner.cookie, '/api/workshop-services');
  const standard = (services.body as { id: number; name: string }[]).find((s) => s.name === 'Standard service')!;
  const job = await staffRequest(server!.baseUrl, owner.cookie, '/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: DAY, startTime: '10:00', endTime: '11:00', mechanicId: null, serviceIds: [standard.id] } });
  expect(job.status, JSON.stringify(job.body)).toBe(201);

  await page.goto(`${server!.baseUrl}/workshop/diary?date=${DAY}`);
  await page.getByRole('button', { name: /^Bike, Standard service/ }).click();
  const bar = page.getByRole('button', { name: /^Full service checklist/ });
  await expect(bar).toContainText('0 of 10 done · 0 notes');
  await bar.click();
  const list = page.getByRole('dialog', { name: 'Full service checklist' });
  // A click, then the tick (the box follows the saved checklist a moment later).
  await list.getByLabel('Frame & fork', { exact: true }).click();
  await expect(list.getByLabel('Frame & fork', { exact: true })).toBeChecked();
  await expect(list.getByText('1 of 10 done · 0 notes')).toBeVisible();
  await list.getByRole('button', { name: 'Add a note for Headset' }).click();
  await list.getByLabel('Note for Headset').fill('Slight play, adjusted.');
  await list.getByLabel('Frame & fork', { exact: true }).focus();
  await expect(list.getByText('1 of 10 done · 1 note')).toBeVisible();
  await list.getByRole('button', { name: 'Done' }).click();
  await expect(bar).toContainText('1 of 10 done · 1 note');
});
