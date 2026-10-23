// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import type { BrowserContext } from '@playwright/test';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { runWithShop, prepare } from '../../server/db.js';

// Office › Today in a real browser against the real server
// (openspec/changes/today-page; op-today): the quote with no answer in Needs
// attention opening its job, Book in in Workshop today, and the cards in two
// columns on a computer, one on a phone with Needs attention first.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let due: { id: number; reference: string };
let quoted: { id: number; reference: string };
// The server's day is the test clock's, Tuesday 1 September 2026; the page's
// clock is 09:30 that morning.
const TODAY = '2026-09-01';
const NOW = new Date('2026-09-01T08:30:00Z');

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London' });

function staff(path: string, options?: object) {
  return staffRequest(server!.baseUrl, owner.cookie, path, options);
}

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  const maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  const made = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: TODAY, startTime: '09:00', endTime: '10:00', mechanicId: alex, customerId: maya.id } });
  expect(made.status, JSON.stringify(made.body)).toBe(201);
  due = made.body;
  // A quote sent and reminded with no answer, on another day's job.
  const jamie = (await staff('/api/customers', { method: 'POST', body: { name: 'Jamie Brooks', phone: '07700 900300' } })).body;
  quoted = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Gear adjustment', jobDate: '2026-09-03', customerId: jamie.id } })).body;
  const q = (await staff(`/api/workshop-jobs/${quoted.id}/quotes`, { method: 'POST', body: { lines: [{ kind: 'part', description: 'Shimano brake pads', unitAmount: 28, need: 'needed', reason: 'Rear pads worn' }] } })).body;
  expect((await staff(`/api/quotes/${q.id}/send`, { method: 'POST', body: {} })).status).toBe(200);
  // As the sender does when the reminder goes (needs-attention.test.js).
  await runWithShop(owner.shop.id, () => prepare("UPDATE customer_messages SET sent_at = now() WHERE job_id = ? AND template_key = 'quote_reminder'").run(quoted.id));
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

async function openToday(page: import('@playwright/test').Page, context: BrowserContext) {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.clock.setFixedTime(NOW);
  await page.goto(`${server!.baseUrl}/workshop/today`);
  await expect(page.getByText(/^Tuesday 1 September · North Street Cycles/)).toBeVisible();
}

test.describe('on a computer', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('two columns; Book in; Record their answer opens the job', async ({ page, context }) => {
    await openToday(page, context);
    const attention = page.getByRole('region', { name: 'Needs attention · 1' });
    const work = page.getByRole('region', { name: 'Workshop today' });
    await expect(attention).toContainText(`${quoted.reference} · Jamie Brooks — no answer to the quote yet`);
    await expect(attention.getByRole('link', { name: '07700 900300' })).toHaveAttribute('href', 'tel:07700900300');
    const [a, w] = [await attention.boundingBox(), await work.boundingBox()];
    expect(a!.x).toBeLessThan(w!.x);
    expect(Math.abs(a!.y - w!.y)).toBeLessThan(2);

    await expect(work).toContainText('1 still to arrive');
    await work.getByRole('button', { name: `Book in ${due.reference}` }).click();
    await expect(work).toContainText('0 still to arrive');
    expect((await staff(`/api/workshop-jobs/${due.id}`)).body.custodyState).toBe('in_shop');

    await attention.getByRole('link', { name: 'Record their answer' }).click();
    await expect(page).toHaveURL(new RegExp(`/workshop/diary\\?job=${quoted.id}`));
    await expect(page.getByRole('dialog', { name: /Gear adjustment/ })).toBeVisible();
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('one column, Needs attention first, nothing wider than the screen', async ({ page, context }) => {
    await openToday(page, context);
    const [a, w] = [await page.getByRole('region', { name: /^Needs attention/ }).boundingBox(), await page.getByRole('region', { name: 'Workshop today' }).boundingBox()];
    expect(a!.y + a!.height).toBeLessThanOrEqual(w!.y);
    expect(Math.abs(a!.x - w!.x)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
