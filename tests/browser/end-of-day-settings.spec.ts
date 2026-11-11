// Settings › Front desk › End of day: Close the day timing and Count first
// (openspec/changes/owner-setup-till-payments-eod design 3; set-eod-close;
// eod-count-shown), in a real browser against the real server. The Owner
// chooses 1 hour before and turns Count first off; each is saved with "Saved"
// and Undo; Close the day then shows what the till expects while counting.
// The server's clock is pinned to 1 Sep 2026.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { runWithShop, prepare } from '../../server/db.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, tillCookies } from '../helpers/staff.js';
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

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`choose when Close the day shows, turn Count first off, and count with the expected amount at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    owners.push(owner);
    expect((await staffRequest(server!.baseUrl, owner.cookie, '/api/end-of-day-settings', { method: 'PUT', body: { floatPence: 15000 } })).status).toBe(200);
    // Shut on Tuesdays, as close-the-day.spec does: Close the day shows all day
    // on the pinned Tuesday, and the float can be looked at when closing.
    const hours = await staffRequest(server!.baseUrl, owner.cookie, '/api/workshop-settings', { method: 'PUT', body: { openingHours: [{ weekday: 1, open: '09:00', close: '17:00' }] } });
    expect(hours.status).toBe(200);
    await context.addCookies(await tillCookies(server!.baseUrl, owner.cookie));

    // Close the day: 30 minutes before to start; 1 hour before saved, with Undo.
    await page.goto(`${server!.baseUrl}/workshop/settings?room=front-desk&fold=close-the-day`);
    const closeFold = page.getByRole('button', { name: /^Close the day/ });
    await expect(closeFold).toContainText('30 minutes before closing');
    const choices = page.getByRole('radiogroup', { name: 'Show “Close the day” in the till bar' });
    await expect(choices.getByRole('radio', { name: '30 minutes before' })).toHaveAttribute('aria-checked', 'true');
    await choices.getByRole('radio', { name: '1 hour before' }).click();
    await expect(closeFold).toContainText('1 hour before closing');
    // The note sits as drawn (settings-frame.mjs toastHtml) inside the Settings
    // content area: on a computer 24px above its foot and centred over it; on a
    // phone 12px inside it at each side and at the foot. The content area's
    // foot is the screen's less the main area's padding (18px on a computer,
    // 14px on a phone) and Settings' own (1.25rem, 1rem: about 20px and 16px,
    // read from the page since it follows the text size).
    const note = page.locator('[data-saved-note][role="status"] > *');
    await expect(note.getByRole('button', { name: 'Undo' })).toBeVisible();
    await expect(note).toContainText('Saved');
    const box = (await note.boundingBox())!;
    const content = await page.locator('[data-settings-frame]').evaluate((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return { left: r.left + parseFloat(s.paddingLeft), right: r.right - parseFloat(s.paddingRight), pad: parseFloat(s.paddingBottom) };
    });
    const below = viewport.height - (box.y + box.height);
    if (viewport.width < 768) {
      expect(below).toBeCloseTo(14 + content.pad + 12, 0);
      expect(Math.round(box.x - content.left)).toBe(12);
      expect(Math.round(content.right - (box.x + box.width))).toBe(12);
    } else {
      expect(below).toBeCloseTo(18 + content.pad + 24, 0);
      expect(Math.abs(Math.round(box.x + box.width / 2 - (content.left + content.right) / 2))).toBeLessThanOrEqual(1);
    }
    expect((await staffRequest(server!.baseUrl, owner.cookie, '/api/end-of-day-settings')).body.closeEntryMinutes).toBe(60);
    await expect(page.getByRole('link', { name: 'Change opening hours' })).toBeVisible();

    // Counting the cash: Count first off, saved.
    const countFold = page.getByRole('button', { name: /^Counting the cash/ });
    await expect(countFold).toContainText('Count first');
    await countFold.click();
    await page.getByRole('switch', { name: 'Count first' }).click();
    await expect(countFold).toContainText('Show the expected amount');
    expect((await staffRequest(server!.baseUrl, owner.cookie, '/api/end-of-day-settings')).body.countFirst).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // Close the day: the float looked at first, then a £74.00 cash sale (the drawing's example).
    await page.goto(`${server!.baseUrl}/workshop/till/close`);
    const check = page.getByRole('dialog', { name: 'Hello, Jack' });
    await check.getByRole('button', { name: 'Looks right' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await runWithShop(owner.shop.id, () => prepare("INSERT INTO sales (subtotal, total, payment_method, cash_amount) VALUES (74, 74, 'Cash', 74)").run());
    await page.reload();
    const counting = page.getByRole('region', { name: 'Count the cash' });
    await expect(counting).toContainText('The till expects£224.00');
    await counting.getByLabel('Cash counted, total').fill('221.90');
    await expect(counting).toContainText('Difference£2.10 short');
    await counting.getByRole('button', { name: 'Done counting', exact: true }).click();
    await expect(counting.getByRole('group', { name: 'How the till worked out what it expected' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
