import { defineConfig } from '@playwright/test';

// Journey tests drive the real bundle on the real server against the compose
// Postgres - never a dev server.
//
// Its own port, and never a reused server: on a dev machine 8080 is the docker
// `app` container, built from whatever the image was last built from. Reusing
// whatever answers a port would test that old code and pass or fail for
// reasons unrelated to the working tree.
const PORT = 8091;

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
    env: { PORT: String(PORT) },
    url: `http://127.0.0.1:${PORT}/workshop`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
