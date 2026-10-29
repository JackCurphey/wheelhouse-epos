// The Tills list, with Rename and Remove (openspec/changes/tills-list; drawn
// as set-till-tills-owner and set-till-remove in setup.mjs), in a real
// browser against the real server: the Owner sees Till B1 and a workshop
// computer with who registered them, renames the till, and removes it after
// being asked.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
const owners: { cookie: string; shop: { id: number }; loginId: number }[] = [];

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
  test(`rename and remove a till from Settings at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    owners.push(owner);
    const api = (path: string, body: unknown) => staffRequest(server!.baseUrl, owner.cookie, path, { method: 'POST', body });
    const site = await api('/api/sites', { name: 'Bolton', code: 'B' });
    expect(site.status).toBe(201);
    // Another computer becomes Till B1, and another a workshop computer.
    expect((await api('/api/till-setup', { siteId: site.body.id, number: 1 })).status).toBe(201);
    // Each from its own sign-in: a sign-in used on a workshop computer stays
    // that computer's (workshop-lock-server).
    const elsewhere = await staffFreshCookie(owner.loginId);
    expect((await staffRequest(server!.baseUrl, elsewhere, '/api/till-setup/workshop', { method: 'POST', body: { siteId: site.body.id } })).status).toBe(201);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    const noSideScroll = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.goto(`${server!.baseUrl}/workshop/settings?room=front-desk`);
    const fold = page.getByRole('button', { name: /^Tills/ });
    await expect(fold).toContainText('Till B1');
    if ((await fold.getAttribute('aria-expanded')) !== 'true') await fold.click();
    const rows = page.getByRole('listitem');
    await expect(rows.nth(0)).toContainText('Till B1');
    await expect(rows.nth(0)).toContainText(/Bolton · registered \w{3} \d{1,2} \w{3} by Jack Lewis/);
    await expect(rows.nth(1)).toContainText('Workshop computer');
    await noSideScroll();

    // Rename.
    await page.getByRole('button', { name: 'Rename Till B1' }).click();
    await page.getByLabel('Name (optional)').fill('Front counter');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Till B1 · Front counter')).toBeVisible();

    // Remove asks first; Keep the till changes nothing.
    await page.getByRole('button', { name: 'Remove Till B1' }).click();
    const box = page.getByRole('dialog');
    await expect(box.getByRole('heading', { name: 'Remove Till B1?' })).toBeVisible();
    await expect(box.getByText('This computer stops working as a till. Sales already taken stay in the reports.')).toBeVisible();
    await noSideScroll();
    await box.getByRole('button', { name: 'Keep the till' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Till B1 · Front counter')).toBeVisible();
    await page.getByRole('button', { name: 'Remove Till B1' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove the till' }).click();
    await expect(page.getByRole('button', { name: 'Remove Till B1' })).toHaveCount(0);
    await expect(fold).toContainText('None yet');
    await expect(page.getByRole('button', { name: 'Remove Workshop computer' })).toBeVisible();
  });
}
