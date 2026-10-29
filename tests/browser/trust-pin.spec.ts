// Trust PIN on the workshop computer (openspec/changes/trust-pin-workshop;
// the lines on set-till-quick; till-checkin-workshop-names in signin.mjs), in
// a real browser against the real server: the Owner switches trust PIN on in
// Settings › Till › Signing in and chooses 5 minutes; the workshop computer
// then goes back to Enter your PIN after 5 minutes left alone.
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
  test(`trust PIN: Signing in, then 5 minutes on the workshop computer at ${viewport.width}px`, async ({ page, context }) => {
    await page.clock.install();
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    owners.push(owner);
    const call = (cookie: string, path: string, body?: unknown) => staffRequest(server!.baseUrl, cookie, path, { method: 'POST', body });
    const site = await call(owner.cookie, '/api/sites', { name: 'Bolton', code: 'B' });
    expect(site.status).toBe(201);
    const alex = await call(owner.cookie, '/api/team', { name: 'Alex Morgan', isMechanic: true, isCashier: false, email: `alex-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' });
    expect(alex.status).toBe(201);
    const alexCookie = await staffFreshCookie(alex.body.loginId);
    const pin: string = (await call(alexCookie, '/api/your-settings/till-pin/offer')).body.pin;
    expect((await call(alexCookie, '/api/your-settings/till-pin', { pin })).status).toBe(200);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    const noSideScroll = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // Settings › Front desk › Till › Signing in, on the Owner's own computer.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server!.baseUrl}/workshop/settings?room=front-desk`);
    const fold = page.getByRole('button', { name: /^Signing in/ });
    await expect(fold).toContainText('Trust PIN off');
    if ((await fold.getAttribute('aria-expanded')) !== 'true') await fold.click();
    await expect(page.getByRole('radiogroup', { name: 'Go back to the start when left alone' })).toHaveCount(0);
    await page.getByRole('switch', { name: 'Trust PIN' }).click();
    const times = page.getByRole('radiogroup', { name: 'Go back to the start when left alone' });
    await expect(times.getByRole('radio', { name: '10 minutes', exact: true })).toHaveAttribute('aria-checked', 'true');
    await times.getByRole('radio', { name: '5 minutes', exact: true }).click();
    await expect(fold).toContainText('Trust PIN on · back after 5 minutes');

    // This computer becomes the workshop computer; Alex types his PIN.
    await page.setViewportSize(viewport);
    expect((await page.request.post(`${server!.baseUrl}/api/till-setup/workshop`, { data: { siteId: site.body.id } })).status()).toBe(201);
    await page.goto(`${server!.baseUrl}/workshop`);
    await expect(page.getByRole('heading', { name: 'Enter your PIN' })).toBeVisible();
    for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
    const working = page.getByRole('region', { name: 'Who’s working' });
    await expect(working).toContainText('Working: Alex Morgan');
    await noSideScroll();

    // Left alone for 5 minutes: back to Enter your PIN, and the server agrees.
    await page.clock.fastForward('04:00');
    await expect(working).toContainText('Working: Alex Morgan');
    await page.clock.fastForward('01:05');
    await expect(page.getByRole('heading', { name: 'Enter your PIN' })).toBeVisible();
    expect((await (await page.request.get(`${server!.baseUrl}/api/till-checkin`)).json()).serving).toBeNull();
  });
}
