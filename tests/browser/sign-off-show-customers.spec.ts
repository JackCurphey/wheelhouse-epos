// The mechanic sign-off, piece 3 (Jack, 18 Oct, docs/decisions/2026-10-16-mechanic-sign-off.md),
// against the real server: Settings › Workshop › Mechanics switches "Show who
// signed off to customers" on, and a signed-off job's receipt then says who
// checked it. The browser's print box is replaced to read what's printed.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
const TUE = '2026-10-13';

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });
const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' } });
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  let job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: TUE, startTime: '10:00', endTime: '11:00', mechanicId: alex } })).body;
  const items = await staff(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [{ lineType: 'labour', name: 'Standard service', unitPrice: 65, minutes: 60 }] } });
  expect(items.status, JSON.stringify(items.body)).toBe(200);
  for (const step of ['book-in', 'start', 'finish']) {
    const r = await staff(`/api/workshop-jobs/${job.id}/${step}`, { method: 'POST', body: step === 'finish' ? { version: job.version, signedOffBy: alex } : { version: job.version } });
    expect(r.status, `${step}: ${JSON.stringify(r.body)}`).toBe(200);
    job = r.body;
  }
  const cashier = made.body.employeeId;
  const paid = await staff(`/api/sale-documents/${job.orderId}/convert`, { method: 'POST', body: { cardAmount: 65, cashierId: cashier, signedOffBy: null } });
  expect(paid.status, JSON.stringify(paid.body)).toBe(201);
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

declare global { interface Window { __printed: string[] } }

test('switching the setting on puts Checked by on the receipt', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.addInitScript(() => {
    window.__printed = [];
    window.print = () => { window.__printed.push(document.getElementById('wh-print')?.innerText ?? ''); };
  });
  await page.goto(`${server!.baseUrl}/workshop/settings?room=workshop`);
  await page.getByRole('button', { name: /^Mechanics/ }).click();
  const sw = page.getByRole('switch', { name: 'Show who signed off to customers' });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => (await staff('/api/workshop-settings')).body.showSignOffToCustomers).toBe(true);

  await page.goto(`${server!.baseUrl}/workshop/diary?date=${TUE}`);
  await page.getByRole('button', { name: /Standard service/ }).first().click({ button: 'right' });
  await page.getByRole('menu', { name: 'Job actions' }).getByRole('menuitem', { name: 'Print receipt' }).click();
  await expect.poll(async () => (await page.evaluate(() => window.__printed)).length).toBe(1);
  expect((await page.evaluate(() => window.__printed))[0]).toContain('Checked by Alex Morgan');
});
