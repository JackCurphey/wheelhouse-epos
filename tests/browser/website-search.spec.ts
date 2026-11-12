// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { runWithShop, prepare } from '../../server/db.js';

// Search in a real browser against the real server (openspec/changes/
// website-browse, task 6.6; drawings wb-search-typing, wb-search-results,
// wb-search-measure, wb-search-none): on a computer the header's box suggests
// after a pause with one request for fast typing, the arrow keys pick a
// suggestion, Enter goes to the results, and a measurement narrows to its
// category; on a phone Search the shop opens a search across the top. The
// browser-coverage rule (#351).
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let bearings = 0;

// name, inner diameter (mm), stock at Bolton.
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

test('on a computer: one request for fast typing, arrow keys pick, Enter goes to the results, and a measurement narrows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const suggests: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/api/site/suggest')) suggests.push(new URL(r.url()).searchParams.get('q') ?? ''); });
  await page.goto(`${server!.baseUrl}/store/${owner.shop.slug}/`);
  const box = page.getByRole('banner').getByRole('combobox', { name: 'Search the shop' });
  await box.pressSequentially('bearing', { delay: 20 });
  const list = page.getByRole('search').getByRole('listbox', { name: 'Suggestions' });
  await expect(list.getByRole('group', { name: 'Products' })).toBeVisible();
  await expect(list.getByRole('group', { name: 'Categories' }).getByRole('option', { name: /Bearings/ })).toBeVisible();
  await expect(list.getByRole('option', { name: 'See all results for “bearing”' })).toBeVisible();
  expect(suggests).toEqual(['bearing']);

  // The arrow keys pick, focus staying in the box; Escape closes; Enter with nothing picked searches.
  await box.press('ArrowDown');
  const first = list.getByRole('option').first();
  await expect(box).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id'))!);
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await expect(box).toBeFocused();
  await box.press('Escape');
  await expect(list).toHaveCount(0);
  await expect(box).toHaveValue('bearing');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/search\?q=bearing$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Results for “bearing”' })).toBeVisible();
  await countLine(page, '8 products');
  const sort = page.getByRole('combobox', { name: 'Sort by' });
  await expect(sort.locator('option:checked')).toHaveText('Best match');
  await expect(box).toHaveValue('bearing');

  // A measurement: the category, with the value ticked; removing it searches the other words in the category.
  await box.fill('bearing 30mm');
  await box.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Results for “bearing 30mm”' })).toBeVisible();
  await countLine(page, 'Bearings with an inner diameter of 30 mm · 3 products');
  await expect(page.getByRole('button', { name: 'Remove filter Category: Bearings' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Filters' }).getByRole('checkbox', { name: /^30 mm/ })).toBeChecked();
  await page.getByRole('button', { name: 'Remove filter Inner diameter: 30 mm' }).click();
  await expect(page).toHaveURL(new RegExp(`/search\\?q=bearing&category=${bearings}$`));
  await countLine(page, '8 products match');
});

test('on a phone: Search the shop opens a search across the top, and nothing found offers Ask the shop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${server!.baseUrl}/store/${owner.shop.slug}/`);
  const button = page.getByRole('button', { name: 'Search the shop' });
  await button.click();
  const box = page.getByRole('combobox', { name: 'Search the shop' });
  await expect(box).toBeFocused();
  await box.pressSequentially('bearing', { delay: 20 });
  const list = page.getByRole('search').getByRole('listbox', { name: 'Suggestions' });
  await expect(list.getByRole('option', { name: 'See all results for “bearing”' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('search').getByRole('button', { name: 'Cancel' }).click();
  await expect(box).toHaveCount(0);
  await expect(button).toBeFocused();

  await button.click();
  await box.fill('zzq');
  await box.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'No results for “zzq”' })).toBeVisible();
  await expect(box).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Ask the shop' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Shop by category' })).toBeVisible();
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/website-search-390.png` });
});
