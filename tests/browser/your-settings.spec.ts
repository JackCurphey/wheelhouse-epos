// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import type { BrowserContext, Page } from '@playwright/test';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Your settings › Accessibility in a real browser against the real server
// (openspec/changes/your-settings-accessibility; your-settings): Larger text
// makes the app a step larger without widening the page, and Reduce motion
// stops transitions, at a computer's width and a phone's.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000, mode: 'serial' });

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

const settings = (body?: object) => staffRequest(server!.baseUrl, owner.cookie, '/api/your-settings', body ? { method: 'PUT', body } : undefined);

async function signIn(page: Page, context: BrowserContext, path: string) {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}${path}`);
}
const heightOf = async (page: Page, text: string) => (await page.getByText(text, { exact: true }).first().boundingBox())!.height;

test.describe('on a computer', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Larger text from Your settings makes the app a step larger, at once, and is kept', async ({ page, context }) => {
    await settings({ accessibility: { largerText: false, reduceMotion: false } });
    await signIn(page, context, '/workshop/your-settings');
    await expect(page.getByRole('dialog', { name: 'Your settings' })).toBeVisible();
    const before = await heightOf(page, 'Makes text across Wheelhouse a step larger.');
    await page.getByRole('switch', { name: 'Larger text' }).click();
    await expect(page.getByRole('switch', { name: 'Larger text' })).toHaveAttribute('aria-checked', 'true');
    const after = await heightOf(page, 'Makes text across Wheelhouse a step larger.');
    expect(after / before).toBeGreaterThan(1.15);
    expect((await settings()).body.accessibility.largerText).toBe(true);
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog', { name: 'Your settings' })).toHaveCount(0);
    await expect(page.locator('html')).toHaveClass(/wh-larger-text/);
  });

  test('Reduce motion stops transitions that run with it off', async ({ page, context }) => {
    // A colour change that fades, as the app's buttons do (transition-colors).
    const fade = () => page.evaluate(() => {
      const el = document.createElement('button');
      el.className = 'transition-colors';
      document.body.append(el);
      const d = parseFloat(getComputedStyle(el).transitionDuration);
      el.remove();
      return d;
    });
    await settings({ accessibility: { reduceMotion: false } });
    await signIn(page, context, '/workshop/your-settings');
    await page.getByRole('switch', { name: 'Reduce motion' }).waitFor();
    expect(await fade()).toBeGreaterThan(0.05);
    await page.getByRole('switch', { name: 'Reduce motion' }).click();
    await expect(page.locator('html')).toHaveClass(/wh-reduce-motion/);
    expect(await fade()).toBeLessThan(0.001);
  });

});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('with Larger text on, Today is no wider than the screen', async ({ page, context }) => {
    await settings({ accessibility: { largerText: true } });
    await signIn(page, context, '/workshop/today');
    await expect(page.getByRole('region', { name: 'Workshop today' })).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/wh-larger-text/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
