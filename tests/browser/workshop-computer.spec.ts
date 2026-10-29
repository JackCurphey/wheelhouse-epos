// The shared workshop computer (openspec/changes/workshop-computer; drawn as
// till-checkin-workshop in signin.mjs and the Working bar in diary.mjs), in a
// real browser against the real server: the Owner makes this computer a
// workshop computer; every page is then Enter your PIN with no till number;
// Alex Morgan's PIN opens the diary with "Working: Alex Morgan · Switch";
// Switch goes back; and 10 minutes left alone goes back too.
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

for (const [viewport, device] of [[{ width: 1440, height: 900 }, 'computer'], [{ width: 390, height: 844 }, 'device']] as const) {
  test(`a workshop ${device}: Enter your PIN, Working, Switch, and back after 10 minutes at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    await page.clock.install();
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    owners.push(owner);
    const call = (cookie: string, path: string, body?: unknown) => staffRequest(server!.baseUrl, cookie, path, { method: 'POST', body });
    expect((await call(owner.cookie, '/api/sites', { name: 'Bolton', code: 'B' })).status).toBe(201);
    // Alex Morgan, a mechanic, with his PIN.
    const alex = await call(owner.cookie, '/api/team', { name: 'Alex Morgan', isMechanic: true, isCashier: false, email: `alex-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' });
    expect(alex.status).toBe(201);
    const alexCookie = await staffFreshCookie(alex.body.loginId);
    const pin: string = (await call(alexCookie, '/api/your-settings/till-pin/offer')).body.pin;
    expect((await call(alexCookie, '/api/your-settings/till-pin', { pin })).status).toBe(200);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    const noSideScroll = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const typePin = async () => { for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click(); };

    // Set up this computer: a workshop computer at Bolton.
    await page.goto(`${server!.baseUrl}/workshop/till/setup`);
    await page.getByRole('radio', { name: 'A workshop computer' }).click();
    await expect(page.getByRole('heading', { name: 'Set up a workshop computer' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Till number' })).toHaveCount(0);
    await noSideScroll();
    await page.getByRole('button', { name: `Make this ${device} a workshop computer` }).click();

    // Enter your PIN, under the workshop bar, with no till words and no menu.
    await expect(page.getByRole('heading', { name: 'Enter your PIN' })).toBeVisible();
    const bar = page.getByRole('banner');
    await expect(bar.getByText('Workshop computer')).toBeVisible();
    await expect(bar).toContainText(viewport.width < 768 ? 'Nobody working' : 'Nobody working — enter your PIN');
    await expect(page.getByText(/Till B1|Checked in today|No PIN yet/)).toHaveCount(0);
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await noSideScroll();

    // Alex's PIN: the diary, as Alex.
    await typePin();
    await expect(page).toHaveURL(/\/workshop\/diary$/);
    const working = page.getByRole('region', { name: 'Who’s working' });
    await expect(working).toContainText('Working: Alex Morgan');
    await noSideScroll();
    // Still Alex after a reload; the PIN is nowhere on the page.
    await page.reload();
    await expect(working).toContainText('Working: Alex Morgan');
    expect(await page.content()).not.toContain(`>${pin}<`);

    // Switch: back to Enter your PIN.
    await working.getByRole('button', { name: 'Switch' }).click();
    await expect(page.getByRole('heading', { name: 'Enter your PIN' })).toBeVisible();

    // Alex again, then 10 minutes with nobody using it: back to Enter your PIN,
    // and the server agrees nobody is working.
    await typePin();
    await expect(working).toContainText('Working: Alex Morgan');
    await page.clock.fastForward('09:00');
    await expect(working).toContainText('Working: Alex Morgan');
    await page.clock.fastForward('01:05');
    await expect(page.getByRole('heading', { name: 'Enter your PIN' })).toBeVisible();
    const checkin = await page.request.get(`${server!.baseUrl}/api/till-checkin`);
    expect((await checkin.json()).serving).toBeNull();
  });
}
