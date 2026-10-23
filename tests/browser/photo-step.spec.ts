import { test, expect } from '@playwright/test';

// Use my phone, the phone's page in a real browser at 320px
// (openspec/changes/use-my-phone; phone-photo-ready to -done): the address the
// server hands out opens the photo step, a photo is picked, checked and sent,
// and the page says it's added. The page's replies are answered here, so the
// test needs no seeded shop.
const CODE = 'c'.repeat(64);
const VIEW = { shopName: 'North Street Cycles', reference: 'WH-1042', bike: 'Trek Domane AL 3', line: 'Shimano brake pads', reason: 'Rear pads worn — replacing' };
// A 1 by 1 PNG, as book-journey.spec.ts uses.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

test('at 320px the phone takes a photo for the line, checks it and sends it', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route('**/api/portal/*/services', (route) =>
    route.fulfill({ json: { shopName: 'North Street Cycles', showPrices: true, full: [], categories: [], uncategorised: [] } }));
  let sent: { dataBase64?: string } | null = null;
  await page.route(`**/api/portal/*/photo-codes/${CODE}`, (route) => {
    if (route.request().method() === 'POST') {
      sent = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { reference: 'WH-1042', line: 'Shimano brake pads' } });
    }
    return route.fulfill({ json: VIEW });
  });
  await page.goto(`/book/north/photo/${CODE}`);
  await expect(page.getByRole('heading', { name: 'Add a photo for Shimano brake pads' })).toBeVisible();
  await expect(page.getByText('WH-1042 · Trek Domane AL 3')).toBeVisible();
  await expect(page.getByText('Take a photo', { exact: true })).toBeVisible();
  await page.getByLabel('Choose from your photos').setInputFiles({ name: 'pads.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('heading', { name: 'Check the photo' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'The photo you just took' })).toBeVisible();
  await page.getByRole('button', { name: 'Use this photo' }).click();
  await expect(page.getByRole('heading', { name: 'Photo added to WH-1042' })).toBeVisible();
  expect(sent).not.toBeNull();
  expect(Buffer.from(sent!.dataBase64 ?? '', 'base64').equals(PNG)).toBe(true);
});
