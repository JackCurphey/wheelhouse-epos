// Opening the shop with a float check (openspec/changes/opening-float-check;
// opening the shop decisions 2 and 8), in a real browser against the real
// server: the Owner sets the float in Settings › End of day, the first
// cashier in counts it short at the till, and the Owner marks it Seen on Today.
import '../../server/load-env.js';
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
const owners: { cookie: string; shop: { id: number } }[] = [];

test.describe.configure({ timeout: 90_000 });
test.beforeAll(async () => {
  server = await startLiveServer();
});
test.afterAll(async () => {
  try {
    for (const o of owners) await deleteTestShop(o.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`set the float, count it short, and see it on Today at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    // A shop of its own for each width: a shop has one float check a day.
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    owners.push(owner);
    const made = await staffRequest(server!.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    const jo = await staffFreshCookie(made.body.loginId);
    const signIn = async (cookie: string) => {
      await context.clearCookies();
      const [name, value] = cookie.split('=');
      await context.addCookies([{ name, value, url: server!.baseUrl }]);
    };

    // The Owner sets the float.
    await signIn(owner.cookie);
    await page.goto(`${server!.baseUrl}/workshop/settings?room=front-desk`);
    const fold = page.getByRole('button', { name: /^Float/ });
    if ((await fold.getAttribute('aria-expanded')) !== 'true') await fold.click();
    const box = page.getByLabel('Leave this much in the drawer each night');
    await box.fill('150.00');
    await box.blur();
    await expect(page.getByText('Saved.')).toBeVisible();
    await expect(fold).toContainText('£150.00');

    // Jo is first in: the float check, a count, and it's short.
    await signIn(jo);
    await page.goto(`${server!.baseUrl}/workshop/till`);
    const check = page.getByRole('dialog', { name: 'Hello, Jo' });
    await expect(check).toBeVisible();
    await expect(check).toContainText('£150.00');
    // The first day on Wheelhouse: Count it only.
    await expect(check.getByRole('button')).toHaveText(['Count it']);
    await check.getByRole('button', { name: 'Count it' }).click();
    const count = page.getByRole('dialog', { name: 'Count the float' });
    await expect(count.getByRole('button', { name: 'Done counting' })).toBeDisabled();
    await count.getByLabel('Number of £20', { exact: true }).fill('7');
    await count.getByLabel('Number of £5', { exact: true }).fill('1');
    await count.getByRole('button', { name: 'Done counting' }).click();
    const diff = page.getByRole('dialog', { name: 'The float is short' });
    await expect(diff).toContainText('£5.00 short');
    await diff.getByLabel(/Any idea why/).fill('change given wrong');
    await diff.getByRole('button', { name: 'Start the day' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Nothing runs off the side of the page.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // The Owner sees it on Today and marks it Seen.
    await signIn(owner.cookie);
    await page.goto(`${server!.baseUrl}/workshop/today`);
    const line = page.getByRole('listitem').filter({ hasText: 'The float was £5.00 short this morning' });
    await expect(line).toContainText('Counted by Jo Taylor at');
    await expect(line).toContainText('“change given wrong”');
    // The Owner opening the till isn't asked again today.
    await line.getByRole('button', { name: 'Seen' }).click();
    await expect(line).toHaveCount(0);
    await page.goto(`${server!.baseUrl}/workshop/till`);
    await expect(page.getByRole('region', { name: 'Sale' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}

// Chrome lets a page block a dialog's Escape only once without a click in
// between (review, 27 Oct): the float check must still be there after three,
// and still answer.
test('Escape pressed three times leaves the float check open', async ({ page, context }) => {
  const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  owners.push(owner);
  expect((await staffRequest(server!.baseUrl, owner.cookie, '/api/end-of-day-settings', { method: 'PUT', body: { floatPence: 15000 } })).status).toBe(200);
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/till`);
  const check = page.getByRole('dialog', { name: 'Hello, Jack' });
  await expect(check).toBeVisible();
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Escape');
  await expect(check).toBeVisible();
  await check.getByRole('button', { name: 'Count it' }).click();
  await expect(page.getByRole('dialog', { name: 'Count the float' })).toBeVisible();
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Count the float' })).toBeVisible();
});
