// Who's in and Tills on Today, and "Your till PIN" by itself
// (openspec/changes/whos-in-and-first-pin; op-today, op-today-staff,
// op-today-late, pin-first), in a real browser against the real server: Jo
// Taylor checks in at the till, so the Owner's Today shows the till open and
// Jo in, and Alex Morgan, a mechanic due today, late. Jo's first sign-in
// opens Your till PIN by itself; after Skip for now it doesn't come back.
import { randomUUID } from 'node:crypto';
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, seedMechanic, checkInWithPin } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
const owners: { cookie: string; shop: { id: number } }[] = [];
// The server's day is the test clock's, Tuesday 1 September 2026; the page's clock is late that morning.
const LATE_MORNING = new Date('2026-09-01T11:30:00+01:00');

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London' });
test.beforeAll(async () => { server = await startLiveServer(); });
test.afterAll(async () => {
  try {
    for (const o of owners) await deleteTestShop(o.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

const asCookies = (cookie: string) => cookie.split('; ').map((pair) => {
  const at = pair.indexOf('=');
  return { name: pair.slice(0, at), value: pair.slice(at + 1), url: server!.baseUrl };
});
const fits = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function shopWithJo() {
  const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  owners.push(owner);
  await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  const made = await staffRequest(server!.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  expect(made.status).toBe(201);
  return { owner, jo: await staffFreshCookie(made.body.loginId) };
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`the Owner's Today shows the till open, Jo in and Alex late at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const { owner, jo } = await shopWithJo();
    // Jo gets a PIN and checks in on the Owner's till.
    const offer = await staffRequest(server!.baseUrl, jo, '/api/your-settings/till-pin/offer', { method: 'POST' });
    expect((await staffRequest(server!.baseUrl, jo, '/api/your-settings/till-pin', { method: 'POST', body: { pin: offer.body.pin } })).status).toBe(200);
    await checkInWithPin(server!.baseUrl, owner.cookie, offer.body.pin);

    await context.addCookies(asCookies(owner.cookie));
    await page.clock.setFixedTime(LATE_MORNING);
    await page.goto(`${server!.baseUrl}/workshop/today`);
    const who = page.getByRole('region', { name: 'Who’s in' });
    await expect(who.getByRole('listitem').filter({ hasText: 'Jo Taylor' })).toContainText(/Checked in at \d\d:\d\d · Staff/);
    await expect(who.getByRole('listitem').filter({ hasText: 'Jo Taylor' })).toContainText('In');
    await expect(who.getByRole('listitem').filter({ hasText: 'Alex Morgan' })).toContainText(/Due in at \d\d:\d\d · MechanicLate/);
    const tills = page.getByRole('region', { name: 'Tills' });
    await expect(tills.getByRole('listitem')).toContainText(/TillOpen · Jo Taylor checked in at \d\d:\d\d/);
    // Nothing about PINs on Today.
    expect(await page.getByRole('main').textContent()).not.toMatch(/PIN/);
    expect(await fits(page)).toBe(true);
  });
}

test('Jo\'s first sign-in opens Your till PIN by itself; Skip for now and it doesn\'t come back', async ({ page, context }) => {
  const { jo } = await shopWithJo();
  await context.addCookies(asCookies(jo));
  await page.goto(`${server!.baseUrl}/workshop/today`);
  const pop = page.getByRole('dialog', { name: 'Your till PIN' });
  await expect(pop).toContainText(/Welcome to North Street Cycles[^,]*, Jo\./);
  await expect(pop.getByText(/^New PIN \d \d \d \d$/)).toHaveCount(1);
  await expect(pop.getByRole('button', { name: 'Keep this PIN' })).toBeFocused();
  // No ✕, and Escape doesn't close it.
  await page.keyboard.press('Escape');
  await expect(pop).toBeVisible();
  await pop.getByRole('button', { name: 'Skip for now' }).click();
  await expect(pop).toHaveCount(0);
  await expect(page).toHaveURL(/\/workshop\/today$/);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Who’s in' })).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.getByRole('dialog', { name: 'Your till PIN' })).toHaveCount(0);
});
