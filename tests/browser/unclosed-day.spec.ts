// A day nobody closed (openspec/changes/unclosed-day; Jack's 29 Oct answer
// 5; op-float-check-unclosed, op-today-unclosed, op-close-yesterday), in a
// real browser against the real server: Monday 31 August took £74.00 in
// cash and nobody closed it; on the pinned Tuesday morning the Owner counts
// the float plus Monday's cash, then Today's Close it banks Monday's cash
// and saves Monday's own report.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { runWithShop, prepare } from '../../server/db.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, tillCookies } from '../helpers/staff.js';
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
  test(`count the morning after a day nobody closed, then Close it at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    owners.push(owner);
    const float = await staffRequest(server!.baseUrl, owner.cookie, '/api/end-of-day-settings', { method: 'PUT', body: { floatPence: 15000 } });
    expect(float.status).toBe(200);
    // Sunday 30 August was closed; Monday opened with the float, took
    // Maya Patel's £74.00 in cash, and nobody closed it.
    await runWithShop(owner.shop.id, async () => {
      const sun = await prepare("INSERT INTO float_checks (day, login_id, expected_pence, checked_at) VALUES ('2026-08-30', ?, 15000, '2026-08-30T08:00:00Z') RETURNING id").get(owner.loginId);
      await prepare(`INSERT INTO day_closes (day, login_id, closed_at, float_check_id, float_start_pence, cash_pence, paid_outs_pence, expected_pence, counted_pence,
        float_pence, banked_pence, takings_pence, card_pence, other_pence) VALUES ('2026-08-30', ?, '2026-08-30T17:00:00Z', ?, 15000, 0, 0, 15000, 15000, 15000, 0, 0, 0, 0)`).run(owner.loginId, sun.id);
      await prepare("INSERT INTO float_checks (day, login_id, expected_pence, checked_at) VALUES ('2026-08-31', ?, 15000, '2026-08-31T08:00:00Z')").run(owner.loginId);
      await prepare("INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount) VALUES ('2026-08-31T10:00:00Z', 74, 74, 'Cash', 74)").run();
    });
    await context.addCookies(await tillCookies(server!.baseUrl, owner.cookie));

    // First in: the float plus Monday's cash, Count it only.
    await page.goto(`${server!.baseUrl}/workshop/till`);
    const check = page.getByRole('dialog', { name: 'Hello, Jack' });
    await expect(check).toContainText('The drawer should have£150.00plus Monday’s cash£74.00');
    await expect(check.getByRole('button')).toHaveText(['Count it']);
    await check.getByRole('button', { name: 'Count it' }).click();
    const count = page.getByRole('dialog', { name: 'Count the float' });
    await count.getByLabel('Cash counted, total').fill('224.00');
    await count.getByRole('button', { name: 'Done counting' }).click();
    await expect(page.getByText('Float checked · counted by Jack Lewis')).toBeVisible();

    // Today: Monday wasn't closed; Close it.
    await page.goto(`${server!.baseUrl}/workshop/today`);
    const line = page.getByRole('listitem').filter({ hasText: 'Monday 31 August wasn’t closed' });
    // The server's clock is pinned to 1 Sep and the browser's isn't, so "this morning" may read as that date.
    await expect(line).toContainText(/counted with (this morning’s|Tuesday 1 September’s) float by Jack Lewis · still to bank/);
    await line.getByRole('link', { name: 'Close Monday 31 August' }).click();

    // Monday's Close the day, at banking.
    await expect(page.getByText('Monday 31 August')).toBeVisible();
    await expect(page.getByRole('button', { name: /^\d\s?Count the cash/ })).toContainText(/Counted (this morning|on Tuesday 1 September) by Jack Lewis/);
    const banking = page.getByRole('region', { name: 'Paid-outs and banking' });
    await expect(banking).toContainText('No cash taken out on Monday.');
    await expect(banking).toContainText('Bank Monday’s cash£74.00');
    await expect(banking).toContainText('Leave in the drawerThe float and today’s sales');
    await banking.getByRole('button', { name: 'Banking bagged — next step' }).click();
    await page.getByRole('button', { name: 'Close the day and show the report' }).click();
    const report = page.getByRole('dialog', { name: 'Day closed' });
    await expect(report).toContainText('Monday 31 August · closed by Jack Lewis');
    await expect(report.getByRole('listitem').first()).toHaveText('Takings£74.00');
    await expect(report).toContainText('Banked£74.00');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const kept = await staffRequest(server!.baseUrl, owner.cookie, '/api/close-the-day?day=2026-08-31');
    expect([kept.body.close.countedPence, kept.body.close.bankedPence, kept.body.close.takingsPence]).toEqual([22400, 7400, 7400]);
    // Tonight starts from the float.
    const tonight = await staffRequest(server!.baseUrl, owner.cookie, '/api/close-the-day');
    expect([tonight.body.earlierDay, tonight.body.expectedPence]).toEqual([null, 15000]);
  });
}
