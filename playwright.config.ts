import { defineConfig } from '@playwright/test';

// Journey tests drive the real bundle on the real server against the compose
// Postgres - never a dev server.
//
// Its own port, and never a reused server: on a dev machine 8080 is the docker
// `app` container, built from whatever the image was last built from. Reusing
// whatever answers a port would test that old code and pass or fail for
// reasons unrelated to the working tree.
//
// A free port per run, not a fixed one: several sessions test at once on one
// Mac, each in its own worktree, and with 8091 for all a second browser run
// stopped at once ("already used", 10 Nov). The run picks it and keeps it in
// WH_BROWSER_PORT, so its workers, which load this file again, use the same
// one (tests/playwright-port.test.js).
async function freePort(): Promise<string> {
  const { createServer } = await import('node:net');
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(String(port)));
    });
  });
}
process.env.WH_BROWSER_PORT ||= await freePort();
const PORT = Number(process.env.WH_BROWSER_PORT);

export default defineConfig({
  testDir: 'tests/browser',
  // Journey tests share one database. Running them in parallel means two
  // journeys booking the same capacity slot, which is a real race that would
  // show up as flake rather than as a finding.
  workers: 1,
  fullyParallel: false,
  // Two retries hide flake. One retry, and a test that needs it gets looked at.
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure' },
  webServer: {
    // Builds first so the page serves the bundle from this working tree.
    // Locally that dirties public/dist - see the trap in .agents/STATUS.md.
    command: 'npm run build && npm start',
    // Pretend WorkOS too: a developer's .env may connect the real one, and a
    // test never reaches a real outside service (staff-signin-workos-screens).
    // An empty sign-in skip holds: .env never overrides a variable already set, so a
    // developer's local skip stays out of these tests.
    env: { PORT: String(PORT), PAYMENTS_PROVIDER: 'pretend', STAFF_SIGNIN_PROVIDER: 'pretend', WHEELHOUSE_DEV_AUTOLOGIN: '' },
    url: `http://127.0.0.1:${PORT}/workshop`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
