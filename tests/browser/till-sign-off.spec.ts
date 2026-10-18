// The mechanic sign-off, piece 2 (Jack, 16 Oct, answer 5,
// docs/decisions/2026-10-16-mechanic-sign-off.md), against the real server:
// paying at the till for work still in progress asks who is signing it off,
// and the job records it.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jo: { cookie: string };
let jobId: number;
let alex: number;

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });
const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' } });
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  let job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-13', startTime: '10:00', endTime: '11:00', mechanicId: alex } })).body;
  jobId = job.id;
  const items = await staff(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [{ lineType: 'labour', name: 'Standard service', unitPrice: 65, minutes: 60 }] } });
  expect(items.status, JSON.stringify(items.body)).toBe(200);
  for (const step of ['book-in', 'start']) {
    const r = await staff(`/api/workshop-jobs/${jobId}/${step}`, { method: 'POST', body: { version: job.version } });
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

test('paying for work in progress asks who is signing it off, and the job records it', async ({ page, context }) => {
  const [name, value] = jo.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/till?job=${jobId}`);
  await page.getByRole('region', { name: 'Sale' }).getByRole('button', { name: 'Take payment · £65.00' }).click();
  const pop = page.getByRole('dialog', { name: 'Who’s signing this off?' });
  await expect(pop.getByRole('radio', { name: 'Alex Morgan' })).toHaveAttribute('aria-checked', 'true');
  await pop.getByRole('button', { name: 'Sign off and mark ready' }).click();
  await expect(pop).toBeHidden();
  const pay = page.getByRole('dialog');
  await pay.getByRole('button', { name: /^Card · £65.00/ }).click();
  await pay.getByRole('button', { name: 'Card approved' }).click();
  await expect(pay.getByRole('heading', { name: 'Paid' })).toBeVisible();
  await expect.poll(async () => {
    const j = (await staff(`/api/workshop-jobs/${jobId}`)).body;
    return [j.workState, j.signedOffBy, j.signedOffByName];
  }).toEqual(['complete', alex, 'Alex Morgan']);
});
