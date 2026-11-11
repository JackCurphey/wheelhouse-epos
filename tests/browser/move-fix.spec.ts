// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
// @ts-expect-error a plain helper with no types
import { xlsxOf } from '../helpers/xlsx.js';

// The rows that need a look and Ask us to help in a real browser
// (openspec/changes/citrus-import-fix; mv-fix, mv-sorted, mv-help, mv-help-sent): a
// made-up file with two rows that don't fit, one fixed and one left out, then
// Everything's sorted and a question for the team, at computer and phone widths, with
// nothing scrolling sideways. The pads are the drawing's (B05S-RX, £28.00).
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
const shops: { shop: { id: number } }[] = [];

test.describe.configure({ timeout: 90_000 });
test.beforeAll(async () => { server = await startLiveServer({ env: { WH_MOVE_TICK_MS: '200' } }); });
test.afterAll(async () => {
  try {
    for (const s of shops) await deleteTestShop(s.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

const PRICE_LIST = xlsxOf([
  ['Price List - Store Level'],
  ['Store', 'Department', 'Category', 'Supplier', 'Item Lookup Code', 'Description', 'Store Cost', 'Price', 'Tax Rate', 'Qty On Hand'],
  ['[Shop]', 'Brakes', null, '[Supplier]', 'B05S-RX', 'Shimano brake pads', 14, null, 20, 6],
  ['[Shop]', 'Brakes', null, '[Supplier]', '[Supplier code]', '[Product]', 1, null, 20, 1],
]);

for (const [size, viewport] of [['computer', { width: 1280, height: 900 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`at ${size} width: look at the rows, fix one, leave one out, and ask for help`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    shops.push(owner);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/moving`);
    const main = page.getByRole('main');
    const noSideways = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    await main.getByLabel('Choose files').setInputFiles({ name: 'Price List.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: PRICE_LIST });
    await expect(main.getByRole('heading', { level: 2, name: 'Here’s what came across' })).toBeVisible({ timeout: 30_000 });
    await main.getByRole('button', { name: 'Look at the 2' }).click();
    await expect(main.getByRole('heading', { level: 2, name: '2 need a look' })).toBeVisible();
    await expect(main.getByRole('heading', { level: 3, name: 'Products · 2' })).toBeVisible();
    await noSideways();
    await page.screenshot({ path: test.info().outputPath(`mv-fix-${size}.png`) });

    await main.getByRole('button', { name: 'Fix Shimano brake pads' }).click();
    const box = page.getByRole('dialog', { name: 'Fix Shimano brake pads' });
    await expect(box.getByLabel('Product code')).toHaveValue('B05S-RX');
    await box.getByLabel('Price', { exact: true }).fill('£28.00');
    await box.getByRole('button', { name: 'Save' }).click();
    await expect(box.getByRole('alert')).toHaveText('The price isn’t a number Wheelhouse can use');
    await noSideways();
    await page.screenshot({ path: test.info().outputPath(`mv-fix-popup-${size}.png`) });
    await box.getByLabel('Price', { exact: true }).fill('28.00');
    await box.getByRole('button', { name: 'Save' }).click();
    await expect(box).toBeHidden();
    await expect(main.getByText('Shimano brake pads came across')).toBeVisible();
    await expect(main.getByRole('heading', { level: 2, name: '1 need a look' })).toBeVisible();

    const found = await staffRequest(server!.baseUrl, owner.cookie, '/api/products?search=B05S-RX');
    expect(found.body[0]).toMatchObject({ name: 'Shimano brake pads', stockQty: 6, price: 28 });

    await main.getByRole('button', { name: 'Leave out [Product]' }).click();
    await expect(main.getByRole('heading', { level: 2, name: 'Everything’s sorted' })).toBeVisible();
    await expect(main.getByRole('listitem').filter({ hasText: 'Left out' })).toContainText('1 row');
    await noSideways();
    await page.screenshot({ path: test.info().outputPath(`mv-sorted-${size}.png`) });

    await main.getByRole('button', { name: 'Ask us to help' }).click();
    const help = page.getByRole('dialog', { name: 'Ask us to help' });
    await expect(help).toContainText(`We’ll see you asked from Everything’s sorted, and that you’re Jack Lewis at ${owner.shop.name}.`);
    await help.getByLabel('What looks wrong?').fill('[What Jack wrote]');
    await noSideways();
    await page.screenshot({ path: test.info().outputPath(`mv-help-${size}.png`) });
    await help.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Thanks — we’ve got it. Any reply comes to your email.' })).toBeVisible();
    await noSideways();
    await page.screenshot({ path: test.info().outputPath(`mv-help-sent-${size}.png`) });

    await page.reload();
    await expect(main.getByRole('heading', { level: 2, name: 'Everything’s sorted' })).toBeVisible();

    // See them: Settings › Office › Your data, Download everything open, the row left out counted
    // (your-data-download group 4).
    await main.getByRole('listitem').filter({ hasText: 'Left out' }).getByRole('link', { name: 'See them' }).click();
    await expect(page).toHaveURL(/\/workshop\/settings\?room=office&fold=download-everything$/);
    await expect(page.getByRole('list', { name: 'What the download holds' }).getByRole('listitem').last()).toHaveText('Left out from Citrus Lime · 1 row');
    await noSideways();
  });
}

const focusedName = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const at = document.activeElement as HTMLElement | null;
  return at?.getAttribute('aria-label') ?? at?.textContent?.trim() ?? '';
});
const pressUntil = async (page: import('@playwright/test').Page, name: string) => {
  for (let i = 0; i < 60; i += 1) {
    await page.keyboard.press('Tab');
    if ((await focusedName(page)) === name) return;
  }
  throw new Error(`Tab never reached ${name}`);
};

test('by keyboard alone: pop-ups give focus back, the last row\'s line takes it, and another file goes to the summary', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/moving`);
  const main = page.getByRole('main');
  await main.getByLabel('Choose files').setInputFiles({ name: 'Price List.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: PRICE_LIST });
  await expect(main.getByRole('button', { name: 'Look at the 2' })).toBeVisible({ timeout: 30_000 });

  await main.getByRole('button', { name: 'Look at the 2' }).focus();
  await page.keyboard.press('Enter');
  await expect(main.getByRole('heading', { level: 2, name: '2 need a look' })).toBeFocused();

  // Fix: Cancel, then Escape, each back to the button.
  await pressUntil(page, 'Fix Shimano brake pads');
  await page.keyboard.press('Enter');
  const box = page.getByRole('dialog', { name: 'Fix Shimano brake pads' });
  await expect(box).toBeVisible();
  await box.getByRole('button', { name: 'Cancel' }).focus();
  await page.keyboard.press('Enter');
  await expect(box).toBeHidden();
  expect(await focusedName(page)).toBe('Fix Shimano brake pads');
  await page.keyboard.press('Enter');
  await expect(box).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(box).toBeHidden();
  expect(await focusedName(page)).toBe('Fix Shimano brake pads');

  // Ask us to help: Cancel, back to the link.
  await main.getByRole('button', { name: 'Ask us to help' }).focus();
  await page.keyboard.press('Enter');
  const help = page.getByRole('dialog', { name: 'Ask us to help' });
  await expect(help).toBeVisible();
  await help.getByRole('button', { name: 'Cancel' }).focus();
  await page.keyboard.press('Enter');
  await expect(help).toBeHidden();
  expect(await focusedName(page)).toBe('Ask us to help');

  // A row left out: its line takes the focus, on this board and on the next.
  await main.getByRole('button', { name: 'Leave out [Product]' }).focus();
  await page.keyboard.press('Enter');
  await expect(main.getByText('[Product] left out')).toBeFocused();
  await main.getByRole('button', { name: 'Leave out Shimano brake pads' }).focus();
  await page.keyboard.press('Enter');
  await expect(main.getByRole('heading', { level: 2, name: 'Everything’s sorted' })).toBeVisible();
  await expect(main.getByText('Shimano brake pads left out')).toBeFocused();
  await expect(main.getByRole('listitem').filter({ hasText: 'Left out' })).toContainText('2 rows');

  // Another file: what came across, then its rows, then sorted again.
  await main.getByLabel('Choose files').setInputFiles({ name: 'More.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsxOf([
    ['Price List - Store Level'],
    ['Store', 'Department', 'Category', 'Supplier', 'Item Lookup Code', 'Description', 'Store Cost', 'Price', 'Tax Rate', 'Qty On Hand'],
    ['[Shop]', 'Brakes', null, '[Supplier]', '[Another code]', '[Another product]', 1, null, 20, 0],
  ]) });
  await expect(main.getByRole('heading', { level: 2, name: 'Here’s what came across' })).toBeVisible({ timeout: 30_000 });
  await expect(main.getByRole('listitem').filter({ hasText: 'Stock levels' })).toContainText('2 left out');
  await expect(main.getByRole('listitem').filter({ hasText: 'Stock levels' })).not.toContainText('All in');
  await main.getByRole('button', { name: 'Look at the 1' }).click();
  await main.getByRole('button', { name: 'Leave out [Another product]' }).click();
  await expect(main.getByRole('heading', { level: 2, name: 'Everything’s sorted' })).toBeVisible();
  await expect(main.getByText('[Another product] left out')).toBeFocused();
});
