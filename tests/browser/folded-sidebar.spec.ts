// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import type { BrowserContext, Page } from '@playwright/test';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Folded sidebar in a real browser (openspec/changes/folded-sidebar; app map
// review 4, 5, 7): on a computer the Till is folded to the 84px rail, the full
// sidebar opens over the page after resting on the rail and with Unfold, and
// the switch folds every page.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000, mode: 'serial' });
test.use({ viewport: { width: 1440, height: 900 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

const folded = (on: boolean) => staffRequest(server!.baseUrl, owner.cookie, '/api/your-settings', { method: 'PUT', body: { accessibility: { foldedSidebar: on } } });
async function signIn(page: Page, context: BrowserContext, path: string) {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}${path}`);
}
const panel = (page: Page) => page.locator('nav[data-unfolded]');

test('the Till is folded to the rail; resting on it opens the full sidebar over the till, and moving away folds it', async ({ page, context }) => {
  await folded(false);
  await signIn(page, context, '/workshop/till');
  const rail = page.getByRole('navigation', { name: 'Main, folded' });
  await expect(rail).toBeVisible();
  expect((await rail.boundingBox())!.width).toBeCloseTo(84, 0);
  await expect(panel(page)).toBeHidden();
  await rail.getByRole('link', { name: 'Diary' }).hover();
  await expect(panel(page)).toBeVisible();
  await page.mouse.move(1200, 500);
  await expect(panel(page)).toBeHidden();
  await rail.getByRole('button', { name: 'Unfold the menu' }).click();
  await expect(panel(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel(page)).toBeHidden();
});

test('other pages keep the full sidebar, until Folded sidebar is on', async ({ page, context }) => {
  await folded(false);
  await signIn(page, context, '/workshop/today');
  await expect(page.locator('nav[aria-label="Main"]:not([data-unfolded])')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main, folded' })).toBeHidden();
  await folded(true);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main, folded' })).toBeVisible();
  await expect(page.locator('nav[aria-label="Main"]:not([data-unfolded])')).toHaveCount(0);
  await folded(false);
});
