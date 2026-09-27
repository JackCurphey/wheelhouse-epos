// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import type { BrowserContext, Page } from '@playwright/test';
import { startLiveServer, TEST_CLOCK_PIN } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic, staffFreshCookie } from '../helpers/staff.js';
import { portalSignup } from '../helpers/portal.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { bookOnline, dayMaker, linkActions } from '../helpers/linkActions.js';
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
// A real 1x1 PNG: the booking route accepts a photo by its bytes.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

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
    if (server) await server.stop();
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

async function signIn(context: BrowserContext, cookie = owner.cookie) {
  const [name, value] = cookie.split('=');
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
  const accepted = await staff(`/api/workshop-jobs/${booked.id}/accept`, { method: 'POST', body: { version: 1 } });
  expect(accepted.status).toBe(200);
  await signIn(context);
  await openDiary(page);
  const block = page.locator(`.wk-job-block[data-job="${booked.id}"]`);
  await goToWeekOf(page, block);
  const origBox = (await block.boundingBox())!;
  // Someone else saves the job after the diary loaded it.
  const changedElsewhere = await staff(`/api/workshop-jobs/${booked.id}`, { method: 'PUT', body: { notes: 'Changed elsewhere' } });
  expect(changedElsewhere.status).toBe(200);
  // Drag the block down one hour.
  await page.mouse.move(origBox.x + origBox.width / 2, origBox.y + 10);
  await page.mouse.down();
  await page.mouse.move(origBox.x + origBox.width / 2, origBox.y + 10 + 48, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('#toast')).toContainText('This job changed while you were looking at it.');
  const after = (await staff(`/api/workshop-jobs/${booked.id}`)).body;
  expect(after.startTime).toBe('10:00');
  // The diary reloads: the block is drawn back at its original 10:00 position.
  await expect(block).toBeVisible();
  const redrawnBox = (await block.boundingBox())!;
  expect(Math.round(redrawnBox.y)).toBe(Math.round(origBox.y));
});

test('toggling complete on a job changed elsewhere is refused and the form closes', async ({ page, context }) => {
  const booked = await book();
  await staff(`/api/workshop-jobs/${booked.id}/accept`, { method: 'POST', body: { version: 1 } });
  await signIn(context);
  await openDiary(page);
  const block = page.locator(`.wk-job-block[data-job="${booked.id}"]`);
  await goToWeekOf(page, block);
  await block.click();
  await expect(page.locator('#workshop-job-form')).toBeVisible();
  // Someone else saves the job after the form opened.
  await staff(`/api/workshop-jobs/${booked.id}`, { method: 'PUT', body: { notes: 'Changed elsewhere' } });
  await page.locator('#wj-complete-toggle').click();
  await expect(page.locator('#toast')).toContainText('This job changed while you were looking at it.');
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
});

test('a new online booking is listed with its details, and clicking it jumps to the job', async ({ page, context }) => {
  const booked = await book();
  await signIn(context);
  await openDiary(page);
  const card = page.locator(`.waiting-card[data-job="${booked.id}"]`);
  await expect(page.locator('.workshop-feed-title')).toHaveText(/^Waiting for you \(\d+\)$/);
  await expect(card).toContainText('New booking');
  await expect(card).toContainText('Brake check');
  await expect(card).toContainText('Sam');
  await expect(card).toContainText(/Arrived (just now|\d+ minutes? ago)/);
  await card.click();
  const block = page.locator(`.wk-job-block[data-job="${booked.id}"]`);
  await expect(block).toBeInViewport();
  await expect(block).toHaveClass(/flash-highlight/);
});

test('a staff-made pending job is not listed', async ({ page, context }) => {
  const made = (await staff('/api/workshop-jobs', {
    method: 'POST', body: { title: 'Staff pending', jobDate: nextDay(), startTime: '12:00', endTime: '13:00', mechanicId: sam, status: 'pending' },
  })).body;
  await signIn(context);
  await openDiary(page);
  await expect(page.locator('.workshop-feed-title')).toBeVisible();
  await expect(page.locator(`.waiting-card[data-job="${made.id}"]`)).toHaveCount(0);
});

test('the column picks up a new booking within a minute without a click', async ({ page, context }) => {
  await signIn(context);
  await page.clock.install({ time: new Date(TEST_CLOCK_PIN) });
  await page.goto(`${server!.baseUrl}/#workshop`);
  await expect(page.locator('#workshop-feed')).toBeVisible();
  const booked = await book();
  await expect(page.locator(`.waiting-card[data-job="${booked.id}"]`)).toHaveCount(0);
  await page.clock.fastForward(61_000);
  await expect(page.locator(`.waiting-card[data-job="${booked.id}"]`)).toBeVisible();
});

test('the minute timer stops at logout so it never wipes the login screen', async ({ page, context }) => {
  // A session of its own: /api/auth/logout destroys only this token, so the
  // shared owner.cookie every other test in this file signs in with stays
  // valid.
  await signIn(context, await staffFreshCookie(owner.loginId));
  await page.clock.install({ time: new Date(TEST_CLOCK_PIN) });
  await page.goto(`${server!.baseUrl}/#workshop`);
  await expect(page.locator('#workshop-feed')).toBeVisible();
  const waitingCalls: string[] = [];
  page.on('request', (req) => { if (req.url().endsWith('/api/workshop-waiting')) waitingCalls.push(req.url()); });
  await page.locator('#logout-btn').click();
  await expect(page.locator('#auth-email')).toBeVisible();
  waitingCalls.length = 0;
  await page.locator('#auth-email').fill('still-typing@example.com');
  await page.clock.fastForward(61_000);
  expect(waitingCalls).toEqual([]);
  await expect(page.locator('#auth-email')).toHaveValue('still-typing@example.com');
});

test('a change request shows amber on the job and a dashed outline at the requested time', async ({ page, context }) => {
  const booked = await book();
  await staff(`/api/workshop-jobs/${booked.id}/accept`, { method: 'POST', body: { version: 1 } });
  // Same week as the booking: the next weekday in dayMaker's sequence may be in
  // another week, so ask for 14:00 on the booking's own day.
  const link = linkActions(server!.baseUrl, owner.shop.slug);
  const res = await link.change(booked.code, { jobDate: booked.jobDate, mechanicId: sam, startTime: '14:00' });
  expect(res.status).toBe(200);
  await signIn(context);
  await openDiary(page);
  await page.locator(`.waiting-card[data-job="${booked.id}"]`).click();
  const block = page.locator(`.wk-job-block[data-job="${booked.id}"]`);
  await expect(block).toHaveClass(/mark-move-requested/);
  await expect(block).toContainText('Move requested');
  const label = block.locator('.job-mark-label');
  await expect(label).toHaveText('Move requested');
  await expect(label).toBeVisible();
  const [blockBox, labelBox] = [(await block.boundingBox())!, (await label.boundingBox())!];
  expect(labelBox.height).toBeGreaterThanOrEqual(8);
  expect(labelBox.y).toBeGreaterThanOrEqual(blockBox.y);
  expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(blockBox.y + blockBox.height);
  const outline = page.locator(`.wk-request-outline[data-job="${booked.id}"]`);
  await expect(outline).toBeVisible();
  const [b, o] = [(await block.boundingBox())!, (await outline.boundingBox())!];
  expect(Math.round(o.y - b.y)).toBe(4 * 48); // 10:00 → 14:00 at 48px an hour
});

test("a customer's cancellation shows greyed until seen, and a declined booking is not drawn", async ({ page, context }) => {
  const cancelled = await book();
  const declined = await book();
  const link = linkActions(server!.baseUrl, owner.shop.slug);
  expect((await link.cancel(cancelled.code)).status).toBe(200);
  await staff(`/api/workshop-jobs/${declined.id}/decline`, { method: 'POST', body: { version: 1 } });
  await signIn(context);
  await openDiary(page);
  await page.locator(`.waiting-card[data-job="${cancelled.id}"]`).click();
  const block = page.locator(`.wk-job-block[data-job="${cancelled.id}"]`);
  await expect(block).toHaveClass(/mark-cancelled-unseen/);
  await expect(block).toContainText('Cancelled by customer');
  const label = block.locator('.job-mark-label');
  await expect(label).toHaveText('Cancelled by customer');
  await expect(label).toBeVisible();
  const [blockBox, labelBox] = [(await block.boundingBox())!, (await label.boundingBox())!];
  expect(labelBox.height).toBeGreaterThanOrEqual(8);
  expect(labelBox.y).toBeGreaterThanOrEqual(blockBox.y);
  expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(blockBox.y + blockBox.height);
  await expect(block.locator('.wk-resize-handle')).toHaveCount(0);
  await expect(page.locator(`[data-job="${declined.id}"]`)).toHaveCount(0);
});

async function openFromColumn(page: Page, id: number) {
  await page.locator(`.waiting-card[data-job="${id}"]`).click();
  await page.locator(`.wk-job-block[data-job="${id}"]`).click();
  await expect(page.locator('.review-modal')).toBeVisible();
}

test('the pop-up shows the answers, the photo and the notes, and Accept confirms the booking', async ({ page, context }) => {
  const booked = await book({ photos: [{ dataBase64: PNG.toString('base64'), contentType: 'image/png', filename: 'bike.png' }] });
  await signIn(context);
  await openDiary(page);
  await openFromColumn(page, booked.id);
  const modal = page.locator('.review-modal');
  await expect(modal).toContainText(`New online booking · ${booked.reference}`);
  await expect(modal).toContainText('Brake check');
  await expect(modal).toContainText("What's wrong?");
  await expect(modal).toContainText('Gears slipping');
  await expect(modal).toContainText("Customer's notes");
  await expect(modal).toContainText('Squeaky brakes');
  await expect(modal.locator('img.review-photo')).toHaveCount(1);
  await expect.poll(() => modal.locator('img.review-photo').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await modal.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.locator('.review-modal')).toHaveCount(0);
  await expect(page.locator(`.waiting-card[data-job="${booked.id}"]`)).toHaveCount(0);
  expect((await staff(`/api/workshop-jobs/${booked.id}`)).body.bookingState).toBe('scheduled');
});

test('Decline asks first; keeping the booking changes nothing, confirming declines it', async ({ page, context }) => {
  const booked = await book();
  await signIn(context);
  await openDiary(page);
  await openFromColumn(page, booked.id);
  const modal = page.locator('.review-modal');
  await modal.getByRole('button', { name: 'Decline', exact: true }).click();
  await expect(modal).toContainText("This can't be undone.");
  await modal.getByRole('button', { name: 'Keep booking' }).click();
  await expect(modal.getByRole('button', { name: 'Decline', exact: true })).toBeVisible();
  expect((await staff(`/api/workshop-jobs/${booked.id}`)).body.bookingState).toBe('pending');
  await modal.getByRole('button', { name: 'Decline', exact: true }).click();
  await modal.getByRole('button', { name: 'Decline booking' }).click();
  await expect(page.locator('.review-modal')).toHaveCount(0);
  expect((await staff(`/api/workshop-jobs/${booked.id}`)).body.bookingState).toBe('declined');
  await expect(page.locator(`[data-job="${booked.id}"]`)).toHaveCount(0);
});

test('a change request can be accepted from the pop-up or its outline, and declined', async ({ page, context }) => {
  const link = linkActions(server!.baseUrl, owner.shop.slug);
  const make = async () => {
    const b = await book();
    await staff(`/api/workshop-jobs/${b.id}/accept`, { method: 'POST', body: { version: 1 } });
    expect((await link.change(b.code, { jobDate: b.jobDate, mechanicId: sam, startTime: '14:00' })).status).toBe(200);
    return b;
  };
  const moved = await make();
  const kept = await make();
  await signIn(context);
  await openDiary(page);
  await page.locator(`.waiting-card[data-job="${moved.id}"]`).click();
  await page.locator(`.wk-request-outline[data-job="${moved.id}"]`).click();
  const modal = page.locator('.review-modal');
  await expect(modal).toContainText('Customer asked to move from');
  await modal.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(modal).toHaveCount(0);
  expect((await staff(`/api/workshop-jobs/${moved.id}`)).body.startTime).toBe('14:00');
  await openFromColumn(page, kept.id);
  await page.locator('.review-modal').getByRole('button', { name: 'Decline', exact: true }).click();
  await expect(page.locator('.review-modal')).toHaveCount(0); // no confirmation for a change
  const keptNow = (await staff(`/api/workshop-jobs/${kept.id}`)).body;
  expect([keptNow.startTime, keptNow.requested]).toEqual(['10:00', null]);
});

test("Seen takes a customer's cancellation off the list and the diary", async ({ page, context }) => {
  const booked = await book();
  expect((await linkActions(server!.baseUrl, owner.shop.slug).cancel(booked.code)).status).toBe(200);
  await signIn(context);
  await openDiary(page);
  await openFromColumn(page, booked.id);
  await page.locator('.review-modal').getByRole('button', { name: 'Seen' }).click();
  await expect(page.locator('.review-modal')).toHaveCount(0);
  await expect(page.locator(`[data-job="${booked.id}"]`)).toHaveCount(0);
});

test('answering something someone else already answered says so plainly', async ({ page, context }) => {
  const booked = await book();
  await signIn(context);
  await openDiary(page);
  await openFromColumn(page, booked.id);
  await staff(`/api/workshop-jobs/${booked.id}/accept`, { method: 'POST', body: { version: 1 } });
  await page.locator('.review-modal').getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.locator('.review-message')).toHaveText('This job changed while you were looking at it.');
});

test('closing the pop-up while an answer is on its way leaves the diary usable when the answer comes back', async ({ page, context }) => {
  const booked = await book();
  await signIn(context);
  await openDiary(page);
  await openFromColumn(page, booked.id);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**/api/workshop-jobs/${booked.id}/accept`, async (route) => {
    await held;
    await route.fulfill({
      status: 409, contentType: 'application/json',
      body: JSON.stringify({ error: 'This job changed while you were looking at it. Reload and try again.', code: 'stale' }),
    });
  });
  await page.locator('.review-modal').getByRole('button', { name: 'Accept', exact: true }).click();
  await page.locator('.review-modal #modal-close').click();
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  // Whatever the late answer does next, it fetches the waiting list; wait for that.
  const settled = page.waitForResponse((r) => r.url().endsWith('/api/workshop-waiting'));
  release();
  await settled;
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  await page.locator(`.wk-job-block[data-job="${booked.id}"]`).click();
  await expect(page.locator('.review-modal')).toContainText('New online booking');
  await page.locator('.review-modal #modal-close').click();
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
});

test('with everything answered the column reads "Nothing waiting"', async ({ page, context }) => {
  const { items } = (await staff('/api/workshop-waiting')).body;
  for (const item of items) {
    const job = (await staff(`/api/workshop-jobs/${item.jobId}`)).body;
    const action = { new_booking: 'decline', change_request: 'decline-change', customer_cancelled: 'cancellation-seen' }[item.kind as string];
    await staff(`/api/workshop-jobs/${item.jobId}/${action}`, { method: 'POST', body: { version: job.version } });
  }
  await signIn(context);
  await openDiary(page);
  await expect(page.locator('.workshop-feed-title')).toHaveText('Waiting for you (0)');
  await expect(page.locator('#workshop-feed')).toContainText('Nothing waiting');
});
