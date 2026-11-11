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
  });
}
