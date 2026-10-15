# Design: a hosted copy for Jack (WP-0.5)

## Context

See `proposal.md` for why. What the code already does, which this design
builds on:

- **One container image.** The `Dockerfile` builds the screens and runs
  `node server/server.js` on port 4000. `docker-compose.yml` adds Postgres 16
  and `server/gateway.js`, a small always-up process that shows an offline
  page when the app is down.
- **Migrations at start-up.** `server/server.js:5483-5490` runs
  `runMigrations()` under a Postgres advisory lock (30-second limit,
  `server/migrations/run-migrations.js:45`), then `assertPoolerModeSafe()`,
  then creates `uploads/`, and only then listens. Until all of that finishes,
  `/healthz` doesn't answer, and it answers 503 when the database is
  unreachable (`server/server.js:5010-5015`).
- **The pooler guard can only prove a connection unsafe, never safe.**
  `POOLER_GUARD_ON_UNSAFE = 'fail'` (`server/db.js:468`). But the probe can
  pass behind a transaction-mode pooler that has spare connections
  (`server/db.js:495-502`). It runs after migrations, and it skips its check
  entirely under `DB_TENANT_SCOPE=transaction` (`server/db.js:580-584`).
  That mode can tell a caller a save worked before it was saved
  (`server/db.js:326-332`), which is #137's concern.
- **Uploads on local disk.** `UPLOADS_DIR` is `<repo>/uploads`
  (`server/server.js:260`), `/app/uploads` in the image, and a named volume
  under compose. Job attachments and uploaded images use it
  (`server/server.js:2892-3096`).
- **Outside services today.**
  - Texts go through Twilio only when `TWILIO_ACCOUNT_SID`,
    `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER` are all set
    (`server/sms.js:24-29`).
  - Without them, the quote route says "Texts aren't set up on this
    Wheelhouse yet." (`server/server.js:2620`). Texting a customer saves a
    "failed" message with "SMS is not configured on this server"
    (`server/routes/customer-messages.js:54-60`).
  - Shopify connects when staff paste a token (`POST /api/shopify/connection`,
    `server/routes/website.js:41`).
  - No payment, email or sign-in provider exists yet.
- **`NODE_ENV=production` does two things today:** the clock ignores
  `WHEELHOUSE_TEST_CLOCK` (`server/clock.js:16`), and the server refuses to
  start without `SHOPIFY_TOKEN_ENCRYPTION_KEY` (`server/shopify.js:10-12`).
- **Sign-up is closed** unless `SIGNUP_CODE` is set and given
  (`server/routes/auth.js:48-57`).
- **There is no test data loader.** `scripts/dev/` has `new-db.mjs` and
  `purge-test-shops.mjs`.

## Goals / Non-Goals

**Goals:**
- Name no host. Any host that passes the checklist in Decision 1 will do, so
  Jack can choose on #137 without the spec changing.
- Keep code changes small: one start-up guard, one Shopify refusal, the
  commit in `/healthz`, and a loader for the test shop. The rest is host
  settings, a GitHub workflow and runbooks.

**Non-Goals:**
- Hosting fit for real shops (more than one server, monitoring, a status
  page). That is PL-11 to PL-14, before go-live.
- A file store such as S3 for uploads (Decision 4), unless the chosen host
  forces it (Decision 1).

## Decisions

### 1. What the host must offer (the checklist for Jack's choice)

The host SHALL offer:
- running our existing container image;
- managed Postgres 16 with point-in-time restore over [n] days and a
  **direct** connection address (PL-2);
- a persistent disk that survives deploys and restarts;
- HTTPS on a fixed address;
- deploys started from GitHub Actions, with its own deploy-on-push switched
  off;
- a UK or EU region, whichever Jack picks;
- disk snapshots, or another place inside the same account to copy uploads
  to each night.

**The disk and a no-downtime deploy, together.** Many hosts can't keep the
old version serving while the new one starts if the app has a persistent
disk: the disk belongs to one machine, so the old container stops first.
That is fine for a test copy, but it changes what a failed migration looks
like. The copy is down until the old version is put back, rather than the
old version carrying on. So the spec promises "reported, and back on the
previous version within [n] minutes", which every host on the list can
meet:
- where the host can do both, a failed deploy never takes the copy down;
- where it can't, the deploy workflow puts the previous version back itself
  (Decision 3).

Each candidate host is checked against this before it goes to Jack. If none
can put the previous version back automatically, a file store (Decision 4's
alternative) moves into this change.

*Alternative:* a plain virtual server running `docker compose`. It is
cheapest, but restores, HTTPS and safe deploys would all be ours to build
and look after. It goes on the list for Jack only if he wants the cheapest
option.

### 2. One app process, no gateway

The hosted copy runs `server/server.js` alone. The host's health check and
its own error page do the gateway's job there. The gateway stays for a
shop's own machine, where nothing else would do it.

### 3. Deploys: `main` only, after tests, in order, watched to the end

A new workflow, `.github/workflows/deploy-hosted-copy.yml`, runs on
`workflow_run` when `Tests` completes. It deploys only when all of these
hold:
- the run succeeded;
- its event was `push`;
- its branch was `main`;
- it came from this repository, not a fork. A fork's branch called `main`
  would otherwise match.

It then works like this:
- **The commit.** It deploys `workflow_run.head_sha`, never `GITHUB_SHA`,
  which is just the latest `main`.
- **Order.** One concurrency group (`hosted-copy`), without cancelling a
  deploy already under way. Before deploying, it skips a commit that is an
  ancestor of the one already running, so two quick merges finishing out of
  order can't put the older one on top.
- **Watching to the end.** It waits until the host reports the new version
  healthy and `/healthz` answers with the new commit. If that doesn't happen
  within [n] minutes, the workflow fails, which emails Mark through GitHub,
  and it puts the previous commit back (where the host doesn't already keep
  the old version running).
- **Settings at build time.** `NODE_ENV` is a run-time setting only. If it
  reached the image build, `npm ci` would skip the tools the build stage
  needs.

The existing start-up order already runs migrations before listening, so a
failed migration never gives a healthy `/healthz`. We run one copy of the
app, so the advisory lock never has to wait on another one.

**The commit it runs.** The workflow passes the commit in as
`WHEELHOUSE_COMMIT`. `/healthz` returns it as `commit` beside `status`, and
leaves `commit` out when the setting is unset.

**Old code against a new schema.** Where the host keeps the old version
serving while the new one migrates, the old code briefly reads a newer
database. Migrations are forward-only and names are frozen on `main` (split
plan §4.2 rule 5). So until a later change says otherwise, a migration that
drops or renames something the running code reads is split into two
merges: add first, remove later.

### 4. Uploads on the host's persistent disk, backed up nightly

Mount the host's persistent disk at `/app/uploads`. No code change is
needed, because `UPLOADS_DIR` already resolves there. Back it up nightly,
inside the same host account, so there is no second account or bill: disk
snapshots if the host has them, otherwise a scheduled copy. Keep each
backup [n] days.

*Alternative:* a file store such as S3. It would last better and suit more
than one server, but every upload route would need changing, behind a new
adapter. That's worth doing before go-live, not for a test copy, unless
Decision 1's check forces it. The shared `server/lib/uploads.js` promised
on #180 is where that adapter would go.

### 5. One "hosted copy" setting that refuses anything unsafe

A new setting, `WHEELHOUSE_HOSTED_COPY=1`, is checked once at start-up,
**before migrations**. With it on, the server refuses to start, naming the
setting, if:
- any `TWILIO_*` setting is present;
- any setting on a list of known real-key names is present. The list starts
  with Twilio, and each outside service's adapter change adds its names,
  with a test;
- `NODE_ENV` is not `production`;
- `DB_TENANT_SCOPE` is anything but `session`. This closes the gap where
  `assertPoolerModeSafe` skips its check.

The direct address itself can't be proved from inside the app. So the setup
notes (task 3.2) record which address `DATABASE_URL` is and why. The
existing pooler probe stays as a backstop that may catch a mistake, not as
proof.

`POST /api/shopify/connection` also refuses with "This is a test copy of
Wheelhouse: connecting Shopify is switched off." and saves nothing. Each
future adapter picks its pretend version whenever the setting is on.

The guard only works if the setting is there. So the runbook's setup and
check steps include confirming `WHEELHOUSE_HOSTED_COPY=1` is set.

*Alternative:* simply don't set the keys. That relies on nobody ever
pasting one in. One mistaken paste sends a real text to a real phone, and
the guard is a few lines.

### 6. `NODE_ENV=production` in the host's settings, not the Dockerfile

Setting it in the `Dockerfile` would switch it on for everyone's local
`docker compose`, which would then refuse to start without
`SHOPIFY_TOKEN_ENCRYPTION_KEY`. So the hosted copy sets it in the host's
run-time settings. That is how the encryption key is never left out: the
guard insists on `NODE_ENV=production`, and `server/shopify.js` then
insists on the key. The key is a random secret we generate, not an outside
account.

### 7. The test shop is loaded from the drawings by a script

A new `scripts/dev/load-test-shop.mjs` creates one shop, its site, its
staff, a few customers, bikes, products and workshop jobs. It uses only
names, prices and wording from `docs/design/user-journeys/generator/` and
`personas.md`, with `[n]` where they are silent. It goes through the same
database helpers the server uses, so the separation between shops (RLS) is
respected. It refuses to run if the test shop already exists, and refuses
on a database that has any other shop. It is run by hand once, after the
first deploy, not on every deploy, so anything Jack makes while trying the
app survives.

**For Jack:** this script is the slice Jack can take (#199). He knows the
drawings best. The file is in Mark's area (`scripts/dev/**`), so Mark
approves it. It doesn't touch `server.js`, so it doesn't have to wait for
WP-0.4.

#### The test shop's records, and where each value comes from (task 1.1)

`G/` is `docs/design/user-journeys/generator/`. The loader reads the jobs,
the week, the pending booking, the change request and the services from
`G/diary.mjs` itself, so they can't drift from the drawings.

- **Shop:** North Street Cycles (`G/app-map.mjs:17`). Address and phone:
  not given (`G/book.mjs:224` draws "[Shop address] · [shop phone]"), so
  not set. Its starting rows (customer groups Blue Light and ACC, workshop,
  label and theme settings, the Madison mock supplier) are the ones
  `createShop()` gives every new shop (`server/auth.js:85`).
- **No login.** Jack's login is given to him privately (spec, "Jack can
  sign in"), so the loader makes none.
- **Site:** Bolton, code B (`G/book.mjs:224`, `G/sites.mjs:17`). **No
  tills:** a till's sign-in belongs to the device that sets it up, so Jack
  makes B1, "Front counter", through "Set up this till"
  (`G/stage1.mjs:248`), as drawn.
- **Staff:** Jack Lewis (Owner), Jo Taylor (Staff, works in the workshop),
  Alex Morgan (Mechanic, can use the till) (`G/setup.mjs:208`). Jo and Alex
  each have a diary column (`G/diary.mjs:399`), so both are mechanics;
  Alex can use the till, so is a cashier. No PINs or emails: not given.
  Working days are left at every day: Owner setup draws Jo in the workshop
  Tue, Wed and Sat (`G/setup.mjs:220`), but the diary week gives her jobs on
  Mon, Thu and Fri too. "Sam Reid" on the till check-in (`G/stage1.mjs:256`)
  is left out: the Saturday worker has no name yet (`personas.md:122`).
- **Customers and bikes** (`G/customer.mjs:151`): Maya Patel, Trek Domane
  AL 3, green, black mudguards, 07700 900 142, maya@example.test
  (`G/customer.mjs:21`); Oliver Chen, Brompton C Line, black
  (`G/diary.mjs:1929`); Sam Reed, Specialized Sirrus; Jamie Brooks, Giant
  Escape 2; Aisha Khan, Cannondale Quick. The other four phones read
  "[phone]", as drawn; no emails, serial numbers or other colours are given.
- **Services** (`G/diary.mjs:329`, `:336`, `:402`): Standard service, 60
  min, in Full service; Safety check 60, Gear adjustment 60 and Brake
  service 45 min, in Individual service; Gear service, 90 min. Only Standard
  service has a price, £65.00 (`G/diary.mjs:341`). The rest are drawn as
  "[£ price]" (`G/browse.mjs:80`); a price can't hold a placeholder, so they
  are £0.00, for Jack to overrule (`decided-while-building.md`).
- **Product:** Shimano brake pads, SKU B05S-RX, £28.00 (`G/diary.mjs:342`).
  No other product has a price in the drawings.
- **Workshop jobs:** the drawings' example week, Mon 14 to Sun 20 September
  2026 (`G/diary.mjs:388`), all 37 jobs with their WH numbers, times,
  mechanics, services and customers (`G/diary.mjs:399`; WH-1038 and WH-1040
  take theirs from `customerBikeOf()`, `G/diary.mjs:467`). WH-1046, a
  Standard service with no time in the shared queue (`G/diary.mjs:504`),
  is drawn on every week's no-time row, so it goes on the drawings' today,
  Thu 17 Sep. Their colour
  sets their state (`G/diary.mjs:57`): Expected is a scheduled booking with
  the bike expected; "Booked in" has the bike in the shop; "In the
  workshop" has work in progress; Waiting for parts; Finished; Cancelled,
  by the customer (`G/diary.mjs:414`). Change requested is WH-1052, with
  the customer's requested 14:00 (`G/diary.mjs:516`). Sam Reed's Brake
  service request, Fri 18 Sep 10:00 to 10:45, is a pending booking with no
  mechanic (`G/diary.mjs:511`). It accepted the booking terms, which puts it
  in Waiting for you with the change request and the cancellation. The
  drawings give those three no times, only an order (`G/diary.mjs`,
  `WAITING`), so they arrive a second apart, in that order, when the shop
  is loaded. It has no drawn number, so it takes the next one after the
  week's, and has no booking link: its code would have to be given to
  someone, and nobody is drawn receiving it. A job's title is its service.
  Quotes are left out of this first version.

### 8. Rollback

- **No new migration:** deploy the previous good commit through the same
  workflow (run by hand on that commit) or the host's release history.
- **New migration**, in this order:
  1. Stop the bad version, or deploy the previous commit with the app
     stopped, so the bad migration can't run again.
  2. Restore the database to the moment the workflow recorded just before
     the bad deploy. Most hosts restore into a new database with a new
     address.
  3. Point `DATABASE_URL` at the restored database. It must still be the
     direct address.
  4. Start the previous commit, and check `/healthz` shows it.
  5. Tell Jack that anything made after that moment is gone.

Both are written up in `docs/runbooks/hosted-copy.md`, and each is done once
on the hosted copy, with the time written down.

### 9. The restore rehearsal (PL-3: Jack's hands, Mark's eyes)

The rehearsal follows the agreed PL-3
(`docs/decisions/2026-09-01-ownership-signoff.md:55`;
`docs/superpowers/plans/2026-08-31-master-implementation-plan.md:194`):
- Jack does it with Mark watching.
- It restores the database to a chosen moment, and the latest uploads
  backup, into a fresh copy on the same host.
- Jack opens a job with a photo, and each step is timed.
- The result is a dated runbook, `docs/runbooks/<date>-restore-drill.md`.
  Until it exists, the rehearsal reads "blocked", never "done".

Mark writes the steps first, so Jack can follow them.

## Risks / Trade-offs

- [The host's disk is tied to one machine and region] → Nightly backups
  plus the rehearsal prove it can be brought back. A file store comes before
  go-live.
- [On a host that stops the old version first, a failed migration takes the
  copy down until the previous version is back] → The workflow puts it back
  itself, within [n] minutes. It's a test copy.
- [Old code serves briefly against a newer schema] → The add-first,
  remove-later rule (Decision 3).
- [The real-key list falls behind a new adapter] → Each adapter's change
  adds its key names to the list, with a test.
- [Someone forgets `WHEELHOUSE_HOSTED_COPY=1`] → It's in the runbook's setup
  and check steps. Without it, `NODE_ENV=production` still forces the
  encryption key, and no texting keys are set.
- [Jack takes time on the residency question] → The guard and the loader
  can be built before he answers. The account and the first deploy can't.

## Migration Plan

1. The test shop loader (any time), and the guard, Shopify refusal and
   commit in `/healthz` (once WP-0.4 has merged, because they edit
   `server.js`). None of them needs an account.
2. Once Jack says yes to a host (#137): open the account, then set up
   Postgres (direct address), the disk, the settings and HTTPS.
3. Add the deploy workflow and do the first deploy. Load the test shop, and
   give Jack his address and login privately.
4. Write the runbook, and do each rollback once. Then the restore rehearsal,
   Jack's hands, Mark's eyes.

Rollback for this change itself: switch off the deploy workflow. Nothing on
a shop's own machine changes.

## Open Questions

- The `[n]` values: deploy time, rollback time, days of point-in-time
  restore and backup retention. These are set once the host is known and
  don't change the approach.
