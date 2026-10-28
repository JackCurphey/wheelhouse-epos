// A deposit paid online comes off at the till, against the real server (Jack,
// 29 Sep, selling at the till decision 11; drawn as till-job-balance;
// openspec/changes/till-online-deposit): the till asks for the rest, the
// receipt prints the deposit as its own payment, and the job then offers no
// Refund the deposit (Jack, 24 Oct).
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
  const maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  let job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-13', startTime: '10:00', endTime: '11:00', mechanicId: alex, customerId: maya.id } })).body;
  jobId = job.id;
  expect((await staff(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [{ lineType: 'labour', name: 'Standard service', unitPrice: 65 }] } })).status).toBe(200);
  for (const step of ['book-in', 'start', 'finish']) {
    const r = await staff(`/api/workshop-jobs/${jobId}/${step}`, { method: 'POST', body: step === 'finish' ? { version: job.version, signedOffBy: alex } : { version: job.version } });
    expect(r.status, `${step}: ${JSON.stringify(r.body)}`).toBe(200);
    job = r.body;
  }
  // The deposit Maya paid online when she booked (the payments adapter's own record).
  await runWithShop(owner.shop.id, async () => {
    await prepare('UPDATE workshop_jobs SET deposit_pence = 1300 WHERE id = ?').run(jobId);
    await prepare("INSERT INTO online_payments (provider, provider_ref, amount_pence, status, request_key_hash, job_id) VALUES ('pretend', 'ref-1', 1300, 'taken', 'key-1', ?)").run(jobId);
  });
});
test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('the deposit comes off, the receipt shows it, and the job then offers no refund', async ({ page, context }) => {
  // Signed in, and checked in at the till with a PIN (pins-and-checkin).
  await context.addCookies(await tillCookies(server!.baseUrl, jo.cookie));
  let printed = '';
  await page.exposeFunction('whPrinted', (text: string) => { printed = text; });
  await page.addInitScript(() => { window.print = () => { (window as unknown as { whPrinted: (t: string) => void }).whPrinted(document.getElementById('wh-print')?.textContent ?? ''); }; });
  await page.goto(`${server!.baseUrl}/workshop/till?job=${jobId}`);
  const sale = page.getByRole('region', { name: 'Sale' });
  await expect(sale.getByText('Deposit paid', { exact: true })).toBeVisible();
  await expect(sale.getByText('−£13.00')).toBeVisible();
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/till-online-deposit.png` });
  await sale.getByRole('button', { name: 'Take payment · £52.00' }).click();
  const pay = page.getByRole('dialog').first();
  await pay.getByRole('button', { name: /^Card · £52.00/ }).click();
  await pay.getByRole('button', { name: 'Card approved' }).click();
  await expect(pay.getByRole('heading', { name: 'Paid' })).toBeVisible();
  await pay.getByRole('button', { name: 'Print' }).click();
  await expect.poll(() => printed).toContain('Deposit paid online');

  await page.goto(`${server!.baseUrl}/workshop/diary?date=2026-10-13&job=${jobId}`);
  const job = page.getByRole('dialog', { name: /Standard service/ });
  await expect(job.getByText(/Deposit paid/).first()).toBeVisible();
  await expect(job.getByRole('button', { name: 'Refund the deposit' })).toHaveCount(0);
});
