// Till PINs and the PIN check-in (openspec/changes/pins-and-checkin; drawn
// as pin-first, till-checkin and till-pin-wrong in signin.mjs), in a real
// browser against the real server: the Owner gets a PIN Wheelhouse picked in
// Your settings, the till asks Enter your PIN, a wrong PIN says so, the right
// one checks him in, and Serving switches back.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup } from '../helpers/staff.js';
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
  test(`get a PIN, check in at the till with it, and switch at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    owners.push(owner);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);

    // Your settings: no PIN yet; Get your PIN shows four digits Wheelhouse picked.
    await page.goto(`${server!.baseUrl}/workshop/your-settings`);
    await expect(page.getByText('No PIN yet')).toBeVisible();
    await page.getByRole('button', { name: 'Get your PIN' }).click();
    const pop = page.getByRole('dialog', { name: 'Your till PIN' });
    await expect(pop).toContainText('Welcome to North Street Cycles');
    const digits = pop.getByLabel(/^New PIN \d \d \d \d$/);
    await expect(digits).toBeVisible();
    const pin = ((await digits.getAttribute('aria-label')) ?? '').replace('New PIN ', '').replaceAll(' ', '');
    expect(pin).toMatch(/^\d{4}$/);
    await pop.getByRole('button', { name: 'Keep this PIN' }).click();
    await expect(pop).toHaveCount(0);
    await expect(page.getByLabel('PIN is set')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // The till: Enter your PIN; a wrong one says so and clears the dots.
    await page.goto(`${server!.baseUrl}/workshop/till`);
    await expect(page.getByRole('heading', { name: 'Enter your PIN' })).toBeVisible();
    const wrong = pin === '0000' ? '1111' : '0000';
    for (const d of wrong) await page.getByRole('button', { name: d, exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('That PIN isn’t anyone’s — try again');
    await expect(page.getByRole('status', { name: '0 of 4 digits entered' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // The right one, typed on the keyboard: the till is his.
    for (const d of pin) await page.keyboard.press(d);
    const serving = page.getByRole('button', { name: 'Serving: Jack Lewis — switch who’s serving' });
    await expect(serving).toBeVisible();
    await expect(page.getByRole('region', { name: 'Sale' })).toBeVisible();
    // Still his after a reload: the check-in lasts the day.
    await page.reload();
    await expect(serving).toBeVisible();

    // Switch: back to Enter your PIN, and he's listed as checked in today.
    await serving.click();
    await expect(page.getByRole('heading', { name: 'Enter your PIN' })).toBeVisible();
    const today = page.getByText('Checked in today', { exact: true }).locator('..');
    await expect(today).toBeVisible();
    await expect(today).toContainText('Jack Lewis');
  });
}
