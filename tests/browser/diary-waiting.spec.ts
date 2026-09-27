// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { pool } from '../../server/db.js';
import { startLiveServer, TEST_CLOCK_PIN } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { portalSignup } from '../helpers/portal.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { bookOnline, dayMaker } from '../helpers/linkActions.js';
import { purgeAttachmentFiles } from '../helpers/workshopFixtures.js';

// The legacy staff diary (public/app.js, #workshop): "Waiting for you", the
// review pop-up and the grid markings.
// Spec: docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let sam: number;
let svc: { id: number; questions: { id: string; wording: string }[] };
let customer: { cookie: string };
const nextDay = dayMaker();

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London', viewport: { width: 1400, height: 900 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Diary Cycles' });
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  const service = await staff('/api/workshop-services', {
    method: 'POST',
    body: {
      name: 'Brake check', price: 20, minutes: 60, bookableOnline: true,
      questions: [{ wording: "What's wrong?", kind: 'text', required: true }],
    },
  });
  expect(service.status, JSON.stringify(service.body)).toBe(201);
  svc = service.body;
  const settings = await staff('/api/workshop-settings', { method: 'PUT', body: { showPricesOnline: true } });
  expect(settings.status, JSON.stringify(settings.body)).toBe(200);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
});

test.afterAll(async () => {
  try {
    if (owner) { await purgeAttachmentFiles(owner.shop.id); await deleteTestShop(owner.shop.id); }
  } finally {
    try { if (server) await server.stop(); } finally { await pool.end(); }
  }
});

function staff(path: string, options?: object) {
  return staffRequest(server!.baseUrl, owner.cookie, path, options);
}

async function book(overrides: object = {}) {
  const jobDate = nextDay();
  const result = await bookOnline(server!.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate, startTime: '10:00', serviceIds: [svc.id],
    answers: [{ serviceId: svc.id, questionId: svc.questions[0].id, text: 'Gears slipping' }],
    ...overrides,
  });
  return { ...result, jobDate: result.jobDate ?? jobDate };
}

async function signIn(context: BrowserContext) {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
}

async function openDiary(page: Page) {
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));
  await page.goto(`${server!.baseUrl}/#workshop`);
  await expect(page.locator('#workshop-feed')).toBeVisible();
}

// Clicks "Next ›" until the job's block is drawn (at most 8 weeks on).
// Each week's render follows an async fetch, so a single `.isVisible()`
// right after `networkidle` can still race the DOM update; polling with
// `expect(...).toBeVisible()` for a bounded time avoids that race without
// hardcoding the week arithmetic here.
async function isVisibleSoon(locator: ReturnType<Page['locator']>) {
  try {
    await expect(locator).toBeVisible({ timeout: 1500 });
    return true;
  } catch {
    return false;
  }
}

async function goToWeekOf(page: Page, block: ReturnType<Page['locator']>) {
  for (let i = 0; i < 8; i += 1) {
    if (await isVisibleSoon(block)) return;
    await page.locator('#week-next').click();
  }
  await expect(block).toBeVisible();
}

test('a diary drag on a copy someone else has changed is refused and the diary reloads', async ({ page, context }) => {
  const booked = await book();
  await staff(`/api/workshop-jobs/${booked.id}/accept`, { method: 'POST', body: { version: 1 } });
  await signIn(context);
  await openDiary(page);
  const block = page.locator(`.wk-job-block[data-job="${booked.id}"]`);
  await goToWeekOf(page, block);
  // Someone else saves the job after the diary loaded it.
  await staff(`/api/workshop-jobs/${booked.id}`, { method: 'PUT', body: { notes: 'Changed elsewhere' } });
  // Drag the block down one hour.
  const box = (await block.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 10 + 48, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('#toast')).toContainText('This job changed while you were looking at it.');
  const after = (await staff(`/api/workshop-jobs/${booked.id}`)).body;
  expect(after.startTime).toBe('10:00');
});
