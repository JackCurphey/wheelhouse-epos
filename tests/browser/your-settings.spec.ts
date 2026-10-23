// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import type { BrowserContext, Page } from '@playwright/test';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Your settings › Accessibility in a real browser against the real server
// (openspec/changes/your-settings-accessibility; your-settings): Reduce motion
// stops transitions, and the pop-up fits a phone.
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

test.describe('on a computer', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

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

  test('Show status symbols puts the status’s shape in a week block’s top-right corner', async ({ page, context }) => {
    const made = await staffRequest(server!.baseUrl, owner.cookie, '/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-09-02', startTime: '10:00', endTime: '11:00' } });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    await settings({ accessibility: { statusSymbols: true, reduceMotion: false } });
    await signIn(page, context, '/workshop/diary?date=2026-09-02');
    const shape = page.locator('[title*="Standard service"] [data-status-shape]').first();
    await expect(shape).toBeVisible();
    const [s, b] = [await shape.boundingBox(), await page.locator('[title*="Standard service"]').first().boundingBox()];
    expect(s!.x + s!.width).toBeLessThanOrEqual(b!.x + b!.width);
    expect(s!.x).toBeGreaterThan(b!.x + b!.width / 2);
    expect(s!.y - b!.y).toBeLessThan(8);
    await settings({ accessibility: { statusSymbols: false } });
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Your settings fills the phone, no wider than the screen', async ({ page, context }) => {
    await signIn(page, context, '/workshop/your-settings');
    await expect(page.getByRole('switch', { name: 'Reduce motion' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const box = await page.getByRole('dialog', { name: 'Your settings' }).boundingBox();
    expect(box!.width).toBeGreaterThan(380);
  });

});
