// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { runWithShop, prepare } from '../../server/db.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { stopLink } from '../../server/messaging/stop-codes.js';

// "Stop these" for service reminders, end to end against the real server
// (openspec/changes/stop-reminders; ac-stopped, ac-stopped-on): Maya opens her
// link on a phone, is asked first, presses the button and her reminders stop;
// Turn them back on is a yes from the stop page.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let customerId: number;

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London', viewport: { width: 375, height: 812 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } });
  customerId = (made.body as { id: number }).id;
  await runWithShop(owner.shop.id, () => prepare("UPDATE customers SET service_reminders = true, review_requests = true, reminders_said_yes_at = now(), reminders_said_yes_via = 'booking' WHERE id = ?").run(customerId));
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

const answers = () => runWithShop(owner.shop.id, () => prepare('SELECT service_reminders, reminders_said_yes_via FROM customers WHERE id = ?').get(customerId));

test('Maya stops her service reminders with a press, then turns them back on', async ({ page }) => {
  const link = await runWithShop(owner.shop.id, () => stopLink(server!.baseUrl, owner.shop.slug, customerId));
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Stop service reminders?' })).toBeVisible();
  expect((await answers()).service_reminders, 'opening the link stops nothing').toBe(true);
  await page.getByRole('button', { name: 'Stop service reminders' }).click();
  await expect(page.getByRole('heading', { name: 'Service reminders stopped' })).toBeVisible();
  expect((await answers()).service_reminders).toBe(false);
  await page.getByRole('button', { name: 'Turn them back on' }).click();
  await expect(page.getByRole('heading', { name: 'Service reminders are on again' })).toBeVisible();
  expect(await answers()).toMatchObject({ service_reminders: true, reminders_said_yes_via: 'stop_page' });
});
