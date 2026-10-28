// Paying a workshop job's order at the till (Jack, 18 Oct,
// docs/decisions/2026-10-18-till-job-payment.md), against the real server:
// the job page's Take payment opens the till with the job, card pays the
// order, the job is finished and the bike recorded as collected.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, seedMechanic, tillCookies } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jo: { cookie: string };
let jobId: number;
let orderId: number;
const TUE = '2026-10-13';

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });
const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Pay Cycles' });
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' } });
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  const service = (await staff('/api/workshop-services', { method: 'POST', body: { name: 'Fit & adjust brakes', price: 18, minutes: 30 } })).body;
  let job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Brake service', jobDate: TUE, startTime: '10:00', endTime: '11:00', mechanicId: alex } })).body;
  jobId = job.id;
  orderId = job.orderId;
  const items = await staff(`/api/sale-documents/${orderId}/items`, { method: 'PUT', body: { items: [{ lineType: 'labour', serviceId: service.id, name: 'Fit & adjust brakes', unitPrice: 18, minutes: 30 }] } });
  expect(items.status, JSON.stringify(items.body)).toBe(200);
  for (const step of ['book-in', 'start', 'finish']) {
    const r = await staff(`/api/workshop-jobs/${jobId}/${step}`, { method: 'POST', body: step === 'finish' ? { version: job.version, signedOffBy: alex } : { version: job.version } });
    expect(r.status, `${step}: ${JSON.stringify(r.body)}`).toBe(200);
    job = r.body;
  }
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('Take payment on the job page pays the order at the till and hands the bike over', async ({ page, context }) => {
  // Signed in, and checked in at the till with a PIN (pins-and-checkin).
  await context.addCookies(await tillCookies(server!.baseUrl, jo.cookie));
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${TUE}`);
  await page.getByRole('button', { name: /^Bike, Brake service/ }).click();
  await page.getByRole('dialog', { name: /Brake service/ }).getByRole('button', { name: 'Take payment' }).click();
  await expect(page).toHaveURL(new RegExp(`/workshop/till\\?job=${jobId}$`));
  const sale = page.getByRole('region', { name: 'Sale' });
  await expect(sale.getByText(/agreed on the job/)).toBeVisible();
  await expect(sale.getByRole('button', { name: 'Bike collected when paid' })).toHaveAttribute('aria-pressed', 'true');
  await sale.getByRole('button', { name: 'Take payment · £18.00' }).click();
  const pay = page.getByRole('dialog');
  await pay.getByRole('button', { name: /^Card · £18.00/ }).click();
  await pay.getByRole('button', { name: 'Card approved' }).click();
  await expect(pay.getByRole('heading', { name: 'Paid' })).toBeVisible();
  await expect.poll(async () => (await staff(`/api/sale-documents/${orderId}`)).body.status).toBe('converted');
  await expect.poll(async () => (await staff(`/api/workshop-jobs/${jobId}`)).body.custodyState).toBe('collected');
  await pay.getByRole('button', { name: 'No receipt' }).click();
  await expect(page).toHaveURL(/\/workshop\/till$/);
});
