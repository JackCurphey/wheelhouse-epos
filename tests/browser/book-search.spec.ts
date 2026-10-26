// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { runWithShop, prepare } from '../../server/db.js';

// The search over a shop's many single jobs, in a real browser at phone width
// (openspec/changes/booking-search-unavailable; bk-service-many).
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let shop: { id: number; slug: string };

const JOBS = ['Brake bleed', 'Brake pads fitted', 'Puncture repair', 'Gear tune', 'Chain fitted', 'Wheel true', 'Headset service', 'Bottom bracket service', 'Tubeless set-up'];

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer();
  shop = (await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' })).shop;
  await runWithShop(shop.id, async () => {
    for (const name of JOBS) {
      await prepare("INSERT INTO workshop_services (name, price, price_pence, minutes, bookable_online, active, updated_at) VALUES (?, 20, 2000, 30, 1, 1, now())").run(name);
    }
  });
});

test.afterAll(async () => {
  try {
    if (shop) await deleteTestShop(shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('on a phone: typing narrows the single jobs, and a tick survives the search', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${server!.baseUrl}/book/${shop.slug}/services`);
  const box = page.getByRole('searchbox', { name: 'Search the individual services' });
  await expect(box).toHaveAttribute('placeholder', `Search ${JOBS.length} individual services — like “brakes” or “puncture”`);
  await page.getByRole('button', { name: /^Wheel true/ }).click();
  await box.fill('brake');
  await expect(page.getByRole('button', { name: /^Brake bleed/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Brake pads fitted/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Puncture repair/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Wheel true/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/book-search-375.png` });
  await box.fill('');
  await expect(page.getByRole('button', { name: /^Wheel true/ })).toHaveAttribute('aria-pressed', 'true');
  await box.fill('zzz');
  await expect(page.getByText('No single jobs match “zzz”.')).toBeVisible();
});
