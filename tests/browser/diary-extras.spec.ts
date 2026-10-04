// The React staff diary, piece 5b, in a real browser against the real server:
// two jobs at the same time are a stack that fans out on hover, a fanned job
// opens with a click and moves with a drag, and resting on a job shows its
// summary. (The menu and the chooser are covered in
// tests/screens/diary-extras.test.js.)
// Spec: docs/superpowers/specs/2026-10-03-staff-diary-view-design.md (piece 5b)
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let alexJob: number;
const MON = '2026-10-19';
const TUE = '2026-10-20';

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });
const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Stack Cycles' });
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  const jo = await seedMechanic(owner.shop.id, { name: 'Jo Taylor' });
  await staff('/api/workshop-settings', {
    method: 'PUT',
    body: { openingHours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, open: '09:00', close: '18:00' })) },
  });
  const a = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Brake service', jobDate: TUE, startTime: '10:00', endTime: '11:00', mechanicId: alex, notes: 'Front brake rubs' } });
  expect(a.status, JSON.stringify(a.body)).toBe(201);
  alexJob = a.body.id;
  const b = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Puncture repair', jobDate: TUE, startTime: '10:00', endTime: '10:30', mechanicId: jo } });
  expect(b.status, JSON.stringify(b.body)).toBe(201);
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('a stack fans out on hover; a fanned job opens, shows its summary, and drags to move', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
  const stack = page.getByRole('button', { name: /^2 jobs booked 10:00 to 11:00/ });
  await expect(stack).toBeVisible();

  // A quick click opens the chooser, not a job that hasn't fanned out yet.
  await stack.click();
  const chooser = page.getByRole('dialog', { name: '2 jobs at 10:00' });
  await expect(chooser).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(chooser).toBeHidden();
  await page.mouse.move(0, 0);

  // The fan is hidden until the mouse rests on the stack.
  const fan = page.locator('[data-fan]');
  const tile = fan.locator('button', { hasText: 'Brake service' });
  await expect(fan).toHaveCSS('opacity', '0');
  await stack.hover();
  await expect(fan).toHaveCSS('opacity', '1');

  // Resting on a fanned job shows its summary.
  await tile.hover();
  const summary = page.locator('[data-hover-summary]');
  await expect(summary).toContainText('Brake service');
  await expect(summary).toContainText('Front brake rubs');

  // A click opens it.
  await tile.click();
  const jobPage = page.getByRole('dialog', { name: /Brake service/ });
  await expect(jobPage).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(jobPage).toBeHidden();

  // Dragging it down an hour moves it out of the stack.
  await page.mouse.move(0, 0);
  await stack.hover();
  await expect(fan).toHaveCSS('opacity', '1');
  const box = (await tile.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 8 + 58, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await staff(`/api/workshop-jobs/${alexJob}`)).body.startTime).toBe('11:00');
  await expect(page.getByRole('button', { name: /^2 jobs booked/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Bike, Brake service/ })).toBeVisible();
});

// Fresh review of #112, finding 3: a fanned tile hangs over the next day, so
// a small nudge on its outer half must not move the job there.
test('nudging a fanned job a little keeps it on its own day', async ({ page, context }) => {
  const WED = '2026-10-21';
  const alex = await seedMechanic(owner.shop.id, { name: 'Sam Price' });
  const jo = await seedMechanic(owner.shop.id, { name: 'Kit Lane' });
  const a = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Gear tune', jobDate: WED, startTime: '14:00', endTime: '15:00', mechanicId: alex } });
  const b = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Chain swap', jobDate: WED, startTime: '14:00', endTime: '14:30', mechanicId: jo } });
  expect(a.status, JSON.stringify(a.body)).toBe(201);
  expect(b.status, JSON.stringify(b.body)).toBe(201);
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
  const stack = page.getByRole('button', { name: /^2 jobs booked 14:00 to 15:00/ });
  await stack.hover();
  const fan = page.locator('[data-fan]').filter({ hasText: 'Gear tune' });
  await expect(fan).toHaveCSS('opacity', '1');
  // The tile furthest from the stack's middle, grabbed near its outer edge.
  const day = (await page.locator(`[data-diary-col]`).nth(2).boundingBox())!;
  const tiles = fan.locator('button');
  const boxes = [(await tiles.nth(0).boundingBox())!, (await tiles.nth(1).boundingBox())!];
  const outer = boxes[0].x < day.x || boxes[0].x + boxes[0].width > day.x + day.width ? boxes[0] : boxes[1];
  const x = outer.x < day.x ? outer.x + 4 : outer.x + outer.width - 4;
  expect(x < day.x || x > day.x + day.width, 'the grab point hangs over the next day').toBe(true);
  await page.mouse.move(x, outer.y + 8);
  await page.mouse.down();
  // Down half an hour, so the move is saved either way; then check the day.
  const saved = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/workshop-jobs\/\d+$/.test(r.url()));
  await page.mouse.move(x, outer.y + 8 + 30, { steps: 4 });
  await page.mouse.up();
  const put = await saved;
  expect(put.request().postDataJSON().jobDate).toBe(WED);
});

// Fresh review of the follow-up: an ordinary job grabbed off-centre and dropped
// near the far edge of the next day lands on that day, where the pointer is.
test('a job grabbed near its edge lands on the day under the pointer', async ({ page, context }) => {
  const THU = '2026-10-22';
  const FRI = '2026-10-23';
  const mech = await seedMechanic(owner.shop.id, { name: 'Rae Moss' });
  const j = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Bottom bracket', jobDate: THU, startTime: '16:00', endTime: '17:00', mechanicId: mech } });
  expect(j.status, JSON.stringify(j.body)).toBe(201);
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
  const block = page.getByRole('button', { name: /^Bike, Bottom bracket/ });
  const b = (await block.boundingBox())!;
  const fri = (await page.locator('[data-diary-col="4"]').boundingBox())!;
  await page.mouse.move(b.x + 4, b.y + 8);
  await page.mouse.down();
  const saved = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/workshop-jobs\/\d+$/.test(r.url()));
  await page.mouse.move(fri.x + fri.width - 4, b.y + 8, { steps: 8 });
  await page.mouse.up();
  expect((await saved).request().postDataJSON().jobDate).toBe(FRI);
});
