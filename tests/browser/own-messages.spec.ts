// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Settings › Messages › Your own messages in a real browser (set-msg-new;
// openspec/changes/own-messages-screens): add one, at a computer and a phone
// width, and it's listed with when and how it goes.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000, mode: 'serial' });
test.beforeAll(async () => {
  server = await startLiveServer({ env: { WH_OWN_MESSAGES_SCAN: 'off' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
});
test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

for (const [size, viewport, name] of [['computer', { width: 1280, height: 800 }, 'Spring check'], ['phone', { width: 375, height: 812 }, 'Winter check']] as const) {
  test(`on a ${size}, the owner adds their own message and it’s listed`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const [cookieName, value] = owner.cookie.split('=');
    await context.addCookies([{ name: cookieName, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/settings?room=front-desk`);
    const fold = page.getByRole('button', { name: /^Automatic messages/ });
    if ((await fold.getAttribute('aria-expanded')) !== 'true') await fold.click();
    await page.getByRole('button', { name: '+ Add your own message' }).click();
    const box = page.getByRole('dialog', { name: 'Your own message' });
    await box.getByLabel('Name').fill(name);
    await box.getByLabel('How long after').fill('6');
    await box.getByLabel('Wording').fill('Hi ');
    await box.getByRole('button', { name: '+ Customer’s first name' }).click();
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/own-message-box-${viewport.width}.png` });
    await box.getByRole('button', { name: 'Add the message' }).click();
    await expect(page.getByRole('button', { name: `Edit ${name}` })).toBeVisible();
    await expect(page.getByText('6 months after a job is collected · by email').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    if (process.env.WH_SHOTS) await page.screenshot({ path: `${process.env.WH_SHOTS}/own-message-list-${viewport.width}.png`, fullPage: true });
  });
}
