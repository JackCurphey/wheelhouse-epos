// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Logging a privacy request and sending the copy in a real browser (openspec/changes/
// finish-customers, task 7.3; cs-privacy; question 7; Jack's 9 Nov answer 6): the Owner logs
// that Maya Patel asked in person for a copy of her data, then emails it to her, at a computer
// and a phone width.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
const shops: number[] = [];

test.describe.configure({ timeout: 90_000, mode: 'serial' });
test.beforeAll(async () => {
  server = await startLiveServer();
});
test.afterAll(async () => {
  try {
    for (const id of shops) await deleteTestShop(id);
  } finally {
    if (server) await server.stop();
  }
});

const noSideScroll = async (page: import('@playwright/test').Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

for (const [size, viewport] of [['computer', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`on a ${size}, the Owner logs Maya’s request made in person and emails her the copy`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    shops.push(owner.shop.id);
    await staffRequest(server!.baseUrl, owner.cookie, '/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: 'maya@example.test' } });
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);

    await page.goto(`${server!.baseUrl}/workshop/customers/privacy`);
    await page.getByRole('button', { name: '+ Log a request' }).click();
    const box = page.getByRole('dialog', { name: 'Log a request' });
    await box.getByLabel('Customer').fill('Maya');
    await box.getByRole('list', { name: 'Customers found' }).getByRole('button', { name: /Maya Patel/ }).click();
    await box.getByRole('radiogroup', { name: 'What they asked for' }).getByRole('radio', { name: 'Copy of their data' }).click();
    await box.getByRole('radiogroup', { name: 'How they asked' }).getByRole('radio', { name: 'In person' }).click();
    await noSideScroll(page);
    await box.getByRole('button', { name: 'Log it' }).click();
    await expect(box).toBeHidden();

    const rows = page.getByRole('list', { name: 'Privacy requests' });
    await expect(rows.getByText('Maya Patel · Copy of their data')).toBeVisible();
    await expect(rows.getByText(/^Asked in person · .* · answer by /)).toBeVisible();
    await noSideScroll(page);
    await rows.getByRole('button', { name: 'Send the copy' }).click();
    const send = page.getByRole('dialog', { name: 'Send Maya Patel’s copy' });
    await send.getByRole('button', { name: 'Email it' }).click();
    await expect(send).toBeHidden();
    await expect(rows.getByText(/^Asked in person · .* · done /)).toBeVisible();
    await expect(rows.getByText('Done', { exact: true })).toBeVisible();
    await noSideScroll(page);
  });
}
