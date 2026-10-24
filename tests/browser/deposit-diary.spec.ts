// The diary job's deposit in a real browser against the real server (approved
// drawings bk-staff-no-show… and bk-staff-deposit-refund;
// openspec/changes/deposit-diary-screen): Didn't come and Undo, then the
// deposit refunded by hand with a reason.
import '../../server/load-env.js';
import { randomBytes } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { runWithShop, prepare } from '../../server/db.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { futureDate } from '../helpers/workshopFixtures.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jobId: number;

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });
const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);
const portal = (path: string, body: object) => fetch(`${server!.baseUrl}/api/portal/${owner.shop.slug}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json() }));

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  const service = await runWithShop(owner.shop.id, async () => (await prepare("INSERT INTO workshop_services (name, price, minutes, bookable_online, active, updated_at) VALUES ('Standard service', 65, 60, 1, 1, now()) RETURNING id").get()).id);
  expect((await staff('/api/workshop-settings', { method: 'PUT', body: { bookingMode: 'timed', depositOn: true, depositPercent: 20 } })).status).toBe(200);
  const requestKey = randomBytes(32).toString('base64url');
  const hold = await portal('/deposit-holds', { serviceIds: [service], requestKey });
  await portal(`/pretend-payments/${hold.body.ref}/card`, { cardNumber: '4242424242424242' });
  const booked = await portal('/bookings', {
    mechanicId: alex, jobDate: futureDate(2), startTime: '11:30', serviceIds: [service], requestKey, paymentId: hold.body.paymentId,
    guestName: 'Maya Patel', guestPhone: '07700 900142', email: 'maya@example.test', updateChannel: 'email', termsAccepted: true,
  });
  expect(booked.status, JSON.stringify(booked.body)).toBe(201);
  jobId = booked.body.id;
  const version = (await staff(`/api/workshop-jobs/${jobId}`)).body.version;
  expect((await staff(`/api/workshop-jobs/${jobId}/accept`, { method: 'POST', body: { version } })).status).toBe(200);
  // The day gone, with the bike never in.
  await runWithShop(owner.shop.id, () => prepare("UPDATE workshop_jobs SET job_date = '2025-09-17' WHERE id = ?").run(jobId));
});
test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('Didn’t come and Undo, then the deposit refunded by hand with a reason', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=2025-09-17&job=${jobId}`);
  const job = page.getByRole('dialog', { name: /Standard service/ });
  await expect(job.getByRole('group', { name: 'Deposit' })).toContainText('Not come in');
  await job.getByRole('button', { name: 'Didn’t come' }).click();
  await expect(job.getByText('Marked Didn’t come · the deposit is kept')).toBeVisible();
  await expect(job.getByRole('group', { name: 'Deposit' })).toContainText('Deposit kept');
  await job.getByRole('button', { name: 'Undo' }).click();
  await expect(job.getByRole('button', { name: 'Didn’t come' })).toBeVisible();
  await job.getByRole('button', { name: 'Refund the deposit' }).click();
  const refund = page.getByRole('dialog', { name: 'Refund the deposit' });
  await refund.getByLabel('Reason (needed)').fill('Bike wasn’t ready in time');
  await refund.getByRole('button', { name: 'Refund £13.00' }).click();
  await expect(job.getByRole('group', { name: 'Deposit' })).toContainText('Deposit refunded');
  await expect(job.getByRole('group', { name: 'Deposit' })).toContainText('Bike wasn’t ready in time');
  const pay = await runWithShop(owner.shop.id, () => prepare('SELECT status FROM online_payments WHERE job_id = ?').get(jobId));
  expect(pay.status).toBe('refunded');
});
