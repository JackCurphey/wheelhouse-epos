// The Working pills (openspec/changes/working-pills; drawn as
// workshop-working-pills in signin.mjs), in a real browser against the real
// server: with trust PIN on, after Alex Morgan and Jo Taylor have typed their
// PINs on the workshop computer, the strip sits at the bottom of the diary;
// Alex taps his pill and is working on the same page; "Someone else" shows
// the PIN pad.
import { randomUUID } from 'node:crypto';
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
const owners: { cookie: string; shop: { id: number } }[] = [];

test.describe.configure({ timeout: 90_000 });
test.beforeAll(async () => {
  server = await startLiveServer();
});
test.afterAll(async () => {
  try {
    for (const o of owners) await deleteTestShop(o.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`the Working pills at the bottom of the diary at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    owners.push(owner);
    const call = (cookie: string, path: string, body?: unknown, method = 'POST') => staffRequest(server!.baseUrl, cookie, path, { method, body });
    const site = await call(owner.cookie, '/api/sites', { name: 'Bolton', code: 'B' });
    expect(site.status).toBe(201);
    expect((await call(owner.cookie, '/api/signing-in-settings', { trustPin: true }, 'PUT')).status).toBe(200);
    const pinFor = async (name: string, mechanic: boolean) => {
      const made = await call(owner.cookie, '/api/team', { name, isMechanic: mechanic, isCashier: !mechanic, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' });
      expect(made.status).toBe(201);
      const cookie = await staffFreshCookie(made.body.loginId);
      const pin: string = (await call(cookie, '/api/your-settings/till-pin/offer')).body.pin;
      expect((await call(cookie, '/api/your-settings/till-pin', { pin })).status).toBe(200);
      return pin;
    };
    const alexPin = await pinFor('Alex Morgan', true);
    const joPin = await pinFor('Jo Taylor', false);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    expect((await page.request.post(`${server!.baseUrl}/api/till-setup/workshop`, { data: { siteId: site.body.id } })).status()).toBe(201);
    const typePin = async (pin: string) => { for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click(); };

    // Alex types his PIN, then Jo hers ("Someone else"), on the diary.
    await page.goto(`${server!.baseUrl}/workshop/diary`);
    await typePin(alexPin);
    const strip = page.getByRole('group', { name: 'Who’s working' });
    await expect(strip.getByRole('button', { name: 'Alex Morgan' })).toHaveAttribute('aria-pressed', 'true');
    await strip.getByRole('button', { name: 'Someone else' }).click();
    await expect(page.getByRole('heading', { name: 'Enter your PIN' })).toBeVisible();
    await typePin(joPin);
    await expect(strip.getByRole('button', { name: 'Jo Taylor' })).toHaveAttribute('aria-pressed', 'true');

    // The strip: at the bottom of the screen, "Working:", no Switch at the top, no sideways scroll.
    await expect(strip).toContainText('Working:');
    await expect(page.getByRole('button', { name: 'Switch' })).toHaveCount(0);
    const box = await strip.boundingBox();
    expect(Math.round(box!.y + box!.height)).toBeGreaterThanOrEqual(viewport.height - 2);
    // On a page longer than the screen it stays at the bottom as the page scrolls.
    expect(await strip.evaluate((el) => getComputedStyle(el.parentElement!).position)).toBe('sticky');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // Alex taps his pill: Alex is working, still on the diary.
    await strip.getByRole('button', { name: 'Alex Morgan' }).click();
    await expect(strip.getByRole('button', { name: 'Alex Morgan' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/\/workshop\/diary$/);
    expect((await (await page.request.get(`${server!.baseUrl}/api/till-checkin`)).json()).serving.name).toBe('Alex Morgan');
  });
}
