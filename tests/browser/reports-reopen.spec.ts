// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { runWithShop, prepare } from '../../server/db.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Reopening a closed day in a real browser, against the real server (openspec/changes/reports-accounts-and-reopen,
// reports and close-the-day specs; rp-reopen, rp-takings-reopened): the Owner reopens the latest closed day from
// its report with a reason, sees it left out and said so, finds it in Today's Needs attention, counts the cash
// again and closes it, at a computer and a phone width. The server's clock is pinned to Thursday 17 September 2026.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
const shops: number[] = [];

test.describe.configure({ timeout: 90_000, mode: 'serial' });
test.beforeAll(async () => {
  server = await startLiveServer({ env: { WHEELHOUSE_TEST_CLOCK: '2026-09-17T11:00:00Z' } });
});
test.afterAll(async () => {
  try {
    for (const id of shops) await deleteTestShop(id);
  } finally {
    if (server) await server.stop();
  }
});

for (const [size, viewport] of [['computer', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`on a ${size}, the Owner reopens the latest closed day, sees it left out, and closes it again`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    shops.push(owner.shop.id);
    await runWithShop(owner.shop.id, async () => {
      await prepare('UPDATE shops SET float_pence = 15000 WHERE id = ?').run(owner.shop.id);
      for (const [day, takings, cash] of [['2026-09-14', 20000, 7000], ['2026-09-15', 30000, 14000]] as const) {
        const check = await prepare('INSERT INTO float_checks (day, login_id, expected_pence, counted_pence) VALUES (?, ?, 15000, 15000) RETURNING id').get(day, owner.loginId);
        await prepare(
          `INSERT INTO day_closes (day, login_id, closed_at, float_check_id, float_start_pence, cash_pence, drawer_cash_pence, paid_outs_pence, expected_pence, counted_pence,
             float_pence, banked_pence, takings_pence, card_pence, other_pence, online_pence)
           VALUES (?, ?, ?, ?, 15000, ?, ?, 0, ?, ?, 15000, ?, ?, ?, 0, 0)`
        ).run(day, owner.loginId, `${day}T16:30:00Z`, check.id, cash, cash, 15000, 15000, 0, takings, takings - cash);
      }
    });
    await context.clearCookies();
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);

    await page.goto(`${server!.baseUrl}/workshop/reports/takings?period=this-week`);
    const table = page.getByRole('table', { name: 'Closed days' });
    // Monday's report is not the latest closed day: no Reopen this day.
    await table.getByRole('button', { name: /^Mon 14 Sep/ }).click();
    await expect(page.getByRole('dialog', { name: 'Mon 14 September' }).getByRole('button', { name: 'Print' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reopen this day' })).toHaveCount(0);
    await page.getByRole('dialog', { name: 'Mon 14 September' }).getByRole('button', { name: 'Close' }).click();

    await table.getByRole('button', { name: /^Tue 15 Sep/ }).click();
    await page.getByRole('button', { name: 'Reopen this day' }).click();
    const box = page.getByRole('dialog', { name: 'Reopen Tue 15 September?' });
    await expect(box.getByRole('button', { name: 'Reopen the day' })).toHaveAttribute('aria-disabled', 'true');
    await box.getByLabel('Why are you reopening it? (needed)').fill('a card payment was counted as cash');
    await box.getByRole('button', { name: 'Reopen the day' }).click();
    await expect(page.getByText('Tue 15 Sep is reopened — its figures are left out until it’s closed again')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Closed days’ takings' }).getByText('£200.00')).toBeVisible();
    await expect(table.getByRole('row', { name: /Tue 15 Sep.*Reopened/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // Today's Needs attention has it with Close it.
    await page.goto(`${server!.baseUrl}/workshop/today`);
    await expect(page.getByText('Tuesday 15 September was reopened')).toBeVisible();
    await page.getByRole('link', { name: 'Close Tuesday 15 September' }).click();

    // Count the cash again and close it.
    const again = page.getByRole('region', { name: 'Close the day again' });
    await expect(again.getByText(/was reopened by Jack Lewis: “a card payment was counted as cash”/)).toBeVisible();
    await again.getByLabel('Cash counted, total').fill('151.00');
    await expect(again.getByText('Difference')).toBeVisible();
    await again.getByRole('button', { name: 'Close the day again' }).click();
    await expect(page.getByRole('dialog', { name: 'Tue 15 September' })).toBeVisible();
    await page.goto(`${server!.baseUrl}/workshop/reports/takings?period=this-week`);
    await expect(page.getByText(/is reopened/)).toHaveCount(0);
    await expect(page.getByRole('table', { name: 'Closed days' }).getByRole('button', { name: /^Tue 15 Sep/ })).toBeVisible();
  });
}
