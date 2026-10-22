// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import type { BrowserContext } from '@playwright/test';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// The staff Messages inbox in a real browser against the real server
// (decision 7; account.mjs inbox(); openspec/changes/messages-inbox): a
// customer's note from their booking page reaches Needs a reply; staff answer
// it on a desktop; on a phone the list comes first, then the conversation.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London' });

function staff(path: string, options?: object) {
  return staffRequest(server!.baseUrl, owner.cookie, path, options);
}
async function noteFrom(name: string, words: string) {
  const customer = (await staff('/api/customers', { method: 'POST', body: { name, phone: '07700 900142' } })).body;
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-05', customerId: customer.id } })).body;
  const code = (await staff(`/api/workshop-jobs/${job.id}/private-link`, { method: 'POST', body: {} })).body.privateLink.split('/booking/')[1];
  const res = await fetch(`${server!.baseUrl}/api/portal/${owner.shop.slug}/booking-links/${code}/notes`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: words }),
  });
  expect(res.status).toBe(201);
  return job;
}

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

async function signIn(context: BrowserContext) {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
}

test('a customer’s note needs a reply; answering it takes it out of the list', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(context);
  await noteFrom('Maya Patel', 'Can you check the back light too?');
  await page.goto(`${server!.baseUrl}/workshop/messages`);
  await expect(page.getByRole('button', { name: 'Needs a reply · 1' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Choose a conversation to read it.')).toBeVisible();
  await page.getByRole('link', { name: 'Needs a reply: Maya Patel' }).click();
  const conv = page.getByRole('region', { name: 'Maya Patel' });
  await expect(conv.getByText('Can you check the back light too?')).toBeVisible();
  await conv.getByRole('textbox', { name: 'Reply', exact: true }).fill('Yes, we’ll check it.');
  await conv.getByRole('button', { name: 'Send reply' }).click();
  await expect(conv.getByText('Sent to Maya by text, with a link to reply on the job’s page.')).toBeVisible();
  await expect(conv.getByText('Yes, we’ll check it.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Needs a reply · 0' })).toBeVisible();
  await expect(page.getByText('Nothing needs a reply. Every conversation is under All.')).toBeVisible();
});

test('on a phone, the list, then the conversation with a way back', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(context);
  await noteFrom('Oliver Chen', 'Is my Brompton ready?');
  await page.goto(`${server!.baseUrl}/workshop/messages`);
  await page.getByRole('link', { name: 'Needs a reply: Oliver Chen' }).click();
  await expect(page.getByRole('navigation', { name: 'Conversations' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Oliver Chen' }).getByText('Is my Brompton ready?')).toBeVisible();
  await page.getByRole('button', { name: /^← Messages · needs a reply/ }).click();
  await expect(page.getByRole('navigation', { name: 'Conversations' })).toBeVisible();
  // Nothing wider than the phone.
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(wide).toBe(false);
});
