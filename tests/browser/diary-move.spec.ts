// The React staff diary (/workshop/diary), piece 3: dragging a job moves it.
// Spec: docs/superpowers/specs/2026-10-03-staff-diary-view-design.md (piece 3)
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jobId: number;
const MON = '2026-10-12';
const TUE = '2026-10-13';
const WED = '2026-10-14';

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });

function staff(path: string, options?: object) {
  return staffRequest(server!.baseUrl, owner.cookie, path, options);
}

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Move Cycles' });
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  const opened = await staff('/api/workshop-settings', {
    method: 'PUT',
    body: { openingHours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, open: '09:00', close: '18:00' })) },
  });
  expect(opened.status, JSON.stringify(opened.body)).toBe(200);
  const created = await staff('/api/workshop-jobs', {
    method: 'POST',
    body: { title: 'Brake service', jobDate: TUE, startTime: '10:00', endTime: '11:00', mechanicId: alex },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  jobId = created.body.id;
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('dragging a job down an hour and across a day moves it there', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
  const block = page.getByRole('button', { name: /^Bike, Brake service/ });
  await expect(block).toBeVisible();
  const box = (await block.boundingBox())!;
  const tue = (await page.getByRole('group', { name: 'Tuesday 13 October' }).boundingBox())!;
  const wed = (await page.getByRole('group', { name: 'Wednesday 14 October' }).boundingBox())!;
  // Grab the block and drop it one column right and two 30-minute rows down.
  await page.mouse.move(box.x + box.width / 2, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + (wed.x - tue.x), box.y + 8 + 58, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => {
    const now = (await staff(`/api/workshop-jobs/${jobId}`)).body;
    return `${now.jobDate} ${now.startTime}-${now.endTime}`;
  }).toBe(`${WED} 11:00-12:00`);
  await expect(page.getByRole('group', { name: 'Wednesday 14 October' }).getByRole('button', { name: /^Bike, Brake service/ })).toBeVisible();
  // A drag is not a click: the job page must not open.
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a click on a job opens its page, and Book in books it in', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
  await page.getByRole('button', { name: /^Bike, Brake service/ }).click();
  const job = page.getByRole('dialog', { name: /Brake service/ });
  await expect(job.getByText('Expected')).toBeVisible();
  await job.getByRole('button', { name: 'Book in' }).click();
  await expect(job.getByRole('button', { name: 'Start work' })).toBeVisible();
  expect((await staff(`/api/workshop-jobs/${jobId}`)).body.custodyState).toBe('in_shop');
});

test('notes typed on the job page are saved with Save notes', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
  await page.getByRole('button', { name: /^Bike, Brake service/ }).click();
  const job = page.getByRole('dialog', { name: /Brake service/ });
  await job.getByRole('textbox', { name: 'Notes' }).fill('Rear hub bearings are gritty.');
  await job.getByRole('button', { name: 'Save notes' }).click();
  await expect(job.getByText('Notes saved.')).toBeVisible();
  expect((await staff(`/api/workshop-jobs/${jobId}`)).body.notes).toBe('Rear hub bearings are gritty.');
});

test('Add item puts a product on the job', async ({ page, context }) => {
  const product = await staff('/api/products', { method: 'POST', body: { name: 'Brake pads (pair)', price: 18, sku: 'BP-01', stockQty: 5 } });
  expect(product.status, JSON.stringify(product.body)).toBe(201);
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
  await page.getByRole('button', { name: /^Bike, Brake service/ }).click();
  const job = page.getByRole('dialog', { name: /Brake service/ });
  await job.getByRole('button', { name: 'Add item' }).click();
  await job.getByLabel('Search products or services, or scan a barcode').fill('brake');
  await job.getByRole('button', { name: /Brake pads \(pair\)/ }).click();
  await expect(job.getByRole('table').getByText('Brake pads (pair)')).toBeVisible();
  const orderId = (await staff(`/api/workshop-jobs/${jobId}`)).body.orderId;
  const order = (await staff(`/api/sale-documents/${orderId}`)).body;
  expect(order.items.map((i: { name: string }) => i.name)).toEqual(['Brake pads (pair)']);
});
