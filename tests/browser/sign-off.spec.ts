// The mechanic sign-off, piece 1 (Jack, 16 and 18 Oct,
// docs/decisions/2026-10-16-mechanic-sign-off.md), against the real server:
// Mark ready for collection asks who is signing it off, the job's mechanic
// picked; signing off finishes the work, and the page shows who and when.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let jobId: number;
let alex: number;
const TUE = '2026-10-13';

test.describe.configure({ timeout: 90_000 });
const staff = (path: string, options?: object) => staffRequest(server!.baseUrl, owner.cookie, path, options);

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  await seedMechanic(owner.shop.id, { name: 'Jo Taylor' });
  let job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: TUE, startTime: '10:00', endTime: '11:00', mechanicId: alex } })).body;
  jobId = job.id;
  for (const step of ['book-in', 'start']) {
    const r = await staff(`/api/workshop-jobs/${jobId}/${step}`, { method: 'POST', body: { version: job.version } });
    expect(r.status, `${step}: ${JSON.stringify(r.body)}`).toBe(200);
    job = r.body;
  }
});

test.afterAll(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`signing off a job at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const [name, value] = owner.cookie.split('=');
    await context.addCookies([{ name, value, url: server!.baseUrl }]);
    // The first run finishes the job; the phone run reopens it first.
    const now = (await staff(`/api/workshop-jobs/${jobId}`)).body;
    if (now.workState === 'complete') {
      const r = await staff(`/api/workshop-jobs/${jobId}/reopen-work`, { method: 'POST', body: { version: now.version } });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
    }
    await page.goto(`${server!.baseUrl}/workshop/diary?date=${TUE}${viewport.width < 768 ? '&day=2026-10-13' : ''}`);
    await page.getByRole('button', { name: /Standard service/ }).first().click();
    const job = page.getByRole('dialog', { name: /Standard service/ });
    await job.getByRole('button', { name: 'Mark ready for collection' }).click();
    const pop = page.getByRole('dialog', { name: 'Who’s signing this off?' });
    await expect(pop.getByRole('radio', { name: 'Alex Morgan' })).toHaveAttribute('aria-checked', 'true');
    await expect(pop.getByRole('radio', { name: 'Jo Taylor' })).toHaveAttribute('aria-checked', 'false');
    await pop.getByRole('button', { name: 'Sign off and mark ready' }).click();
    await expect(pop).toBeHidden();
    await expect(job.getByText(/^Signed off by Alex Morgan · \w{3} \d{1,2} \w{3}, \d{2}:\d{2}$/)).toBeVisible();
    const done = (await staff(`/api/workshop-jobs/${jobId}`)).body;
    expect([done.workState, done.signedOffBy]).toEqual(['complete', alex]);
  });
}
