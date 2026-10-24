// "You didn't finish booking", in a real browser against the real server
// (Jack, 1 Oct, book a repair decision 9; drawn as bk-resume;
// openspec/changes/booking-draft-resume): a booking begun, the tab closed,
// the booking page opened again in a new tab comes back on the step left,
// with the banner; Carry on closes it; a refresh then shows none.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let shop: { id: number; slug: string } | undefined;

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 390, height: 844 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  shop = owner.shop;
  await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-services', { method: 'POST', body: { name: 'Brake service', price: 20, minutes: 45, bookableOnline: true } });
  expect(made.status, JSON.stringify(made.body)).toBe(201);
});
test.afterAll(async () => {
  try {
    if (shop) await deleteTestShop(shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('begun, the tab closed, opened again: back on the step left, with the banner', async ({ context }) => {
  const first = await context.newPage();
  await first.goto(`${server!.baseUrl}/book/${shop!.slug}`);
  await first.getByRole('button', { name: /Individual services/ }).click();
  await first.getByRole('button', { name: /Brake service/ }).click();
  await first.getByRole('button', { name: 'Continue' }).click();
  await first.getByRole('textbox', { name: 'Your bike (optional)' }).fill('Specialized Sirrus');
  await expect(first.getByRole('heading', { level: 1, name: 'Tell us about your bike' })).toBeVisible();
  await first.waitForTimeout(300);
  await first.close();

  // A new tab: its own sessionStorage, the device's localStorage.
  const again = await context.newPage();
  await again.goto(`${server!.baseUrl}/book/${shop!.slug}`);
  await expect(again).toHaveURL(new RegExp(`/book/${shop!.slug}/problem$`));
  await expect(again.getByText(/You didn’t finish booking\./)).toBeVisible();
  await expect(again.getByRole('textbox', { name: 'Your bike (optional)' })).toHaveValue('Specialized Sirrus');
  if (process.env.WH_SHOTS) await again.screenshot({ path: `${process.env.WH_SHOTS}/book-resume.png` });
  await again.getByRole('button', { name: 'Carry on' }).click();
  await expect(again.getByText(/You didn’t finish booking\./)).toHaveCount(0);
  await again.reload();
  await expect(again.getByRole('textbox', { name: 'Your bike (optional)' })).toHaveValue('Specialized Sirrus');
  await expect(again.getByText(/You didn’t finish booking\./)).toHaveCount(0);
});
