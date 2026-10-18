// The React staff diary, piece 5b, in a real browser against the real server:
// two jobs at the same time are a stack that fans out on hover, a fanned job
// opens with a click and moves with a drag, and resting on a job shows its
// summary. (The menu and the chooser are covered in
// tests/screens/diary-extras.test.js.)
// Spec: docs/superpowers/specs/2026-10-03-staff-diary-view-design.md (piece 5b)
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let alexJob: number;
const MON = '2026-10-19';
const TUE = '2026-10-20';

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 900 } });
const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Stack Cycles' });
  const alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  const jo = await seedMechanic(owner.shop.id, { name: 'Jo Taylor' });
  await staff('/api/workshop-settings', {
    method: 'PUT',
    body: { openingHours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, open: '09:00', close: '18:00' })) },
  });
  const a = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Brake service', jobDate: TUE, startTime: '10:00', endTime: '11:00', mechanicId: alex, notes: 'Front brake rubs' } });
  expect(a.status, JSON.stringify(a.body)).toBe(201);
  alexJob = a.body.id;
  const b = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Puncture repair', jobDate: TUE, startTime: '10:00', endTime: '10:30', mechanicId: jo } });
  expect(b.status, JSON.stringify(b.body)).toBe(201);
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

test('a stack fans out on hover; a fanned job opens, shows its summary, and drags to move', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
  const stack = page.getByRole('button', { name: /^2 jobs booked 10:00 to 11:00/ });
  await expect(stack).toBeVisible();

  // A quick click opens the chooser, not a job that hasn't fanned out yet.
  await stack.click();
  const chooser = page.getByRole('dialog', { name: '2 jobs at 10:00' });
  await expect(chooser).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(chooser).toBeHidden();
  await page.mouse.move(0, 0);

  // The fan is hidden until the mouse rests on the stack.
  const fan = page.locator('[data-fan]');
  const tile = fan.locator('button', { hasText: 'Brake service' });
  await expect(fan).toHaveCSS('opacity', '0');
  await stack.hover();
  await expect(fan).toHaveCSS('opacity', '1');

  // Resting on a fanned job shows its summary.
  await tile.hover();
  const summary = page.locator('[data-hover-summary]');
  await expect(summary).toContainText('Brake service');
  await expect(summary).toContainText('Front brake rubs');

  // A click opens it.
  await tile.click();
  const jobPage = page.getByRole('dialog', { name: /Brake service/ });
  await expect(jobPage).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(jobPage).toBeHidden();

  // Dragging it down an hour moves it out of the stack.
  await page.mouse.move(0, 0);
  await stack.hover();
  await expect(fan).toHaveCSS('opacity', '1');
  const box = (await tile.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 8 + 58, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await staff(`/api/workshop-jobs/${alexJob}`)).body.startTime).toBe('11:00');
  await expect(page.getByRole('button', { name: /^2 jobs booked/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Bike, Brake service/ })).toBeVisible();
});

// Fresh review of #112, finding 3: a fanned tile hangs over the next day, so
// a small nudge on its outer half must not move the job there.
test('nudging a fanned job a little keeps it on its own day', async ({ page, context }) => {
  const WED = '2026-10-21';
  const alex = await seedMechanic(owner.shop.id, { name: 'Sam Price' });
  const jo = await seedMechanic(owner.shop.id, { name: 'Kit Lane' });
  const a = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Gear tune', jobDate: WED, startTime: '14:00', endTime: '15:00', mechanicId: alex } });
  const b = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Chain swap', jobDate: WED, startTime: '14:00', endTime: '14:30', mechanicId: jo } });
  expect(a.status, JSON.stringify(a.body)).toBe(201);
  expect(b.status, JSON.stringify(b.body)).toBe(201);
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
  const stack = page.getByRole('button', { name: /^2 jobs booked 14:00 to 15:00/ });
  await stack.hover();
  const fan = page.locator('[data-fan]').filter({ hasText: 'Gear tune' });
  await expect(fan).toHaveCSS('opacity', '1');
  // The tile furthest from the stack's middle, grabbed near its outer edge.
  const day = (await page.locator(`[data-diary-col]`).nth(2).boundingBox())!;
  const tiles = fan.locator('button');
  const boxes = [(await tiles.nth(0).boundingBox())!, (await tiles.nth(1).boundingBox())!];
  const outer = boxes[0].x < day.x || boxes[0].x + boxes[0].width > day.x + day.width ? boxes[0] : boxes[1];
  const x = outer.x < day.x ? outer.x + 4 : outer.x + outer.width - 4;
  expect(x < day.x || x > day.x + day.width, 'the grab point hangs over the next day').toBe(true);
  await page.mouse.move(x, outer.y + 8);
  await page.mouse.down();
  // Down half an hour, so the move is saved either way; then check the day.
  const saved = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/workshop-jobs\/\d+$/.test(r.url()));
  await page.mouse.move(x, outer.y + 8 + 30, { steps: 4 });
  await page.mouse.up();
  const put = await saved;
  expect(put.request().postDataJSON().jobDate).toBe(WED);
});

// Fresh review of the follow-up: an ordinary job grabbed off-centre and dropped
// near the far edge of the next day lands on that day, where the pointer is.
test('a job grabbed near its edge lands on the day under the pointer', async ({ page, context }) => {
  const THU = '2026-10-22';
  const FRI = '2026-10-23';
  const mech = await seedMechanic(owner.shop.id, { name: 'Rae Moss' });
  const j = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Bottom bracket', jobDate: THU, startTime: '16:00', endTime: '17:00', mechanicId: mech } });
  expect(j.status, JSON.stringify(j.body)).toBe(201);
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
  const block = page.getByRole('button', { name: /^Bike, Bottom bracket/ });
  const b = (await block.boundingBox())!;
  const fri = (await page.locator('[data-diary-col="4"]').boundingBox())!;
  await page.mouse.move(b.x + 4, b.y + 8);
  await page.mouse.down();
  const saved = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/workshop-jobs\/\d+$/.test(r.url()));
  await page.mouse.move(fri.x + fri.width - 4, b.y + 8, { steps: 8 });
  await page.mouse.up();
  expect((await saved).request().postDataJSON().jobDate).toBe(FRI);
});

// Seen on screen (4 Oct): on a tablet, the press-and-hold tray ran off the
// diary's left edge and squashed short jobs. It must stay inside the diary,
// with tiles at least the drawn 56px tall (touchStackTile).
test('on a tablet, press and hold lays a stack out on a tray that fits the diary', async ({ browser }) => {
  // Monday, the left-most day, where the tray has least room.
  const a = await seedMechanic(owner.shop.id, { name: 'Lou Hart' });
  const b = await seedMechanic(owner.shop.id, { name: 'Ida Kerr' });
  for (const body of [
    { title: 'Brake bleed', jobDate: MON, startTime: '09:00', endTime: '10:00', mechanicId: a },
    { title: 'Valve swap', jobDate: MON, startTime: '09:00', endTime: '09:30', mechanicId: b },
  ]) {
    const r = await staff('/api/workshop-jobs', { method: 'POST', body });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
  }
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1024, height: 768 } });
  try {
    const [name, value] = owner.cookie.split('=');
    await ctx.addCookies([{ name, value, url: server!.baseUrl }]);
    const page = await ctx.newPage();
    await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
    const stack = page.getByRole('button', { name: /^2 jobs booked 09:00 to 10:00/ });
    const s = (await stack.boundingBox())!;
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: s.x + s.width / 2, y: s.y + 10 }] });
    const fan = page.locator('[data-fan][data-open="true"]');
    await expect(fan).toBeVisible();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const grid = (await page.locator('[data-diary-col]').first().locator('xpath=ancestor::div[contains(@class,"overflow-x-auto")][1]').boundingBox())!;
    const tray = (await fan.boundingBox())!;
    expect(tray.x, 'the tray starts inside the diary').toBeGreaterThanOrEqual(grid.x);
    expect(tray.x + tray.width, 'the tray ends inside the diary').toBeLessThanOrEqual(grid.x + grid.width);
    for (const tile of await fan.locator('button').all()) expect((await tile.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  } finally {
    await ctx.close();
  }
});

// Jack, 16 Oct: everything clickable shows the pointing-finger cursor, as the
// sidebar's links already do (Tailwind 4 leaves buttons with the arrow).
// Spec: openspec/changes/pick-hover-and-pointer
test('buttons show the pointing-finger cursor; a disabled one keeps the arrow', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
  await expect(page.getByRole('button', { name: 'New job' })).toHaveCSS('cursor', 'pointer');
  await expect(page.getByRole('button', { name: 'Next week' })).toHaveCSS('cursor', 'pointer');
  // A job that can be dragged keeps its open hand, which says it can move too.
  await expect(page.getByRole('button', { name: /Puncture repair/ }).first()).toHaveCSS('cursor', 'grab');
  const disabled = await page.evaluate(() => {
    const b = document.createElement('button');
    b.disabled = true;
    document.body.append(b);
    const c = getComputedStyle(b).cursor;
    b.remove();
    return c;
  });
  expect(disabled).toBe('default');
});

// Jack, 16 Oct: typing a customer's name doesn't change New job's size.
// Spec: openspec/changes/new-job-customer-dropdown
test('New job keeps its size while a customer search shows its results', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
  await page.getByRole('button', { name: 'New job' }).click();
  await page.getByRole('button', { name: 'Enter a time instead' }).click();
  const dialog = page.getByRole('dialog', { name: 'New job' });
  await expect(dialog).toBeVisible();
  const before = (await dialog.boundingBox())!.height;
  await dialog.getByLabel('Find customer by name, phone or email').fill('zz');
  const list = dialog.locator('[data-customer-results]');
  await expect(list.getByText('No customer matches “zz”.')).toBeVisible();
  expect((await dialog.boundingBox())!.height).toBe(before);
  // Escape in the search closes the list, keeping what was typed and New job.
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
  await expect(dialog.getByLabel('Find customer by name, phone or email')).toHaveValue('zz');
  await expect(dialog).toBeVisible();
});

// Jack, 16 Oct: nothing that appears pushes the page. New job's "choose a
// time" bar floats at the bottom of the screen, so the diary doesn't move.
// Spec: openspec/changes/floating-diary-messages
test('pressing New job does not move the diary', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
  const monday = page.getByRole('group', { name: /^Monday/ });
  await expect(monday).toBeVisible();
  const before = (await monday.boundingBox())!.y;
  await page.getByRole('button', { name: 'New job' }).click();
  await expect(page.getByText(/Choose a time for the new job\./)).toBeVisible();
  expect((await monday.boundingBox())!.y).toBe(before);
});

// Jack, 16 Oct: Waiting for you is boxed in as a panel, its heading inside
// and its count as a badge. Spec: openspec/changes/waiting-panel
test('Waiting for you is a panel with its count as a badge', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
  const panel = page.getByRole('region', { name: /^Waiting for you/ });
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS('border-top-width', '1px');
  await expect(panel).toHaveCSS('background-color', 'rgb(240, 234, 220)');
  await expect(panel.locator('[data-count-badge]')).toHaveCSS('background-color', 'rgb(255, 253, 247)');
  await expect(panel.locator('[data-count-badge]')).toBeVisible();
});

// The layout review (#238, items 4 and 5): on a tablet, as drawn, the Week /
// Day buttons and a chosen Waiting card's Open button are 44px finger
// targets, and the card's text is larger. Spec: openspec/changes/review-catch-ups
test('on a tablet, the Week and Day buttons are finger-sized', async ({ browser }) => {
  const r = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Full service', jobDate: MON, startTime: '15:00', endTime: '16:00' } });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const ctx = await browser.newContext({ hasTouch: true, isMobile: false, viewport: { width: 1024, height: 768 } });
  try {
    const [name, value] = owner.cookie.split('=');
    await ctx.addCookies([{ name, value, url: server!.baseUrl }]);
    const page = await ctx.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
    const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    test.skip(!coarse, 'this browser does not report a touch pointer');
    for (const tab of ['Week', 'Day']) {
      expect((await page.getByRole('tab', { name: tab }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  } finally {
    await ctx.close();
  }
});

// The layout review's item 1 (Jack, 16 Oct): Week/Day sits with the dates at
// the left, one control, not across a gap. Spec: openspec/changes/toolbar-and-phone-today
test('the Week/Day switch sits next to the date arrows', async ({ page, context }) => {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
  // The switch's last tab is Month since 18 Oct (Jack: month view).
  const last = (await page.getByRole('tab', { name: 'Month' }).boundingBox())!;
  const prev = (await page.getByRole('button', { name: 'Previous week' }).boundingBox())!;
  expect(prev.x - (last.x + last.width)).toBeLessThan(40);
});

// After the fresh review: on a 360px phone away from today, with "By
// mechanic" showing, the Today button fits; the row tightens and the people
// chip shortens rather than the page scrolling sideways (Jack, 16 Oct: "1").
test('on a 360px phone, Today fits in the top row', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
  try {
    const [name, value] = owner.cookie.split('=');
    await ctx.addCookies([{ name, value, url: server!.baseUrl }]);
    const page = await ctx.newPage();
    await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}&who=bymech`);
    const today = page.getByRole('button', { name: 'Today' });
    await expect(today).toBeVisible();
    const box = (await today.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    // The top row itself doesn't run over (the grid below is checked elsewhere).
    const row = today.locator('xpath=ancestor::div[contains(@class, "justify-between")][1]');
    expect(await row.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    const chip = (await page.getByRole('button', { name: /^Showing By mechanic/ }).boundingBox())!;
    const prev = (await page.getByRole('button', { name: 'Previous week' }).boundingBox())!;
    expect(chip.x + chip.width).toBeLessThanOrEqual(prev.x);
  } finally {
    await ctx.close();
  }
});

// The layout review's item 7 (Jack approved the drawing, 16 Oct): on an
// upright tablet (834 wide) the toolbar sits on two rows and "Waiting for you"
// is a button opening the phone's list, so the week has the full width.
// Spec: openspec/changes/upright-tablet-diary
test('on an upright tablet, Waiting is a button and the toolbar has two rows', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 834, height: 1112 }, hasTouch: true });
  try {
    const [name, value] = owner.cookie.split('=');
    await ctx.addCookies([{ name, value, url: server!.baseUrl }]);
    const page = await ctx.newPage();
    await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
    await expect(page.getByRole('region', { name: /^Waiting for you/ })).toBeHidden();
    const waiting = page.getByRole('button', { name: /^Waiting for you, \d+/ });
    await expect(waiting).toBeVisible();
    const tabs = (await page.getByRole('tablist', { name: 'Diary view' }).boundingBox())!;
    const newJob = (await page.getByRole('button', { name: 'New job' }).boundingBox())!;
    expect(newJob.y).toBeGreaterThan(tabs.y + tabs.height - 1);
    await waiting.click();
    await expect(page.getByRole('dialog', { name: /^Waiting for you \(\d+\)/ })).toBeVisible();
  } finally {
    await ctx.close();
  }
});

// Jack, 18 Oct: Shared queue is a fourth button after the mechanics; the
// toolbar still fits one row on a 1280px laptop and wider. (At 1024px it
// was already two rows before Shared queue.)
for (const width of [1280, 1366]) {
  test(`at ${width}px, the toolbar with Shared queue stays one row`, async ({ page, context }) => {
    // Its own shop with two mechanics (four people buttons): other tests
    // here add more mechanics to the shared shop, and more buttons wrap.
    const shop = await staffSignup(server!.baseUrl, { shopName: 'Toolbar Cycles' });
    try {
      await seedMechanic(shop.shop.id, { name: 'Alex Morgan' });
      await seedMechanic(shop.shop.id, { name: 'Jo Taylor' });
      await page.setViewportSize({ width, height: 800 });
      const [name, value] = shop.cookie.split('=');
      await context.addCookies([{ name, value, url: server!.baseUrl }]);
      await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
      await expect(page.getByRole('button', { name: 'Shared queue' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Jo Taylor' })).toBeVisible();
      const tabs = (await page.getByRole('tablist', { name: 'Diary view' }).boundingBox())!;
      const newJob = (await page.getByRole('button', { name: 'New job' }).boundingBox())!;
      expect(Math.abs(newJob.y + newJob.height / 2 - (tabs.y + tabs.height / 2))).toBeLessThan(4);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    } finally {
      await deleteTestShop(shop.shop.id);
    }
  });
}

// The tighter spacing is the desktop drawing's only; tablets keep theirs
// (12px from Week/Day to the dates, 6px between people buttons).
for (const width of [834, 1024]) {
  test(`at ${width}px, the toolbar keeps the tablet drawing's spacing`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
    await expect(page.getByRole('button', { name: 'Shared queue' })).toBeVisible();
    const gaps = await page.evaluate(() => {
      const tabs = document.querySelector('[role="tablist"][aria-label="Diary view"]')!.getBoundingClientRect();
      const prev = document.querySelector('button[aria-label="Previous week"]')!.getBoundingClientRect();
      const chips = [...document.querySelectorAll('[role="group"][aria-label="Mechanic"] > button')].map((b) => b.getBoundingClientRect());
      return { toDates: Math.round(prev.left - tabs.right), chip: Math.round(chips[1].left - chips[0].right) };
    });
    expect(gaps).toEqual({ toDates: 12, chip: 6 });
  });
}

test('on a computer, Waiting stays a column beside the diary', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
  await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}`);
  await expect(page.getByRole('region', { name: /^Waiting for you/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Waiting for you, \d+/ })).toBeHidden();
});

// Jack, 17 Oct: on a phone, "By mechanic" columns stay readable (at least
// 96px) and the diary scrolls sideways inside its own area; the page doesn't,
// the times stay put and the names move with their columns.
// Spec: openspec/changes/phone-bymech-columns
test('on a phone, By mechanic columns stay readable and scroll sideways', async ({ browser }) => {
  for (const extra of ['Ravi Dhar', 'Nell Ames', 'Tom Ruiz', 'Ola Berg']) await seedMechanic(owner.shop.id, { name: extra });
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
  try {
    const [name, value] = owner.cookie.split('=');
    await ctx.addCookies([{ name, value, url: server!.baseUrl }]);
    const page = await ctx.newPage();
    await page.goto(`${server!.baseUrl}/workshop/diary?date=${MON}&who=bymech`);
    const heading = page.locator('[data-mech-headings] span[data-mech]').first();
    await expect(heading).toBeVisible();
    expect((await heading.boundingBox())!.width).toBeGreaterThanOrEqual(96);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    const scroller = page.locator('[data-mech-scroll]');
    expect(await scroller.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
    const time = page.locator('[data-mech-scroll] [data-hours]');
    const before = (await time.boundingBox())!.x;
    await scroller.evaluate((e) => { e.scrollLeft = 200; e.dispatchEvent(new Event('scroll')); });
    await expect.poll(async () => (await time.boundingBox())!.x).toBe(before);
    await expect.poll(() => page.locator('[data-mech-headings]').evaluate((e) => e.scrollLeft)).toBe(200);
  } finally {
    await ctx.close();
  }
});

// After the fresh review: a drag only lands on a column you can see. Let go
// over the times, with Alex's column scrolled under them, and the job stays
// with its own mechanic. Alfie sorts straight after Alex, so his column is
// the second one, on screen. Spec: openspec/changes/phone-bymech-columns
test('on a phone, a drag never lands on a column hidden under the times', async ({ browser }) => {
  const alfie = await seedMechanic(owner.shop.id, { name: 'Alfie Ash' });
  // Enough mechanics that the columns scroll, even when this test runs alone.
  for (const extra of ['Kit Lowe', 'Ana Quist']) await seedMechanic(owner.shop.id, { name: extra });
  const made = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Wheel true', jobDate: TUE, startTime: '13:00', endTime: '14:00', mechanicId: alfie } });
  expect(made.status, JSON.stringify(made.body)).toBe(201);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
  try {
    const [name, value] = owner.cookie.split('=');
    await ctx.addCookies([{ name, value, url: server!.baseUrl }]);
    const page = await ctx.newPage();
    await page.goto(`${server!.baseUrl}/workshop/diary?date=${TUE}&who=bymech`);
    const column = page.getByRole('group', { name: 'Alfie Ash' });
    const job = column.getByRole('button', { name: /Wheel true/ });
    await expect(job).toBeVisible();
    await page.locator('[data-mech-scroll]').evaluate((e) => { e.scrollLeft = 60; e.dispatchEvent(new Event('scroll')); });
    const sent: string[] = [];
    page.on('request', (r) => { if (r.method() === 'PUT') sent.push(r.postData() ?? ''); });
    const box = (await job.boundingBox())!;
    const times = (await page.locator('[data-mech-scroll] [data-hours]').boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x - 20, box.y + 10, { steps: 4 });
    await page.mouse.move(times.x + 20, box.y + 10, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    expect(sent.filter((b) => !b.includes(`"mechanicId":${alfie}`) && b.includes('mechanicId'))).toEqual([]);
    await expect(column.getByRole('button', { name: /Wheel true/ })).toBeVisible();
  } finally {
    await ctx.close();
  }
});
