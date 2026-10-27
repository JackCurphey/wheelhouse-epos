// Close the day (openspec/changes/close-the-day; cash-up decisions 2 to 6), in
// a real browser against the real server: the Owner opens Close the day,
// checks the float first, counts the drawer blind, takes cash out, bags the
// banking and closes the day, and the report shows the day's figures. The
// server's clock is pinned to 1 Sep 2026, so the day's sale is put on that day.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { runWithShop, prepare } from '../../server/db.js';
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

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`count, take cash out, bank and close the day at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    // A shop of its own for each width: a shop closes once a day.
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    owners.push(owner);
    const float = await staffRequest(server!.baseUrl, owner.cookie, '/api/end-of-day-settings', { method: 'PUT', body: { floatPence: 15000 } });
    expect(float.status).toBe(200);
    // Maya Patel's £74.00, paid in cash, today (the drawing's example sale).
    await runWithShop(owner.shop.id, () => prepare(
      "INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount) VALUES ('2026-09-01T10:00:00Z', 74, 74, 'Cash', 74)"
    ).run());
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);

    await page.goto(`${server!.baseUrl}/workshop/till/close`);
    // Nobody has checked the float today: that comes first, Looks right only,
    // even on the first day (Jack's answer 8).
    const check = page.getByRole('dialog', { name: 'Hello, Jack' });
    await expect(check.getByRole('button')).toHaveText(['Looks right']);
    await check.getByRole('button', { name: 'Looks right' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Count the cash, blind: nothing expected is shown until the count is done.
    const counting = page.getByRole('region', { name: 'Count the cash' });
    await expect(page.getByRole('heading', { name: 'Close the day' })).toBeVisible();
    await expect(page.getByText('£224.00')).toHaveCount(0);
    await counting.getByLabel('Cash counted, total').fill('224.00');
    await counting.getByRole('button', { name: 'Done counting — show the difference' }).click();
    await expect(counting).toContainText('Spot on');
    await expect(counting.getByRole('group', { name: 'How the till worked out what it expected' })).toContainText('plus cash sales£74.00');
    await counting.getByRole('button', { name: 'Keep this count and go on' }).click();

    // Paid-outs and banking: take £5.00 out, then leave the float and bank the rest.
    const banking = page.getByRole('region', { name: 'Paid-outs and banking' });
    await expect(banking).toContainText('No cash taken out today.');
    await banking.getByRole('button', { name: 'Add a paid-out' }).click();
    const out = page.getByRole('dialog', { name: 'Cash taken out' });
    await out.getByLabel('Amount').fill('5.00');
    await out.getByLabel('What it was for').fill('[Shop’s reason]');
    await out.getByRole('button', { name: 'Take it out' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(banking.getByRole('listitem')).toContainText('[Shop’s reason]');
    await expect(banking).toContainText('Leave in the drawer£150.00');
    await expect(banking).toContainText('Bank£74.00');
    await banking.getByRole('button', { name: 'Banking bagged — next step' }).click();

    // Close the day: the report, kept on the server.
    await page.getByRole('button', { name: 'Close the day and show the report' }).click();
    const report = page.getByRole('dialog', { name: 'Day closed' });
    await expect(report).toContainText('Tuesday 1 September · closed by Jack Lewis');
    await expect(report.getByRole('listitem')).toHaveText([
      'Takings£74.00', 'Card£0.00', 'Cash£74.00', 'Gift cards, store credit, customer accounts, other£0.00',
      /^Float at the start£150\.00 · looked right · Jack Lewis at \d\d:\d\d£150\.00$/, 'Cash difference£5.00 over', 'Banked£74.00',
    ]);
    await expect(report).toContainText('Online money is not in this till’s takings: £0.00 today');
    // Nothing runs off the side of the page.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await report.getByRole('button', { name: 'Close' }).click();
    const kept = await staffRequest(server!.baseUrl, owner.cookie, '/api/close-the-day');
    expect([kept.body.close.countedPence, kept.body.close.paidOutsPence, kept.body.close.bankedPence]).toEqual([22400, 500, 7400]);
  });
}
