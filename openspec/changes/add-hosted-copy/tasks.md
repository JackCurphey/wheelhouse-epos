# Tasks: a hosted copy for Jack (WP-0.5)

Lane: Mark, unless a group says otherwise. When each group can start:

- **Group 1:** any time. It doesn't touch `server.js`.
- **Group 2:** waits for WP-0.4's route moves to merge (split plan §9 line 6;
  nothing edits `server.js` while it moves).
- **Group 3:** tasks 3.2 and 3.3 wait for Jack's yes to DigitalOcean on #137, and Jack does them himself (Mark, 15 Oct), with Mark on hand. Tasks 3.4 to 3.6 also wait for group 2, which adds the commit to `/healthz` and the real-key guard.
- **Group 4:** after group 3.
- **Group 5:** Jack's hands, Mark's eyes (PL-3).

Each of groups 1–3 is about one pull request (aim: 250–600 changed lines).

## 1. The test shop loaded from the drawings (Jack could take this, with Mark's approval)

- [x] 1.1 List each record the test shop needs (shop, site, staff, customers, bikes, products, workshop jobs), with the drawing or persona each value comes from, or `[n]`. Add the list to `design.md` and check it against `docs/design/user-journeys/generator/` and `personas.md`
- [x] 1.2 Write tests first for `scripts/dev/load-test-shop.mjs`, and watch each fail:
  - it loads onto an empty database;
  - it refuses when the test shop already exists, changing nothing;
  - it refuses when any other shop exists;
  - another shop can't see the test shop's rows.
- [x] 1.3 Write the loader using the server's database helpers. Verify the 1.2 tests pass, and that the app on `localhost:8080` shows the test shop after running it. Shown on a local copy of the app run on its own port against a throwaway database, because the compose database behind 8080 holds other shops and the loader refuses there: the diary shows the drawn week of 14 to 20 September with Waiting for you (3)
- [x] 1.4 Verify `npm test` and `npm run test:browser` pass, then get a fresh review against `specs/hosted-copy/spec.md`. `npm test` 1750/1750 and `npm run test:browser` 34/34. The fresh review found WH-1038 and WH-1040 without their drawn customers, WH-1046 missing, and Waiting for you out of the drawn order; each fixed with a test watched failing first

## 2. The hosted-copy guard, Shopify switched off, and the commit in the health check (Mark; after WP-0.4)

- [x] 2.1 Write tests first for the `WHEELHOUSE_HOSTED_COPY=1` start-up guard, and watch each fail because the guard doesn't exist yet:
  - it refuses with any `TWILIO_*` setting;
  - it refuses without `NODE_ENV=production`;
  - it refuses with `DB_TENANT_SCOPE=transaction`;
  - each refusal comes before any migration runs and names the setting;
  - it starts with none of these.
- [x] 2.2 Add the guard before `runMigrations()` in the start-up order, with the known real-key list starting at Twilio. Verify the 2.1 tests pass
- [x] 2.3 Write a test first that `POST /api/shopify/connection`, with the setting on, is refused with "This is a test copy of Wheelhouse: connecting Shopify is switched off." and saves nothing. Watch it fail, then add the refusal in `server/routes/website.js`. Verify it passes, and that the existing Shopify tests still pass with the setting off. Refused with 403 before the request is read (`tests/hosted-copy-switches.test.js`); watched failing first with 400 "Could not connect"
- [x] 2.4 Write a test first that `/healthz` returns `commit` from `WHEELHOUSE_COMMIT`, with no `commit` when it is unset. Watch it fail, then add it and verify it passes
- [x] 2.4a Write a test first that the 503 `/healthz` gives when the database is down also carries `commit`. Watch it fail, then add it and verify it passes. Extended the database-down test in `tests/server-lifecycle.test.js`; watched failing first with `commit` undefined on the 503
- [x] 2.5 Add a test that, with the setting on and `NODE_ENV=production`, a pinned `WHEELHOUSE_TEST_CLOCK` has no effect. This checks the clock's existing behaviour (`server/clock.js:16`), so it is expected to pass straight away. Confirm it is really testing that by removing line 16 briefly and watching it fail. Seen: without line 16 it failed with "expected the real time, got 2026-09-01T06:00:00.000Z"; line 16 put back unchanged
- [ ] 2.6 Verify `npm test` and `npm run test:browser` pass, then get a fresh review

## 3. The host and the first deploy (Mark; waits for Jack's yes on #137)

- [x] 3.1 Jack answered #137: a UK region, for the test copy only. Mark compared Fly.io, free tiers and London servers, and chose DigitalOcean (London) with managed Postgres. Recorded in `docs/decisions/2026-10-15-hosted-copy-region.md`, with PL-1 settled for the test copy
- [ ] 3.2 (Jack) Jack says yes on #137, opens the DigitalOcean account with his card and invites Mark. Jack makes an API token and stores it with `doctl auth init` on his machine; no token goes in the repo or chat
- [ ] 3.3 (Mark writes, Jack runs) `scripts/hosting/` (setup with `doctl`, a first-boot script, the Caddy and compose files) and `docs/runbooks/hosted-copy.md`, Jack's step-by-step guide. Running it should create, all in `lon1`:
  - the 1GB droplet with Mark's SSH key, automatic security updates, and a firewall open only for web traffic and SSH;
  - the smallest managed Postgres cluster, with trusted sources limited to the droplet, the app's database and its own non-admin login, connected by its direct address (port 25060) with SSL, the server holding DigitalOcean's certificate and the app trusting it (`NODE_EXTRA_CA_CERTS`);
  - the server's settings file: `NODE_ENV=production`, `WHEELHOUSE_HOSTED_COPY=1`, a generated `SHOPIFY_TOKEN_ENCRYPTION_KEY`, `SIGNUP_CODE`, `TRUST_PROXY`, `PGSSL`, and no `TWILIO_*`;
  - the app started from `main`, built on the server, behind Caddy.

  Verify point-in-time restore is available on the cluster, that migrations and row-level security work under the app's login, and that `/healthz` answers `ok` over HTTPS. Record the database address and port used, and why, in `docs/runbooks/hosted-copy.md`
- [ ] 3.4 (after group 2) Add `.github/workflows/deploy-hosted-copy.yml` as Decision 3 describes:
  - it starts on `workflow_run` and only deploys when `Tests` succeeded on a `push` to this repository's `main`;
  - it builds the image, pushes it to GitHub's container registry (package public) tagged with `head_sha`, and starts it on the server over SSH with a deploy-only key checked against a stored `known_hosts` entry, in one concurrency group, skipping an older commit;
  - it records the time before each deploy;
  - it waits for `/healthz` to show the new commit, and fails and starts the previous image otherwise.

  Verify that a merge deploys and `/healthz` shows its commit, and that a branch push or pull request deploys nothing
- [ ] 3.5 On the hosted copy, deploy by hand a scratch commit with a deliberately failing migration. Verify that the deploy is reported as failed and that the previous version is serving within [n] minutes, and write down what was seen and how long it took
- [ ] 3.6 (after group 2) Load the test shop, make Jack's test login, and send him the address and login privately, never in the repo. Tell him uploads aren't kept. From a phone, verify that signing in works, `http://` goes to `https://`, and sign-up without the code is refused

## 4. The way back (Mark; after group 3)

- [x] 4.1 In `docs/runbooks/hosted-copy.md`, write deploying, checking that `WHEELHOUSE_HOSTED_COPY=1` is set, rolling back with no migration, and rolling back with a migration in Decision 8's order. Written for today's by-hand updates (the deploy workflow, 3.4, isn't built yet) and checked against `scripts/hosting/`; the restore details read `[to confirm …]` until 4.1b
- [ ] 4.1b Verify each rollback by doing it once on the hosted copy and writing down the time in the runbook (split from 4.1 on 22 Oct, so 4.1's tick doesn't claim a run that hasn't happened; the hosted copy isn't set up yet)

## 5. The restore rehearsal (PL-3: Jack's hands, Mark's eyes)

- [ ] 5.1 Mark writes the restore steps for Jack in plain English, in `docs/runbooks/hosted-copy.md`. Jack reads them and says they're clear
- [ ] 5.2 Jack, with Mark watching, restores the database to a chosen moment into a new cluster, points a fresh copy at it, and opens a job. Record it in `docs/runbooks/<date>-restore-drill.md` with each step and its time. This task stays open ("blocked") until it is actually done
- [ ] 5.3 Fill in the spec's `[n]` values from what was measured and agreed, then get a fresh review of the whole change against the spec

## Workflow follow-up

- Archive the change with `/opsx:archive` as the last commit of the last pull request, before it merges.
- Tell Jack on #199 that the hosted copy is up, and add it to the day's status pull request.
