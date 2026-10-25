// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer, TEST_CLOCK_PIN } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

// Settings › Workshop › Services, end to end against the real server
// (openspec/changes/services-room; set-workshop-services, ac-service-edit):
// the Owner adds Brake service under Individual service, which customers can
// then book; changes Standard service's time; and removes Brake service,
// which customers then can't book.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London', viewport: { width: 1440, height: 900 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const service = await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-services', { method: 'POST', body: { name: 'Standard service', price: 65, minutes: 60, kind: 'full', bookableOnline: true } });
  expect(service.status, JSON.stringify(service.body)).toBe(201);
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

const bookable = async () => {
  const res = await fetch(`${server!.baseUrl}/api/portal/${owner.shop.slug}/services`);
  const body = await res.json() as { full: { name: string }[]; uncategorised: { name: string }[]; categories: { services: { name: string }[] }[] };
  return [...body.full, ...body.uncategorised, ...body.categories.flatMap((c) => c.services)].map((s) => s.name).sort();
};

test('the Owner adds, changes and removes a service, and online booking follows', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));
  await page.goto(`${server!.baseUrl}/workshop/settings?room=workshop`);

  await expect(page.getByRole('button', { name: 'Edit Standard service' })).toBeVisible();
  await expect(page.getByText('£65.00')).toBeVisible();

  // Add Brake service, as drawn: Individual service, 45 min, [£ price] kept at £0.00.
  await page.getByRole('group', { name: 'Service groups' }).getByText('Individual service').click();
  await page.getByRole('button', { name: '+ Add a service' }).click();
  const add = page.getByRole('dialog', { name: 'New service' });
  await add.getByRole('textbox', { name: 'Name' }).fill('Brake service');
  await add.getByRole('textbox', { name: 'Time in the diary' }).fill('45');
  await add.getByRole('textbox', { name: 'Price' }).fill('0');
  await add.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('45 min in the diary')).toBeVisible();
  expect(await bookable()).toEqual(['Brake service', 'Standard service']);

  // Change Standard service's time.
  await page.getByRole('group', { name: 'Service groups' }).getByText('Full service').click();
  await page.getByRole('button', { name: 'Edit Standard service' }).click();
  const box = page.getByRole('dialog', { name: 'Standard service' });
  await expect(box.getByText('Full service · 60 min in the diary · £65.00')).toBeVisible();
  await box.getByRole('textbox', { name: 'Time in the diary' }).fill('90');
  await box.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('90 min in the diary')).toBeVisible();
  const saved = await staffRequest(server!.baseUrl, owner.cookie, '/api/workshop-services');
  expect((saved.body as { name: string; minutes: number; price: number }[]).find((s) => s.name === 'Standard service')).toMatchObject({ minutes: 90, price: 65 });

  // Remove Brake service.
  await page.getByRole('group', { name: 'Service groups' }).getByText('Individual service').click();
  await page.getByRole('button', { name: 'Remove Brake service' }).click();
  await expect(page.getByRole('button', { name: 'Edit Brake service' })).toHaveCount(0);
  expect(await bookable()).toEqual(['Standard service']);
});
