// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { runWithShop, prepare } from '../../server/db.js';

// Choosing the shop to collect from, in a real browser against the real
// server (openspec/changes/website-browse, tasks 7.1-7.4; drawings
// wb-choose-shop, wb-shops and wb-shop-page): the chip opens "Which shop
// will you collect from?", one tap chooses and the chip names the shop, the
// choice is remembered across a reload, and Our shops leads to the shop's own
// page. staffSignup adds a word to the business's name, so names are matched
// by pattern. Two shops, as drawn: Bolton and "[Second site]". The
// browser-coverage rule (#351).
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let second = 0;

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const setUp = await staffRequest(server.baseUrl, owner.cookie, '/api/website/set-up', { method: 'POST', body: { kind: 'wheelhouse', startWith: 'every', mainColour: '#2A2822' } });
  expect(setUp.status, JSON.stringify(setUp.body)).toBe(200);
  expect((await staffRequest(server.baseUrl, owner.cookie, '/api/website/publish', { method: 'POST' })).status).toBe(200);
  expect((await staffRequest(server.baseUrl, owner.cookie, '/api/website/turn-on', { method: 'POST' })).status).toBe(200);
  await runWithShop(owner.shop.id, async () => {
    await prepare("UPDATE sites SET name = 'Bolton'").run();
    second = ((await prepare("INSERT INTO sites (name, code) VALUES ('[Second site]', 'SS') RETURNING id").get()) as { id: number }).id;
  });
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    await server?.stop();
  }
});

test('the chip chooses the shop through "Which shop will you collect from?", remembers it, and Our shops opens its page', async ({ page }) => {
  const home = `${server!.baseUrl}/store/${owner.shop.slug}/`;
  await page.goto(home);
  const chip = page.getByRole('button', { name: 'Choose a shop to collect from' });
  await expect(chip).toHaveText('Choose a shop');
  await chip.click();

  const box = page.getByRole('dialog', { name: 'Which shop will you collect from?' });
  await expect(box).toBeVisible();
  await expect(box).toHaveAccessibleDescription('We’ll remember it, and show when things are ready there');
  const shops = box.getByRole('group', { name: 'Which shop will you collect from?' }).getByRole('button');
  await expect(shops).toHaveCount(2);
  for (const b of await shops.all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await box.getByRole('button', { name: '[Second site]' }).click();

  await expect(box).toHaveCount(0);
  const chosen = page.getByRole('button', { name: /^Collecting from North Street Cycles \S+, \[Second site\] — change the shop$/ });
  await expect(chosen).toHaveText('Collecting from [Second site] · Change');
  await expect(chosen).toBeFocused();
  const cookie = (await page.context().cookies()).find((c) => c.name === 'wh_shop');
  expect(cookie?.value).toBe(String(second));
  expect(cookie?.path).toBe(`/store/${owner.shop.slug}`);
  expect(cookie?.sameSite).toBe('Lax');
  expect(cookie?.httpOnly).toBe(false);
  // About a year (design 4).
  expect(cookie!.expires * 1000 - Date.now()).toBeGreaterThan(364 * 24 * 3600 * 1000);

  // Remembered on the next visit.
  await page.reload();
  await expect(page.getByRole('button', { name: /^Collecting from North Street Cycles \S+, \[Second site\] — change the shop$/ })).toBeVisible();

  // Esc closes the box and leaves the choice as it was.
  await chosen.click();
  await expect(box).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(box).toHaveCount(0);
  await expect(chosen).toBeFocused();
  await expect(chosen).toHaveText('Collecting from [Second site] · Change');

  // Our shops leads to the chosen shop's own page, which says it is chosen.
  await page.getByRole('navigation', { name: 'Website' }).getByRole('link', { name: 'Our shops' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Our shops' })).toBeVisible();
  await page.getByRole('heading', { level: 3, name: '[Second site]' }).getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1, name: /^North Street Cycles \S+, \[Second site\]$/ })).toBeVisible();
  await expect(page).toHaveURL(`${home}shops/${second}`);
  await expect(page.getByRole('status')).toHaveText('Collecting from [Second site] — what you see now shows when it’s ready here.');
  await expect(page.getByRole('button', { name: 'Collect from here' })).toHaveCount(0);

  // Bolton's page offers Collect from here; pressing it chooses Bolton.
  await page.getByRole('navigation', { name: 'You are here' }).getByRole('link', { name: 'Our shops' }).click();
  await page.getByRole('heading', { level: 3, name: 'Bolton' }).getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1, name: /^North Street Cycles \S+, Bolton$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Collect from here' }).click();
  await expect(page.getByRole('status')).toHaveText('Collecting from Bolton — what you see now shows when it’s ready here.');
  await expect(page.getByRole('status')).toBeFocused();
  await expect(page.getByRole('button', { name: /^Collecting from North Street Cycles \S+, Bolton — change the shop$/ })).toBeVisible();
});
