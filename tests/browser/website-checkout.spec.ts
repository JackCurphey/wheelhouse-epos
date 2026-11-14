// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { connectPayments } from '../helpers/payments.js';
import { runWithShop, prepare } from '../../server/db.js';

// Checkout up to where paying starts, in a real browser against the real
// server (openspec/changes/website-buy-online, task 12.6; drawings on-checkout
// and on-checkout-errors): from the basket to checkout, the order priced by
// the server, the boxes' messages from the server, the terms over the page,
// and the server's "not ready yet" beside Pay, which on a phone stays in a bar
// along the bottom. Payments are connected with the pretend provider; no real
// account, and nothing is paid: paying comes in a later pull request.
// Example data from the drawings: Shimano brake pads B05S-RX at £28.00,
// Bolton, Maya Patel, maya@example.test and 07700 900 142; "[Brake lever]"
// stands in for the drawing's second line.
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

const toCheckout = async (page: import('@playwright/test').Page) => {
  const store = `${server!.baseUrl}/store/${owner.shop.slug}`;
  await page.goto(`${store}/products/${P.pads}`);
  await page.getByRole('button', { name: 'Add to basket' }).click();
  await expect(page.getByRole('link', { name: 'Basket, 1 item' }).first()).toBeAttached();
  await page.goto(`${store}/basket`);
  await page.getByRole('link', { name: 'Go to checkout' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Your order' })).toBeVisible();
};

test('on a phone: the order at the top, Pay in a bar along the bottom, and the server’s “not ready yet” beside it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await toCheckout(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const order = page.getByRole('region', { name: 'Your order' });
  await expect(order.locator('dl > div:last-child dd')).toHaveText('£28.00');
  const pay = page.getByRole('button', { name: 'Pay £28.00' });
  const bar = (await page.locator('[data-pay-bar]').boundingBox())!;
  expect(Math.round(bar.y + bar.height)).toBe(844);
  expect((await pay.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // The order comes before How you'll get it on a phone.
  const orderTop = (await order.boundingBox())!.y;
  expect(orderTop).toBeLessThan((await page.getByRole('heading', { name: 'How you’ll get it' }).boundingBox())!.y);

  await page.getByRole('textbox', { name: 'Name' }).fill('Maya Patel');
  await page.getByRole('textbox', { name: 'Phone' }).fill('07700 900 142');
  await page.getByRole('textbox', { name: 'Email' }).fill('maya@example.test');
  // A box the keyboard moves to isn't left under the bar.
  await page.getByRole('textbox', { name: 'Phone' }).focus();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Email' })).toBeFocused();
  const email = (await page.getByRole('textbox', { name: 'Email' }).boundingBox())!;
  expect(email.y + email.height).toBeLessThanOrEqual((await page.locator('[data-pay-bar]').boundingBox())!.y);
  await pay.click();
  await expect(page.locator('[data-pay-bar]').getByRole('alert')).toHaveText('Paying online isn’t ready yet');
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/website-checkout-390.png` });
});

test('on a computer: the boxes’ messages from the server, then the terms over the page keep what was typed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await toCheckout(page);
  await page.getByRole('textbox', { name: 'Phone' }).fill('07700 900 142');
  await page.getByRole('textbox', { name: 'Email' }).fill('maya@example');
  await page.getByRole('button', { name: 'Pay £28.00' }).click();
  await expect(page.locator('div[tabindex="-1"]', { hasText: /^Check the 2 boxes marked below\.$/ })).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription('Enter your name');
  await expect(page.getByRole('textbox', { name: 'Email' })).toHaveAttribute('aria-invalid', 'true');

  await page.getByRole('textbox', { name: 'Name' }).fill('Maya Patel');
  await page.getByRole('button', { name: 'terms' }).click();
  const dialog = page.getByRole('dialog', { name: 'Collection and returns' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Maya Patel');
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/website-checkout-1280.png` });
});
