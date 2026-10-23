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

test('unfolded over the diary, the menu is on top: its links work, and tapping the page folds it', async ({ page, context }) => {
  const made = await staffRequest(server!.baseUrl, owner.cookie, '/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-09-02', startTime: '10:00', endTime: '11:00' } });
  expect(made.status, JSON.stringify(made.body)).toBe(201);
  await folded(true);
  await signIn(page, context, '/workshop/diary?date=2026-09-02');
  await expect(page.locator('[title*="Standard service"]').first()).toBeVisible();
  await page.getByRole('button', { name: 'Unfold the menu' }).click();
  await expect(panel(page)).toBeVisible();
  // What's at a point inside the menu is the menu, not the diary under it.
  const box = (await panel(page).boundingBox())!;
  // Down its right-hand edge, where it lies over the diary's columns, headings and footer.
  const under = await page.evaluate(([x, top, h]) => {
    const missed = [];
    for (let y = top + 10; y < top + h - 10; y += 20) if (!document.elementFromPoint(x, y)?.closest('nav[data-unfolded]')) missed.push(y);
    return missed;
  }, [box.x + box.width - 12, box.y, box.height]);
  expect(under).toEqual([]);
  // Tapping the page beside it folds it.
  await page.mouse.click(1200, 600);
  await expect(panel(page)).toBeHidden();
  await page.getByRole('button', { name: 'Unfold the menu' }).click();
  await panel(page).getByRole('link', { name: 'Today' }).click();
  await expect(page).toHaveURL(/\/workshop\/today/);
  await folded(false);
});

test.describe('on a tablet', () => {
  test.use({ viewport: { width: 900, height: 1180 }, hasTouch: true });

  test('the rail’s Unfold puts the menu on top of the diary', async ({ page, context }) => {
    await signIn(page, context, '/workshop/diary?date=2026-09-02');
    await expect(page.locator('[title*="Standard service"]').first()).toBeVisible();
    await page.getByRole('button', { name: 'Unfold the menu' }).click();
    await expect(panel(page)).toBeVisible();
    const box = (await panel(page).boundingBox())!;
    const under = await page.evaluate(([x, top, h]) => {
      const missed = [];
      for (let y = top + 10; y < top + h - 10; y += 20) if (!document.elementFromPoint(x, y)?.closest('nav[data-unfolded]')) missed.push(y);
      return missed;
    }, [box.x + box.width - 12, box.y, box.height]);
    expect(under).toEqual([]);
  });
});
