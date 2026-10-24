// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Merge in a real browser (openspec/changes/customer-merge; cs-page-dup,
// cs-merge): two Mayas flagged, merged into one with her jobs together, and
// the merge undone.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let maya: { id: number };
let twinJob: { reference: string };

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142', email: 'maya@example.com' } })).body;
  const twin = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya P.', phone: '07700 900142' } })).body;
  twinJob = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Gear tune', jobDate: '2026-09-20', customerId: twin.id } })).body;
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('Check, Merge into one, her history together, then Undo the merge', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/customers/${maya.id}`);
  await expect(page.getByText('Might be the same person as Maya P.')).toBeVisible();
  await page.getByRole('button', { name: 'Check' }).click();
  const dialog = page.getByRole('dialog', { name: 'The same person?' });
  await expect(dialog.getByText('Only what’s different is shown. Both have 07700 900142.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Merge into one' }).click();
  await expect(dialog).toHaveCount(0);
  const history = page.getByRole('region', { name: 'History' });
  await expect(history.getByRole('link', { name: new RegExp(twinJob.reference) })).toBeVisible();
  await expect(page.getByText(/Merged with Maya P\. on .* · can be undone until/)).toBeVisible();
  await page.getByRole('button', { name: 'Undo the merge' }).click();
  await expect(history.getByRole('link', { name: new RegExp(twinJob.reference) })).toHaveCount(0);
  await expect(page.getByText('Might be the same person as Maya P.')).toBeVisible();
});
