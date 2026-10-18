// Shop details (Jack, 18 Oct, docs/decisions/2026-10-18-shop-details.md), in a
// real browser against the real server: the owner fills in Settings › Shop
// details, each box saving as it's left, and a paid job's printed receipt then
// carries the address, phone and VAT number at the bottom, above the barcode.
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
  const paid = await staff(`/api/sale-documents/${job.orderId}/convert`, { method: 'POST', body: { cardAmount: 65, cashierId: made.body.employeeId } });
  expect(paid.status, JSON.stringify(paid.body)).toBe(201);
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

type Printed = { text: string; barcodeLast: boolean };
declare global { interface Window { __printed: Printed[] } }

test('Shop details saves as you go, and the receipt carries them above the barcode', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.addInitScript(() => {
    window.__printed = [];
    window.print = () => {
      const paper = document.querySelector('#wh-print article');
      window.__printed.push({ text: (paper as HTMLElement | null)?.innerText ?? '', barcodeLast: Boolean(paper?.lastElementChild?.lastElementChild?.querySelector('svg rect')) });
    };
  });
  await page.goto(`${server!.baseUrl}/workshop/settings`);
  for (const [label, text] of [['Address', '[Shop address]'], ['Phone', '[shop phone]'], ['VAT number', '[VAT number]']]) {
    await page.getByLabel(label, { exact: true }).fill(text);
    await page.getByLabel(label, { exact: true }).blur();
    await expect(page.getByText('Saved.')).toBeVisible();
  }
  await expect.poll(async () => (await staff('/api/shop-details')).body.vatNumber).toBe('[VAT number]');

  await page.goto(`${server!.baseUrl}/workshop/diary?date=${TUE}`);
  await page.getByRole('button', { name: /Standard service/ }).first().click({ button: 'right' });
  await page.getByRole('menu', { name: 'Job actions' }).getByRole('menuitem', { name: 'Print receipt' }).click();
  await expect.poll(async () => (await page.evaluate(() => window.__printed)).length).toBe(1);
  const [printed] = await page.evaluate(() => window.__printed);
  expect(printed.text).toMatch(/Paid by card\s*£65\.00\s*\[Shop address\]\s*\[shop phone\]\s*VAT number \[VAT number\]\s*$/);
  expect(printed.barcodeLast).toBe(true);
});
