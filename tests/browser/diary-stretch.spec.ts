// The React staff diary: stretching a job by its bottom edge (Jack, 18 Oct,
// docs/decisions/2026-10-18-old-diary-features.md answer 2, and its tablet and
// phone section). With a mouse the edge is always there; on a touch screen
// the grip shows only after "Change length" in the job's menu.
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

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });

const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Stretch Cycles' });
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  await staff('/api/workshop-settings', {
    method: 'PUT',
    body: { openingHours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, open: '09:00', close: '18:00' })) },
  });
  const created = await staff('/api/workshop-jobs', {
    method: 'POST',
    body: { title: 'Brake service', jobDate: TUE, startTime: '10:00', endTime: '11:00', mechanicId: alex },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  jobId = created.body.id;
  const other = await staff('/api/workshop-jobs', {
    method: 'POST',
    body: { title: 'Gear tune', jobDate: MON, startTime: '14:00', endTime: '15:00', mechanicId: alex },
  });
  expect(other.status, JSON.stringify(other.body)).toBe(201);
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('dragging a job\'s bottom edge down an hour makes it an hour longer', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
  const block = page.getByRole('button', { name: /^Bike, Brake service/ });
  await expect(block).toBeVisible();
  const box = (await block.boundingBox())!;
  const saved = page.waitForRequest((r) => r.method() === 'PUT' && r.url().endsWith(`/api/workshop-jobs/${jobId}`));
  // The edge: the block's bottom 8px. Two 30-minute rows of 29px down.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 3 + 58, { steps: 8 });
  await expect(page.getByText('10:00–12:00 · 2 hours')).toBeVisible();
  await page.mouse.up();
  const body = (await saved).postDataJSON();
  expect(body).toMatchObject({ jobDate: TUE, startTime: '10:00', endTime: '12:00' });
  // It was a stretch, not an opened job.
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

// Fresh review: grabbed anywhere on the edge, the end follows the edge, not
// the pointer, and a press with only a tiny wobble changes nothing.
test('grabbed at the top of the edge, an hour\'s drag adds an hour; a wobble changes nothing', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
  const block = page.getByRole('button', { name: /^Bike, Gear tune/ });
  await expect(block).toBeVisible();
  const box = (await block.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height - 7; // the top of the 8px edge
  const puts: string[] = [];
  page.on('request', (r) => { if (r.method() === 'PUT') puts.push(r.postData() ?? ''); });
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 2);
  await page.mouse.up();
  await expect(page.locator('[data-stretch-grip]')).toHaveCount(0);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 58, { steps: 8 });
  await expect(page.getByText('14:00–16:00 · 2 hours')).toBeVisible();
  // Back where it started: nothing to save.
  await page.mouse.move(x, y, { steps: 8 });
  await page.mouse.up();
  expect(puts).toEqual([]);
});

test('on a tablet, the grip shows only after Change length, and is finger-sized', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1024, height: 768 } });
  try {
    const [name, value] = owner.cookie.split('=');
    await ctx.addCookies([{ name, value, url: server!.baseUrl }]);
    const page = await ctx.newPage();
    await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
    const block = page.getByRole('button', { name: /^Bike, Brake service/ });
    await expect(block).toBeVisible();
    await expect(page.locator('[data-stretch-edge]').first()).toBeHidden();
    await expect(page.locator('[data-stretch-grip]')).toHaveCount(0);
    await block.focus();
    await page.keyboard.press('ContextMenu');
    await page.getByRole('menuitem', { name: 'Change length' }).click();
    const grip = page.locator('[data-stretch-grip]');
    await expect(grip).toBeVisible();
    expect((await grip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  } finally {
    await ctx.close();
  }
});
