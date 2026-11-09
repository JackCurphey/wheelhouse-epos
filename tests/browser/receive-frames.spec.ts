// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Receiving bikes by frame number in a real browser (openspec/changes/frame-numbers; rs-frame,
// rs-frame-dup, st-product-bike): Jo scans two of the drawing's Trek Domane AL 3 in, each by its
// frame sticker, is stopped at a frame already in stock, books them in, and the bike's page lists
// both frames, at computer and phone widths, nothing scrolling sideways. Frames are placeholders.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jo: string;

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  expect(made.status).toBe(201);
  jo = await staffFreshCookie(made.body.loginId);
  expect((await staffRequest(server.baseUrl, jo, '/api/your-settings/till-pin/ask', { method: 'POST' })).status).toBe(200);
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

const asOwner = (path: string, body?: unknown) => staffRequest(server!.baseUrl, owner.cookie, path, body === undefined ? undefined : { method: 'POST', body });
const sideways = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [size, viewport] of [['computer', { width: 1280, height: 900 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`at ${size} width: two bikes scanned in by frame number, and the bike's page lists them`, async ({ page, context }) => {
    const sku = `[Supplier code]-${size}`;
    const bike = await asOwner('/api/products', { name: 'Trek Domane AL 3', sku, category: 'Bikes', price: 500, cost: 300 });
    expect(bike.status).toBe(201);
    const frames = [`[frame ${size} 1]`, `[frame ${size} 2]`];
    await page.setViewportSize(viewport);
    const [name, value] = jo.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/deliveries/receive`);
    const main = page.getByRole('main');
    const box = main.getByRole('searchbox', { name: 'Scan a barcode, or type to search' });
    for (const [i, f] of frames.entries()) {
      await box.fill(sku);
      await box.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Frame number' });
      await expect(dialog).toContainText(`Trek Domane AL 3 · bike ${i + 1} in this delivery`);
      if (i === 1) {
        // The first frame again: caught, not counted.
        await dialog.getByRole('textbox', { name: 'Frame number' }).fill(frames[0]);
        await dialog.getByRole('textbox', { name: 'Frame number' }).press('Enter');
        await expect(dialog.getByRole('alert')).toHaveText('This frame number is already in this delivery.');
      }
      await dialog.getByRole('textbox', { name: 'Frame number' }).fill(f);
      await dialog.getByRole('textbox', { name: 'Frame number' }).press('Enter');
      await expect(dialog).toBeHidden();
      await expect(main.getByRole('textbox', { name: 'How many: Trek Domane AL 3' })).toHaveValue(String(i + 1));
    }
    await expect(main.getByRole('list', { name: 'Scanned' })).toContainText(`Frame ${frames[0]} · Frame ${frames[1]}`);
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/receive-frames-${size}.png` });
    await main.getByRole('button', { name: 'Book in 2 items' }).click();
    await expect(page).toHaveURL(/\/workshop\/deliveries\/delivery\/\d+\/booked$/);

    const [oname, ovalue] = owner.cookie.split('=');
    await context.addCookies([{ name: oname, value: ovalue, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/stock/${bike.body.id}`);
    const listed = page.getByRole('region', { name: 'Bikes by frame number' });
    await expect(listed.getByRole('listitem')).toHaveCount(2);
    for (const f of frames) await expect(listed).toContainText(`Frame ${f}`);
    await expect(page.getByRole('region', { name: 'Stock history' })).toContainText('2 frame numbers');
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/bike-page-${size}.png`, fullPage: true });
  });
}
