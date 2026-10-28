// Giving a PIN at the till (openspec/changes/give-pin-at-till; drawn in
// signin.mjs as till-serving-menu, till-serving-menu-several,
// till-give-pin-pick and till-give-pin), in a real browser against the real
// server: Jack Lewis, the Owner, checked in at the till, gives the till-only
// [Name] their PIN from "Who’s getting a PIN?"; the till goes back to Enter
// your PIN and [Name]'s new PIN checks them in. With only Jo Taylor left
// without a PIN, the menu names her, and closing gives nobody a PIN.
import { randomUUID } from 'node:crypto';
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, checkInAtTill } from '../helpers/staff.js';
import { runWithShop, prepare } from '../../server/db.js';
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

const fits = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`the Owner gives a till-only person their PIN at the till at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    owners.push(owner);
    // Jo Taylor (invited, with a sign-in) and the till-only [Name]: neither has a PIN.
    const jo = await staffRequest(server!.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
    expect(jo.status).toBe(201);
    await runWithShop(owner.shop.id, () => prepare('INSERT INTO employees (name, is_cashier) VALUES (?, 1)').run('[Name]'));
    // Jack has a PIN and is checked in on this browser.
    const { cookie: both, pin: ownerPin } = await checkInAtTill(server!.baseUrl, owner.cookie);
    await context.addCookies(both.split('; ').map((pair) => {
      const at = pair.indexOf('=');
      return { name: pair.slice(0, at), value: pair.slice(at + 1), url: server!.baseUrl };
    }));
    await page.goto(`${server!.baseUrl}/workshop/till`);

    // Serving opens the menu: two people have no PIN.
    const serving = page.getByRole('button', { name: 'Serving: Jack Lewis', exact: true });
    await serving.click();
    const menu = page.getByRole('menu', { name: 'Serving: Jack Lewis' });
    await expect(menu.getByRole('menuitem', { name: 'Switch who’s serving' })).toBeVisible();
    const someone = menu.getByRole('menuitem', { name: 'Give someone their PIN' });
    await expect(someone).toContainText('2 people have no PIN yet');
    expect(await fits(page)).toBe(true);
    await someone.click();

    // Who's getting a PIN? Jo Taylor and [Name], never Jack.
    const pick = page.getByRole('dialog', { name: 'Who’s getting a PIN?' });
    await expect(pick.getByRole('button', { name: /Jo Taylor/ })).toBeVisible();
    await expect(pick.getByRole('button', { name: /Jack Lewis/ })).toHaveCount(0);
    expect(await fits(page)).toBe(true);
    await pick.getByRole('button', { name: /\[Name\]/ }).click();

    // [Name]'s till PIN: read the four digits, keep them.
    const pop = page.getByRole('dialog', { name: '[Name]’s till PIN' });
    await expect(pop).toContainText('Turn the screen to [Name].');
    const words = pop.getByText(/^\[Name\]’s PIN \d \d \d \d$/);
    await expect(words).toHaveCount(1);
    const pin = ((await words.textContent()) ?? '').replace('[Name]’s PIN ', '').replaceAll(' ', '');
    expect(pin).toMatch(/^\d{4}$/);
    await expect(pop.getByRole('button', { name: 'Keep this PIN' })).toBeFocused();
    expect(await fits(page)).toBe(true);
    await pop.getByRole('button', { name: 'Keep this PIN' }).click();

    // Back to Enter your PIN, and [Name]'s PIN checks them in, with no menu.
    await expect(page.getByRole('heading', { name: 'Enter your PIN' })).toBeVisible();
    await expect(page.getByText('No PIN yet?').locator('..')).toHaveText('No PIN yet? Sign in on your phone, or ask the owner or a manager to give you one here.');
    for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
    const theirs = page.getByRole('button', { name: 'Serving: [Name] — switch who’s serving' });
    await expect(theirs).toBeVisible();
    await theirs.click();

    // Jack again: only Jo is left, by name; closing gives nobody a PIN.
    await expect(page.getByRole('heading', { name: 'Enter your PIN' })).toBeVisible();
    for (const d of ownerPin) await page.keyboard.press(d);
    await serving.click();
    const give = page.getByRole('menuitem', { name: 'Give Jo Taylor their PIN' });
    await expect(give).toContainText('Staff · no PIN yet');
    await give.click();
    const hers = page.getByRole('dialog', { name: 'Jo Taylor’s till PIN' });
    await expect(hers.getByText(/^Jo Taylor’s PIN \d \d \d \d$/)).toHaveCount(1);
    await hers.getByRole('button', { name: 'Close without giving a PIN' }).click();
    await expect(hers).toHaveCount(0);
    await expect(serving).toBeVisible();
    await expect(page.getByRole('region', { name: 'Sale' })).toBeVisible();
    const joRow = await runWithShop(owner.shop.id, () => prepare('SELECT pin_hash FROM employees WHERE id = ?').get(jo.body.employeeId));
    expect(joRow.pin_hash).toBeNull();
  });
}
