// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, tillCookies } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Ways to pay's Cash card and Other ways to pay in a real browser
// (openspec/changes/owner-setup-till-payments-eod, task 5.3; set-pay-ways, set-pay-other;
// Jack's answer 3): the Owner sees Cash always on, adds Bank transfer and removes and puts
// back Payment link, at a computer and a phone width; Take payment is unchanged.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jo: string;

test.describe.configure({ timeout: 90_000, mode: 'serial' });
test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  jo = await staffFreshCookie(made.body.loginId);
  await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-services', { method: 'POST', body: { name: 'Fit & adjust brakes', price: 18, minutes: 30 } });
});
test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

const signIn = async (context: import('@playwright/test').BrowserContext, cookie: string) => {
  await context.clearCookies();
  const [name, value] = cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
};
const noSideScroll = async (page: import('@playwright/test').Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};
const open = async (page: import('@playwright/test').Page, name: RegExp) => {
  const fold = page.getByRole('button', { name });
  if ((await fold.getAttribute('aria-expanded')) !== 'true') await fold.click();
  return fold;
};

for (const [size, viewport] of [['computer', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`on a ${size}, Cash is always on, and Jack adds Bank transfer and removes Payment link with Undo`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    await signIn(context, owner.cookie);
    await page.goto(`${server!.baseUrl}/workshop/settings?room=front-desk`);
    await open(page, /^Ways to pay/);
    await expect(page.getByText('Always on')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Card' })).toHaveCount(0);

    const fold = await open(page, /^Other ways to pay/);
    await expect(fold).toContainText('Finance, Cycle to Work, Payment link');
    await expect(page.getByText('Needs setting up with [payment provider] first')).toBeVisible();
    await page.getByRole('textbox', { name: 'New way to pay' }).fill('Bank transfer');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove Bank transfer' })).toBeVisible();
    // Settings' one note at the foot of the page (saved-note.tsx), worded as set-till-quick-saved.
    const note = page.locator('[data-saved-note][role="status"] > *');
    await expect(note).toBeVisible();
    await expect(note).toContainText('Saved · Bank transfer added');
    await expect(fold).toContainText('Finance, Cycle to Work, Payment link, Bank transfer');

    await page.getByRole('button', { name: 'Remove Payment link' }).click();
    await expect(page.getByRole('button', { name: 'Remove Payment link' })).toHaveCount(0);
    await expect(note).toContainText('Saved · Payment link removed');
    await note.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove Payment link' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove Payment link' })).toBeFocused();
    await noSideScroll(page);
    const list = (await staffRequest(server!.baseUrl, owner.cookie, '/api/payment-ways-other')).body.ways.map((w: { name: string }) => w.name);
    expect(list).toEqual(['Finance', 'Cycle to Work', 'Payment link', 'Bank transfer']);

    // Back as it was for the next width.
    await page.getByRole('button', { name: 'Remove Bank transfer' }).click();
    await expect(page.getByRole('button', { name: 'Remove Bank transfer' })).toHaveCount(0);
  });
}

test('at 320px, a 30-character name with no spaces wraps and its ✕ stays on the screen', async ({ page, context }) => {
  // [a_thirty_character_way_name_]: a bracketed placeholder exactly 30 characters long, with nowhere to break.
  const long = '[a_thirty_character_way_name_]';
  await staffRequest(server!.baseUrl, owner.cookie, '/api/payment-ways-other', { method: 'POST', body: { name: long } });
  await page.setViewportSize({ width: 320, height: 700 });
  await signIn(context, owner.cookie);
  await page.goto(`${server!.baseUrl}/workshop/settings?room=front-desk`);
  await open(page, /^Other ways to pay/);
  const remove = page.getByRole('button', { name: `Remove ${long}` });
  await expect(remove).toBeVisible();
  const box = (await remove.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  await noSideScroll(page);
  await remove.click();
  await expect(remove).toHaveCount(0);
});

test('after adding Bank transfer, Take payment offers the same ways to pay as before', async ({ page, context }) => {
  await staffRequest(server!.baseUrl, owner.cookie, '/api/payment-ways-other', { method: 'POST', body: { name: 'Bank transfer' } });
  await page.setViewportSize({ width: 1440, height: 900 });
  await context.clearCookies();
  await context.addCookies(await tillCookies(server!.baseUrl, jo));
  await page.goto(`${server!.baseUrl}/workshop/till`);
  await page.getByRole('group', { name: 'Workshop quick buttons' }).getByRole('button', { name: /^Fit & adjust brakes/ }).click();
  await page.getByRole('region', { name: 'Sale' }).getByRole('button', { name: 'Take payment · £18.00' }).click();
  const pay = page.getByRole('dialog');
  await expect(pay.getByRole('button', { name: /^Card · £18.00/ })).toBeVisible();
  const ways = await pay.getByRole('button').evaluateAll((bs) => bs.map((b) => (b.querySelector('span span')?.textContent ?? b.textContent ?? '').trim()));
  expect(ways.filter((w) => w && !/^(Close|Cancel|Back)/.test(w))).toEqual(['Card · £18.00', 'Cash', 'Split']);
  await expect(pay.getByText('Bank transfer')).toHaveCount(0);
  await expect(pay.getByText('Other', { exact: true })).toHaveCount(0);
});
