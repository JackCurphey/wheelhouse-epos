// Set up this till (openspec/changes/till-setup; drawn as till-setup in
// signin.mjs and set-till-tills-owner in setup.mjs), in a real browser
// against the real server: from Settings › Till › Tills the Owner makes this
// computer Till B1, the till then says which till it is, and Settings no
// longer offers the button on it.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
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
  test(`make this ${device} Till B1 from Settings at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    owners.push(owner);
    expect((await staffRequest(server!.baseUrl, owner.cookie, '/api/sites', { method: 'POST', body: { name: 'Bolton', code: 'B' } })).status).toBe(201);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    const noSideScroll = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // Settings › Front desk › Till › Tills.
    await page.goto(`${server!.baseUrl}/workshop/settings?room=front-desk`);
    const fold = page.getByRole('button', { name: /^Tills/ });
    await expect(fold).toContainText('None yet');
    if ((await fold.getAttribute('aria-expanded')) !== 'true') await fold.click();
    await page.getByRole('link', { name: 'Make this computer a till' }).click();

    // Set up this till: Bolton and B1 chosen, a name typed.
    await expect(page.getByRole('heading', { name: 'Set up this till' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Bolton' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'B1' })).toHaveAttribute('aria-checked', 'true');
    await noSideScroll();
    await page.getByLabel('Name (optional)').fill('Front counter');
    await page.getByRole('button', { name: `Make this ${device} Till B1` }).click();

    // The till: which till it is, and Enter your PIN.
    await expect(page.getByRole('heading', { name: 'Enter your PIN' })).toBeVisible();
    await expect(page.getByText('Till B1', { exact: true })).toBeVisible();
    await expect(page.getByText('Bolton · North Street Cycles')).toBeVisible();
    await noSideScroll();
    // Still Till B1 after a reload: the browser keeps it.
    await page.reload();
    await expect(page.getByText('Till B1', { exact: true })).toBeVisible();

    // Settings: Tills reads Till B1, and the button is gone on this computer.
    await page.goto(`${server!.baseUrl}/workshop/settings?room=front-desk`);
    await expect(fold).toContainText('Till B1');
    if ((await fold.getAttribute('aria-expanded')) !== 'true') await fold.click();
    await expect(page.getByText('Do this on the computer that will be the till.', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Make this computer a till' })).toHaveCount(0);
  });
}
