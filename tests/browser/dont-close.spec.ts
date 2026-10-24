// Don't close things by themselves in a real browser against the real server
// (Jack, 24 Oct answer 9; approved drawings job-finished-wait and
// job-finished-sent; openspec/changes/dont-close-screens): Bike ready waits
// for Send now, still waits when the job is opened again, then goes.
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
  const customer = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  day = futureDate(2);
  let job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: day, startTime: '10:00', endTime: '11:00', mechanicId: alex, customerId: customer.id } })).body;
  for (const step of ['book-in', 'start']) job = (await staff(`/api/workshop-jobs/${job.id}/${step}`, { method: 'POST', body: { version: job.version } })).body;
  jobId = job.id;
  expect((await staff('/api/your-settings', { method: 'PUT', body: { accessibility: { noAutoClose: true } } })).status).toBe(200);
});
test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('Bike ready waits for Send now, still waits when the job is opened again, then goes', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${day}&job=${jobId}`);
  const job = page.getByRole('dialog', { name: /Standard service/ });
  await job.getByRole('button', { name: 'Mark ready for collection' }).click();
  const signOff = page.getByRole('dialog', { name: 'Who’s signing this off?' });
  await signOff.getByRole('radio', { name: 'Alex Morgan' }).click();
  await signOff.getByRole('button', { name: 'Sign off and mark ready' }).click();
  const waiting = job.getByText(/“Bike ready” to Maya by text is waiting until you press Send now\./);
  await expect(waiting).toBeVisible();
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/dont-close-waiting.png` });

  // Opened again, from scratch: the strip comes from the job's messages.
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${day}&job=${jobId}`);
  await expect(waiting).toBeVisible();
  await job.getByRole('button', { name: 'Send now' }).click();
  await expect(job.getByText(/“Bike ready” sent to Maya by text · \d\d:\d\d/)).toBeVisible();
  await expect(job.getByRole('button', { name: 'Send now' })).toHaveCount(0);
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/dont-close-sent.png` });
  const row = await runWithShop(owner.shop.id, () => prepare("SELECT send_after = 'infinity'::timestamptz AS held FROM customer_messages WHERE job_id = ? AND template_key = 'bike_ready'").get(jobId));
  expect(row.held).toBe(false);
});
