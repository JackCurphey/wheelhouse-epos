// Larger text in a real browser against the real server (Jack, 24 Oct answer
// 8; openspec/changes/larger-text): text on the shared scale goes from 14 to
// 17, and a diary block keeps its place in the grid and its size, because
// nothing is zoomed (the page's heading above the grid grows with the text).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { futureDate } from '../helpers/workshopFixtures.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let day: string;

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });
const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  day = futureDate(2);
  const made = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Gear tune', jobDate: day, startTime: '10:00', endTime: '11:00', mechanicId: alex } });
  expect(made.status, JSON.stringify(made.body)).toBe(201);
});
test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('Larger text: 14 becomes 17, and the diary’s block keeps its place and size', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${day}`);
  const block = page.getByRole('button', { name: /Gear tune/ }).first();
  await expect(block).toBeVisible();
  // Its place down the day and its height, what dragging relies on; the hour
  // column grows a little with the text, so the days are a little narrower.
  const place = () => block.evaluate((el: HTMLElement) => ({ top: el.offsetTop, height: el.offsetHeight }));
  const before = await place();
  const size = () => page.evaluate(() => {
    const probe = document.createElement('span');
    probe.className = 'text-sm';
    document.body.append(probe);
    const px = getComputedStyle(probe).fontSize;
    probe.remove();
    return px;
  });
  expect(await size()).toBe('14px');

  expect((await staff('/api/your-settings', { method: 'PUT', body: { accessibility: { largerText: true } } })).status).toBe(200);
  await page.reload();
  await expect(block).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('wh-larger-text'))).toBe(true);
  expect(await size()).toBe('17px');
  expect(await place()).toEqual(before);
  // The hour labels aren't cut off: each fits its column.
  const clipped = await page.evaluate(() => [...document.querySelectorAll('[data-hour-label]')]
    .filter((el) => el.getBoundingClientRect().left < (el.parentElement as HTMLElement).getBoundingClientRect().left).length);
  expect(clipped).toBe(0);
});
