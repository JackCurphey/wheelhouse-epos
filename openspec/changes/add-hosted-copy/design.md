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
- One host, DigitalOcean in London (Decision 1), set up from a script in the
  repo so it can be rebuilt or reviewed.
- Keep code changes small: one start-up guard, one Shopify refusal, the
  commit in `/healthz`, and a loader for the test shop. The rest is host
  settings, a GitHub workflow and runbooks.

**Non-Goals:**
- Hosting fit for real shops (more than one server, monitoring, a status
  page). That is PL-11 to PL-14, before go-live.
- Keeping uploads (Decision 4). That comes with a file store before real use.

## Decisions

### 1. The host: DigitalOcean in London (Mark, 15 Oct; for Jack's yes on #137)

Jack chose a UK region for the test copy, as an answer for the test copy
only (#137, 15 Oct; `docs/decisions/2026-10-15-hosted-copy-region.md`).
Mark chose DigitalOcean's London region (`lon1`):
- **one server (a 1GB "Basic" droplet)** running our existing container
  image with Docker, about $6 a month;
- **DigitalOcean managed Postgres, smallest plan**, about $15 a month, with
  daily backups and point-in-time restore (to be confirmed on the new
  cluster before anything relies on it), using its **direct** connection
  (port 25060), not its optional pools (port 25061), with SSL. The app
  verifies the database's certificate (`PGSSL=require`, `server/db.js`), and
  DigitalOcean signs it with its own authority, so the server holds that
  certificate (`doctl databases get-ca`) and the app trusts it through
  `NODE_EXTRA_CA_CERTS`; `sslmode` stays out of `DATABASE_URL`;
- the database reachable only from the server (DigitalOcean "trusted
  sources"), and the server's firewall open only for web traffic and SSH.

That's about $21 a month, about £20 with VAT. Everything is set up from a
script in the repo (`scripts/hosting/`, Mark's area) through DigitalOcean's
`doctl` command-line tool, so the whole setup can be rebuilt or reviewed.
**Jack runs it himself** (Mark, 15 Oct: good learning for him), following
`docs/runbooks/hosted-copy.md`, with Mark on hand.

**A deploy means a short outage.** One server runs one copy of the app, so
the old version stops before the new one starts: under a minute. A failed
deploy puts the previous version back (Decision 3). That's fine for a test
copy.

*Alternatives considered (15 Oct):*
- **Fly.io** (app plus its managed Postgres, about $45 a month, about £40
  with VAT; or app plus Neon's free Postgres, under $5). No servers to look after and no outage on
  deploy, but its managed Postgres is young, and the free database's 6-hour
  restore window and sleeping compute suit development, not the restore
  rehearsal.
- **Everything on one server** (Postgres in Docker too, about $8 a month).
  Cheapest, but backups and restores would be ours to build.
- **Free tiers** (Render, Supabase, Oracle). None offers a UK region, a
  managed database with backups and an always-on app together.

### 2. The app and Caddy on the server, no gateway

The server runs two containers: the app (`server/server.js`) and Caddy in
front of it, which gets and renews the HTTPS certificate and redirects
`http://` to `https://`. There is no Postgres container (the database is
managed) and no gateway (Caddy shows its own error page while the app
restarts). The server's own settings file holds the run-time settings
(Decision 6); it is written by the setup script and never committed.

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
  which is just the latest `main`. It builds the image in GitHub Actions,
  pushes it to GitHub's container registry tagged with that commit (the
  package made public, as the repo is, so the server pulls it without a
  token), then logs into the server with a deploy-only SSH key (a repository
  secret, checked against the server's stored `known_hosts` entry) and
  starts the new image. The deploy key can run Docker, which amounts to
  root on that server, so it is used for nothing else. The previous image stays on the server for
  rolling back.
- **Order.** One concurrency group (`hosted-copy`), without cancelling a
  deploy already under way. Before deploying, it skips a commit that is an
  ancestor of the one already running, so two quick merges finishing out of
  order can't put the older one on top.
- **Watching to the end.** It waits until `/healthz`, over HTTPS, answers
  `ok` with the new commit (task 2.4). If that doesn't happen
  within [n] minutes, the workflow fails, which emails Mark through GitHub,
  and it starts the previous image again.
- **Settings at build time.** `NODE_ENV` is a run-time setting only. If it
  reached the image build, `npm ci` would skip the tools the build stage
  needs.

The existing start-up order already runs migrations before listening, so a
failed migration never gives a healthy `/healthz`. We run one copy of the
app, so the advisory lock never has to wait on another one.

**The commit it runs.** The workflow passes the commit in as
`WHEELHOUSE_COMMIT`. `/healthz` returns it as `commit` beside `status`, and
leaves `commit` out when the setting is unset.

**Old code against a new schema.** A rollback starts the previous image
against a database the new version may already have migrated, so the old
code can read a newer schema. Migrations are forward-only and names are frozen on `main` (split
plan §4.2 rule 5). So until a later change says otherwise, a migration that
drops or renames something the running code reads is split into two
merges: add first, remove later.

### 4. Uploads are not kept on the test copy (Mark, 15 Oct)

The photos part isn't being built now, so the test copy doesn't keep
uploads. The upload screens still work, but files land inside the app's
container, aren't backed up, and are lost whenever a deploy replaces the
container. Jack is told this up front
(#137), so a missing attachment isn't a surprise. Before any real use,
uploads need a home that survives: DigitalOcean Spaces (its file store),
behind the shared `server/lib/uploads.js` (#180), is the likely choice, with
its own backups and a place in the restore rehearsal.

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

### 6. `NODE_ENV=production` in the server's settings, not the Dockerfile

Setting it in the `Dockerfile` would switch it on for everyone's local
`docker compose`, which would then refuse to start without
`SHOPIFY_TOKEN_ENCRYPTION_KEY`. So the hosted copy sets it in the server's
settings file. That is how the encryption key is never left out: the
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

- **No new migration:** start the previous image on the server (the deploy
  workflow, run by hand, or one command in the runbook).
- **New migration**, in this order:
  1. Stop the bad version, so the bad migration can't run again.
  2. Restore the database to the moment the workflow recorded just before
     the bad deploy. DigitalOcean restores into a new cluster with a new
     address.
  3. Point `DATABASE_URL` at the restored cluster, by its direct address,
     add the server to its trusted sources, and refresh the server's copy of
     the database certificate if the new cluster's differs.
  4. Start the previous image, and check `/healthz` shows its commit.
  5. Tell Jack that anything made after that moment is gone.

Both are written up in `docs/runbooks/hosted-copy.md`, and each is done once
on the hosted copy, with the time written down.

### 9. The restore rehearsal (PL-3: Jack's hands, Mark's eyes)

The rehearsal follows the agreed PL-3
(`docs/decisions/2026-09-01-ownership-signoff.md:55`;
`docs/superpowers/plans/2026-08-31-master-implementation-plan.md:194`):
- Jack does it with Mark watching.
- It restores the database to a chosen moment into a new cluster, and
  points a fresh copy of the app at it. Once uploads are kept (Decision 4),
  their backup is restored too.
- Jack opens a job, and each step is timed.
- The result is a dated runbook, `docs/runbooks/<date>-restore-drill.md`.
  Until it exists, the rehearsal reads "blocked", never "done".

Mark writes the steps first, so Jack can follow them.

## Risks / Trade-offs

- [A deploy takes the copy down briefly] → Under a minute, and a failed one
  puts the previous version back. It's a test copy.
- [We look after a server: updates and security] → The setup script turns
  on automatic security updates; only web traffic and SSH are allowed in,
  SSH by key only.
- [Uploads vanish on deploy] → Jack is told; a file store comes before real
  use (Decision 4).
- [Old code against a newer schema after a rollback] → The add-first,
  remove-later rule (Decision 3).
- [The real-key list falls behind a new adapter] → Each adapter's change
  adds its key names to the list, with a test.
- [Someone forgets `WHEELHOUSE_HOSTED_COPY=1`] → The setup script writes it,
  and the runbook's check steps confirm it.
- [Point-in-time restore isn't on the smallest plan] → Checked on the new
  cluster before the first deploy; if missing, the plan is raised (and Jack
  told the cost) or the restore rehearsal uses the daily backup.

## Migration Plan

1. Jack says yes on #137 and opens the DigitalOcean account with his card,
   inviting Mark. He makes an API token and stores it with `doctl auth init`
   on his own machine; no token goes in the repo or chat.
2. Jack runs `scripts/hosting/setup.sh`, following the runbook, with Mark on
   hand. It creates the server, database, firewall and trusted sources in
   London, installs Docker and Caddy, writes the settings, and starts the
   app built from `main`. Jack can sign up with his code and try it at once.
3. Tasks group 2 (the guard, the Shopify refusal and the commit in
   `/healthz`) merges, and the server is updated to it by hand.
4. The deploy workflow goes in, so every merge deploys itself. Then the test
   shop, the runbook's rollbacks, and the restore rehearsal (Jack's hands,
   Mark's eyes).

Rollback for this change itself: switch off the deploy workflow and destroy
the server and database. Nothing on a shop's own machine changes.

## Open Questions

- The `[n]` values: deploy time, rollback time, days of point-in-time
  restore and backup retention. They're measured on DigitalOcean and don't
  change the approach.
