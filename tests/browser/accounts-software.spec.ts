// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { runWithShop, prepare } from '../../server/db.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Accounts software in a real browser, against the real server (openspec/changes/reports-accounts-and-reopen,
// accounts-software spec; rp-accounts-connect, rp-accounts-map, rp-accounts-missing, rp-accounts-disconnect): the Owner
// connects the pretend Xero from Settings › Your data, chooses an account for a line, sees what still needs one,
// and disconnects, keeping the choice, at a computer and a phone width.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
const shops: number[] = [];

test.describe.configure({ timeout: 90_000, mode: 'serial' });
test.beforeAll(async () => { server = await startLiveServer(); });
test.afterAll(async () => {
  try {
    for (const id of shops) await deleteTestShop(id);
  } finally {
    if (server) await server.stop();
  }
});

for (const [size, viewport] of [['computer', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`on a ${size}, the Owner connects the pretend Xero, chooses an account, and disconnects`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    shops.push(owner.shop.id);
    await runWithShop(owner.shop.id, () => prepare("INSERT INTO product_categories (name, path) VALUES ('Accessories', 'Accessories')").run());
    await context.clearCookies();
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);

    await page.goto(`${server!.baseUrl}/workshop/settings?room=office`);
    const fold = page.getByRole('button', { name: /^Accounts software/ });
    await expect(fold).toContainText('Not connected');
    await fold.click();
    const panel = page.locator('#set-fold-accounts');
    await expect(panel.getByRole('button', { name: 'Connect QuickBooks' })).toBeVisible();
    await panel.getByRole('button', { name: 'Connect Xero' }).click();
    await expect(panel.getByText('Connected to Xero', { exact: true })).toBeVisible();
    await expect(panel.getByText(/^by Jack Lewis on /)).toBeVisible();
    await expect(panel.getByText('This is a practice connection: nothing leaves Wheelhouse until a real Xero account is set up.')).toBeVisible();
    await expect(fold).toContainText('accounts to choose');
    await expect(panel.getByText('No Xero account chosen — days with Accessories sales can’t be sent')).toBeVisible();
    await expect(panel.getByRole('combobox', { name: /^Online sales \(paid on the website\)/ })).toBeVisible();

    const accessories = panel.getByRole('combobox', { name: /^Accessories/ });
    await accessories.selectOption({ label: '[Xero account 2]' });
    await expect(panel.getByText('No Xero account chosen — days with Accessories sales can’t be sent')).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.reload();
    await page.getByRole('button', { name: /^Accounts software/ }).click();
    await expect(panel.getByRole('combobox', { name: /^Accessories/ })).toHaveValue('xero-2');

    await panel.getByRole('button', { name: 'Disconnect Xero' }).click();
    const box = page.getByRole('dialog', { name: 'Disconnect Xero?' });
    await expect(box.getByText('Your account choices are kept in case you reconnect.')).toBeVisible();
    await box.getByRole('button', { name: 'Disconnect', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Connect Xero' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Accounts software/ })).toContainText('Not connected');
    await panel.getByRole('button', { name: 'Connect Xero' }).click();
    await expect(panel.getByRole('combobox', { name: /^Accessories/ })).toHaveValue('xero-2');
  });
}
