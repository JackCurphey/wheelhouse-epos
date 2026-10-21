// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import type { BrowserContext } from '@playwright/test';
import { startLiveServer, TEST_CLOCK_PIN } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { futureDate } from '../helpers/workshopFixtures.js';

// The old app (public/app.js) after its workshop diary was retired
// (docs/decisions/2026-10-18-retire-old-diary.md): its Workshop tab opens the
// new diary, and so does an order's workshop job (changed 20 Oct): "View /
// edit workshop job" opens the job's page there, and ticking "Show in
// workshop diary" opens New job filled in from the order, linked once saved.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jobTitle: string;
let jobId: number;

test.describe.configure({ timeout: 60_000 });
test.use({ timezoneId: 'Europe/London', viewport: { width: 1400, height: 900 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Old App Cycles' });
  const sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  jobTitle = `Brake check ${owner.shop.id}`;
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-jobs', {
    method: 'POST',
    body: { title: jobTitle, jobDate: futureDate(2, new Date(TEST_CLOCK_PIN)), startTime: '10:00', endTime: '11:00', mechanicId: sam },
  });
  expect(made.status, JSON.stringify(made.body)).toBe(201);
  jobId = made.body.id;
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

function staff(path: string, options?: object) {
  return staffRequest(server!.baseUrl, owner.cookie, path, options);
}

async function signIn(context: BrowserContext) {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
}

test('an old #workshop address opens the new diary', async ({ page, context }) => {
  await signIn(context);
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));
  await page.goto(`${server!.baseUrl}/#workshop`);
  await expect(page).toHaveURL(/\/workshop\/diary$/);
});

test("the old app's Workshop tab opens the new diary", async ({ page, context }) => {
  await signIn(context);
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));
  await page.goto(`${server!.baseUrl}/#till`);
  await page.locator('#nav button[data-nav="workshop"]').click();
  await expect(page).toHaveURL(/\/workshop\/diary$/);
});

async function openOrder(page: import('@playwright/test').Page, title: string) {
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));
  await page.goto(`${server!.baseUrl}/#till`);
  await page.locator('#view-orders-btn').click();
  await page.locator('#order-table-body tr', { hasText: title }).locator('button[data-open]').click();
}

test("an order's View / edit workshop job opens the job's page in the new diary", async ({ page, context }) => {
  await signIn(context);
  await openOrder(page, jobTitle);
  await page.locator('#doc-view-job-btn').click();
  await expect(page).toHaveURL(/\/workshop\/diary\?date=\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByRole('dialog', { name: new RegExp(jobTitle) })).toBeVisible();
});

test('ticking Show in workshop diary opens New job filled in from the order, and saving links it', async ({ page, context }) => {
  const customer = await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: 'maya@example.test' } });
  expect(customer.status, JSON.stringify(customer.body)).toBe(201);
  const title = `Wheel build ${owner.shop.id}`;
  const order = await staff('/api/sale-documents', {
    method: 'POST',
    body: { kind: 'order', title, customerId: customer.body.id, note: 'Rims ordered', items: [{ lineType: 'labour', name: 'Wheel build', unitPrice: 40, qty: 1, minutes: 60 }] },
  });
  expect(order.status, JSON.stringify(order.body)).toBe(201);
  await signIn(context);
  await openOrder(page, title);
  // Typed on the order but not saved: kept, as leaving the page would lose it.
  const typed = `${title}, front and rear`;
  await page.locator('#doc-title').fill(typed);
  await page.locator('#doc-workshop-toggle').check();
  await expect(page).toHaveURL(/\/workshop\/diary$/);
  const form = page.getByRole('dialog', { name: 'New job' });
  await expect(form.getByLabel('Job title')).toHaveValue(typed);
  await expect(form.getByText('Maya Patel')).toBeVisible();
  await expect(form.getByLabel('Staff notes')).toHaveValue('Rims ordered');
  await form.getByRole('button', { name: 'Save job' }).click();
  await expect(form).toBeHidden();
  const linked = (await staff(`/api/sale-documents/${order.body.id}`)).body;
  expect(linked.workshopJobId).toBeTruthy();
  expect((await staff(`/api/workshop-jobs/${linked.workshopJobId}`)).body.title).toBe(typed);
});

// The old app never takes payment for a workshop job (Jack, 21 Oct,
// docs/decisions/2026-10-21-old-app-placeholder.md): its till's "Load into
// sale" and an order's "Convert to sale" go to the new till for that job,
// where the sign-off is asked.
test("a workshop job's order: Load into sale opens the new till for the job", async ({ page, context }) => {
  await signIn(context);
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));
  await page.goto(`${server!.baseUrl}/#till`);
  await page.locator('#view-orders-btn').click();
  await page.locator('#order-table-body tr', { hasText: jobTitle }).locator('button[data-load]').click();
  await expect(page).toHaveURL(new RegExp(`/workshop/till\\?job=${jobId}$`));
});

test("a workshop job's order: Convert to sale opens the new till for the job", async ({ page, context }) => {
  const name = `Jo Taylor ${Date.now()}`;
  const cashier = await staff('/api/team', { method: 'POST', body: { name, isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' } });
  expect(cashier.status, JSON.stringify(cashier.body)).toBeLessThan(300);
  await signIn(context);
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));
  await page.goto(`${server!.baseUrl}/#till`);
  await page.locator('button[data-cashier]', { hasText: name }).click();
  await page.locator('#view-orders-btn').click();
  await page.locator('#order-table-body tr', { hasText: jobTitle }).locator('button[data-open]').click();
  await page.locator('#doc-convert-btn').click();
  await expect(page).toHaveURL(new RegExp(`/workshop/till\\?job=${jobId}$`));
});
