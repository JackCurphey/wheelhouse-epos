// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { runWithShop, prepare } from '../../server/db.js';

// A category page and its filters in a real browser against the real server
// (openspec/changes/website-browse, task 4.8; drawings wb-category,
// wb-category-filtered): on a computer the Filters panel at the side ticks a
// detail straight away, the address keeps it for Back, and Show more moves
// focus to the first new product; on a phone the Filter panel changes nothing
// until "Show [n] products". The browser-coverage rule (#351).
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let bearings = 0;

// name, inner diameter (mm), stock at Bolton. Eight, so a first page of six leaves two for Show more.
const BEARINGS: [string, number, number][] = [
  ['[Bearing A]', 30, 2], ['[Bearing B]', 30, 0], ['[Bearing C]', 25, 1], ['[Bearing D]', 25, 0],
  ['[Bearing E]', 28, 3], ['[Bearing F]', 30, 0], ['[Bearing G]', 28, 1], ['[Bearing H]', 25, 0],
];

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const setUp = await staffRequest(server.baseUrl, owner.cookie, '/api/website/set-up', { method: 'POST', body: { kind: 'wheelhouse', startWith: 'every', mainColour: '#2A2822' } });
  expect(setUp.status, JSON.stringify(setUp.body)).toBe(200);
  expect((await staffRequest(server.baseUrl, owner.cookie, '/api/website/publish', { method: 'POST' })).status).toBe(200);
  expect((await staffRequest(server.baseUrl, owner.cookie, '/api/website/turn-on', { method: 'POST' })).status).toBe(200);
  await runWithShop(owner.shop.id, async () => {
    const one = (sql: string, ...args: unknown[]) => prepare(sql).get(...args) as Promise<{ id: number }>;
    await prepare("UPDATE sites SET name = 'Bolton'").run();
    const bolton = (await one('SELECT id FROM sites')).id;
    bearings = (await one("INSERT INTO product_categories (parent_id, name, path) VALUES (NULL, 'Bearings', 'Bearings') RETURNING id")).id;
    const inner = (await one("INSERT INTO category_details (category_id, name, kind, unit, position, choices) VALUES (?, 'Inner diameter', 'number', 'mm', 0, '{}'::text[]) RETURNING id", bearings)).id;
    let minute = 0;
    for (const [name, mm, qty] of BEARINGS) {
      const id = (await one(
        `INSERT INTO products (sku, name, brand, category, price, cost, supplier, barcode, description, photo_url, show_online, active, created_at, updated_at)
         VALUES (?, ?, '[Brand]', 'Bearings', ?, 7, '[Supplier]', ?, '', NULL, true, 1, ?::timestamptz, now()) RETURNING id`,
        `[sku ${name}]`, name, 10 + minute, `[barcode ${name}]`, new Date(Date.UTC(2026, 8, 1, 0, minute++)).toISOString(),
      )).id;
      await prepare('INSERT INTO product_details (detail_id, product_id, value_number, value_key) VALUES (?, ?, ?, ?) RETURNING product_id').get(inner, id, mm, Math.round(mm * 10000));
      if (qty) await prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, ?) RETURNING product_id').get(bolton, id, qty);
    }
  });
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    await server?.stop();
  }
});

const countLine = (page: import('@playwright/test').Page, text: string) =>
  expect(page.locator('[aria-live="polite"]', { hasText: new RegExp(`^${text}$`) })).toBeVisible();

test('on a computer: a tick filters at once, the address keeps it for Back, and Show more moves focus on', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${server!.baseUrl}/store/${owner.shop.slug}/shop/${bearings}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Bearings' })).toBeVisible();
  await countLine(page, '8 products');
  const crumbs = page.getByRole('navigation', { name: 'You are here' });
  await expect(crumbs.getByRole('link', { name: 'Shop' })).toBeVisible();

  // Show more: the next two, with focus on the first of them.
  await expect(page.getByText('Showing 6 of 8 products')).toBeVisible();
  await page.getByRole('button', { name: 'Show more' }).click();
  await expect(page.getByRole('link', { name: /\[Bearing G\]/ })).toBeFocused();
  // All eight shown: the line and the button go.
  await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(0);
  await expect(page.getByText(/^Showing \d+ of 8 products$/)).toHaveCount(0);
  expect(page.url()).not.toContain('after=');

  const filters = page.getByRole('complementary', { name: 'Filters' });
  await filters.getByRole('checkbox', { name: /^30 mm/ }).check();
  await countLine(page, '3 products match');
  await expect(page).toHaveURL(/[?&]inner-diameter=30(&|$)/);
  await expect(page.getByRole('button', { name: 'Remove filter Inner diameter: 30 mm' })).toBeVisible();
  await expect(page.getByRole('link', { name: /\[Bearing C\]/ })).toHaveCount(0);

  await filters.getByRole('checkbox', { name: /^Ready today at Bolton/ }).check();
  await countLine(page, '1 product matches');
  await expect(page.getByRole('link', { name: /\[Bearing A\]/ })).toBeVisible();

  await page.goBack();
  await countLine(page, '3 products match');
  await expect(filters.getByRole('checkbox', { name: /^Ready today at Bolton/ })).not.toBeChecked();
  await page.goBack();
  await countLine(page, '8 products');
  await expect(page.getByRole('button', { name: /^Remove filter/ })).toHaveCount(0);
});

test('on a phone: the Filter panel changes nothing until "Show [n] products", and Esc throws a tick away', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${server!.baseUrl}/store/${owner.shop.slug}/shop/${bearings}`);
  await countLine(page, '8 products');
  await expect(page.getByRole('complementary', { name: 'Filters' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const filter = page.getByRole('button', { name: 'Filter', exact: true });
  await filter.click();
  const panel = page.getByRole('dialog', { name: 'Filter' });
  await expect(panel).toBeVisible();
  await panel.getByRole('checkbox', { name: /^30 mm/ }).check();
  await expect(panel.getByRole('button', { name: 'Show 3 products' })).toBeVisible();
  // Nothing behind the panel has changed yet.
  expect(new URL(page.url()).search).toBe('');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(filter).toBeFocused();
  expect(new URL(page.url()).search).toBe('');
  await countLine(page, '8 products');

  await filter.click();
  await expect(panel.getByRole('checkbox', { name: /^30 mm/ })).not.toBeChecked();
  await panel.getByRole('checkbox', { name: /^30 mm/ }).check();
  await panel.getByRole('button', { name: 'Show 3 products' }).click();
  await expect(panel).toBeHidden();
  await countLine(page, '3 products match');
  await expect(page).toHaveURL(/[?&]inner-diameter=30(&|$)/);
  await expect(filter).toBeFocused();
  await expect(page.getByRole('button', { name: 'Remove filter Inner diameter: 30 mm' })).toBeVisible();
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/website-category-390.png` });
});
