// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// The cookie banner on a phone in a real browser against the real server
// (openspec/changes/website-browse, task 8.8; drawing wb-cookies-banner at
// phone size): a shop that added Google Analytics asks first; the banner is
// fixed to the bottom, full width, two buttons to a row; nothing from Google
// is asked for until Accept all, and the choice is kept for the next page.
// Google is never really reached: every request to it is stopped here and
// only counted. The tag ID is a test value, not a real account's.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
const TEST_TAG = 'G-TEST';

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const call = (path: string, method: string, body?: unknown) => staffRequest(server!.baseUrl, owner.cookie, path, { method, body });
  const setUp = await call('/api/website/set-up', 'POST', { kind: 'wheelhouse', startWith: 'every', mainColour: '#2A2822' });
  expect(setUp.status, JSON.stringify(setUp.body)).toBe(200);
  const tool = await call('/api/website/tracking/google_analytics', 'PUT', { on: true, id: TEST_TAG });
  expect(tool.status, JSON.stringify(tool.body)).toBe(200);
  expect((await call('/api/website/publish', 'POST')).status).toBe(200);
  expect((await call('/api/website/turn-on', 'POST')).status).toBe(200);
});

test.afterAll(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  await server?.stop();
});

test('on a phone: the cookie banner sits at the bottom, full width, and Google loads only after Accept all', async ({ page, context }) => {
  const asked: string[] = [];
  await context.route(/googletagmanager\.com/, (route) => { asked.push(route.request().url()); return route.abort(); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${server!.baseUrl}/store/${owner.shop.slug}/`);

  const banner = page.getByRole('region', { name: 'Cookie choices' });
  await expect(banner).toBeVisible();
  await expect(banner.getByRole('heading', { level: 2, name: 'Cookies on this website' })).toBeVisible();
  await expect(banner).toContainText('we’d also like to use Google Analytics');
  const box = (await banner.boundingBox())!;
  expect(box.x).toBe(0);
  expect(box.width).toBe(390);
  expect(Math.round(box.y + box.height)).toBe(844);
  // Two to a row: Reject all and Accept all side by side, Choose below.
  const reject = (await banner.getByRole('button', { name: 'Reject all' }).boundingBox())!;
  const accept = (await banner.getByRole('button', { name: 'Accept all' }).boundingBox())!;
  const choose = (await banner.getByRole('button', { name: 'Choose' }).boundingBox())!;
  expect(accept.y).toBe(reject.y);
  expect(accept.x).toBeGreaterThan(reject.x);
  expect(choose.y).toBeGreaterThan(reject.y);
  for (const b of [reject, accept, choose]) expect(b.height).toBeGreaterThanOrEqual(44);
  expect(asked, 'nothing from Google before the visitor says yes').toEqual([]);

  await banner.getByRole('button', { name: 'Accept all' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your cookie choices are saved' })).toBeVisible();
  await expect(banner).toHaveCount(0);
  await expect.poll(() => asked.length).toBeGreaterThan(0);
  expect(asked[0]).toBe(`https://www.googletagmanager.com/gtm.js?id=${TEST_TAG}`);
  const kept = (await context.cookies()).find((c) => c.name === 'wh_cookies');
  expect(kept?.value).toBe('measuring-on.advertising-on');

  // The next page: no banner, and Cookie choices at the bottom instead.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(banner).toHaveCount(0);
  await expect(page.getByRole('contentinfo').getByRole('button', { name: 'Cookie choices' })).toBeVisible();
});
