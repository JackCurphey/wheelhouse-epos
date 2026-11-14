// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { connectPayments } from '../helpers/payments.js';
import { runWithShop, prepare } from '../../server/db.js';

// Buying online up to the basket, in a real browser against the real server
// (openspec/changes/website-buy-online, task 11.6; drawings on-basket and
// on-basket-changed): Add to basket on the product page, the header's count,
// the basket's lines and total priced by the server, one more held at the
// stock, Remove and Undo, and a basket line the shop has since run out of.
// Payments are connected with the pretend provider; no real account.
// Example data from the drawings: Shimano brake pads B05S-RX at £28.00 and
// Bolton; "[Brake lever]" stands in for the drawing's second line.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
const P: Record<string, number> = {};
let bolton = 0;

test.describe.configure({ timeout: 90_000, mode: 'serial' });

const inShop = <T>(fn: () => Promise<T>) => runWithShop(owner.shop.id, fn);
const setStock = (productId: number, qty: number) => inShop(() => prepare(
  'INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, ?) ON CONFLICT (shop_id, site_id, product_id) DO UPDATE SET qty = EXCLUDED.qty RETURNING shop_id',
).run(bolton, productId, qty));

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const setUp = await staffRequest(server.baseUrl, owner.cookie, '/api/website/set-up', { method: 'POST', body: { kind: 'wheelhouse', startWith: 'every', mainColour: '#2A2822' } });
  expect(setUp.status, JSON.stringify(setUp.body)).toBe(200);
  expect((await staffRequest(server.baseUrl, owner.cookie, '/api/website/publish', { method: 'POST' })).status).toBe(200);
  expect((await staffRequest(server.baseUrl, owner.cookie, '/api/website/turn-on', { method: 'POST' })).status).toBe(200);
  await inShop(async () => {
    await prepare("UPDATE sites SET name = 'Bolton'").run();
    bolton = ((await prepare('SELECT id FROM sites').get()) as { id: number }).id;
    const add = async (key: string, name: string, sku: string, price: number) => {
      P[key] = ((await prepare(
        "INSERT INTO products (sku, name, category, price, cost, show_online, active, updated_at) VALUES (?, ?, 'Brakes', ?, 1, true, 1, now()) RETURNING id",
      ).get(sku, name, price)) as { id: number }).id;
    };
    await add('pads', 'Shimano brake pads', 'B05S-RX', 28);
    await add('lever', '[Brake lever]', '[sku lever]', 40);
    await prepare('INSERT INTO online_order_settings DEFAULT VALUES ON CONFLICT (shop_id) DO NOTHING RETURNING shop_id').run();
    await prepare('UPDATE online_order_settings SET buying_online = true').run();
  });
  await setStock(P.pads, 2);
  await setStock(P.lever, 4);
  await connectPayments(owner.shop.id);
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    await server?.stop();
  }
});

test('on a phone: Add to basket, the header’s count, then the basket priced by the server and held at the stock', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const store = `${server!.baseUrl}/store/${owner.shop.slug}`;
  await page.goto(`${store}/products/${P.pads}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Shimano brake pads' })).toBeVisible();
  const add = page.getByRole('button', { name: 'Add to basket' });
  expect((await add.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await add.click();
  await expect(page.getByRole('status').filter({ hasText: 'Added' })).toHaveText('Added 1 × Shimano brake pads View basket');
  await expect(page.getByRole('link', { name: 'Basket, 1 item' }).first()).toBeAttached();

  await page.getByRole('link', { name: 'View basket' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your basket' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const pads = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Shimano brake pads' }) });
  await expect(pads.getByText('Ready today at Bolton')).toBeVisible();
  const order = page.getByRole('region', { name: 'Your order' });
  await expect(order.locator('dl > div:last-child dd')).toHaveText('£28.00');

  // Bolton has 2: one more is allowed, a third is held.
  const more = pads.getByRole('button', { name: 'One more Shimano brake pads' });
  await more.click();
  await expect(order.locator('dl > div:last-child dd')).toHaveText('£56.00');
  await expect(more).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('link', { name: 'Basket, 2 items' }).first()).toBeAttached();
  await expect(page.getByRole('link', { name: 'Go to checkout' })).toBeVisible();
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/website-basket-390.png` });
});

test('on a computer: Remove and Undo, then a line the shop has run out of holds Go to checkout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const store = `${server!.baseUrl}/store/${owner.shop.slug}`;
  await page.goto(`${store}/products/${P.lever}`);
  await page.getByRole('button', { name: 'Add to basket' }).click();
  await page.goto(`${store}/products/${P.pads}`);
  await page.getByRole('button', { name: 'Add to basket' }).click();
  await expect(page.getByRole('link', { name: 'Basket, 2 items' }).first()).toBeAttached();
  await page.getByRole('link', { name: 'Basket, 2 items' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your basket' })).toBeVisible();
  const order = page.getByRole('region', { name: 'Your order' });
  await expect(order.locator('dl > div:last-child dd')).toHaveText('£68.00');

  await page.getByRole('button', { name: 'Remove [Brake lever]' }).click();
  await expect(page.getByRole('heading', { name: '[Brake lever]' })).toHaveCount(0);
  await expect(order.locator('dl > div:last-child dd')).toHaveText('£28.00');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('heading', { name: '[Brake lever]' })).toBeVisible();
  await expect(order.locator('dl > div:last-child dd')).toHaveText('£68.00');

  // The shop sells its last lever; the basket says so when it's next opened.
  await setStock(P.lever, 0);
  await page.reload();
  await expect(page.getByText('Something in your basket changed.')).toBeVisible();
  const checkout = page.getByRole('button', { name: 'Go to checkout' });
  await expect(checkout).toHaveAttribute('aria-disabled', 'true');
  await expect(checkout).toHaveAccessibleDescription('Remove the item that’s no longer in stock first.');
  await page.getByRole('button', { name: 'Remove [Brake lever]' }).click();
  await expect(page.getByRole('link', { name: 'Go to checkout' })).toBeVisible();
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/website-basket-1280.png` });
});
