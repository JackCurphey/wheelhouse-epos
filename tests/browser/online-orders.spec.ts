// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { runWithShop, prepare } from '../../server/db.js';

// The staff's Online orders in a real browser, against the real server
// (openspec/changes/website-buy-online group 8; on-orders, on-orders-ready,
// on-order-staff-ready): Mark ready, then Hand over from the order, at
// computer and phone widths with nothing scrolling sideways. Paid orders are
// made straight in the database, as tests/online-orders-staff.test.js makes
// them: paying (group 5) is built separately. Names and amounts are made-up
// test values.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
const tag = () => randomUUID().slice(0, 8);

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const pads = (await staffRequest(server.baseUrl, owner.cookie, '/api/products', { method: 'POST', body: { name: 'Shimano brake pads', sku: 'B05S-RX', category: '[Category]', supplier: '[Supplier]', price: 15, cost: 7, stockQty: 6 } })).body;
  await runWithShop(owner.shop.id, async () => {
    const { id: site } = await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get();
    let number = 900;
    for (const name of ['Maya Patel', '[Customer]']) {
      number += 1;
      const order = await prepare(
        `INSERT INTO online_orders (site_id, name, email, phone, total_pence, card_pence, credit_pence, order_code, request_key_hash, number, paid_at, stage)
         VALUES (?, ?, ?, '07700 900123', 1500, 1500, 0, ?, ?, ?, now(), 'to_get_ready') RETURNING id`,
      ).get(site, name, `order-${tag()}@example.test`, `code-${tag()}`, `key-${tag()}`, number);
      await prepare('INSERT INTO online_order_lines (order_id, product_id, qty, unit_pence) VALUES (?, ?, 1, 1500)').run(order.id, pads.id);
    }
  });
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

const sideways = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [width, height, label, who] of [[1280, 900, 'computer', 'Maya Patel'], [375, 812, 'phone', '[Customer]']] as const) {
  test(`Mark ready, then Hand over from the order, on a ${label}`, async ({ page, context }) => {
    await page.setViewportSize({ width, height });
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/orders`);
    await expect(page.getByRole('heading', { name: /^To get ready · \d$/ })).toBeVisible();
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: `Mark ${who}’s order ready` }).click();
    await expect(page.getByText(`Ready. The email goes to ${who} in 10 seconds`)).toBeVisible();
    const ready = page.getByRole('list', { name: /^Ready to collect · / });
    await ready.getByRole('button', { name: `Hand over ${who}’s order` }).click();
    const box = page.getByRole('dialog', { name: new RegExp(`· ${who.replace(/[[\]]/g, '\\$&')}$`) });
    await expect(box.getByText('Shimano brake pads')).toBeVisible();
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    await box.getByRole('button', { name: 'Hand over' }).click();
    await expect(box).toBeHidden();
    await expect(page.getByText(`Handed over ${who}’s order`)).toBeVisible();
    await expect(page.getByRole('list', { name: /^Collected · / }).getByRole('button', { name: `Open ${who}’s order` })).toBeVisible();
  });
}
