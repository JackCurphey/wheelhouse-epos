// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { seedWorkshopJob } from '../helpers/workshopFixtures.js';
import { runWithShop, prepare } from '../../server/db.js';

// The customer's account in a real browser (openspec/changes/
// customer-account-screens; ac-account): signed out it goes to sign in and
// comes back; her bike and its repair; the repair opens its page; on a
// computer two columns, on a phone one, with nothing wider than the screen.
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

for (const [size, viewport] of [['a computer', { width: 1440, height: 900 }], ['a phone', { width: 375, height: 812 }]] as const) {
  test(`on ${size}: sign in from the account, her bike and repair, and the repair opens`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const email = `maya-account-${viewport.width}@example.test`;
    await page.goto(`${server!.baseUrl}/book/${shop.slug}/account`);
    await expect(page).toHaveURL(new RegExp(`/book/${shop.slug}/sign-in\\?from=`));
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Email me a code' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Enter your code' })).toBeVisible();
    const { code } = await runWithShop(shop.id, () => prepare('SELECT code FROM pretend_signin_codes WHERE email = ? AND used_at IS NULL').get(email));
    await page.getByRole('textbox', { name: 'Your 6-digit code' }).fill(code);
    await expect(page).toHaveURL(new RegExp(`/book/${shop.slug}/account$`));
    await expect(page.getByText(/^Nothing here yet. Your repairs and purchases with North Street Cycles .*show here.$/)).toBeVisible();

    // Her bike, and a repair of it booked.
    const { jobId } = await runWithShop(shop.id, async () => {
      const { customer_id: customerId } = await prepare('SELECT customer_id FROM customer_logins WHERE lower(email) = ?').get(email);
      const { lastInsertRowid: bikeId } = await prepare("INSERT INTO customer_bikes (customer_id, make, model, colour, updated_at) VALUES (?, 'Trek', 'Domane AL 3', 'Green', now())").run(customerId);
      const job = await seedWorkshopJob({ shopId: shop.id, customerId, title: 'Standard service', jobDate: '2026-09-17' });
      await prepare('UPDATE workshop_jobs SET bike_id = ? WHERE id = ?').run(bikeId, job.jobId);
      return job;
    });
    await page.reload();
    const bikes = page.getByRole('region', { name: 'Your bikes' });
    const history = page.getByRole('region', { name: 'History' });
    const details = page.getByRole('region', { name: 'Your details' });
    await expect(bikes.getByText('Trek Domane AL 3 · Green')).toBeVisible();
    const row = history.getByRole('link', { name: /Trek Domane AL 3 · Standard service/ });
    await expect(row).toContainText('Booked in Thu 17 Sep');
    await expect(row).toContainText('Booked');
    await expect(details.getByText('How we contact you')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // A computer: bikes and details on the left, the history beside them. A phone: bikes, history, details, one under the other.
    const [b, h, d] = await Promise.all([bikes.boundingBox(), history.boundingBox(), details.boundingBox()]);
    if (viewport.width > 1000) {
      expect(h!.x).toBeGreaterThan(b!.x + b!.width - 1);
      expect(d!.y).toBeGreaterThan(b!.y + b!.height - 1);
      expect(Math.round(d!.x)).toBe(Math.round(b!.x));
    } else {
      expect(h!.y).toBeGreaterThan(b!.y + b!.height - 1);
      expect(d!.y).toBeGreaterThan(h!.y + h!.height - 1);
    }
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/account-${viewport.width}.png`, fullPage: true });

    await row.click();
    await expect(page).toHaveURL(new RegExp(`/book/${shop.slug}/booking/job-${jobId}$`));
    await expect(page.getByRole('heading', { level: 1, name: /Trek Domane AL 3/ })).toBeVisible();
  });
}

test('Sign out leaves for the booking page, and the account then asks to sign in', async ({ page }) => {
  const email = 'lena-account@example.test';
  await page.goto(`${server!.baseUrl}/book/${shop.slug}/sign-in`);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Enter your code' })).toBeVisible();
  const { code } = await runWithShop(shop.id, () => prepare('SELECT code FROM pretend_signin_codes WHERE email = ? AND used_at IS NULL').get(email));
  await page.getByRole('textbox', { name: 'Your 6-digit code' }).fill(code);
  await expect(page).toHaveURL(new RegExp(`/book/${shop.slug}/account$`));
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(new RegExp(`/book/${shop.slug}$`));
  await page.goto(`${server!.baseUrl}/book/${shop.slug}/account`);
  await expect(page).toHaveURL(new RegExp(`/book/${shop.slug}/sign-in\\?from=`));
});
