// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Cycle to Work in a real browser (openspec/changes/cycle-to-work group 4;
// cw-list, cw-new, cw-order-held, cw-quote): New Cycle to Work order for
// Maya Patel with a bike in stock, held; the order with its note and "What's
// happened"; the quote with its LOGO placeholder; and the list and sidebar
// count, at computer and phone widths, with nothing scrolling sideways.
// Providers, bikes and quote numbers stay bracketed; prices are test values.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let mayaEmail: string;

test.describe.configure({ timeout: 120_000, mode: 'serial' });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const staff = (path: string, body: unknown, method = 'POST') => staffRequest(server!.baseUrl, owner.cookie, path, { method, body });
  expect((await staff('/api/c2w/settings', { holdDays: 7, remindDays: 2, quoteValidDays: 30, howToApply: '[How to apply]' }, 'PUT')).status).toBe(200);
  expect((await staff('/api/c2w/providers', { name: '[Provider]', commissionKind: 'percent', commissionValue: 500, paysInDays: 30 })).status).toBe(201);
  expect((await staff('/api/products', { name: '[Bike] · [Size]', sku: 'C2W-BIKE', price: 1000, stockQty: 4 })).status).toBe(201);
  expect((await staff('/api/products', { name: '[Accessory]', sku: 'C2W-ACC', price: 40, stockQty: 4 })).status).toBe(201);
  mayaEmail = `maya-${owner.shop.id}@example.test`;
  expect((await staff('/api/customers', { name: 'Maya Patel', phone: '07700 900 142', email: mayaEmail })).status).toBe(201);
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

for (const [size, viewport] of [['computer', { width: 1280, height: 900 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`at ${size} width: make a quote with the bike held, see the order and its quote, and the list`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.addInitScript(() => { (window as unknown as { printed: number }).printed = 0; window.print = () => { (window as unknown as { printed: number }).printed += 1; }; });
    const wide = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    await page.goto(`${server!.baseUrl}/workshop/c2w`);
    const main = page.getByRole('main');
    await main.getByRole('button', { name: '+ New Cycle to Work order' }).click();
    const box = page.getByRole('dialog', { name: 'New Cycle to Work order' });
    await box.getByRole('searchbox', { name: 'Customer' }).fill('Maya');
    await box.getByRole('button', { name: /^Maya Patel/ }).click();
    await expect(box.getByText('Maya Patel · 07700 900 142')).toBeVisible();
    await expect(box.getByText('Pays in about 30 days')).toBeVisible();
    await box.getByRole('searchbox', { name: 'Bike' }).fill('[Bike]');
    await box.getByRole('button', { name: /^\[Bike\] · \[Size\]/ }).click();
    await box.getByRole('searchbox', { name: 'Accessories' }).fill('[Accessory]');
    await box.getByRole('button', { name: /^\[Accessory\]/ }).click();
    await expect(box.getByRole('checkbox', { name: /^Hold the bike until / })).toBeChecked();
    await expect(box.getByText(/^We’re holding your bike until .+ This quote is valid until .+ Once your certificate reaches us, it’s yours to collect\.$/)).toBeVisible();
    await expect(box.getByRole('checkbox', { name: `Email the quote to ${mayaEmail} now` })).toBeChecked();
    await expect(box.getByText('£1,040.00')).toBeVisible();
    await wide();
    await box.getByRole('button', { name: 'Make the quote' }).click();

    await expect(main.getByRole('heading', { level: 2, name: 'Maya Patel · Cycle to Work' })).toBeVisible();
    await expect(page.getByRole('status').getByText(`Quote emailed to ${mayaEmail}. Bike held until`)).toBeVisible();
    await expect(main.getByText(/^Quote CW-\d+ · North Street Cycles/)).toBeVisible();
    await expect(main.getByRole('list', { name: 'Stages' }).getByRole('listitem').nth(1)).toHaveAttribute('aria-current', 'step');
    await expect(main.getByText(new RegExp(`Jack Lewis gave quote CW-\\d+ and emailed it to ${mayaEmail.replace(/\./g, '\\.')} · it says the bike is put aside until`))).toBeVisible();
    await expect(main.getByText('Maya pays at collection')).toBeVisible();
    await wide();

    await main.getByRole('button', { name: 'Print the quote' }).click();
    await expect(main.getByRole('heading', { level: 2, name: 'The quote' })).toBeVisible();
    await expect(main.getByLabel('Shop logo goes here')).toHaveText('LOGO');
    await expect(main.getByText('How to apply:')).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
    await wide();

    await page.goto(`${server!.baseUrl}/workshop/c2w`);
    await expect(main.getByRole('heading', { level: 2, name: /^Waiting for the certificate · \d$/ })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Open Maya Patel’s order' }).first()).toBeVisible();
    await wide();
  });
}
