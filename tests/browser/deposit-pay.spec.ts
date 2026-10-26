// Paying the deposit on step 4, in a real browser against the real server
// (bk-details-deposit; openspec/changes/deposit-pay-screen): the pretend card
// declined, then accepted, and the booking made with its deposit taken.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { runWithShop, prepare } from '../../server/db.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { futureDate } from '../helpers/workshopFixtures.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let alex: number;
let service: number;

test.describe.configure({ timeout: 90_000 });
const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  service = await runWithShop(owner.shop.id, async () => (await prepare("INSERT INTO workshop_services (name, price, price_pence, minutes, bookable_online, active, updated_at) VALUES ('Standard service', 65, ROUND(65 * 100)::int, 60, 1, 1, now()) RETURNING id").get()).id);
  expect((await staff('/api/workshop-settings', { method: 'PUT', body: { bookingMode: 'timed', depositOn: true, depositPercent: 20 } })).status).toBe(200);
});
test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('a declined card, then an accepted one: booked, with £13.00 taken', async ({ page }) => {
  const draft = { serviceIds: [service], answers: [], date: futureDate(2), mechanicId: alex, startTime: '11:00', name: 'Maya Patel', phone: '07700 900142', termsAccepted: true };
  await page.addInitScript(([slug, d]) => { if (!sessionStorage.getItem(`wh-book-draft:${slug}`)) sessionStorage.setItem(`wh-book-draft:${slug}`, d); }, [owner.shop.slug, JSON.stringify(draft)] as const);
  await page.goto(`${server!.baseUrl}/book/${owner.shop.slug}/details`);
  await expect(page.getByRole('group', { name: 'Deposit · £13.00' })).toBeVisible();
  await page.getByLabel('Card number').fill('4000 0000 0000 0002');
  await page.getByRole('button', { name: 'Pay £13.00 and send request' }).click();
  await expect(page.getByText('The card didn’t go through.')).toBeVisible();
  await page.getByLabel('Card number').fill('4242 4242 4242 4242');
  await page.getByRole('button', { name: 'Pay £13.00 and send request' }).click();
  await expect(page).toHaveURL(/\/booking\//);
  const paid = await runWithShop(owner.shop.id, () => prepare("SELECT p.status, j.deposit_pence FROM online_payments p JOIN workshop_jobs j ON j.id = p.job_id WHERE p.status = 'taken'").all());
  expect(paid.map((r: { status: string; deposit_pence: number }) => [r.status, r.deposit_pence])).toEqual([['taken', 1300]]);
});
