// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';

// The old app (public/app.js) signed out: since staff sign in only through
// WorkOS (#504), its email-and-password "Log in" box always refused. Its Log
// in tab now leads to the new sign-in screen (the old app is a placeholder
// whose screens go as their replacements land: project rule 5; Jack, 21 Oct).
// "Create shop account" stays, as it is still the only shop sign-up.
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;

test.describe.configure({ timeout: 60_000 });
test.beforeAll(async () => { server = await startLiveServer(); });
test.afterAll(async () => { if (server) await server.stop(); });

test('the old app signed out: Log in leads to “Sign in to Wheelhouse”, with no password box', async ({ page }) => {
  await page.goto(`${server!.baseUrl}/`);
  const signIn = page.getByRole('link', { name: 'Sign in' });
  await expect(signIn).toHaveAttribute('href', '/workshop/sign-in');
  await expect(page.locator('#auth-password')).toHaveCount(0);
  await signIn.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in to Wheelhouse' })).toBeVisible();
});

test('the old app signed out: Create shop account is still there, with its password box', async ({ page }) => {
  await page.goto(`${server!.baseUrl}/`);
  await page.getByRole('button', { name: 'Create shop account' }).click();
  // The old app's labels aren't tied to their boxes, so they're found by id.
  await expect(page.locator('#auth-shop-name')).toBeVisible();
  await expect(page.locator('#auth-password')).toBeVisible();
});
