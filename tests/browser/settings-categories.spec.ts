// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Settings › Stockroom › Categories in a real browser (openspec/changes/categories-screens;
// st-categories, st-category-edit): the Owner adds Bearings with its three details in mm by
// keyboard, then Derailleurs inside Drivetrain with Number of gears as a choice, at computer
// and phone widths, with nothing scrolling sideways. Names as drawn.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

const sideways = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [width, height, label] of [[1280, 900, 'computer'], [375, 812, 'phone']] as const) {
  test(`Categories by keyboard on a ${label}: Bearings with its details, then Derailleurs inside Drivetrain`, async ({ page, context }) => {
    await page.setViewportSize({ width, height });
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    const tag = label === 'phone' ? ' 2' : '';
    if (!label.includes('phone')) {
      expect((await staffRequest(server!.baseUrl, owner.cookie, '/api/product-categories', { method: 'POST', body: { name: 'Drivetrain' } })).status).toBe(201);
    }
    await page.goto(`${server!.baseUrl}/workshop/settings?room=stockroom`);
    const fold = page.getByRole('button', { name: /^Categories/ });
    if ((await fold.getAttribute('aria-expanded')) !== 'true') await fold.click();

    // + Add a category, by keyboard only.
    await page.getByRole('button', { name: '+ Add a category' }).focus();
    await page.keyboard.press('Enter');
    const box = page.getByRole('dialog');
    await expect(box.getByRole('heading', { name: 'Add a category' })).toBeVisible();
    await box.getByRole('textbox', { name: 'Name', exact: true }).focus();
    await page.keyboard.type(`Bearings${tag}`);
    for (const detail of ['Inner diameter', 'Outer diameter', 'Height']) {
      await box.getByRole('textbox', { name: 'New detail name' }).focus();
      await page.keyboard.type(detail);
      await box.getByRole('textbox', { name: 'Unit' }).focus();
      await page.keyboard.type('mm');
      await page.keyboard.press('Enter');
    }
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/categories-add-${label}.png` });
    await box.getByRole('button', { name: 'Save' }).focus();
    await page.keyboard.press('Enter');
    await expect(box).toBeHidden();
    await expect(page.getByRole('listitem').filter({ hasText: `Bearings${tag}` })).toContainText('Inner diameter (mm) · Outer diameter (mm) · Height (mm)');

    // Derailleurs inside Drivetrain, picked with the arrow keys, with a choice.
    await page.getByRole('button', { name: '+ Add a category' }).click();
    await box.getByRole('textbox', { name: 'Name', exact: true }).fill(`Derailleurs${tag}`);
    const inside = box.getByRole('combobox', { name: 'Sits inside' });
    await inside.fill('drive');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(inside).toHaveValue('Drivetrain');
    await box.getByRole('textbox', { name: 'New detail name' }).fill('Number of gears');
    await box.getByRole('radio', { name: 'A choice from a list' }).click();
    const choices = box.getByRole('textbox', { name: 'Choices for the new detail' });
    await choices.fill('11');
    await choices.press('Enter');
    await choices.fill('12');
    await choices.press('Enter');
    await box.getByRole('button', { name: 'Add this detail' }).click();
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    await box.getByRole('button', { name: 'Save' }).click();
    await expect(box).toBeHidden();
    const row = page.getByRole('listitem').filter({ hasText: `Derailleurs${tag}` });
    await expect(row).toContainText('Inside Drivetrain');
    await expect(row).toContainText('Number of gears (a choice)');
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/categories-list-${label}.png`, fullPage: true });
    // Its box, as drawn: from Drivetrain, its own choices.
    await row.getByRole('button', { name: /^Edit/ }).click();
    await expect(box.getByRole('group', { name: 'Choices for Number of gears' })).toContainText('12');
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/categories-edit-${label}.png` });
    await page.keyboard.press('Escape');
    await expect(box).toBeHidden();
  });
}
