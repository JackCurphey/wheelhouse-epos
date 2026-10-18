// The job page's "Change details" in a real browser (Jack, 18 Oct,
// docs/decisions/2026-10-18-old-diary-features.md answer 3 and its tablet and
// phone section): beside Close on a computer, in the job's details box on a
// phone, where the pop-up fills the screen; a save changes the job.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jobId: number;
let untimedId: number;
const TUE = '2026-10-13';

test.describe.configure({ timeout: 90_000 });

const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Details Cycles' });
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  await staff('/api/workshop-settings', { method: 'PUT', body: { openingHours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, open: '09:00', close: '18:00' })) } });
  const made = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Brake service', jobDate: TUE, startTime: '10:00', endTime: '11:00', mechanicId: alex } });
  expect(made.status, JSON.stringify(made.body)).toBe(201);
  jobId = made.body.id;
  const untimed = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Puncture repair', jobDate: TUE, mechanicId: null } });
  expect(untimed.status, JSON.stringify(untimed.body)).toBe(201);
  untimedId = untimed.body.id;
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('on a computer, Change details sits beside Close, and a save changes the job', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${TUE}`);
  await page.getByRole('button', { name: /^Bike, Brake service/ }).click();
  const jobPage = page.getByRole('dialog', { name: /Brake service/ });
  const change = jobPage.getByRole('button', { name: 'Change details' });
  await expect(change).toHaveCount(1);
  const close = (await jobPage.getByRole('button', { name: 'Close' }).first().boundingBox())!;
  const box = (await change.boundingBox())!;
  expect(Math.abs(box.y + box.height / 2 - (close.y + close.height / 2))).toBeLessThan(4);
  await change.click();
  const dlg = page.getByRole('dialog', { name: 'Change details' });
  await dlg.getByLabel('End time').fill('12:00');
  await dlg.getByRole('button', { name: 'Save changes' }).click();
  await expect(dlg).toHaveCount(0);
  await expect.poll(async () => (await staff(`/api/workshop-jobs/${jobId}`)).body.endTime).toBe('12:00');
});

test('on a phone, Change details sits in the job\'s details box and the pop-up fills the screen', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  try {
    const [name, value] = owner.cookie.split('=');
    await ctx.addCookies([{ name, value, url: server!.baseUrl }]);
    const page = await ctx.newPage();
    await page.goto(`${server!.baseUrl}/workshop/diary?date=${TUE}`);
    await page.getByRole('button', { name: /^Bike, Brake service/ }).click();
    const jobPage = page.getByRole('dialog', { name: /Brake service/ });
    const details = jobPage.getByRole('region', { name: 'Job details' });
    await expect(jobPage.getByRole('button', { name: 'Change details' })).toHaveCount(1);
    await expect(details.getByRole('button', { name: 'Change details' })).toBeVisible();
    await details.getByRole('button', { name: 'Change details' }).click();
    const dlg = (await page.getByRole('dialog', { name: 'Change details' }).boundingBox())!;
    expect(dlg.width).toBeGreaterThanOrEqual(388);
  } finally {
    await ctx.close();
  }
});

// Fresh review: the real server refused a job with no time ("Start time must
// be in HH:MM format"), and an end time cleared to get the automatic hour.
test('a job with no set time saves; a start with no end gets an hour', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${TUE}`);
  await page.getByRole('group', { name: 'No time' }).getByRole('button', { name: /Puncture repair/ }).click();
  const jobPage = page.getByRole('dialog', { name: /Puncture repair/ });
  await jobPage.getByRole('button', { name: 'Change details' }).click();
  let dlg = page.getByRole('dialog', { name: 'Change details' });
  await dlg.getByLabel('Job title').fill('Puncture and tube');
  await dlg.getByRole('button', { name: 'Save changes' }).click();
  await expect(dlg).toHaveCount(0);
  await expect.poll(async () => (await staff(`/api/workshop-jobs/${untimedId}`)).body.title).toBe('Puncture and tube');
  // The page is named after the new title now.
  await page.getByRole('dialog', { name: /Puncture and tube/ }).getByRole('button', { name: 'Change details' }).click();
  dlg = page.getByRole('dialog', { name: 'Change details' });
  await dlg.getByLabel('Start time').fill('15:00');
  await dlg.getByRole('button', { name: 'Save changes' }).click();
  await expect(dlg).toHaveCount(0);
  await expect.poll(async () => (await staff(`/api/workshop-jobs/${untimedId}`)).body.endTime).toBe('16:00');
});

// Fresh review: in a real browser, Escape in the customer search closes its
// list and leaves the pop-up open.
test('Escape in the customer search closes its list, not Change details', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const made = await staff('/api/customers', { method: 'POST', body: { name: 'Oliver Chen' } });
  expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${TUE}`);
  await page.getByRole('button', { name: /^Bike, Brake service/ }).click();
  await page.getByRole('dialog', { name: /Brake service/ }).getByRole('button', { name: 'Change details' }).click();
  const dlg = page.getByRole('dialog', { name: 'Change details' });
  await dlg.getByLabel('Find customer by name, phone or email').fill('Oli');
  await expect(dlg.getByRole('button', { name: /Oliver Chen/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dlg.getByRole('button', { name: /Oliver Chen/ })).toHaveCount(0);
  await expect(dlg).toBeVisible();
});
