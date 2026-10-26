// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// A bike's own page in a real browser (openspec/changes/bike-page; cs-bike):
// from the customer's page to the bike, its job listed, Edit saved, and New
// job opened with the bike chosen.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let maya: { id: number };
let job: { reference: string };
let trek: { id: number };

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  const bike = trek = (await staff(`/api/customers/${maya.id}/bikes`, { method: 'POST', body: { make: 'Trek', model: 'Domane AL 3', colour: 'Green' } })).body;
  await staff(`/api/customers/${maya.id}/bikes`, { method: 'POST', body: { make: 'Brompton', model: 'C Line' } });
  job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Gear tune', jobDate: '2026-09-20', customerId: maya.id, bikeId: bike.id } })).body;
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('customer page → bike page → Edit → New job with the bike chosen', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/customers/${maya.id}`);
  await page.getByRole('link', { name: /Trek Domane AL 3/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Trek Domane AL 3' })).toBeVisible();
  await expect(page.getByText('Maya Patel’s bike')).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(job.reference) })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Customers' })).toBeVisible();
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/bike-page.png` });

  await page.getByRole('button', { name: 'Edit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit bike' });
  await dialog.getByLabel('Colour').fill('Black');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Black', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'New job' }).click();
  const newJob = page.getByRole('dialog', { name: /New job/ });
  await expect(newJob).toBeVisible();
  await expect(newJob.getByText('Maya Patel').first()).toBeVisible();
  await expect(newJob.getByRole('combobox', { name: 'Bike' })).toHaveValue(/\d+/);
  await expect(newJob.getByRole('combobox', { name: 'Bike' }).locator('option:checked')).toHaveText(/Trek Domane AL 3/);
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/bike-page-new-job.png` });
});

test('the bike page opens from its own address, as after a refresh', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/bikes/${trek.id}`);
  await expect(page.getByRole('heading', { level: 2, name: 'Trek Domane AL 3' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Customers' })).toBeVisible();
});
