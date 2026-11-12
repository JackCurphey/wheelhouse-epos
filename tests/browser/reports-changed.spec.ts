// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { runWithShop, prepare } from '../../server/db.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// "Change what's shown" and the changed report in a real browser, against the real server
// (openspec/changes/reports-your-own, group 1; rp-change, rp-changed): the Owner opens Sales,
// changes it to Items sold by Product for Accessories only, and reads the changed report, at a
// computer and a phone width. The server's clock is pinned to Thursday 17 September 2026.
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
  test(`on a ${size}, the Owner changes Sales to items sold by product and reads the changed report`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    shops.push(owner.shop.id);
    await runWithShop(owner.shop.id, async () => {
      const site = await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get();
      const till = await prepare('INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, ?, ?, ?) RETURNING id').get(site.id, 'B1', 'Till 1', randomUUID());
      const cat = await prepare("INSERT INTO product_categories (parent_id, name, path) VALUES (NULL, 'Accessories', 'Accessories') RETURNING id").get();
      const bottle = await prepare("INSERT INTO products (name, category, supplier, price) VALUES ('Water bottle', 'Accessories', 'Acme', 1) RETURNING id").get();
      expect(cat.id).toBeGreaterThan(0);
      const sale = await prepare('INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, received_at, total_pence, vat_pence) VALUES (?, ?, ?, 1, false, ?, ?, 1600, 0) RETURNING id')
        .get(randomUUID(), till.id, site.id, '2026-09-15T08:00:00Z', '2026-09-15T08:00:00Z');
      await prepare('INSERT INTO till_sale_lines (till_sale_id, product_id, description, qty, unit_price_pence, line_total_pence, vat_rate_bp, vat_pence) VALUES (?, ?, ?, 2, 800, 1600, 0, 0)')
        .run(sale.id, bottle.id, 'Water bottle');
      await prepare('INSERT INTO till_sale_payments (till_sale_id, method, amount_pence) VALUES (?, ?, 1600)').run(sale.id, 'card');
    });
    await context.clearCookies();
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);

    await page.goto(`${server!.baseUrl}/workshop/reports/sales`);
    await expect(page.getByRole('heading', { level: 2, name: 'Sales' })).toBeVisible();
    await page.getByRole('button', { name: 'Change what’s shown' }).click();
    const panel = page.getByRole('dialog', { name: 'Change what’s shown' });
    await expect(panel.getByText('Sales · this week so far')).toBeVisible();
    await expect(panel.getByRole('radio', { name: 'Jobs' })).toHaveAttribute('aria-disabled', 'true');
    await panel.getByText('Items sold', { exact: true }).click();
    await expect(panel.getByRole('radio', { name: 'Payment type' })).toHaveAttribute('aria-disabled', 'true');
    await panel.getByText('Product', { exact: true }).click();
    await panel.getByText('Accessories', { exact: true }).click();
    await panel.getByRole('button', { name: 'Show report' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Sales: items sold by product' })).toBeVisible();
    await expect(page.getByText('Changed from Sales · Accessories only · So far: Mon 14 – Thu 17 September, against the same days last week')).toBeVisible();
    const table = page.getByRole('table', { name: 'Items sold by product' });
    await expect(table.getByRole('row', { name: /Water bottle 2 £16\.00/ })).toBeVisible();
    await expect(table.getByRole('row', { name: /Total, Accessories only 2 £16\.00/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole('link', { name: 'Back to Sales' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Sales' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'This week' })).toBeChecked();
  });
}
