// The till's Email receipt button against the real server (Jack, 23 Oct,
// docs/decisions/2026-10-23-overnight-questions.md item 3; drawn as
// till-receipt's Email and cp-receipt-address; openspec/changes/till-email-receipt):
// a job's customer's address filled in, the countdown waiting, and the
// receipt queued to the address sent.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { runWithShop, prepare } from '../../server/db.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, seedMechanic, tillCookies } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jo: { cookie: string };
let jobId: number;

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });
const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' } });
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  const maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142', email: 'maya@example.test' } })).body;
  let job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-13', startTime: '10:00', endTime: '11:00', mechanicId: alex, customerId: maya.id } })).body;
  jobId = job.id;
  const items = await staff(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [{ lineType: 'labour', name: 'Standard service', unitPrice: 65 }] } });
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

test('Email on Paid: Maya’s address filled in, the countdown waits, and the receipt is queued to it', async ({ page, context }) => {
  // Signed in, and checked in at the till with a PIN (pins-and-checkin).
  await context.addCookies(await tillCookies(server!.baseUrl, jo.cookie));
  await page.goto(`${server!.baseUrl}/workshop/till?job=${jobId}`);
  const sale = page.getByRole('region', { name: 'Sale' });
  await sale.getByRole('button', { name: 'Take payment · £65.00' }).click();
  const pay = page.getByRole('dialog').first();
  await pay.getByRole('button', { name: /^Card · £65.00/ }).click();
  await pay.getByRole('button', { name: 'Card approved' }).click();
  await expect(pay.getByRole('heading', { name: 'Paid' })).toBeVisible();
  await pay.getByRole('button', { name: 'Email' }).click();
  const email = page.getByRole('dialog', { name: 'Email the receipt' });
  await expect(email.getByLabel('Email address')).toHaveValue('maya@example.test');
  await expect(email.getByLabel('Email address')).toBeFocused();
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/till-email-receipt.png` });
  // Longer than the five seconds: still Paid.
  await page.waitForTimeout(6_000);
  await expect(page).toHaveURL(new RegExp(`/workshop/till\\?job=${jobId}$`));
  await email.getByLabel('Email address').press('Enter');
  await expect(page).toHaveURL(/\/workshop\/till$/);
  const queued = await runWithShop(owner.shop.id, () => prepare("SELECT to_address FROM customer_messages WHERE sale_id IS NOT NULL ORDER BY id DESC LIMIT 1").get());
  expect(queued?.to_address).toBe('maya@example.test');
});
