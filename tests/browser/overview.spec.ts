// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import type { BrowserContext } from '@playwright/test';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// The Workshop Overview in a real browser against the real server (Jack, 21 Oct,
// docs/decisions/2026-10-21-workshop-overview.md; #346): today's figures, the
// tabs, Book in for an arrival that's due, and a job opening in the diary.
// The browser-coverage rule (working agreement, #351) names it as the gap.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let due: { id: number; reference: string };
let later: { id: number; reference: string };
let inShop: { id: number; reference: string };
// The server's day is the test clock's, Tuesday 1 September 2026; the page's
// clock is 09:30 that morning, after the shop opens at 09:00.
const TODAY = '2026-09-01';
const NOW = new Date('2026-09-01T08:30:00Z');

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London', viewport: { width: 1440, height: 900 } });

function staff(path: string, options?: object) {
  return staffRequest(server!.baseUrl, owner.cookie, path, options);
}
async function job(title: string, customerName: string, startTime: string, mechanicId: number) {
  const customer = await staff('/api/customers', { method: 'POST', body: { name: customerName } });
  expect(customer.status, JSON.stringify(customer.body)).toBe(201);
  const [h, m] = startTime.split(':').map(Number);
  const endTime = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const made = await staff('/api/workshop-jobs', { method: 'POST', body: { title, jobDate: TODAY, startTime, endTime, mechanicId, customerId: customer.body.id } });
  expect(made.status, JSON.stringify(made.body)).toBe(201);
  return made.body;
}

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  // Due: its time has come. Later: this afternoon. In the shop: booked in already.
  due = await job('Standard service', 'Maya Patel', '09:00', alex);
  later = await job('Gear adjustment', 'Jamie Brooks', '14:00', alex);
  inShop = await job('Safety check', 'Aisha Khan', '10:00', alex);
  const booked = await staff(`/api/workshop-jobs/${inShop.id}/book-in`, { method: 'POST', body: { version: (inShop as { version?: number }).version } });
  expect(booked.status, JSON.stringify(booked.body)).toBe(200);
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

async function signIn(context: BrowserContext) {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
}

test('today’s figures, the tabs, and Book in moving an arrival into the workshop', async ({ page, context }) => {
  await signIn(context);
  await page.clock.setFixedTime(NOW);
  await page.goto(`${server!.baseUrl}/workshop/overview`);
  await expect(page.getByText('Tuesday 1 September · one shop, one view of the work')).toBeVisible();
  const expected = page.getByRole('region', { name: 'Expected today' });
  await expect(expected).toContainText('3 bikes');
  await expect(expected).toContainText('2 still to arrive');
  await expect(page.getByRole('region', { name: 'In the workshop' })).toContainText('1');
  await expect(page.getByRole('button', { name: 'Arrivals · 2' })).toHaveAttribute('aria-pressed', 'true');
  // The 09:00 arrival is due; the 14:00 one shows its time.
  await expect(page.getByRole('button', { name: `Book in ${later.reference}` })).toHaveCount(0);
  await expect(page.getByRole('row', { name: new RegExp(later.reference) })).toContainText('14:00 appointment');

  await page.getByRole('button', { name: `Book in ${due.reference}` }).click();
  await expect(page.getByRole('button', { name: 'Arrivals · 1' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'In the workshop' })).toContainText('2');
  expect((await staff(`/api/workshop-jobs/${due.id}`)).body.custodyState).toBe('in_shop');
});

test('a job’s number and name open its page in the diary', async ({ page, context }) => {
  await signIn(context);
  await page.clock.setFixedTime(NOW);
  await page.goto(`${server!.baseUrl}/workshop/overview`);
  await page.getByRole('link', { name: `${later.reference} · Jamie Brooks` }).click();
  await expect(page).toHaveURL(/\/workshop\/diary/);
  await expect(page.getByRole('dialog', { name: /Gear adjustment/ })).toBeVisible();
});
