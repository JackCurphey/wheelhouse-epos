// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { runWithShop, prepare } from '../../server/db.js';

// Choosing a colour and size on a phone, in a real browser against the real
// server (openspec/changes/website-browse, task 5.8; drawings
// wb-product-sizes and wb-product-held): nothing is chosen to start, the
// stock line waits for both, a size Bolton doesn't have in that colour is
// struck and read out as not in stock, and a size it has shows how many.
// The browser-coverage rule (#351).
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let first = 0;

const SIZES = ['S', 'M', 'L', 'XL'];
const COLOURS = ['[Colour 1]', '[Colour 2]'];

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
    await one("INSERT INTO product_categories (parent_id, name, path) VALUES (NULL, '[Category]', '[Category]') RETURNING id");
    const group = (await one("INSERT INTO product_groups (name, category) VALUES ('[Product with sizes]', '[Category]') RETURNING id")).id;
    for (const colour of COLOURS) {
      for (const size of SIZES) {
        const id = (await one(
          `INSERT INTO products (sku, name, brand, category, price, cost, supplier, barcode, description, photo_url, show_online, active, group_id, size, colour, updated_at)
           VALUES (?, '[Product with sizes]', '[Brand]', '[Category]', 30, 12, '[Supplier]', ?, '', NULL, true, 1, ?, ?, ?, now()) RETURNING id`,
          `[sku ${colour} ${size}]`, `[barcode ${colour} ${size}]`, group, size, colour,
        )).id;
        first ||= id;
        // Bolton has every size but M in [Colour 1].
        if (!(size === 'M' && colour === '[Colour 1]')) await prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, 2) RETURNING product_id').get(bolton, id);
      }
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

test('on a phone: nothing chosen to start, the stock line once colour and size are chosen, and a struck size read out', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${server!.baseUrl}/store/${owner.shop.slug}/products/${first}`);
  await expect(page.getByRole('heading', { level: 1, name: '[Product with sizes]' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const colour = page.getByRole('radiogroup', { name: 'Colour' });
  const size = page.getByRole('radiogroup', { name: 'Size' });
  await expect(colour.getByText('Colour: choose one')).toBeVisible();
  await expect(size.getByText('Size: choose one')).toBeVisible();
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  const line = page.getByRole('status').filter({ hasText: /Ready|Sold out|Choose/ });
  await expect(line).toHaveText('Choose a colour and size to see when it’s ready');
  for (const radio of await page.getByRole('radio').all()) expect((await radio.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // The colours by keyboard, as a radio group: one tab stop, and the arrows go round.
  await expect(colour.getByRole('radio', { name: '[Colour 1]' })).toHaveAttribute('tabindex', '0');
  await expect(colour.getByRole('radio', { name: '[Colour 2]' })).toHaveAttribute('tabindex', '-1');
  await colour.getByRole('radio', { name: '[Colour 2]' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(colour.getByRole('radio', { name: '[Colour 1]' })).toBeFocused();
  await expect(colour.getByRole('radio', { name: '[Colour 1]' })).toHaveAttribute('aria-checked', 'true');
  await expect(colour.getByText('Colour: [Colour 1]')).toBeVisible();
  await expect(line).toHaveText('Choose a colour and size to see when it’s ready');
  const m = size.getByRole('radio', { name: 'M — not in stock at Bolton' });
  await expect(m).toHaveCSS('text-decoration-line', 'line-through');
  await m.click();
  await expect(m).toHaveAttribute('aria-checked', 'true');
  await expect(line).toHaveText('Sold out at Bolton');
  await expect(m).toHaveAccessibleDescription('M isn’t in stock at Bolton in [Colour 1].');
  await expect(page.getByRole('link', { name: 'Add to basket' })).toHaveCount(0);

  await size.getByRole('radio', { name: 'L', exact: true }).click();
  await expect(line).toHaveText('Ready today at Bolton · 2 in stock');
  await page.getByRole('link', { name: 'Add to basket' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Basket' })).toBeVisible();
  await expect(page.getByText(/ can’t take orders online yet\.$/)).toBeVisible();
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/website-product-390.png` });
});
