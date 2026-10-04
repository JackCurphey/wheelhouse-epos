// The quote stage in the React staff app (journey 4), against the real server:
// add to the quote, send it, record the customer's answer taken by phone, and
// the approved part joins the job's work and parts. Texts aren't set up in
// this run, so the app says no text went and offers the link.
// Spec: docs/superpowers/specs/2026-10-03-quote-stage-design.md
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jobId: number;

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });
const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer({ env: { TWILIO_ACCOUNT_SID: '', TWILIO_AUTH_TOKEN: '', TWILIO_FROM_NUMBER: '' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'Quote Cycles' });
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  const c = await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } });
  const b = await staff(`/api/customers/${c.body.id}/bikes`, { method: 'POST', body: { make: 'Trek', model: 'Domane AL 3' } });
  await staff('/api/products', { method: 'POST', body: { name: 'Brake pads (pair)', price: 18, sku: 'BP-01' } });
  const job = await staff('/api/workshop-jobs', {
    method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-13', startTime: '10:00', endTime: '11:00', mechanicId: alex, customerId: c.body.id, bikeId: b.body.id },
  });
  jobId = job.body.id;
  await staff(`/api/workshop-jobs/${jobId}/book-in`, { method: 'POST', body: { version: job.body.version } });
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('staff quote, send and record a phone answer; the approved part joins the job', async ({ page, context }) => {
  await page.addInitScript(() => { (window as unknown as { WH_QUOTE_SEND_DELAY_MS: number }).WH_QUOTE_SEND_DELAY_MS = 200; });
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=2026-10-12`);
  await page.getByRole('button', { name: /^Trek Domane AL 3, Standard service/ }).click();
  const job = page.getByRole('dialog', { name: /Standard service/ });
  await job.getByRole('button', { name: 'Add to quote' }).click();
  await job.getByLabel('Search products or services, or scan a barcode').fill('brake');
  await job.getByRole('button', { name: /Brake pads \(pair\)/ }).click();
  await expect(job.getByText('Awaiting approval')).toBeVisible();
  await job.getByRole('button', { name: 'Send quote' }).click();
  await expect(job.getByText(/but no text went: Texts aren't set up/)).toBeVisible();
  await expect(job.getByText('Quoting')).toBeVisible();
  await job.getByRole('button', { name: 'Record their answer' }).click();
  const rec = page.getByRole('dialog', { name: "Record Maya Patel's answer" });
  await rec.getByRole('button', { name: 'Save: yes to 1 line, no thanks to 0' }).click();
  await expect(job.getByText('Approved total £18.00')).toBeVisible();
  const orderId = (await staff(`/api/workshop-jobs/${jobId}`)).body.orderId;
  expect((await staff(`/api/sale-documents/${orderId}`)).body.items.map((i: { name: string }) => i.name)).toEqual(['Brake pads (pair)']);
});

test('the customer approves on their link, with no sign-in, and the staff side sees it', async ({ page, context, browser }) => {
  // A second job, so this test stands alone.
  const c = (await staff('/api/customers', { method: 'POST', body: { name: 'Oliver Chen' } })).body;
  const job2 = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Full service', jobDate: '2026-10-14', startTime: '13:00', endTime: '14:00', customerId: c.id } })).body;
  const booked = await staff(`/api/workshop-jobs/${job2.id}/book-in`, { method: 'POST', body: { version: job2.version } });
  expect(booked.status).toBe(200);
  await page.addInitScript(() => { (window as unknown as { WH_QUOTE_SEND_DELAY_MS: number }).WH_QUOTE_SEND_DELAY_MS = 200; });
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=2026-10-12`);
  await page.getByRole('button', { name: /^Bike, Full service/ }).click();
  const job = page.getByRole('dialog', { name: /Full service/ });
  await job.getByRole('button', { name: 'Add to quote' }).click();
  await job.getByLabel('Search products or services, or scan a barcode').fill('brake');
  await job.getByRole('button', { name: /Brake pads \(pair\)/ }).click();
  await job.getByRole('button', { name: 'Send quote' }).click();
  const link = (await job.getByText(/\/book\/.*\/booking\//).textContent())!.trim();

  // The customer, in a browser with no staff sign-in.
  const customer = await browser.newContext();
  const theirs = await customer.newPage();
  await theirs.goto(link);
  await expect(theirs.getByText('Waiting for your answer')).toBeVisible();
  await theirs.getByRole('button', { name: 'Approve £18.00' }).click();
  await expect(theirs.getByText('Thanks — the work you agreed is going ahead.')).toBeVisible();
  await customer.close();

  const orderId = (await staff(`/api/workshop-jobs/${job2.id}`)).body.orderId;
  expect((await staff(`/api/sale-documents/${orderId}`)).body.items.map((i: { name: string }) => i.name)).toEqual(['Brake pads (pair)']);
  expect((await staff(`/api/workshop-jobs/${job2.id}`)).body.quote.state).toBe('approved');
});
