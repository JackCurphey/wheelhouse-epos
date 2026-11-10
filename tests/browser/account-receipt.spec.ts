// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { runWithShop, prepare } from '../../server/db.js';

// A receipt from the account in a real browser (openspec/changes/finish-account
// task 2.1; ac-receipt, ac-receipt-sent): signed out, the receipt's address goes
// to sign in and comes back with the receipt in front; Email it to me says
// Sent to her address; on a computer and a phone, nothing wider than the screen.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let shop: { id: number; slug: string };

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer({ env: { CUSTOMER_SIGNIN_PROVIDER: 'pretend' } });
  shop = (await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' })).shop;
});

test.afterAll(async () => {
  try {
    if (shop) await deleteTestShop(shop.id);
  } finally {
    if (server) await server.stop();
  }
});

let receiptNo = 40;
for (const [size, viewport] of [['a computer', { width: 1440, height: 900 }], ['a phone', { width: 375, height: 812 }]] as const) {
  test(`on ${size}: the receipt’s address signs her in and opens it; Email it to me`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const email = `maya-receipt-${viewport.width}-${randomUUID().slice(0, 6)}@example.test`;
    // Maya, with her own email, and a till sale of hers.
    const saleId = await runWithShop(shop.id, async () => {
      const c = await prepare("INSERT INTO customers (name, email, email_from_customer, updated_at) VALUES ('Maya Patel', ?, true, now()) RETURNING id").get(email);
      const site = await prepare("INSERT INTO sites (name, code) VALUES ('Bolton', ?) RETURNING id").get(viewport.width > 500 ? 'B' : 'C');
      const till = await prepare('INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, ?, ?, ?) RETURNING id').get(site.id, viewport.width > 500 ? 'B1' : 'C1', 'Till 1', randomUUID());
      const sale = await prepare(
        `INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, received_at, total_pence, vat_pence, customer_id)
         VALUES (?, ?, ?, ?, false, '2026-08-25T09:05:00Z', '2026-08-25T09:05:00Z', 5600, 933, ?) RETURNING id`
      ).get(randomUUID(), till.id, site.id, ++receiptNo, c.id);
      await prepare("INSERT INTO till_sale_lines (till_sale_id, description, qty, unit_price_pence, line_total_pence, vat_rate_bp, vat_pence) VALUES (?, 'Shimano brake pads', 2, 2800, 5600, 2000, 933)").run(sale.id);
      await prepare("INSERT INTO till_sale_payments (till_sale_id, method, amount_pence) VALUES (?, 'card', 5600)").run(sale.id);
      return sale.id;
    });
    const number = `${viewport.width > 500 ? 'B1' : 'C1'}-00${receiptNo}`;

    await page.goto(`${server!.baseUrl}/book/${shop.slug}/account?receipt=till-${saleId}`);
    await expect(page).toHaveURL(new RegExp(`/book/${shop.slug}/sign-in\\?from=`));
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Email me a code' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Enter your code' })).toBeVisible();
    const { code } = await runWithShop(shop.id, () => prepare('SELECT code FROM pretend_signin_codes WHERE email = ? AND used_at IS NULL').get(email));
    await page.getByRole('textbox', { name: 'Your 6-digit code' }).fill(code);
    await expect(page).toHaveURL(new RegExp(`/book/${shop.slug}/account\\?receipt=till-${saleId}$`));

    const box = page.getByRole('dialog', { name: 'Your receipt' });
    await expect(box.getByText(`Receipt ${number}`)).toBeVisible();
    await expect(box.getByText('2 × £28.00')).toBeVisible();
    await expect(box.getByText(`“Email it to me” sends it to ${email}.`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await box.getByRole('button', { name: 'Email it to me' }).click();
    await expect(box.getByText(`Sent to ${email}`)).toBeVisible();
    await box.getByRole('button', { name: 'Close' }).click();
    await expect(box).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/book/${shop.slug}/account$`));

    // The row opens it again; one that isn't hers is "We can’t find that receipt".
    await page.getByRole('button', { name: new RegExp(`${number} · Shimano brake pads`) }).click();
    await expect(box.getByText(`Receipt ${number}`)).toBeVisible();
    await page.goto(`${server!.baseUrl}/book/${shop.slug}/account?receipt=till-999999999`);
    await expect(page.getByText('We can’t find that receipt')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}
