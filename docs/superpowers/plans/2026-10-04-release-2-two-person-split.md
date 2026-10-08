# Release 2 build — splitting the work between Mark and Jack

> **From 8 Oct 2026 this plan sets the order of work and the lanes only.**
> How each piece is specified and built is in `CLAUDE.md` and OpenSpec
> (`openspec/`) (`docs/decisions/2026-10-08-openspec-only.md`).

**Date:** 4 October 2026
**Status:** proposal from Mark's review of the build plan. Nothing here is
started. Jack, 4 Oct: the build starts only when he says so.
**Codex review, 4 Oct:** four blockers and
eleven should-fix findings in
`docs/reviews/2026-10-04-release-2-plans-codex-adversarial.md`. The four blockers
have fixes written in this file and `CLAUDE.md` (4 Oct), for Mark to review: project rules (#127),
migration numbers (§4.2, #128), the route-split design (§4.1, #129) and the
first week (§9, #130). The eleven later fixes are Jack's GitHub issues,
each due before the stage it affects.
**Sits under:** `docs/superpowers/plans/2026-10-03-release-2-build-plan.md`
(the build plan). This file does not change that plan's scope, its work
packages, which screens each package builds or the stage order. It only
changes **who builds which part of each package**, **in what order the two
people run**, and **the rules that stop them colliding**.

## 1. Intent

The build plan was written for one builder working one package at a time.
Two people will now build at once: Jack mostly on screens, Mark mostly on
the server. Most packages need both a server part and a screen part. So each
package is split into a **server half** (Mark) and a **screens half**
(Jack), joined by a written **contract** of what the server sends and
accepts. A few whole packages go to one person, where splitting them would
cost more than it saves.

Done for this document: Mark and Jack agree to it (or change it), and the
answers to §8 are recorded at the bottom.

## 2. What the code looks like today, and where two people would collide

Surveyed on `origin/main` at `a7958bb` (4 Oct):

| Shared spot | Why it collides | Fix in this plan |
|---|---|---|
| `server/server.js`: 6,861 lines, all 161 routes (146 written out, 15 generated), and every serializer | Every server change edits it | §4.1: one route file per area (WP-0.4) |
| `server/migrations/NNN_*.sql`: numbered one after another (`038` is the latest) | Both people would claim `039` | §4.2 |
| `src/lib/api/types.ts`: client copies of server shapes, written by hand | Every package adds types here | §4.3: one types file per area |
| `src/staff/routes.ts`, `nav.ts`, `app-shell.tsx` `SCREENS` | Every new staff screen edits all three | Jack's; Mark adds his two screens' lines (§3.1) |
| `scripts/ci/assert-screen-trace.mjs` `COVERED` list | Edited with screen-tagged routes | Mark's; Jack adds his own lines (§3.1) |
| `tests/helpers/testShop.js`, `workshopFixtures.js`, `staff.js` | Seed data both people's tests use | Split by what each helper is for (§3.1) |
| `.agents/STATUS.md` and the build board's `BOARD` block | Both are updated after every pull request, by rule | §5 |
| `docs/decisions/decided-while-building.md` | Both append | §5 |
| `public/app.js` (the old app, 7,123 lines) and the server fields kept only for it | Removing an old screen touches both | §4.5 |

Pull requests #110, #111 and #112 (Jack's) are open and edit `server.js`.
They must merge **before** the route split, or each would need rebasing
onto a file that has moved.

## 3. Who owns which files

Each file has one owner. The owner edits it freely. The other person may
change it only in a pull request the owner has approved; adding their own
line to it needs no approval. §3.1 lists the files both touch, and where it
says otherwise it wins over the lists below.

**Mark:** `server/**` (except the workshop area below), `server/migrations/**`,
`src/lib/api/**` (the client and the per-area types files: the seam between
the two halves; the workshop's parts are Jack's, §3.1), `src/lib/live/**`
(the live-updates hook, WP-1.9), the in-browser till copy and send queue
(WP-1.6), `tests/*.test.js` (server tests, except the workshop's, §3.1),
`tests/helpers/**` (except the workshop and screen helpers, §3.1),
`scripts/ci/**`, `scripts/new-db.sh`, `scripts/dev/**`,
`scripts/print-route-list.mjs`, `.github/**`, `docker*`,
`print-agent/**`, every outside-service adapter (§5 of the build plan),
and **all hosting and infrastructure** (Mark, 4 Oct): the host (PL-1), the
hosted copy (WP-0.5), managed Postgres with point-in-time restore and a
rehearsed restore (the sixth architecture ceiling, Jack's before 4 Oct),
deploys, and the outside accounts in Q10 (email sending, WorkOS, online
payments, Xero and QuickBooks developer access).

**Jack:** `src/**` apart from the parts above (screens, `src/staff/*`,
`src/customer/*`, `src/components/**`, `src/styles/**`), `registry/**`,
`public-storefront/**`, `public/app.js` and `public/*.css`, `tests/screens/**`,
`tests/customer/**`, `tests/browser/**`, `docs/design/**`.

**Jack's full-stack area: the workshop.** `server/workshop/**` and the
workshop route file (`server/routes/workshop.js` once WP-0.4 lands) are
Jack's. He built the diary, the job page and quotes, and WP-4.1 is mostly
small server changes alongside a lot of screen work. Splitting it would mean
a contract for every small change. Every server change Jack makes, here
included, also needs Mark's approval (Jack, 5 Oct, §3.1).

### 3.1 Files both people touch (issue #141)

Codex finding 11 found files the one-owner rule can't cover as written. Jack
answered four questions on 5 Oct (§8, question 7); the rest follow from them
and are marked *(proposed)* for Mark to confirm or change, as is anything
not marked with one of Jack's answers.

**The general rule (Jack, answer 3).** Adding your own line to the other
person's file needs no approval beyond the usual fresh review: Mark's line for his screen
in Jack's screen list, or a new screen test or screen helper.
Changing or removing anything the other person wrote still needs their
approval. **The server is the exception** (Jack, 5 Oct, answers 5 and 6): any
change Jack makes to server code, additions included, needs Mark's approval.
That covers `server/**` (the workshop and the booking server included),
workshop migrations and server tests. The workshop server stays Jack's, so
Mark's changes there still need Jack's approval. A generated
file follows its source: whoever changes the source
regenerates it in the same pull request, and never edits the output by hand.

| File or area | Owner | The other person |
|---|---|---|
| **Booking server**: the customer booking routes (`/api/portal/*`, the booking route file after WP-0.4), `server/booking-*.js`, `service-questions.js`, `standard-terms.js`, `customer-auth.js` | Mark (answer 1) | Every change Jack makes, additions included, needs Mark's approval, including his WP-4.4 work (answers 5, 6) |
| `server/capacity.js` and `server/clock.js` (free times, and the shop's "today") | Mark, with the booking server *(proposed)* | The workshop's diary and New job read them too, so a change that alters what the workshop gets needs Jack's approval *(proposed)* |
| `tests/helpers/` for sign-in, test shops and booking (`staff.js`, `till.js`, `portal.js`, `testShop.js`, `liveServer.js`, `http.js`, `bookable.js`, `linkActions.js`) | Mark | Server test helpers, so any change Jack makes, additions included, needs Mark's approval (answer 6) |
| `tests/helpers/` for workshop data (`workshopFixtures.js`) and screens (`dom.js`, `book-screen.js`, `css.js`) | Jack | Mark adds; changing one needs Jack's approval *(proposed)* |
| Tests (`tests/*.test.js`, and screen tests that test Mark's code, such as `tests/screens/api-client.test.js`, `session.test.js`, `intent-adapter.test.js`) | Whoever owns the code tested: Jack for the workshop and his workshop migrations, Mark for the rest, wherever the file sits *(proposed)* | Adds tests for their own code; changing the other's test file needs approval; Jack's server tests go with his server change, so Mark approves them (answer 6) |
| `src/lib/api/client.ts` | Mark, except `jobAction` and other workshop calls, which are Jack's and move to the workshop's own file in WP-0.4's types split *(proposed)* | Jack changes Mark's part with his approval |
| Per-area types files (`src/lib/api/<area>.ts`, §4.3) | The area's server owner | A merged contract changes only with both approving (§4.3) |
| `src/staff/app-shell.tsx`, `routes.ts`, `nav.ts` | Jack | Mark adds a line each for `mv-start` and `rp-accounts-connect` (answer 3) |
| The `mv-start` screen ("Start the move") | Mark until stage 8, then Jack (answer 4) | In stage 8 Jack takes it over with the other move screens |
| The `rp-accounts-connect` screen (connecting Xero or QuickBooks) | Mark (§6, 5.3), in its own file under `src/staff/` *(proposed)* | Jack approves changes to shared screen parts it uses |
| `public/r/**` (generated from `registry/`) | Follows `registry/` (Jack) | Whoever changes `registry/` runs `npm run registry:build` in the same pull request; CI fails if the two differ |
| `tests/fixtures/route-list.txt` (generated, #150) | Mark owns the test and its script | Whoever adds or renames a route regenerates it in that pull request: `node scripts/print-route-list.mjs > tests/fixtures/route-list.txt` |
| `scripts/ci/assert-screen-trace.mjs` `COVERED` list | Mark | Jack adds a line for a new workshop route of his (answer 3) |
| `server/server.js` after WP-0.4, `server/routes/index.js`, `server/lib/*` | Mark | Every change Jack makes, additions included, needs Mark's approval (answer 6) |
| `server/workshop/**`, `server/routes/workshop.js`, `server/workshop/jobs.js` (WP-0.4) | Jack | Mark's changes need Jack's approval; Jack's need Mark's (answer 6). Mark's areas call `jobs.js` freely |
| Workshop migrations | Jack writes them (§4.2), each with Mark's approval (answer 6) | `server/migrations/run-migrations.js` stays Mark's |
| `src/lib/auth/use-session.ts` (the staff app's one source of who is signed in) | Mark, since WP-1.1 and WP-1.7 change it *(proposed)* | A change to what Jack's screens read from it needs Jack's approval *(proposed)* |
| `src/lib/adapters/intent.ts` (printing and messages, for now) | Mark (an outside-service adapter) | A change to what Jack's screens call needs Jack's approval *(proposed)* |
| WP-1.6's browser-side till copy and send queue | Mark, in a folder of its own named in WP-1.6's spec *(proposed)* | Mark's changes to till screens need Jack's approval |
| Front-end build and test config (`vite*.config.ts`, `tsconfig*.json`, `eslint.config.js`, `playwright.config.ts`, `components.json`), `public/*.html`, `public/diary-*.js` | Jack *(proposed)* | Mark edits with Jack's approval |
| `package.json`, `package-lock.json` | Shared *(proposed)* | Either adds a small dependency, saying so (project rule 6); the lockfile is regenerated with `npm install`, never hand-edited; changing or removing what the other uses needs their approval |
| `README.md` | Shared *(proposed)* | Each edits their own section |
| `docs/decisions/**`, `CLAUDE.md` | Jack (they are his decisions and rules) *(proposed)* | Mark proposes; Jack approves |
| `docs/superpowers/plans/**` | Shared: Mark wrote this plan, Jack the build plan *(proposed)* | Either edits; the other approves a change to a lane or an agreed rule |
| `docs/superpowers/specs/**` | Whoever wrote it *(proposed)* | Either edits before it merges; a merged contract changes only with both approving (§4.3) |
| `docs/decisions/decided-while-building.md`, `.agents/STATUS.md`, the build board | Shared, as §5 says | Each in their own section, or in the day's status pull request |
| `docs/reviews/**` | Shared *(proposed)* | Either adds a review |
| `tests/registry/**` | Jack, with `registry/` *(proposed)* | Mark with Jack's approval |
| `public-portal/` (the old customer pages, no longer served) | Jack, who removes it once nothing reads it *(proposed)* | — |
| `.claude/**`, `public-demo/`, `prototype/`, `research/` | Jack *(proposed)* | Mark with Jack's approval |

**Old-app fields (Jack, answer 2).** A field like a job's `status` can be
used by more than the old app: `serializePortalBooking` sends it to
customers, and `server/workshop/legacy-status.mjs` names the old customer
pages (`public-portal/`) as a reader. Mark removes old server fields, as
§4.5 says, and the pull request that removes one lists every place that
uses it: the old app, the booking and customer pages, customer messages,
the client types and tests. It goes only when that list is empty. Where the
field lives in the workshop (a job's `status` does), Mark's removal needs
Jack's approval, and the migration that drops the column is a workshop
migration, which Jack writes and Mark approves *(proposed)*.

## 4. The rules that stop collisions

### 4.1 One route file per area (new WP-0.4, Mark, before anything runs in parallel)

Move the routes out of `server/server.js` into `server/routes/<area>.js`.
After it lands, a package adds to its own route file instead of editing
`server.js`. This is a move, not a rewrite: no behaviour change, proven by
the route-list test below and by `npm test` and `npm run test:browser`
passing unchanged. (Design added 4 Oct for Codex finding 3, issue #129,
from a survey of `server.js` at `a7958bb`.)

**What exists today.** `server.js` has its own router (lines 562–581):
`route(method, pattern, handler)` turns each pattern into an anchored regex
and pushes it onto one `routes` array; the dispatcher (from line 6351)
takes the first entry whose method and regex match. There are **161
entries**: 146 `route(...)` calls plus 15 `jobActionRoute(...)` calls
(line 3385), which each register `POST /api/workshop-jobs/:id/<action>`
(accept, decline, request-reschedule, cancel, expire, book-in, collect,
reopen-custody, start, await-parts, parts-arrived, hold, resume, finish,
reopen-work). No two entries share a method and path, and none shadows
another today. A few handlers sit outside the table: `/healthz`, storefront
hosts, the Shopify webhooks, `/api/uploaded-images/` and `/sdbdemo`.

**1. Calling conventions stay where they are.** The arguments a handler gets
are set by the dispatcher branch, chosen by path prefix in this order:
`/api/till/` (till token, shop from `:shopSlug`, handler gets the `till`),
then `/api/portal/` (customer pages, shop by slug), then `/api/` (staff:
session, then `afterRelease` and the shop id; `/api/auth/` gets no shop).
WP-0.4 moves only the table entries. The dispatcher, its branch order and
the handlers outside the table stay in `server.js`. Each route file's header
says which branch its routes run under (note: `/api/tills` and
`/api/till-attention` are staff routes, not till routes).

**2. Where shared helpers and state go.**

| Module | Moves there | Used by |
|---|---|---|
| `server/lib/http.js` | `sendJson`, `notFound`, `badRequest`, `readJsonBody`, `readRawBody`, `parseCookies`, `makeRateLimiter`, `nowIso` | every area |
| `server/lib/session.js` | `currentSession`, `currentCustomerSession` | auth, staff areas, portal |
| `server/lib/sales.js` | `createSale`, `serializeSale`, `SALE_SELECT`, `resolveCashierId`, `loadDocumentLine`, the Shopify push helpers, **`pendingShopifyPushes`**, and with them `pendingPushSlotRequestStorage` and `runRequestWithPushSlotCleanup` (the push helpers read that store, so they move together; the dispatcher imports `runRequestWithPushSlotCleanup`) | till, orders, customers, the Shopify webhook, the dispatcher, shutdown |
| `server/workshop/jobs.js` (Jack's area) | `checkJobSlot`, `createWorkshopJob`, `syncJobHold`, `withBookingLock`, `withJobBookingLock`, `applyLocked`, `resolveJobMechanicId`, `serializeWorkshopJob`, `WORKSHOP_JOB_SELECT`, `CLEAR_REQUEST`, `requestedOf`, `refusal`, `capacityRefusal`, `SLOT_GONE`, `sendQuoteResult`, `answerAndAddToOrder`, `loadCapacity`, `parseWorkingDays`, `toCapacitySettings`, `currentShopToday` | workshop and booking (and settings, sales, dashboard for the last three) |
| `server/lib/serializers.js` | `serializeProduct`, `serializeBike` | products, stock, customers, booking |
| the area's own route file | its rate limiters (auth: `loginLimiter`, `signupLimiter`; booking: the portal and booking-link limiters) and the print-agent maps (`printAgentsByShop`, `printJobsByDevice`, `printJobStatus`) | that area only |
| stays in `server.js` | `tillAuthFailures`, `shuttingDown`, `serverListening` | the dispatcher and shutdown |

`server/workshop/jobs.js` is in Jack's area but Mark's areas call it:
booking for most of it, and settings, sales and the dashboard for
`parseWorkingDays`, `toCapacitySettings` and `currentShopToday`
(`currentShopToday` at `server.js:1633` and 5283). It is one of the
files both people touch, in §3.1 (#141). Nine test
files import names from `server.js` (`createSale`, `pendingShopifyPushes`,
`JOB_STATUSES` and others); `server.js` keeps re-exporting every one, so no
test changes.

**3. Registration, in a fixed order.** Each route file exports
`register(route)`. `server/routes/index.js` holds the list of areas in one
fixed order, and `server.js` calls each `register` in that order. Grouping
by area **does change the table's order**, because areas are mixed together
in `server.js` today (for example `POST /api/products/:id/photo` is at line
3968, among the workshop routes, while the rest of products is at 659–790).
That is safe only because no route shadows another today (no repeated
method and path, and no pattern that matches another's path), so the proof
in step 4 checks exactly that rather than the order. Areas with no routes
yet (Cycle to Work, the Citrus Lime import) get their file when their
package lands.

**4. The proof: a route-list test** (`tests/route-list.test.js`), written
and committed **before** anything moves:

- `route()` also records its method and pattern string; `server.js` exports
  `listRoutes()`, returning `METHOD pattern` in table order.
- A snapshot, `tests/fixtures/route-list.txt`, is generated from `main`
  before the move: 161 lines, including the 15 workshop actions.
- The test requires `listRoutes()` to hold exactly the snapshot's routes,
  no more and no fewer (compared as a set, since step 3 changes the order).
- A second test requires that **no route shadows another**: for every pair
  with the same method, neither pattern matches a path the other would
  answer. That is what makes the order safe to change, now and as routes
  are added.
- Both are watched failing first: by deleting one route, and by adding a
  route that an earlier one would shadow.
- It must pass unchanged after every move pull request. Later packages
  that add routes update the snapshot in the same pull request, so every
  route change shows up in review.

**5. The screen-trace check follows the routes.**
`scripts/ci/assert-screen-trace.mjs` (line 94) reads only `server/server.js`.
After the move it would find no routes and still print OK, and so would
`tests/screen-trace.test.js`. It changes to read `server/server.js` plus
every file in `server/routes/`, and it **fails if it finds no screen-tagged
routes at all**, so an empty read can never pass. `tests/screen-trace.test.js`
("the real server.js passes", line 48) changes the same way: it reads the
same set of files, not `server.js` alone. Both failures are watched first,
by pointing them at an empty folder.

**6. Size.** The move is several pull requests, one or two areas each, every
one with the route-list test passing. They run over the usual 250–600 line
size because moved lines count twice; each says so in its description.

### 4.2 Migrations

Migrations keep their three-digit numbers (`039`, `040`, …; Mark, 4 Oct).
Mark writes them, except in Jack's workshop area, where Jack writes them
and Mark approves each one (§3.1). The runner applies files in
filename order and remembers what it has run **by filename**, in the
`schema_migrations` table (`server/migrations/run-migrations.js:66–83`). So a
file that has run under one name and is then renamed looks new, and runs a
second time (Codex review, finding 2). Rules 1–5 close that; rule 6 says
what every new table must prove:

1. **Every worktree and every review runs its own database.** Each
   worktree's `.env` names its own database on the compose Postgres (port
   5433), and a review (Jack's, or the fresh review subagent's) builds a
   fresh one from empty. So the only databases that ever run an unmerged
   migration are throwaway ones. The app's database role can't create
   databases (`docker/init-db.sh:17`), so WP-0.4 adds a small helper,
   `scripts/new-db.sh <name>`: as the compose superuser it creates the
   database and grants `epos_app` the same rights `init-db.sh` does, and
   the worktree's `DATABASE_URL` (read by `server/db.js:41`) then points at
   it. Its proof: `npm run migrate` and `scripts/ci/assert-rls-coverage.mjs`
   pass on a database it made, so row-level security works there as it
   does on `epos`.
2. **Take the next free number and claim it.** The number must be higher
   than every migration on `main`. Open a draft pull request containing the
   file before running it anywhere, and check the other open pull requests;
   if one already has that number, take the next one.
3. **If someone else's migration merges first, renumber.** Rename the file
   to the next free number, then drop and rebuild your database from empty,
   and tell anyone who ran your branch to rebuild theirs (rule 1 makes those
   throwaway). This is the only time a migration is renamed.
4. **The hosted copy (WP-0.5) only ever runs merged migrations.** It
   deploys `main`, never a branch.
5. **Once on `main`, a migration file's name never changes and the file is
   never deleted.** A later fix is a new migration.
6. **Every new table proves it keeps businesses, and sites, apart** (issue
   #133, Codex finding 7). A migration that adds a table, or a link from one
   table to another, ships with tests in the same pull request, each
   watched failing first: one business can't read, change or point at
   another's rows; for a table with `site_id`, someone who doesn't work at a
   site can't reach its rows; background work is tested with two
   businesses' data present. The full rule is in
   `docs/superpowers/specs/2026-10-05-wp-1-4-shops-and-sites.md` §5.

**Checks (in WP-0.4, Mark), each watched failing first:**

- *Every new number is higher than everything on `main`.* Fails CI if a
  migration file the pull request adds has a number equal to or lower than
  the highest number on `main`. This catches a clash and a late low number
  alike, so migrations always run in the same order on every database: a
  fresh build and the hosted copy can't disagree.
- *Names on `main` are frozen.* Fails CI if a migration file that exists on
  `main` has been renamed, deleted or edited in the pull request.
- *Upgrade from `main`.* CI migrates a database at `main`, then checks out
  the pull request and migrates again. It fails if the second run errors,
  or applies anything other than the pull request's own new files. Today's
  CI only builds from empty (`.github/workflows/test.yml`, "Migrations are
  idempotent"), which can't see a rename.
- *The checks see the latest `main`.* A check only sees the pull request's
  base, so `main` now requires the `test` check to pass and the branch to be
  up to date with `main` before merging (GitHub branch protection, turned on
  4 Oct with Jack's yes). With it, two pull requests can't both merge the
  same number. Repository admins can still override it in an
  emergency; doing so skips these checks, so don't.
- *A backstop on every push to `main`* checks that all migration numbers on
  `main` are unique and in merge order. It should never fail. If it does, a
  rule above was broken: stop and ask Jack, rather than renaming anything on
  `main`.

### 4.3 The contract, before either half is built

Each package's short spec (build plan §4, step 2) gets a **Contract**
subsection, written by Mark and read by Jack's session in the same spec
pull request:

- each endpoint: method, path, who may call it (role and switch), request
  and response shapes, error codes
- the live-update events it sends (WP-1.9 onwards)
- the needs-attention kinds it adds to Today (WP-1.10 onwards)
- the test shop data Jack's browser tests will need

The types go in `src/lib/api/<area>.ts`, not the single `types.ts`, so two
packages never edit the same types file. Changing a contract after it
merges takes a pull request both people approve.

### 4.4 Mark runs one package ahead

Jack's screens half of a package starts once Mark's server half for it has
merged, so Jack always builds against the real server. Mark stays about one
package ahead. When Jack catches up he takes, in this order:

1. a **whole package** that is already his (§6, marked **J**)
2. old-app removals (§4.5) and the stage check walk-throughs

so he never waits on Mark. (Building blocks ahead of their package was
proposed and turned down, Mark, 4 Oct. See §7 for what Jack does
instead. The workshop is not pulled forward either: Jack, 5 Oct, kept it
in stage 4, §7.2.)

### 4.5 Retiring the old app

When Jack's replacement screen merges, Jack removes the old screen from
`public/app.js` (project rule 5). Mark then removes the server fields kept
only for it, in a follow-up pull request that lists every other place still
using each field (§3.1, old-app fields). They are never done in the same
pull request.

### 4.6 Branches, worktrees, size

- Branches are `mark/<wp>-<what>` and `jack/<wp>-<what>`, off fresh
  `origin/main`. Each Claude session works in its own worktree.
- No branch lives more than two days. Rebase on `main` before opening a pull
  request and again before merging.
- The pull request size target stays at 250–600 changed lines.
- A pull request that changes a file the other person owns needs that
  person's approval, as well as the fresh subagent review (project rule 4).
  Adding your own line doesn't, except on the server: any server change
  Jack makes needs Mark's approval (§3.1).

## 5. Status, the board and the decision log

Today every pull request updates `.agents/STATUS.md` and appends to the
board's `BOARD.pieces`. With two people that will conflict on almost every
merge. Recommended:

- Feature pull requests don't touch `STATUS.md` or the board.
- One small status pull request a day, made by whoever finishes last, covers
  both people's merges. It updates `STATUS.md` (which gets a "Mark is on" line
  and a "Jack is on" line at the top) and the board's `BOARD` block.
- `decided-while-building.md` gets a section for each person, and each
  person appends only to their own.

Agreed by Mark, 4 Oct (§8 answer 1), and by Jack, 4 Oct (§8 answer 6,
issue #127). It changes a project rule (CLAUDE.md "Allowed without asking"
item 7), so CLAUDE.md is updated in the same pull request as this plan.

## 6. Every work package, split

**M** = Mark, **J** = Jack. Where a package names both, Mark's server half
merges first (§4.4). "Whole" means one person builds both halves.

### Stage 0 — Close what's open, and make the code splittable

| Package | Mark | Jack |
|---|---|---|
| 0.1 Merge #110, #112, #111 | review | **J** merges, first, before 0.4 |
| 0.2 Booking bugs | another shop's page on a subdomain; "today" at UTC midnight; a duplicate booking from a lost reply (the server accepts each request once); `null` body error | Back while "Sending…" loses the private link; the client sends the same request key on a retry (from the contract) |
| 0.3 Trim STATUS to 8 KB | **M**, with §5's new layout | — |
| **0.4 (new) Make it splittable** | **M**: route files (§4.1); per-area types files (§4.3); the migration checks and `scripts/new-db.sh` (§4.2) | review |
| **0.5 (new) A hosted copy for Jack** | **M**: choose the host (PL-1), deploy `main` there on every merge, test data only | tries it |

### Stage 1 — Foundations (mostly Mark, in the order of §7.1)

| Package | Mark | Jack |
|---|---|---|
| 1.1 Roles and switches | four roles, nine switches (the table: `specs/2026-10-05-wp-1-1-roles-and-switches.md`), `/api/auth/me`, a check on every route, a login linked to its staff member | blocks 12, 16, 29; `map`, `staff-app`, `till-rail`; the sidebar per role; a mechanic lands on the Diary |
| 1.2 Settings, change record, activity | **M** whole (no screens) | — |
| 1.3 Settings frame | — | **J** whole: blocks 1, 2, 9, 10, 11; `set-till-quick`, `set-till-quick-add`. Uses 1.2's settings store, so no new server routes |
| 1.4 Shops everywhere | **M** whole (no screens) | — |
| 1.5 Products and stock in pence | **M** whole (no screens) | — |
| 1.6 One sales record | **M** whole, including the in-browser copy, send queue and offline PIN check (front-end code, but it belongs to the offline core) | — |
| 1.7 Sign-in and PINs | WorkOS adapter with its fake; emailed codes; PINs; till set-up; idle timeout (10 minutes, Q6) | blocks 13, 22, 26, 40, 42, 43; the 8 screens |
| 1.8 Messages engine | engine, placeholders, text or email, Undo window, scheduler, the outbox stand-in | `set-msg-list`, `set-msg-edit`, `set-msg-new` |
| 1.9 Live updates | **M** whole: the server side and the `src/lib/live` hook Jack's screens use | — |
| 1.10 Needs attention and Today | the needs-attention model with Seen; Who's in; Workshop today data | block 6; `op-today` |
| 1.11 Small shared parts | spreadsheet download; printing through the print agent; header search API; online payments adapter with its fake | block 17, `till-search`; `your-settings` (kept in 1.2's store) |

### Stage 2 — Products and stock

| Package | Mark | Jack |
|---|---|---|
| 2.1 Stock control | stock list query and filters; adjust with reasons; bulk price change with Undo; categories | blocks 3, 4; the 6 screens; 2 Today lines |
| 2.2 Stock take | counts, several counters, differences, apply with Undo, transfers | block 27; the 5 screens |
| 2.3 Deliveries and purchase orders | receiving, booking in, holding stock for a job, problem lines, purchase orders, the restock list | the 7 screens |
| 2.4 Citrus Lime import, first half | **M** whole, including block 24 and `mv-start` (the work is reading Excel files; there is one screen) | — |

### Stage 3 — The till and the shop day

| Package | Mark | Jack |
|---|---|---|
| 3.1 The till, complete | discounts and reasons; parked sales; receipts by email and text link; voids and refunds; store credit, gift cards and accounts; paying for a job with collection recorded; the card machine adapter with its pretend machine, then Stripe Terminal, SumUp and Paymentsense in that order (Jack, 5 Oct) | blocks 8, 19, 20, 21; the 22 screens. This is the biggest screens package |
| 3.2 Customers | duplicate catching, one history, statements, merging, privacy requests | the 8 screens |
| 3.3 Opening the shop | — | **J** whole: block 18, float check (a small server change), 2 screens, Today lines |
| 3.4 End-of-day cash-up | count, paid-outs, banking, card check, end-of-day figures, reopen | blocks 5, 7; the 4 screens |

### Stage 4 — The workshop and the customer's repair

| Package | Mark | Jack |
|---|---|---|
| 4.1 Workshop day, the rest | — | **J** whole (his workshop area, §3): blocks 15, 23, 25; 9 screens; storage slots, checklist, "Mark ready" as the sign-off (Q3) |
| 4.2 Quotes, the rest | reminders through 1.8's scheduler, spending limit, deposit through the online payments adapter | blocks 37, 38; 3 screens |
| 4.3 Collect and pay | "Bike ready" on Mark ready; online payment; receipts; the uncollected reminder | blocks 39, 41; 5 screens |
| 4.4 Book a repair, rebuilt | deposits and auto-confirm on the server | **J** most of it: block 36, 8 customer screens, change and cancel, saved draft. The booking server itself stays Mark's; Jack's server changes for 4.4 need Mark's approval (§3.1, Jack 5 Oct) |
| 4.5 Account, history, reminders | consent and "Stop these", service reminders, review requests, the data download, the staff inbox model | block 47; 9 screens |

### Stage 5 — The office

| Package | Mark | Jack |
|---|---|---|
| 5.1 Owner setup rooms | staff invites through WorkOS; per-person PIN clearing; workshop computers alongside the tills | block 14; 10 screens (most are settings on 1.2's store) |
| 5.2 Multiple sites screens | price and service per shop; works-at days; moving a till | block 28; 5 screens |
| 5.3 Reports and accounts | the reporting layer; VAT; margin; Xero and QuickBooks adapters with a fake; `rp-accounts-connect` (Mark builds this screen: it is a connection screen over his adapter) | the report pages (block 5 already exists) |
| 5.4 Activity log screen | — | **J** whole: `ops-log` over 1.2's activity record |

### Stage 6 — The website

| Package | Mark | Jack |
|---|---|---|
| 6.1 Website management | drafts and publishing; payments set-up; tracking; Shopify in the new frame | block 30; 7 screens |
| 6.2 Find the shop and browse | read-only shop and product feeds, if the existing ones don't cover it | **J** most of it: blocks 31–34, 44, 45; 17 screens in `public-storefront` |
| 6.3 Buy online, click and collect | basket, checkout, orders, online gift cards and credit, order messages | blocks 35, 46; 10 screens |

### Stage 7 — Cycle to Work

| Package | Mark | Jack |
|---|---|---|
| 7.1 Cycle to Work | order stages, holds, the ordering rule, what's owed, payments, messages, the report data | 20 screens and the Cycle to Work lines on earlier screens |

### Stage 8 — The move and the trading week

| Package | Mark | Jack |
|---|---|---|
| 8.1 Citrus Lime import, second half | weekly refresh, the weekly check, switch-over, workshop-job import | `mv-change-day`, `mv-both`, `mv-weeks`, `mv-pick-day` and the `mv-start` situations |
| 8.2 Run alongside | **M** leads | **J**: the shop's side, his real data (Mark never handles it, project rule) |
| 8.3 Switch-over and the trading week | hosting, real accounts (Q10) | the shop |

**Stage checks** (build plan §2): both people walk each stage's journeys
together before the next stage starts. Neither starts the next stage's
packages until any story-breaking findings are fixed. Work that is already
in flight for the next stage can finish.

## 7. Jack sees working software as early as possible

Mark, 4 Oct: "I want him to see progress and a working prototype ASAP."
Stage 1 is almost all server work, so on the build plan's order Jack would
see nothing new on screen for most of it. Two changes fix that (§7.1,
§7.3). None of them changes a package's contents. A third, building some
workshop pieces early (§7.2), was checked and turned down: Jack, 5 Oct,
kept the plan's order.

**7.1 Mark builds stage 1's server halves in the order that unlocks the most
screens first.** Packages whose server half has screens waiting on it come
first; packages with no screens come after:

1. 1.1 Roles and switches (unlocks the app frame and the sidebar per role)
2. 1.2 Settings store (unlocks 1.3 Settings frame and Your settings)
3. 1.10 Needs attention (unlocks Today)
4. 1.7 Sign-in and PINs (unlocks 8 screens)
5. 1.8 Messages engine (unlocks Settings › Messages)
6. 1.11 search, printing, spreadsheet download, the online payments adapter
7. then 1.4, 1.5, 1.6 and 1.9, which have no screens of their own

All of stage 1 still finishes before stage 2's server halves start.

**7.2 The workshop stays in stage 4 (Jack, 5 Oct: "lets just keep the
plans order").** Mark proposed that Jack build parts of WP-4.1 during
stage 1, since the workshop is his full-stack area (§3) and the diary, the
job page and quotes 1–3 already run. Codex's review (finding 5, issue #131)
found some of those parts depend on stage 1 packages, so they would be
built twice; checking each one found most do. The list was trimmed to the pieces with no such dependency
(below), and Jack chose to keep the plan's order anyway: all of WP-4.1,
including the pieces below, is built in stage 4. The tables stay as the
record of what could come forward if this is ever reopened. The rule
stands that workshop server work waits until WP-0.4 has merged (§9), so
nothing edits `server.js` while it moves.

A piece could come forward only if everything it does, as decided, can be
built on what exists today, or on a stage 1 package that has already
merged.

Could be built during stage 1, with nothing to wait for:

| Piece | Why it could come early |
|---|---|
| New job extras (`new-job`, Workshop day 26): "+ Add a bike" from the form, and the customer's note kept apart from the staff notes | Uses the customer and bike data that already exist. The customer's note is saved now; it is printed on the receipt when receipts print (1.11, 3.1) |

Could be built once a stage 1 package has merged:

| Piece | Waits for |
|---|---|
| Choosing the mechanic with pills as you accept a request (`request-new`, Workshop day 62) | 1.4: each site has its own diary and mechanics (Multiple sites 2), so the pills list that site's mechanics. 1.1 then changes only where the names come from (the "Works in the workshop" switch, Owner setup 11) |
| The free-time warning on New job (Workshop day 26) | 1.4: it reads the site's capacity, and 1.4 puts a site on capacity |
| Diary settings (`set-workshop-diary`) | 1.3: it is a section of the Settings page (block 1), built in 1.3 on 1.2's settings store |
| Storage slots (Workshop day 27): "Where the bike is kept" on `new-job`, the slot on the diary block | 1.3 and 1.4: the slots are switched on and listed in diary settings' "Storage slots" section, and each site has its own workshop diary (Multiple sites 2): walk-through 7 (H2) found the other shop's New job form wrongly showing Bolton's hooks |

Stays in WP-4.1 whatever the order, because each needs a later package first:

| Piece | Waits for |
|---|---|
| "+ New customer" from the New job form | 3.2: adding a customer catches possible duplicates (Customer service 5), which is built in stage 3 |
| Offer another time (request pop-up) | 1.8: it sends the "New time offered" message (Book a repair 12); the customer's answer is on the booking page (`bk-offered`, 4.4) |
| Decline with a message (request pop-up) | 1.8: the "Request declined" message (Book a repair 12). Until then the built pop-up's "Decline booking" sends nothing |
| "Booking confirmed sent to [phone], or No message" after saving a new job | 1.8: it is a message |
| Who and when on each staff note (Workshop day 26) | 1.7: on a shared computer it is the person working, by PIN |
| Bike tag at book-in (`job-book-in`) | 1.11: printing through the print agent. The drawing also shows the print acknowledged and "printed by Jo Taylor" (1.7) |
| Done ticks and notes per line | 1.9: changes show on every device, and two people editing one job get "Keep mine" or "Keep Alex's" (walk-through 8, decision 2) |
| "I'll do this" | 1.7: "your column" is the person working, by PIN; 1.9: "every device shows 'Taken by Jo Taylor'" (walk-through 8, decision 5) |
| "Who did what" | 1.2: the one activity record; 1.7: who did it (walk-through 8, decision 7) |
| "Mark ready" as the sign-off | 1.7: signed off by the person working, by PIN (Q3); shown in "Who did what" (1.2) |
| "Use my phone" photo | a photo on each line (4.2), and a page opened with no sign-in, which 1.1's check on every route has to allow (walk-through 8, decision 6) |

`overview` (needs block 3), `job-checklist` (needs block 7) and the
situations that need roles (`diary-mechanic`) were never candidates.

**7.3 Every merge is clickable.**

- Each pull request with a screen in it adds one line to its description:
  where to click to see it.
- The daily status pull request (§5) lists what's new to try that day.
- A hosted copy Jack can open on any device (WP-0.5, Mark). Every merge to
  `main` is deployed there, with test data only. Until it exists, Jack runs
  the app locally on `localhost:8080` as he does today.

## 8. Questions and answers

1. **Status and board updates (§5).** Mark, 4 Oct: option 1. Feature pull
   requests leave `STATUS.md` and the board alone, and one status pull
   request a day covers both people.
2. **Building blocks ahead.** Mark, 4 Oct: no. He wants Jack to see working
   progress as early as possible instead, so §7 replaces it.
3. **Migration names.** Mark, 4 Oct: keep the numbers (§4.2).
4. **The workshop as Jack's full-stack area.** Mark, 4 Oct: yes. Jack, 5 Oct: his server changes there also need Mark's
   approval (question 7, answer 6).
5. **Hosting and infrastructure.** Mark, 4 Oct: Mark's, all of it,
   including the hosted copy for Jack (WP-0.5).
6. **For Jack:** agree to §5's change to the project rules and §7.2's
   change to the build order. Jack, 4 Oct (issue #127): **agrees to §5**
   (one status pull request a day) **and to working in two lanes** (§3, §4);
   `CLAUDE.md` and the top of `.agents/STATUS.md` now say the same.
   §7.2, trimmed to the pieces with no stage 1 dependency (issue #131),
   would have changed the order Jack chose on 3 Oct (Q2). Jack, 5 Oct:
   **keep the plan's order** ("lets just keep the plans order"): the
   workshop, all of WP-4.1, waits for stage 4.

7. **For Jack: the files both people touch (§3.1, issue #141).** Jack,
   5 Oct: (1) the booking server stays Mark's, and Jack edits it with
   Mark's approval ("keep them as marks"); (2) Mark removes old server
   fields, after listing every place that uses them ("1"); (3) adding your
   own line to the other person's file needs no approval, changing or
   removing theirs does ("1"); (4) `mv-start` is Mark's until stage 8, then
   Jack's ("1"); (5) the booking server is the exception to (3): every
   change there, additions included, needs Mark's approval ("1"); (6)
   "anything server related that i change should get marks approval": every
   server change Jack makes, the workshop included, needs Mark's approval,
   and the workshop stays Jack's. Mark to confirm the lines marked
   *(proposed)*.

## 9. The first week, concretely

Stage 0 finishes, including its stage check, before any of stage 1 starts
(build plan §2). Each line below says what it waits for; nothing is listed
before the thing it waits for is done. (#114, also in the build plan's
WP-0.1, merged on 3 Oct.)

**Stage 0**

| # | Who | What | Waits for |
|---|---|---|---|
| 1 | Jack | WP-0.1: bring #110, #112 and #111 up to date with `main` (all three clash with it on 4 Oct), then merge them | nothing |
| 2 | Mark | WP-0.2 server half: write its contract, including the request key a retry repeats (its types go in today's `src/lib/api/types.ts`, since the per-area files of §4.3 come with WP-0.4, which moves them), then fix another shop's page on a subdomain, "today" at UTC midnight, the duplicate booking from a lost reply, and the `null` body error. It edits `server/server.js`, so it merges before WP-0.4 starts | nothing; can run alongside line 1 |
| 3 | Mark | WP-0.3: trim STATUS to 8 KB with §5's layout | nothing |
| 4 | Mark | WP-0.4: route files (§4.1), per-area types files (§4.3), the migration checks and `scripts/new-db.sh` (§4.2). (The `main` setting of §4.2 is already on, 4 Oct.) Jack reviews | lines 1 and 2 merged: every open change to `server.js` is in before it moves |
| 5 | Jack | WP-0.2 screens half: Back while "Sending…" keeps the private link; a retry sends the same request key | line 2 merged |
| 6 | Mark | WP-0.5: the hosted copy | line 4 merged |
| 7 | Jack | Stage 0's stage check: the journeys stage 0 touches (booking, and the till and diary from #110–#112) walked in the real app (build plan §2) | lines 1–6 merged |

While Jack waits on line 2 or line 4, the work that is ready for him is the
two checks only he can do (what Citrus Lime exports, #136; the Paymentsense
card machine, #138) and the planning fixes due before stage 1 (#131, #132,
#133, #141). Workshop server work waits until WP-0.4 has merged, so nothing
edits `server.js` while it moves.

**Stage 1, once stage 0's check has passed**

1. Mark writes the WP-1.1 contract, builds 1.1's server half, then 1.2, then
   the rest in §7.1's order.
2. Jack builds 1.1's screens as soon as their server half merges, then 1.3 once
   1.2's server half merges.

## 10. Decision log

| Decision | Why |
|---|---|
| Split each package into a server half and a screens half, joined by a contract | Two people at once; most packages need both (Mark, 4 Oct request) |
| Jack's packages start after Mark's server half merges | Screens are built and tested against the real server, so there is no fake layer to maintain |
| The workshop is Jack's full-stack area | Jack's sessions wrote the workshop server; Mark agreed, 4 Oct |
| Merge #110–#112 before the route split | They edit `server.js`; rebasing them across the move costs more than waiting |
| Mark builds 1.6's browser-side code | It belongs to the offline core, not the screens |
| Mark builds `mv-start` and `rp-accounts-connect` | Each is one screen over Mark's own adapter |
| 8.2's real data handled by Jack only | Project rule: real shop data stops for Jack |
| One status pull request a day | Mark, 4 Oct, answer 1: avoids a conflict on most merges |
| No building blocks ahead; stage 1's server order puts screens first; workshop pieces pulled forward (the workshop part replaced by Jack, 5 Oct, below) | Mark, 4 Oct, answer 2: Jack should see progress and working software as early as possible |
| Migrations keep their numbers; the second to merge renumbers; CI catches a clash | Mark, 4 Oct, answer 3 |
| §4.2 after two fresh reviews: every worktree and review on its own database; new numbers must be higher than everything on `main`; checks required and run against the latest `main` (GitHub setting, on 4 Oct with Jack's yes); renumbering only when another merges first; a backstop on `main` that stops and asks | Fresh reviews, 4 Oct: no branch protection; reviewers' servers run a branch's migrations on start; a freeze rule that forbade the only fix; a late low number runs in a different order on the hosted copy than on a fresh build |
| §4.1 after the fresh review: the route-list test compares as a set plus a no-shadowing check; the push-tracking store moves with the push helpers; the screen-trace test follows the script | Fresh review, 4 Oct: grouping by area reorders the table (e.g. line 3968); `sales.js` and `server.js` would import each other |
| §4.2: claim a number with a draft pull request before running it; renumber only on a rebuilt throwaway database; names on `main` frozen; CI upgrades from the previous `main` | Codex finding 2 (issue #128): the runner tracks files by name, so a renamed file runs twice |
| Project rules changed to match: two lanes, one status pull request a day | Jack, 4 Oct (issue #127, option 1) |
| §4.1 design for WP-0.4: dispatcher and calling conventions stay put, shared helpers to `server/lib/*` and `server/workshop/jobs.js`, fixed registration order, a 161-route list test written before the move, screen-trace check reads the route files and fails on an empty read | Codex finding 3 (issue #129): shared helpers and state, three calling conventions, and a check that would pass with nothing to check |
| §9 rewritten: stage 0's server work first, every line names what it waits for, stage 0 closes before stage 1 | Codex finding 4 (issue #130): Jack's WP-0.2 screens were listed before the server half they need |
| Hosting and infrastructure are Mark's, and a hosted copy comes in stage 0 | Mark, 4 Oct: "assign the hosting and infra to me"; Jack sees each merge without running the app |
| §7.2 trimmed to the workshop pieces with no stage 1 dependency, each with its reason; the rest stay in WP-4.1. This answers the workshop half of finding 5 only; its first half (§7.1's server order) is not covered here | Codex finding 5 (issue #131): "Who did what", sign-off, notes and printing need PIN identity, the activity record, live updates and printing |
| The workshop is not built early: all of WP-4.1 stays in stage 4, as the build plan's order has it | Jack, 5 Oct, keeping his 3 Oct answer to Q2 ("lets just keep the plans order") |
| §3.1: the files both people touch, who edits and who approves; the booking server stays Mark's; adding your own line needs no approval | Codex finding 11 (issue #141); Jack, 5 Oct, §8 question 7 |
| `mv-start` passes to Jack in stage 8 | Jack, 5 Oct: all the move screens end with one owner |
| Every server change Jack makes needs Mark's approval, the workshop included; the workshop stays Jack's | Jack, 5 Oct: "anything server related that i change should get marks approval" |
