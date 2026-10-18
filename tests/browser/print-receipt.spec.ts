// Printing a receipt (Jack, 18 Oct, docs/decisions/2026-10-18-print-receipt.md),
// against the real server in a real browser: Print on the Paid box after
// paying a job, and the diary menu's Print receipt once it's paid. The
// browser's print box is replaced to read what reaches the printer: the
// receipt, its barcode drawn, and nothing else on the page.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jo: { cookie: string };
let jobId: number;
const TUE = '2026-10-13';

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });
const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' } });
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  const service = (await staff('/api/workshop-services', { method: 'POST', body: { name: 'Fit & adjust brakes', price: 18, minutes: 30 } })).body;
  let job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Brake service', jobDate: TUE, startTime: '10:00', endTime: '11:00', mechanicId: alex } })).body;
  jobId = job.id;
  const items = await staff(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [{ lineType: 'labour', serviceId: service.id, name: 'Fit & adjust brakes', unitPrice: 18, minutes: 30 }] } });
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

type Printed = { text: string; bars: number };
declare global { interface Window { __printed: Printed[] } }

test('Print on Paid prints the job’s receipt; then the diary menu prints it again', async ({ page, context }) => {
  const [name, value] = jo.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.addInitScript(() => {
    window.__printed = [];
    window.print = () => {
      const host = document.getElementById('wh-print');
      window.__printed.push({ text: host?.innerText ?? '', bars: host?.querySelectorAll('svg rect').length ?? 0 });
    };
  });

  await page.goto(`${server!.baseUrl}/workshop/till?job=${jobId}`);
  const sale = page.getByRole('region', { name: 'Sale' });
  await sale.getByRole('button', { name: 'Take payment · £18.00' }).click();
  const pay = page.getByRole('dialog');
  await pay.getByRole('button', { name: /^Card · £18.00/ }).click();
  await pay.getByRole('button', { name: 'Card approved' }).click();
  await expect(pay.getByText(/^Card · £18\.00 · Sale \d+$/)).toBeVisible();
  // With print styles on and the Paid box still open, only #wh-print shows.
  await page.evaluate(() => {
    let host = document.getElementById('wh-print');
    if (!host) { host = document.createElement('div'); host.id = 'wh-print'; document.body.appendChild(host); }
    host.textContent = 'receipt';
  });
  await page.emulateMedia({ media: 'print' });
  await expect(pay).toBeHidden();
  const visible = await page.evaluate(() => [...document.body.children].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.id));
  expect(visible).toEqual(['wh-print']);
  await page.emulateMedia({ media: 'screen' });
  await expect(pay).toBeVisible();
  await pay.getByRole('button', { name: 'Print' }).click();
  await expect(page).toHaveURL(/\/workshop\/till$/);
  let printed = await page.evaluate(() => window.__printed);
  expect(printed).toHaveLength(1);
  for (const want of ['North Street Cycles', 'Fit & adjust brakes', '£18.00', 'Total', 'Paid by card']) expect(printed[0].text).toContain(want);
  expect(printed[0].text).toMatch(/Sale \d+/);
  expect(printed[0].text).not.toContain('VAT');
  expect(printed[0].bars).toBeGreaterThan(10);

  await page.goto(`${server!.baseUrl}/workshop/diary?date=${TUE}`);
  await page.getByRole('button', { name: /^Bike, Brake service/ }).click({ button: 'right' });
  await page.getByRole('menu', { name: 'Job actions' }).getByRole('menuitem', { name: 'Print receipt' }).click();
  await expect.poll(async () => (await page.evaluate(() => window.__printed)).length).toBe(1);
  printed = await page.evaluate(() => window.__printed);
  expect(printed[0].text).toContain('Fit & adjust brakes');
  expect(printed[0].text).toContain('Total');
});
