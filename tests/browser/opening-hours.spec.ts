// Opening hours (Jack, 19 Oct, docs/decisions/2026-10-19-opening-hours.md), in
// a real browser against the real server: Settings › Shop and sites ›
// Opening hours saves each change at once.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000 });
const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
});
test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`closing a day and shortening another saves at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    // Start each run from Monday to Saturday, 09:00 to 17:00.
    const reset = await staff('/api/workshop-settings', { method: 'PUT', body: { openingHours: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, open: '09:00', close: '17:00' })) } });
    expect(reset.status, JSON.stringify(reset.body)).toBe(200);
    await page.goto(`${server!.baseUrl}/workshop/settings`);
    await page.getByLabel('Saturday closes').selectOption('16:00');
    await expect.poll(async () => (await staff('/api/workshop-settings')).body.openingHours.find((d: { weekday: number }) => d.weekday === 6)?.close).toBe('16:00');
    // As drawn on a phone and wider: Open/Closed sits on the day's line, at the end.
    const day = (await page.getByText('Friday', { exact: true }).boundingBox())!;
    const toggle = (await page.getByRole('button', { name: 'Friday open' }).boundingBox())!;
    expect(Math.abs(toggle.y + toggle.height / 2 - (day.y + day.height / 2))).toBeLessThan(12);
    expect(toggle.x).toBeGreaterThan(day.x + day.width);
    await page.getByRole('button', { name: 'Friday open' }).click();
    await expect(page.getByRole('button', { name: 'Friday open' })).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => (await staff('/api/workshop-settings')).body.openingHours.map((d: { weekday: number }) => d.weekday)).toEqual([1, 2, 3, 4, 6]);
    // Nothing runs off the side of the page.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
