// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Customers' list and Add in a real browser (openspec/changes/customers-list;
// cs-list, cs-add-match): the recent list, and a customer caught before
// they're added twice.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  await staffRequest(server.baseUrl, owner.cookie, '/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } });
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('the recent list, and Add a customer catching a number that’s already a customer’s', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/customers`);
  await expect(page.getByRole('list', { name: 'Recent customers' }).getByRole('link', { name: /Maya Patel/ })).toBeVisible();
  await page.getByRole('button', { name: '+ Add a customer' }).click();
  const add = page.getByRole('dialog', { name: 'Add a customer' });
  await add.getByLabel('Phone').fill('+44 7700 900142');
  await expect(add.getByText('Maya Patel already has this number')).toBeVisible();
});
