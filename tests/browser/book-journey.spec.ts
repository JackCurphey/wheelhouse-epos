// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool, runWithShop, prepare } from '../../server/db.js';
import { startLiveServer, TEST_CLOCK_PIN } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { purgeAttachmentFiles, UPLOADS_DIR } from '../helpers/workshopFixtures.js';

// d5: the whole customer booking journey, end to end, in a real browser
// against the real server and the test database - nothing mocked.
//
// A throwaway shop (a service with a question, a mechanic, the default
// opening hours and settings, prices shown) is seeded through the same
// helpers the server tests use, on this file's own live server. That server
// runs on the pinned test clock (07:00 UK time, Tuesday 1 September 2026),
// and the browser's clock is pinned to the same moment in Europe/London, so
// both agree that Wednesday 2 September is bookable. A browser books from
// /book/<shop> to the pending screen, with a photo; the private link is then
// opened cold in a fresh browser context; the booking row is checked in the
// database (answers, bike note, a stored photo, the terms copy); the shop is
// removed afterwards.
//
// Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md

// A real 1x1 PNG: the picker accepts it by type, the server by its bytes.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const QUESTION = "What's wrong with the brakes?";
const PHONE = { width: 320, height: 568 };

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let shop: { id: number; slug: string } | undefined;
let serviceId: number;

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London', viewport: PHONE });

test.beforeAll(async () => {
  server = await startLiveServer();
  const owner = await staffSignup(server.baseUrl, { shopName: 'Journey Cycles' });
  shop = owner.shop;
  await seedMechanic(owner.shop.id, { name: 'Sam' });
  const staff = (p: string, options: object) => staffRequest(server!.baseUrl, owner.cookie, p, options);
  const service = await staff('/api/workshop-services', {
    method: 'POST',
    body: {
      name: 'Brake check', price: 20, minutes: 60, bookableOnline: true,
      questions: [{ wording: QUESTION, kind: 'choice', required: true, choices: ['Squeaking', 'Not stopping well'] }],
    },
  });
  expect(service.status, JSON.stringify(service.body)).toBe(201);
  serviceId = service.body.id;
  const settings = await staff('/api/workshop-settings', { method: 'PUT', body: { showPricesOnline: true } });
  expect(settings.status, JSON.stringify(settings.body)).toBe(200);
});

// The server stop and the pool close sit in `finally`, so a failed clean-up
// or removal check can never leave the spawned server running.
test.afterAll(async () => {
  try {
    if (shop) {
      await purgeAttachmentFiles(shop.id);
      await deleteTestShop(shop.id);
      const { rows } = await pool.query('SELECT count(*)::int AS n FROM shops WHERE id = $1', [shop.id]);
      expect(rows[0].n, 'the throwaway shop is removed').toBe(0);
    }
  } finally {
    try {
      if (server) await server.stop();
    } finally {
      await pool.end();
    }
  }
});

test('a customer books from the first screen to pending, the private link reopens it, and the booking is stored', async ({ page, browser }) => {
  const slug = shop!.slug;
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));
  await page.goto(`${server!.baseUrl}/book/${slug}`);

  // service and service-list
  await page.getByRole('button', { name: /Individual services/ }).click();
  await page.getByRole('button', { name: /Brake check/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // problem: the bike, the question, a photo
  await page.getByRole('textbox', { name: 'Your bike (optional)' }).fill('Blue Trek road bike');
  await page.locator('label', { hasText: /^Squeaking$/ }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'brake.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('img', { name: 'brake.png' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // date: the day after the pinned "today"
  await page.getByRole('button', { name: /^Wednesday,?\s+2 September 2026$/ }).click();
  await page.getByRole('button', { name: 'Sam, 10:00' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // details
  await expect(page.getByRole('heading', { level: 1, name: 'How can we reach you?' })).toBeVisible();
  await expect(page.getByText('Wednesday 2 September, 10:00 with Sam')).toBeVisible();
  await page.getByRole('textbox', { name: 'Your name' }).fill('Gina Guest');
  await page.getByRole('textbox', { name: 'Mobile number' }).fill('07700 900123');
  await page.getByRole('checkbox', { name: 'I agree to the booking terms' }).check();
  await page.getByRole('button', { name: 'Request booking' }).click();

  // pending
  await expect(page.getByRole('heading', { level: 1, name: 'Awaiting shop confirmation' })).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(new RegExp(`/book/${slug}/booking/[0-9a-f]{64}$`));
  const privateLink = page.url();
  expect(await page.evaluate((key) => window.sessionStorage.getItem(key), `wh-book-draft:${slug}`), 'the draft is cleared').toBeNull();

  // the private link, opened cold
  const cold = await browser.newContext({ timezoneId: 'Europe/London', viewport: PHONE });
  const coldPage = await cold.newPage();
  await coldPage.goto(privateLink);
  await expect(coldPage.getByRole('heading', { level: 1, name: 'Awaiting shop confirmation' })).toBeVisible();
  await expect(coldPage.getByText('Blue Trek road bike')).toBeVisible();
  await cold.close();

  // the booking row
  const jobs = await runWithShop(shop!.id, () => prepare(
    'SELECT id, job_date, start_time, booking_state, customer_bike_note, question_answers FROM workshop_jobs',
  ).all());
  expect(jobs).toHaveLength(1);
  const [job] = jobs;
  expect(job).toMatchObject({ job_date: '2026-09-02', start_time: '10:00', booking_state: 'pending', customer_bike_note: 'Blue Trek road bike' });
  expect(job.question_answers).toMatchObject([{ serviceId, wording: QUESTION, kind: 'choice', answer: 'Squeaking' }]);
  const customer = await runWithShop(shop!.id, () => prepare(
    'SELECT c.name, c.update_channel FROM customers c JOIN workshop_jobs w ON w.customer_id = c.id WHERE w.id = ?',
  ).get(job.id));
  expect(customer).toMatchObject({ name: 'Gina Guest', update_channel: 'sms' });
  const photos = await runWithShop(shop!.id, () => prepare(
    'SELECT storage_key, content_type, from_customer FROM workshop_job_attachments WHERE workshop_job_id = ?',
  ).all(job.id));
  expect(photos.map((p: { content_type: string; from_customer: boolean }) => [p.content_type, p.from_customer])).toEqual([['image/png', true]]);
  expect((await readFile(path.join(UPLOADS_DIR, photos[0].storage_key))).equals(PNG), 'the stored photo is the one sent').toBe(true);

  // the terms copy (server piece 11): the words agreed to are stored on the booking
  const stored = await runWithShop(shop!.id, () => prepare('SELECT terms_text FROM workshop_jobs WHERE id = ?').get(job.id));
  const terms = await (await fetch(`${server!.baseUrl}/api/portal/${slug}/terms`)).json();
  expect(terms.standard).toBe(true);
  expect(stored.terms_text).toBe(terms.text);
});
