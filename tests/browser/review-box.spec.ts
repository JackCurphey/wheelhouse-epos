// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer, TEST_CLOCK_PIN } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// The review request's box, end to end (openspec/changes/review-box;
// ac-review-first, ac-review-setting): the Owner adds the shop's review page,
// chooses the days, switches review requests on and saves.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
const PAGE = 'https://g.page/r/north-street-cycles/review';

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London', viewport: { width: 1440, height: 1000 } });

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

test('the Owner switches review requests on with the shop’s review page', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));
  await page.goto(`${server!.baseUrl}/workshop/settings?room=front-desk&fold=automatic-messages`);
  await page.getByRole('button', { name: 'Edit the wording of Review request' }).click();
  const box = page.getByRole('dialog', { name: 'Review request' });
  await expect(box.getByRole('switch', { name: 'Send review requests' })).toBeDisabled();
  await expect(box.getByText('Add your review page first, then switch this on.')).toBeVisible();
  await box.getByRole('textbox', { name: 'Your review page' }).fill(PAGE);
  await box.getByRole('textbox', { name: /Send it/ }).fill('3');
  await box.getByRole('switch', { name: 'Send review requests' }).click();
  await expect(box.getByText(/Stop these: \[link\]\.$/)).toBeVisible();
  await box.getByRole('button', { name: 'Save' }).click();
  await expect(box).toHaveCount(0);
  const settings = (await staffRequest(server!.baseUrl, owner.cookie, '/api/workshop-settings')).body as { reviewPageUrl: string; reviewRequestDays: number };
  expect([settings.reviewPageUrl, settings.reviewRequestDays]).toEqual([PAGE, 3]);
  const list = (await staffRequest(server!.baseUrl, owner.cookie, '/api/message-templates')).body as { key: string; enabled: boolean }[];
  expect(list.find((t) => t.key === 'review_request')?.enabled).toBe(true);
});
