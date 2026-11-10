// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { runWithShop, prepare } from '../../server/db.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Changing the account's email, end to end against the real server
// (openspec/changes/finish-account design 6; Jack, 9 Nov, answer 3): Maya
// signs in, opens Edit your details, types a new email, enters the code sent
// to it, and her account shows the new email; her record has it too.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let mayaId: number;
const email = `maya-${randomUUID().slice(0, 8)}@example.test`;
const next = `m.patel-${randomUUID().slice(0, 8)}@example.test`;

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London', viewport: { width: 375, height: 812 } });

test.beforeAll(async () => {
  server = await startLiveServer({ env: { CUSTOMER_SIGNIN_PROVIDER: 'pretend' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/customers', { method: 'POST', body: { name: 'Maya Patel', email, phone: '07700 900142' } });
  mayaId = made.body.id;
  await runWithShop(owner.shop.id, () => prepare('UPDATE customers SET email_from_customer = true WHERE id = ?').run(mayaId));
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

const codeFor = (to: string) => runWithShop(owner.shop.id, async () => (await prepare('SELECT code FROM pretend_signin_codes WHERE email = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1').get(to))?.code as string);

test('Maya changes her email with a code sent to the new one', async ({ page }) => {
  await page.goto(`${server!.baseUrl}/book/${owner.shop.slug}/sign-in?from=${encodeURIComponent(`/book/${owner.shop.slug}/account`)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByRole('heading', { name: 'Enter your code' })).toBeVisible();
  await page.getByLabel('Your 6-digit code').fill(await codeFor(email));
  await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit your details' }).click();
  const box = page.getByRole('dialog', { name: 'Edit your details' });
  await box.getByLabel('Email').fill(next);
  await box.getByRole('button', { name: 'Save' }).click();
  await expect(box.getByText(`We sent a code to ${next}. It works for 10 minutes.`)).toBeVisible();
  await box.getByLabel('Your 6-digit code').fill(await codeFor(next));
  await box.getByRole('button', { name: 'Confirm' }).click();
  await expect(box.getByText(`Your email is now ${next}. Use it to sign in from now on.`)).toBeVisible();
  await box.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('region', { name: 'Your details' }).getByText(next)).toBeVisible();
  const row = await runWithShop(owner.shop.id, () => prepare('SELECT email FROM customers WHERE id = ?').get(mayaId));
  expect(row.email).toBe(next);
});
