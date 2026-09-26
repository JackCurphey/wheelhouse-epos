# STATUS — Wheelhouse EPOS

**Updated:** 2026-09-26
**Branch:** `main` at `14b824b` (piece (a) #72 and piece (b) #73 merged). Server prerequisite pieces 1-6 for the book
journey are all merged: #64-#70, then **piece 6 (customer photos, migration
029) as #71** (25 Sep; PR CI green). Specs and plans for each are under
`docs/superpowers/`; piece 6's are
`docs/superpowers/specs/2026-09-25-book-server-6-customer-photos-design.md` and
`docs/superpowers/plans/2026-09-25-book-server-6-customer-photos.md`.
**Plan 4a's endpoint check re-run 25 Sep**
(`docs/superpowers/plans/2026-09-20-phase-4a-book.md`): every book screen has a
supplying route. **Jack decided 25 Sep:** no automatic acceptance in Release 1
(A1); `pending` shows the booked price, following the shop's "show prices
online" setting (B1); the work splits into four pieces with their own spec and
PR: (a) booked price in the booking reply and link read-back, (b) customer
shell at `/book`, (c) missing form controls (each approved by Jack), (d) the
six screens. **Piece (a) merged: #72** (25 Sep, CI green on its final
commit; spec `docs/superpowers/specs/2026-09-25-book-a-booked-price-design.md`).
**Piece (b) merged: #73** (26 Sep, CI green on its final commit). Every
`/book` address serves the React customer app (`src/customer/`, placeholders
for the six screens). **Now:** piece (c), the form controls, on branch
`feat/book-c-form-controls`; spec
`docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md` (Jack's
design calls of 26 Sep are in it). **Open for pieces (c)/(d):**
on a storefront subdomain the app reads the shop from the address
(`/book/<slug>`), not the host, so `/book/<other-shop>` on one shop's subdomain
shows the other shop; decide which wins. No request-level test covers the
`/book` 500 page when the app is not built (only `appEntryTags` is tested).
**Next:** piece (d), the six screens; it also needs `/availability` to return a day's opening hours for the diary. Jack
changed J1 on 25 Sep: the new app takes all of `/book` now (nobody uses the old
page); `public-portal/` files are deleted in a later clean-up.
**Piece 6 open items** (facts only):
- Memory risk before public exposure: the booking route reads a body up to
  73,400,320 bytes (5 x 10 MB x 1.4) BEFORE the guest limiter. Peak memory per
  request is roughly 300 MB (received chunks, Buffer.concat copy, utf8 string,
  JSON.parse copy, plus base64 decode). No concurrency limit exists and the
  Dockerfile/compose set no memory limit, so about 10-15 simultaneous max-size
  posts could exhaust Node memory (the same process serves the staff tills).
  Cheapest fix: cap concurrent large-body reads (503 beyond 2-3), reject early
  on Content-Length over the cap, free chunks before parsing. Needs Jack's
  decision before this route is publicly reachable (hosting not chosen, PL-1).
- Files can be left on disk if COMMIT fails after photos were saved (rare,
  up to 50 MB per booking).
- Customer photos must be sent as bare base64; a `data:image/...;base64,`
  prefix or line breaks is refused as "could not be read". Note for whoever
  builds the booking page's photo picker.
- Pre-existing, not from piece 6: a guest's customer row and a newBike row can
  remain after some refusals inside the lock ("Please choose a mechanic",
  capacity refusals, the 23505 case); a JSON body of `null` gives 500.
**Phases 0-3 merged** (#54-#59). **Phase 4 foundation merged** (#60-#62).
**Open:** Mark's #50 review is against the superseded
84-screen version; told 20 Sep. Other open items are Jack's.

> **Tracked and authoritative.** This file and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`. If it is wrong, that is a bug.
> **Never put a destructive command here** — one stale reset nearly destroyed
> the WorkOS plan. State facts; let the reader run the verbs.

## Where this stands

**Release 1 scope is narrowed and settled** (#51); live scope file
`docs/decisions/2026-09-10-release-1-scope-reduction.md`. **The atlas is 82
screens**, 13 notes applied, asserted by `check-notes.mjs` (#54). The tag
barcode is a declared **non-scanning specimen**; PDFs and board PNG **stale**.

**Still no Lightspeed technical spec and no account.** LS-01 to LS-09 are
"Pending", needing the first shop's series and an authorised account.
Recovery is outside Release 1; WorkOS auth and design remediation stay approved
and unbuilt. The `prototype/` demo has **no week view** — the staff diary
(`public/app.js:1496`; `buildWeekGridHtml` :2038, `renderWeekGrid` :2072,
interactions :1878-2285) and customer slot grid (`public-portal/portal.js:364`)
are the spec for screens 38/39/44.

**Check the checkout before judging state; stage one's transaction mode is
OFF.** Detail: `ARCHIVE.md`.

## Operational traps

- **The app is on `localhost:8080`, not 4000; Postgres on 5433, not 5432.**
- **Never delete the `cf-*` header names in `server/gateway.js`** — the strip
  list; removing it reopens a login brute-force bypass.
- **Never hand-edit the atlas HTML**; `package.py` regenerates it.
- **`public/dist` is untracked** (23 Sep; three stale files were committed
  in `fa32b60`). A fresh checkout must `npm run build` before `/workshop`
  serves or `tests/workshop-page.test.js` passes.
- **`npm run docker:down` keeps the volume** — not a clean database. Use a
  scratch one to test migrations from empty.
- **`npm test` hangs silently** without the compose Postgres up.
- **`public/index.html` loads `/app.js`, never `/dist/`** — before Task 1 the
  bundle loaded on no page. The React app is only `/workshop` and below.
- **`npm run test:browser` builds and boots its own server on 8091**, never
  reusing one: 8080 is the docker `app`, 31 Aug image.

## Read order for a fresh session

This file → **Plan register** below and the plans it names →
`2026-09-10-release-1-scope-reduction.md` → `…-lightspeed-readiness.md`.

## Immediate next actions

1. **Piece 5 (service questions): built on branch
   `feat/book-server-5-service-questions`, open as PR #70** (off
   `41f48e8`). Spec
   `docs/superpowers/specs/2026-09-25-book-server-5-service-questions-design.md`;
   plan `docs/superpowers/plans/2026-09-25-book-server-5-service-questions.md`
   carries the decision log and a full spec walk at its end. Migration 028
   adds `workshop_services.questions` and `workshop_jobs.question_answers`.
   **Next:** read CI on #70; Jack decides whether to merge. Follow-up: a
   null byte in answer or description text gives a 500 after the guest
   customer row is written — needs one shared text clean-up step.
   **Piece 4 merged (#69):** private link `/book/<shop>/booking/<code>`,
   read-only until 30 days after the booked date, hash-only storage, staff
   replace route (no button), 30 lookups/15 min/IP, `customer_description`
   apart from `notes`. **For the page and staff button, later:** no-store and
   no-referrer headers, no tight polling, an audit entry on link replacement,
   and the staff screen id on the route's `// screens:` line (now `expired`).
   Plan 4a stays STOPPED at Task 7 item 3; routing decided 23 Sep
   (`docs/decisions/2026-09-23-book-journey-routing-and-modes.md`). Earlier
   25 Sep, Jack: guests always give a phone; the booked price is stored on the
   job (#68); `/sdbdemo` no longer booking is accepted.
2. **Jack: Lightspeed series + test account.** P00-LS and P07 wait on it.
3. **Jack: printer, tag dimensions, driver host.** The **scanner half of P00b
   is closed** (`2026-09-23-p00b-scanner-evidence`): 1D, **cannot read QR**, so
   the tag carries Code 128 as note 11 has it. No tag from our printer has been
   scanned — the atlas barcode stays a non-scanning specimen.
4. **Jack: the message providers**, and what inbound replies do.
5. **Mark: the screen review** (#50), open since 17 Sep.
6. **Split the Release 1 plan into issues** — row IDs, state changes, expected
   failure, test command, proof per package.

**Carried open:** four, incl. three tenant-isolation gaps confirmed ABSENT on
`main` 9 Sep. Three closed 20 Sep (Jack): atlas checks **run in CI**;
`prototype/` and review-pack scripts stay **out** of CI; money stays a JS
float, **totalled in SQL, never JavaScript** — binds Phase 4. **Hubtiger
trial lapsed ~15 Sep**; re-entry needs Jack's login.

## Done and branches

43 PRs merged (#1–#51), plus #54-#64. Record in `ARCHIVE.md`. One branch still
matters — `docs/jack-ranking-2026-09-10` holds the only copy of the filled
**Jack's priority** column, empty on `main`. `plan/phase-4-screens` was
deleted 23 Sep (its plans are on `main`, newer).

## Phases 0-3

Seven state machines replace `workshop_jobs.status`, now a **generated
column**; fifteen action endpoints are guarded by them and an optimistic
`version`, **which every Phase 4 mutation must echo**. **A 409 carries `code:
'stale' | 'illegal'`** (#60, Jack). **Quote line decisions are final** (#59).
Detail, incl. #58's carried items: `ARCHIVE.md`.

## Phase 4 foundation (Tasks 1-6)

`/workshop/*` serves the React app (`src/staff/`). `ROUTES` (`routes.ts`)
maps atlas id → URL; `SCREENS` (`app-shell.tsx`) registers built screens.
Server calls go through `src/lib/api/client.ts` (`jobAction` needs
`version`); identity only via `useSession`. `src/lib/adapters/intent.ts`
records print/message intent, stores nothing, never claims delivery. **Not
yet:** nav, styling, shop theme, auth guard. Endpoint gap list: `ARCHIVE.md`.

## Plan register

Decisions: files under `docs/decisions/`; undecided ones in `ARCHIVE.md`.
LOCKED: `2026-08-31-master-implementation-plan.md`. Current: the Release 1
workshop plan and the Phase 4 screens plan; the phase plan summary is in
`ARCHIVE.md`. Approved, unbuilt: WorkOS, design
remediation. Detail: `ARCHIVE.md`.

## Canonical commands

```sh
npm run docker:up   # the suite hangs silently without it
npm test && npm run typecheck && npm run lint && npm run build
node scripts/ci/assert-rls-coverage.mjs
node scripts/ci/assert-screen-trace.mjs
npm run registry:validate && node scripts/ci/check-registry-drift.mjs
python3 docs/design/release-1-journey/package.py && node docs/design/release-1-journey/check-static.mjs && node docs/design/release-1-journey/check-notes.mjs
npm run test:browser
```

All run in CI too, so a green PR means they passed.


**Verified 24 Sep: CI on `main` `9291119` green, 471/471.** Same day: #65 CI
green; #66 CI green against main on `50785ac`, 565/565 locally. Prior (2a 528/528, 23 Sep 437/437): `ARCHIVE.md`. Check a PR's CI
against the run's own SHA, not the PR pane.

**A worktree needs its own `.env`** — gitignored, so it does not travel;
without it the server uses 5432 not 5433 and every server-booting test fails
with `ECONNREFUSED`, which looks like broken code and is not. Live-server tests
must `import '../server/load-env.js'` first.

## Open items needing Mark

Eight. The screen review (#50) is urgent, re-point at the 82-screen atlas;
the other seven in `ARCHIVE.md`.

## Keeping this file honest

Update at every phase boundary and before ending a session. Cap 8,000 bytes.
Past that, trim by **moving** — to `ARCHIVE.md` or `docs/decisions/`, never by
deleting. Check the byte count before committing, not after.
