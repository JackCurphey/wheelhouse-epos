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

    // A changed report has its own address, so a bookmark and Back work.
    await page.goto(`${server!.baseUrl}/workshop/reports/changed?base=sales&measure=items&split=product&only=Accessories&period=this-week`);
    await expect(page.getByRole('heading', { level: 2, name: 'Sales: items sold by product' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to Sales' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Sales' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'This week' })).toBeChecked();

    // Save it as my report, then open it from Your reports on the Reports page.
    await page.goto(`${server!.baseUrl}/workshop/reports/changed?base=sales&measure=items&split=product&only=Accessories&period=this-week`);
    await page.getByRole('button', { name: 'Save as my report' }).click();
    const save = page.getByRole('dialog', { name: 'Save as my report' });
    await expect(save.getByRole('radio', { name: 'Me and the other managers' })).toHaveAttribute('aria-disabled', 'true');
    await save.getByRole('button', { name: 'Save' }).click();
    await expect(save.getByText('Type its name')).toBeVisible();
    await save.getByLabel('Name (needed)').fill('Bottles this week');
    await save.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved as “Bottles this week”. It is in Your reports on the Reports page.')).toBeVisible();
    await page.goto(`${server!.baseUrl}/workshop/reports`);
    const mine = page.getByRole('region', { name: 'Your reports' });
    await expect(mine.getByText('Just you')).toBeVisible();
    await mine.getByRole('link', { name: /Bottles this week/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Sales: items sold by product' })).toBeVisible();
    // The same name again is refused, and the popup stays.
    await page.getByRole('button', { name: 'Save as my report' }).click();
    await page.getByLabel('Name (needed)').fill('bottles THIS week');
    await page.getByRole('dialog', { name: 'Save as my report' }).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('You already have a report with this name. Choose another name.')).toBeVisible();
    const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow2).toBeLessThanOrEqual(0);

    // Rename it from its menu, then delete it and bring it back with Undo.
    await page.goto(`${server!.baseUrl}/workshop/reports`);
    const list = page.getByRole('region', { name: 'Your reports' });
    await list.getByRole('button', { name: 'More for Bottles this week' }).click();
    await expect(page.getByRole('menuitem', { name: 'Share with managers' })).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    const rename = page.getByRole('dialog', { name: 'Rename' });
    await rename.getByLabel('Name (needed)').fill('Bottles weekly');
    await rename.getByRole('button', { name: 'Save' }).click();
    await expect(list.getByRole('link', { name: /Bottles weekly/ })).toBeVisible();
    await list.getByRole('button', { name: 'More for Bottles weekly' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByText('“Bottles weekly” deleted.')).toBeVisible();
    await expect(list.getByRole('link', { name: /Bottles weekly/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(list.getByRole('link', { name: /Bottles weekly/ })).toBeVisible();
    await expect(page.getByText('“Bottles weekly” deleted.')).toHaveCount(0);
    const overflow3 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow3).toBeLessThanOrEqual(0);
  });
}

test('the Owner changes Workshop to jobs by service, limited to a service category', async ({ page, context }) => {
  const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner.shop.id);
  await runWithShop(owner.shop.id, async () => {
    const cat = await prepare("INSERT INTO workshop_service_categories (name) VALUES ('Repairs') RETURNING id").get();
    await prepare("INSERT INTO workshop_service_categories (name) VALUES ('Servicing')").run();
    const puncture = await prepare("INSERT INTO workshop_services (name, price, price_pence, category_id) VALUES ('Puncture', 10, 1000, ?) RETURNING id").get(cat.id);
    const job = await prepare("INSERT INTO workshop_jobs (title, job_date, booking_state, signed_off_at) VALUES ('Puncture', '2026-09-15', 'scheduled', '2026-09-15T10:00:00Z') RETURNING id").get();
    await prepare('INSERT INTO workshop_job_services (workshop_job_id, service_id, position) VALUES (?, ?, 1)').run(job.id, puncture.id);
  });
  await context.clearCookies();
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);

  await page.goto(`${server!.baseUrl}/workshop/reports/workshop`);
  await expect(page.getByRole('heading', { level: 2, name: 'Workshop' })).toBeVisible();
  await page.getByRole('button', { name: 'Change what’s shown' }).click();
  const panel = page.getByRole('dialog', { name: 'Change what’s shown' });
  await expect(panel.getByRole('radio', { name: 'Items sold' })).toHaveAttribute('aria-disabled', 'true');
  await expect(panel.getByText('Supplier')).toHaveCount(0);
  await panel.getByText('Service', { exact: true }).click();
  await panel.getByText('Repairs', { exact: true }).click();
  await panel.getByRole('button', { name: 'Show report' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Workshop: jobs by service' })).toBeVisible();
  await expect(page.getByText('Changed from Workshop · Repairs only · So far: Mon 14 – Thu 17 September, against the same days last week')).toBeVisible();
  const table = page.getByRole('table', { name: 'Jobs by service' });
  await expect(table.getByRole('row', { name: /Puncture 1/ })).toBeVisible();
  await expect(table.getByRole('row', { name: /Total, Repairs only 1/ })).toBeVisible();
});
