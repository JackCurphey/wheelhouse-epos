// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { runWithShop, prepare } from '../../server/db.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Reports and Sales in a real browser (openspec/changes/reports-sales-and-takings, group 2;
// rp-home, rp-sales, rp-pick-dates): the Owner opens Reports, follows the shop's link to
// Sales on This week, changes period, picks dates, at a computer and a phone width. The
// server's clock is pinned to Thursday 17 September 2026.
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

const noSideScroll = async (page: import('@playwright/test').Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

for (const [size, viewport] of [['computer', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`on a ${size}, the Owner opens Reports, then Sales for this week, a month and picked dates`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    shops.push(owner.shop.id);
    await runWithShop(owner.shop.id, async () => {
      const site = await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get();
      const till = await prepare('INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, ?, ?, ?) RETURNING id').get(site.id, 'B1', 'Till 1', randomUUID());
      let receipt = 0;
      for (const [at, pence] of [['2026-09-15T08:00:00Z', 2500], ['2026-09-16T09:00:00Z', 1500], ['2026-09-10T09:00:00Z', 1000], ['2026-08-20T09:00:00Z', 700]] as const) {
        await prepare('INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, received_at, total_pence, vat_pence) VALUES (?, ?, ?, ?, false, ?, ?, ?, 0)')
          .run(randomUUID(), till.id, site.id, ++receipt, at, at, pence);
      }
    });
    await context.clearCookies();
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);

    await page.goto(`${server!.baseUrl}/workshop/reports`);
    await expect(page.getByText(/^Thursday 17 September · North Street Cycles/)).toBeVisible();
    await expect(page.getByRole('region', { name: 'So far: Mon 14 – Thu 17 September' }).getByText('£40.00')).toBeVisible();
    await noSideScroll(page);
    await page.getByRole('region', { name: 'Ready-made reports' }).getByRole('link', { name: /Sales/ }).click();

    // This week: Tuesday and Wednesday's two sales, against Mon to Thu last week's £10.00.
    await expect(page.getByRole('heading', { level: 2, name: 'Sales' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Takings', exact: true }).getByText('Up £30.00 on the same days last week')).toBeVisible();
    await expect(page.getByRole('row', { name: /^Tue 15 Sep £25\.00 1 £25\.00$/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /^Fri 18 Sep — — —$/ })).toBeVisible();
    await noSideScroll(page);

    await page.getByText('Last 12 months', { exact: true }).click();
    await expect(page.getByRole('table', { name: 'Takings by month' })).toBeVisible();
    await expect(page.getByText('October 2025 – September 2026, against the 12 months before')).toBeVisible();
    await noSideScroll(page);

    await page.getByText('Pick dates', { exact: true }).click();
    const box = page.getByRole('dialog', { name: 'Pick dates' });
    await box.getByLabel('From').fill('2026-09-10');
    await box.getByLabel('To').fill('2026-09-07');
    await box.getByRole('button', { name: 'Show report' }).click();
    await expect(box.getByText('To is before From: pick a To on or after From')).toBeVisible();
    await box.getByLabel('To').fill('2026-09-17');
    await box.getByRole('button', { name: 'Show report' }).click();
    await expect(page.getByText(/10 – 17 September, against the same number of days just before/)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Takings', exact: true }).getByText('£50.00', { exact: true })).toBeVisible();
    await noSideScroll(page);

    // The address alone opens a period (a bookmark): last month is the one August sale.
    await page.goto(`${server!.baseUrl}/workshop/reports/sales?period=last-month`);
    await expect(page.getByRole('group', { name: 'Takings', exact: true }).getByText('£7.00', { exact: true })).toBeVisible();
    await noSideScroll(page);
  });
}

for (const [size, viewport] of [['computer', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`on a ${size}, the Owner opens Takings and cash-ups, then a closed day's report`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    shops.push(owner.shop.id);
    // Monday and Tuesday closed, as Close the day saves them; today not closed.
    await runWithShop(owner.shop.id, async () => {
      for (const [day, takings, cash, counted, banked, online] of [['2026-09-14', 20000, 7000, 7000, 5000, 3000], ['2026-09-15', 30000, 14000, 13500, 11500, 2500]] as const) {
        const check = await prepare('INSERT INTO float_checks (day, login_id, expected_pence, counted_pence) VALUES (?, ?, 15000, 15000) RETURNING id').get(day, owner.loginId);
        await prepare(
          `INSERT INTO day_closes (day, login_id, closed_at, float_check_id, float_start_pence, cash_pence, drawer_cash_pence, paid_outs_pence, expected_pence, counted_pence,
             float_pence, banked_pence, takings_pence, card_pence, other_pence, online_pence)
           VALUES (?, ?, ?, ?, 15000, ?, ?, 0, ?, ?, 15000, ?, ?, ?, 0, ?)`
        ).run(day, owner.loginId, `${day}T16:30:00Z`, check.id, cash, cash, cash, counted, banked, takings, takings - cash, online);
      }
    });
    await context.clearCookies();
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);

    await page.goto(`${server!.baseUrl}/workshop/reports`);
    await page.getByRole('region', { name: 'Ready-made reports' }).getByRole('link', { name: /Takings and cash-ups/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Takings and cash-ups' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Closed days’ takings' }).getByText('£500.00')).toBeVisible();
    const table = page.getByRole('table', { name: 'Closed days' });
    await expect(table.getByRole('row', { name: /^Thu 17 Sep — — — Not closed yet$/ })).toBeVisible();
    await expect(table.getByRole('row', { name: /^Tue 15 Sep · Online £25\.00 — — Not a till$/ })).toBeVisible();
    await expect(table.getByText('−£5.00')).toBeVisible();
    await noSideScroll(page);

    await table.getByRole('button', { name: /^Tue 15 Sep/ }).click();
    const report = page.getByRole('dialog', { name: 'Tue 15 September' });
    await expect(report.getByText(/^Closed by Jack Lewis at \d\d:\d\d$/)).toBeVisible();
    await expect(report.getByText('Banked')).toBeVisible();
    await expect(report.getByText('£115.00')).toBeVisible();
    await expect(report.getByRole('button', { name: 'Print' })).toBeVisible();
    await noSideScroll(page);
    await report.getByRole('button', { name: 'Close' }).click();
    await expect(report).toBeHidden();

    // A bookmark to the address alone.
    await page.goto(`${server!.baseUrl}/workshop/reports/takings?period=this-week`);
    await expect(page.getByRole('table', { name: 'Closed days' })).toBeVisible();
  });
}

test('the Owner downloads Sales as a spreadsheet and turns graphs off in Your settings', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner.shop.id);
  await runWithShop(owner.shop.id, async () => {
    const site = await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get();
    const till = await prepare('INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, ?, ?, ?) RETURNING id').get(site.id, 'B1', 'Till 1', randomUUID());
    await prepare('INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, received_at, total_pence, vat_pence) VALUES (?, ?, ?, 1, false, ?, ?, 2550, 0)')
      .run(randomUUID(), till.id, site.id, '2026-09-15T08:00:00Z', '2026-09-15T08:00:00Z');
  });
  await context.clearCookies();
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);

  await page.goto(`${server!.baseUrl}/workshop/reports/sales`);
  await expect(page.getByRole('img', { name: /^Takings by day:/ })).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download as spreadsheet' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^sales-north-street-cycles-[0-9a-f]{8}-2026-09-14-to-2026-09-17\.csv$/);
  const { readFile } = await import('node:fs/promises');
  const text = await readFile((await download.path())!, 'utf8');
  expect(text).toContain('Tue 15 Sep,25.50,1,25.50');
  expect(text).toContain('So far,25.50,1,25.50');

  // Turn graphs off in Your settings: the table stays, the graph goes.
  await page.goto(`${server!.baseUrl}/workshop/your-settings`);
  const toggle = page.getByRole('dialog', { name: 'Your settings' }).getByRole('switch', { name: 'Show graphs in reports' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.goto(`${server!.baseUrl}/workshop/reports/sales`);
  await expect(page.getByRole('table', { name: 'Sales by day' })).toBeVisible();
  await expect(page.getByRole('img', { name: /^Takings by day:/ })).toHaveCount(0);
});

// Workshop (openspec/changes/reports-ready-made, group 1; rp-workshop): the Owner opens it
// from its card; at a phone width the four figures sit two by two.
for (const [size, viewport] of [['computer', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`on a ${size}, the Owner opens Workshop from its card`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    shops.push(owner.shop.id);
    await runWithShop(owner.shop.id, async () => {
      // Two jobs booked in this week, one signed off; one booked in the same days last week.
      for (const [bookedIn, signedOff] of [['2026-09-14T08:00:00Z', '2026-09-16T08:00:00Z'], ['2026-09-15T08:00:00Z', null], ['2026-09-08T08:00:00Z', null]] as const) {
        await prepare("INSERT INTO workshop_jobs (title, job_date, booked_in_at, signed_off_at) VALUES ('Service', '2026-09-14', ?, ?)").run(bookedIn, signedOff);
      }
    });
    await context.clearCookies();
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);

    await page.goto(`${server!.baseUrl}/workshop/reports`);
    await page.getByRole('region', { name: 'Ready-made reports' }).getByRole('link', { name: /Workshop/ }).click();
    await expect(page).toHaveURL(`${server!.baseUrl}/workshop/reports/workshop`);
    await expect(page.getByRole('heading', { level: 2, name: 'Workshop' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Jobs booked in' }).getByText('Up 1 on the same days last week')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Booked in to ready' }).getByText('2 days')).toBeVisible();
    await expect(page.getByRole('img', { name: /^Jobs finished by day: busiest day Wed 16 Sep; up 1 on the same days last week\./ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'How full each mechanic was' }).getByText('Shared queue')).toBeVisible();
    const boxes = await Promise.all(['Jobs booked in', 'Finished', 'Collected', 'Booked in to ready']
      .map((n) => page.getByRole('group', { name: n, exact: true }).boundingBox()));
    const tops = boxes.map((b) => Math.round(b!.y));
    if (size === 'phone') expect([tops[0] === tops[1], tops[2] === tops[3], tops[2] > tops[0]]).toEqual([true, true, true]);
    else expect(new Set(tops).size).toBe(1);
    await noSideScroll(page);
  });
}

// Returning customers (openspec/changes/reports-ready-made, group 2; rp-returning): the
// Owner opens it from its card, sees who came back, and widens "Not seen for", at a
// computer and a phone width; at a phone width the figures sit two by two.
for (const [size, viewport] of [['computer', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`on a ${size}, the Owner opens Returning customers and changes how long not seen`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    shops.push(owner.shop.id);
    await runWithShop(owner.shop.id, async () => {
      // Ann came in last year and again in February; Ben came in for the first time in June.
      const ann = await prepare('INSERT INTO customers (name, marketing_permission) VALUES (?, true) RETURNING id').get('Ann Lee');
      const ben = await prepare('INSERT INTO customers (name) VALUES (?) RETURNING id').get('Ben Shaw');
      for (const [day, who] of [['2025-03-10', ann.id], ['2026-02-05', ann.id], ['2026-06-10', ben.id]] as const) {
        await prepare("INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, customer_id) VALUES (?, 20, 20, 'Cash', 20, ?)").run(`${day}T12:00:00Z`, who);
      }
    });
    await context.clearCookies();
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);

    await page.goto(`${server!.baseUrl}/workshop/reports`);
    await page.getByRole('region', { name: 'Ready-made reports' }).getByRole('link', { name: /Returning customers/ }).click();
    await expect(page).toHaveURL(`${server!.baseUrl}/workshop/reports/returning`);
    await expect(page.getByRole('heading', { level: 2, name: 'Returning customers' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Customers' }).getByText('Up 1 on the 12 months before')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Came back within 12 months' }).getByText('100%')).toBeVisible();
    await expect(page.getByRole('img', { name: 'New and returning customers by month: most returning in Feb, most new in Jun. The figures are in the table below.' })).toBeVisible();
    const lapsed = page.getByRole('table', { name: 'Not seen lately' });
    await expect(lapsed.getByRole('link')).toHaveText(['Ann Lee']);
    // On a phone the three figures sit two by two, as drawn.
    const tops = (await Promise.all(['Customers', 'New', 'Came back within 12 months']
      .map((n) => page.getByRole('group', { name: n, exact: true }).boundingBox()))).map((b) => Math.round(b!.y));
    if (size === 'phone') expect([tops[0] === tops[1], tops[2] > tops[0]]).toEqual([true, true]);
    else expect(new Set(tops).size).toBe(1);
    await page.getByRole('textbox', { name: /^Not seen for/ }).fill('2');
    await expect(page).toHaveURL(/months=2/);
    await expect(lapsed.getByRole('link')).toHaveText(['Ben Shaw', 'Ann Lee']);
    await noSideScroll(page);
  });
}
