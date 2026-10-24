// "Save to a customer record" from the till's Email receipt, against the real
// server (decision 3, 2 Oct leftover screens; drawn as cp-receipt-address-save;
// openspec/changes/till-save-customer): ticked, the receipt goes, then Add a
// customer saves who was typed, offers only if they said yes.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { runWithShop, prepare } from '../../server/db.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jo: { cookie: string };

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });
const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' } });
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  expect((await staff('/api/workshop-services', { method: 'POST', body: { name: 'Fit & adjust brakes', price: 18, minutes: 30 } })).status).toBe(201);
});
test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('ticked: the receipt goes, then Add a customer saves Maya, with no offers', async ({ page, context }) => {
  const [name, value] = jo.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/till`);
  await page.getByRole('button', { name: /^Fit & adjust brakes/ }).click();
  await page.getByRole('region', { name: 'Sale' }).getByRole('button', { name: 'Take payment · £18.00' }).click();
  const pay = page.getByRole('dialog').first();
  await pay.getByRole('button', { name: /^Card · £18.00/ }).click();
  await pay.getByRole('button', { name: 'Card approved' }).click();
  await pay.getByRole('button', { name: 'Email' }).click();
  const email = page.getByRole('dialog', { name: 'Email the receipt' });
  await email.getByLabel('Email address').fill('maya@example.test');
  await email.getByRole('checkbox', { name: /Save to a customer record/ }).check();
  await email.getByRole('button', { name: 'Send receipt' }).click();
  const add = page.getByRole('dialog', { name: 'Add a customer' });
  await expect(add.getByText('Receipt sent to maya@example.test')).toBeVisible();
  await expect(add.getByLabel('Name')).toBeFocused();
  await add.getByLabel('Name').fill('Maya Patel');
  if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/till-save-customer.png` });
  await add.getByRole('button', { name: 'Add the customer' }).click();
  await expect(page.getByRole('region', { name: 'Sale' }).getByText('Nothing in the sale yet')).toBeVisible();
  const saved = await runWithShop(owner.shop.id, () => prepare("SELECT name, email, marketing_permission FROM customers WHERE email = 'maya@example.test'").get());
  expect(saved).toMatchObject({ name: 'Maya Patel', email: 'maya@example.test' });
  expect(Boolean(saved.marketing_permission)).toBe(false);
});
