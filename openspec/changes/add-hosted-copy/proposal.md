# Proposal: a hosted copy for Jack (WP-0.5)

## Why

Today Jack can only see the app by running it on his own computer. The split
plan promises him a copy on the internet that he can open on any device, with
every merge to `main` put there automatically (split plan §7, §9 line 6).
Before that copy is built, issue #137 asks for a written list of what it must
do. That list covers how the database is connected, where photos are kept,
how an update goes out and comes back, test data only, and a timed restore.
Those points came from Codex's review of the plans (finding 13,
`docs/reviews/2026-10-04-release-2-plans-codex-adversarial.md:101-105`).
This change is that list. WP-0.5 is also the last of Mark's stage 0 lines
before Jack's stage check (§9 line 7).

## What Changes

- A new area spec, `hosted-copy`, saying what the hosted copy does, in terms
  Jack can check: what he can open, what happens when something merges, what
  it will never do (send real texts, take real money, hold real shop data),
  and how it is brought back if it breaks.
- The database connection rule the server already enforces
  (`server/db.js:10-22`, `assertPoolerModeSafe`) written down as a hosting
  requirement: a direct connection or a session-mode pooler, never a
  transaction-mode one.
- Photos and attachments are **not kept** on the test copy for now: the
  photos part isn't being built yet (Mark, 15 Oct). Jack is told up front.
  They get a lasting home before real use.
- Updates: `main` only, the database changes applied before the new version
  takes any traffic, and a written way back.
- Test data only: a test shop loaded from the drawings' example data, with
  real texts and the Shopify connection switched off. The server refuses to
  start if it is given a real key.
- `NODE_ENV=production` set on the hosted copy, so a stray test clock can
  never freeze its time (`server/clock.js:15-21`; promised on #191).
- A timed rehearsal that restores the database (and the attachments, once
  they're kept) into a fresh copy, written down before any real shop uses Wheelhouse. Jack does
  it with Mark watching, as agreed for PL-3
  (`docs/decisions/2026-09-01-ownership-signoff.md:55`).

## Capabilities

### New Capabilities

- `hosted-copy`: the copy of Wheelhouse on the internet that Jack tries each
  merge on. It covers deploys, test data, switched-off outside services,
  storage and the restore rehearsal.

### Modified Capabilities

None.

## Lane, drawings and decisions

- **Lane:** Mark's. All hosting and infrastructure is Mark's (split plan §3,
  `docs/superpowers/plans/2026-10-04-release-2-two-person-split.md:68-75`;
  §8 answer 5). Jack has offered to take a part; tasks group 1 (the test
  shop loaded from the drawings) is marked as one he could take, with Mark's
  approval because the files are Mark's. The restore rehearsal is Jack's
  hands and Mark's eyes (PL-3). The parts that edit `server.js` wait for
  WP-0.4's route moves to merge (split plan §9 line 6).
- **Drawings:** none. This change has no screens. The test shop's names,
  prices and wording come from the drawings
  (`docs/design/user-journeys/generator/`) and the personas
  (`docs/design/user-journeys/personas.md`). Gaps stay as `[n]`.
- **Decisions followed:**
  - The hosted copy comes in stage 0, deploys `main` on every merge, test
    data only (split plan §9 line 6, §7; Jack agreed to the split plan, #127).
  - It only ever runs merged migrations (split plan §4.2 rule 4,
    `two-person-split.md:286-287`).
  - Outside services stay behind a pretend version until Jack says yes to a
    real account (`CLAUDE.md`, "Always stop and ask Jack";
    `openspec/config.yaml`).
  - Managed Postgres with point-in-time restore and a rehearsed restore
    (the sixth architecture ceiling, `two-person-split.md:73-74`).
- **Where the data lives:** a UK region, for the test copy only (Jack, 15 Oct,
  #137; `docs/decisions/2026-10-15-hosted-copy-region.md`). Where real shops'
  data lives is settled before any real use.
- **The host (PL-1, for the test copy):** DigitalOcean in London, a server
  plus managed Postgres, about £20 a month with VAT (Mark, 15 Oct). Opening
  the account costs money, so it waits for Jack's yes on #137.

## Out of scope

- Hosting for real shops (release 2's go-live): uptime monitoring, error
  tracking, a status page, real email, more than one server (PL-11 to PL-14).
- Keeping photos and attachments, and the file store they need (see
  `design.md` Decision 4).
- A "this is a test copy" banner on screens. That would be a screen change,
  in Jack's lane and needing a drawing.
- Switching the database to transaction-mode tenancy (`DB_TENANT_SCOPE`).
- Opening any account or spending any money before Jack's yes.

## Impact

- **New files:** `openspec/changes/add-hosted-copy/` (this change), then on
  archive `openspec/specs/hosted-copy/spec.md`.
- **Code, when built:** a deploy workflow in `.github/workflows/`, a setup
  script and server config in `scripts/hosting/` (with `NODE_ENV`), a start-up guard
  against real keys in `server/`, a test shop loader in `scripts/dev/`, and
  runbooks in `docs/runbooks/`. All of these are Mark's files.
- **Outside accounts:** one DigitalOcean account (server and managed
  Postgres), opened by Jack with his card once he says yes, with Mark invited
  to it. Images go to GitHub's own container registry, so there is no other
  account.
