// The till's Serving pills (openspec/changes/serving-pills; drawn as
// till-serving-pills in till.mjs; stage-1 gaps 11), in a real browser against
// the real server: with trust PIN on, after Alex Morgan and Jo Taylor have
// typed their PINs on Till B1, the pills sit under the quick buttons; Alex
// taps his and is serving; "Someone else" goes to Enter your PIN, where Jo
// taps her name in Checked in today.
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
  test(`the Serving pills on Till B1 at ${viewport.width}px`, async ({ page, context }) => {
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
    expect((await page.request.post(`${server!.baseUrl}/api/till-setup`, { data: { siteId: site.body.id, number: 1 } })).status()).toBe(201);
    const typePin = async (pin: string) => { for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click(); };
    const strip = page.getByRole('group', { name: 'Who’s serving' });

    // Alex types his PIN, then "Someone else", and Jo types hers.
    await page.goto(`${server!.baseUrl}/workshop/till`);
    await typePin(alexPin);
    await expect(strip.getByRole('button', { name: 'Alex Morgan' })).toHaveAttribute('aria-pressed', 'true');
    await strip.getByRole('button', { name: 'Someone else' }).click();
    await expect(page.getByRole('heading', { name: 'Enter your PIN' })).toBeVisible();
    await typePin(joPin);
    await expect(strip.getByRole('button', { name: 'Jo Taylor' })).toHaveAttribute('aria-pressed', 'true');
    await expect(strip).toContainText('Serving:');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // Alex taps his pill: serving, on the till.
    await strip.getByRole('button', { name: 'Alex Morgan' }).click();
    await expect(strip.getByRole('button', { name: 'Alex Morgan' })).toHaveAttribute('aria-pressed', 'true');
    expect((await (await page.request.get(`${server!.baseUrl}/api/till-checkin`)).json()).serving.name).toBe('Alex Morgan');

    // "Someone else": Enter your PIN, where Jo taps her name in Checked in today.
    await strip.getByRole('button', { name: 'Someone else' }).click();
    await expect(page.getByRole('heading', { name: 'Enter your PIN' })).toBeVisible();
    await page.getByRole('button', { name: 'Jo Taylor' }).click();
    await expect(strip.getByRole('button', { name: 'Jo Taylor' })).toHaveAttribute('aria-pressed', 'true');
  });
}
