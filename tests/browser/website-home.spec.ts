// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// The customer website's home page in a real browser against the real server
// (openspec/changes/website-browse, task 3.11; drawings site, site-menu,
// wb-home): a visitor with no staff cookie opens /store/<slug>/ on a computer
// and on a phone, sees the published headline, moves between pages, and on
// the phone opens and closes the menu. The browser-coverage rule (#351).
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const setUp = await staffRequest(server.baseUrl, owner.cookie, '/api/website/set-up', { method: 'POST', body: { kind: 'wheelhouse', startWith: 'every', mainColour: '#2A2822' } });
  expect(setUp.status, JSON.stringify(setUp.body)).toBe(200);
  const saved = await staffRequest(server.baseUrl, owner.cookie, '/api/website/parts/headline', { method: 'PUT', body: { text: '[Headline]' } });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  expect((await staffRequest(server.baseUrl, owner.cookie, '/api/website/publish', { method: 'POST' })).status).toBe(200);
  expect((await staffRequest(server.baseUrl, owner.cookie, '/api/website/turn-on', { method: 'POST' })).status).toBe(200);
});

test.afterAll(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  await server?.stop();
});

test('on a computer: the home page, then Shop and back home by the shop’s name', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${server!.baseUrl}/store/${owner.shop.slug}/`);
  await expect(page.getByRole('heading', { level: 1, name: '[Headline]' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Website' });
  await expect(nav.getByRole('link', { name: 'Book a repair' })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search the shop' })).toBeVisible();
  await nav.getByRole('link', { name: 'Shop' }).click();
  await expect(page).toHaveURL(new RegExp(`/store/${owner.shop.slug}/shop$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Shop' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Shop' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('banner').getByRole('link', { name: /North Street Cycles/ }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: '[Headline]' })).toBeVisible();
});

test('on a phone: the menu opens, Esc closes it and gives focus back to the button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${server!.baseUrl}/store/${owner.shop.slug}/`);
  await expect(page.getByRole('heading', { level: 1, name: '[Headline]' })).toBeVisible();
  const open = page.getByRole('button', { name: 'Open menu' });
  await expect(open).toHaveAttribute('aria-expanded', 'false');
  await open.click();
  const close = page.getByRole('button', { name: 'Close menu' });
  await expect(close).toHaveAttribute('aria-expanded', 'true');
  const account = page.getByRole('link', { name: 'Account' });
  await expect(account).toBeVisible();
  // From inside the menu, as a keyboard user would be.
  await account.focus();
  await expect(account).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Account' })).toBeHidden();
});

test('a switched-off address shows that the website isn’t available', async ({ page }) => {
  const res = await page.goto(`${server!.baseUrl}/store/no-such-shop-anywhere/`);
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'This website isn’t available' })).toBeVisible();
});
