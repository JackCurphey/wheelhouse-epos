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

test('what was sent shows in the fold, in Takings and cash-ups and in Today, and a day that did not go says what to choose', async ({ page, context }) => {
  const clocked = await startLiveServer({ env: { WHEELHOUSE_TEST_CLOCK: '2026-09-17T11:00:00Z' } });
  try {
    const owner = await staffSignup(clocked.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    shops.push(owner.shop.id);
    await context.clearCookies();
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: clocked.baseUrl }]);
    await page.goto(`${clocked.baseUrl}/workshop/settings?room=office`);
    await page.getByRole('button', { name: /^Accounts software/ }).click();
    await page.locator('#set-fold-accounts').getByRole('button', { name: 'Connect Xero' }).click();
    await expect(page.locator('#set-fold-accounts').getByText('Connected to Xero', { exact: true })).toBeVisible();
    // Two closed days, as Close the day saved them: Tuesday sent, Wednesday not (Accessories has no account).
    await runWithShop(owner.shop.id, async () => {
      await prepare("INSERT INTO product_categories (name, path) VALUES ('Accessories', 'Accessories')").run();
      for (const [day, status, reason, line] of [['2026-09-15', 'sent', null, null], ['2026-09-16', 'failed', 'Accessories has no Xero account chosen', 'sales:Accessories']] as const) {
        const check = await prepare('INSERT INTO float_checks (day, login_id, expected_pence, counted_pence) VALUES (?, ?, 15000, 15000) RETURNING id').get(day, owner.loginId);
        const close = await prepare(
          `INSERT INTO day_closes (day, login_id, closed_at, float_check_id, float_start_pence, cash_pence, drawer_cash_pence, paid_outs_pence, expected_pence, counted_pence,
             float_pence, banked_pence, takings_pence, card_pence, other_pence, online_pence) VALUES (?, ?, ?, ?, 15000, 0, 0, 0, 15000, 15000, 15000, 0, 5000, 5000, 0, 0) RETURNING id`
        ).get(day, owner.loginId, `${day}T16:30:00Z`, check.id);
        await prepare('INSERT INTO accounts_sends (day, close_id, status, reason, failed_line, amount_pence, sent_at) VALUES (?, ?, ?, ?, ?, 5000, ?)')
          .run(day, close.id, status, reason, line, status === 'sent' ? `${day}T16:31:00Z` : null);
      }
    });
    await page.reload();
    await page.getByRole('button', { name: /^Accounts software/ }).click();
    const log = page.getByRole('list', { name: 'What was sent' });
    await expect(log.getByText(/^Sent at \d\d:\d\d · £50\.00$/)).toBeVisible();
    await expect(log.getByText(/Accessories has no Xero account chosen/)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Accounts software/ })).toContainText('1 day needs a look');

    await page.goto(`${clocked.baseUrl}/workshop/reports/takings?period=this-week`);
    const table = page.getByRole('table', { name: 'Closed days' });
    await expect(table.getByRole('columnheader', { name: 'Sent to Xero' })).toBeVisible();
    await expect(table.getByRole('row', { name: /^Wed 16 Sep £50\.00.*Not sent$/ })).toBeVisible();
    await expect(table.getByRole('row', { name: /^Tue 15 Sep £50\.00.*Sent$/ })).toBeVisible();

    await page.goto(`${clocked.baseUrl}/workshop/today`);
    await expect(page.getByText('Wednesday 16 September didn’t go to Xero')).toBeVisible();
    await page.getByRole('link', { name: 'Choose an account for Accessories' }).click();
    await expect(page.getByRole('combobox', { name: /^Accessories/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  } finally {
    await clocked.stop();
  }
});
