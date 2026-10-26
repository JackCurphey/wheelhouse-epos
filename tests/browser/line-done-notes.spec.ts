// A Done tick and a staff note on a job's line, in a real browser against the
// real server (Jack, 24 Oct, docs/decisions/2026-10-24-line-notes.md;
// openspec/changes/line-done-notes): tick, note, and both still there when
// the job is opened again.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { runWithShop, prepare } from '../../server/db.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { futureDate } from '../helpers/workshopFixtures.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jobId: number;
let day: string;

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });
const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  const pads = await runWithShop(owner.shop.id, async () => (await prepare(
    "INSERT INTO products (name, sku, price, stock_qty) VALUES ('Shimano brake pads', 'B05S-RX', 28, 5) RETURNING id"
  ).get()).id);
  const customer = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  day = futureDate(2);
  let job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: day, startTime: '10:00', endTime: '11:00', mechanicId: alex, customerId: customer.id } })).body;
  for (const step of ['book-in', 'start']) job = (await staff(`/api/workshop-jobs/${job.id}/${step}`, { method: 'POST', body: { version: job.version } })).body;
  const put = await staff(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [
    { lineType: 'labour', name: 'Standard service', unitPrice: 65 }, { productId: pads, qty: 1, unitPrice: 28 },
  ] } });
  expect(put.status, JSON.stringify(put.body)).toBe(200);
  jobId = job.id;
});
test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('tick a line done and give it a note; both are there when the job is opened again', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  const openJob = () => page.goto(`${server!.baseUrl}/workshop/diary?date=${day}&job=${jobId}`);
  await openJob();
  const job = page.getByRole('dialog', { name: /Standard service/ });
  await job.getByRole('checkbox', { name: 'Shimano brake pads done' }).check();
  await job.getByRole('button', { name: 'Add a note for Shimano brake pads' }).click();
  await job.getByRole('textbox', { name: 'Note for Shimano brake pads' }).fill('Rear pads worn — replacing');
  await job.getByRole('textbox', { name: 'Note for Shimano brake pads' }).blur();
  await expect(job.getByText('Rear pads worn — replacing')).toBeVisible();
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/line-done-notes.png` });

  await openJob();
  await expect(job.getByRole('checkbox', { name: 'Shimano brake pads done' })).toBeChecked();
  await expect(job.getByText('Rear pads worn — replacing')).toBeVisible();
  await expect(job.getByRole('checkbox', { name: 'Standard service done' })).not.toBeChecked();
});
