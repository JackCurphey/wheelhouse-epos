# Release 2 build — splitting the work between Mark and Jack

**Date:** 4 October 2026
**Status:** proposal from Mark's review of the build plan. Nothing here is
started. Jack, 4 Oct: the build starts only when he says so.
**Not ready to build from yet (Codex review, 4 Oct):** four blockers and
eleven should-fix findings in
`docs/reviews/2026-10-04-release-2-plans-codex-adversarial.md`. Two of the
blockers are in this file: the migration-number rule (§4.2) and the
first-week schedule (§9). Jack's GitHub issues track the fixes; the
first-week schedule and §7.2's list will change.
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
| `server/server.js`: 6,861 lines, all 146 routes, and every serializer | Every server change edits it | §4.1: one route file per area (WP-0.4) |
| `server/migrations/NNN_*.sql`: numbered one after another (`038` is the latest) | Both people would claim `039` | §4.2 |
| `src/lib/api/types.ts`: client copies of server shapes, written by hand | Every package adds types here | §4.3: one types file per area |
| `src/staff/routes.ts`, `nav.ts`, `app-shell.tsx` `SCREENS` | Every new staff screen edits all three | Jack's alone (§3) |
| `scripts/ci/assert-screen-trace.mjs` `COVERED` list | Edited with screen-tagged routes | Mark's alone |
| `tests/helpers/testShop.js`, `workshopFixtures.js`, `staff.js` | Seed data both people's tests use | Mark's alone; Jack asks for what he needs |
| `.agents/STATUS.md` and the build board's `BOARD` block | Both are updated after every pull request, by rule | §5 |
| `docs/decisions/decided-while-building.md` | Both append | §5 |
| `public/app.js` (the old app, 7,123 lines) and the server fields kept only for it | Removing an old screen touches both | §4.5 |

Pull requests #110, #111 and #112 (Jack's) are open and edit `server.js`.
They must merge **before** the route split, or each would need rebasing
onto a file that has moved.

## 3. Who owns which files

Each file has one owner. The owner edits it freely. The other person may
edit it only in a pull request the owner has approved.

**Mark:** `server/**` (except the workshop area below), `server/migrations/**`,
`src/lib/api/**` (the client and the per-area types files: the seam between
the two halves), `src/lib/live/**` (the live-updates hook, WP-1.9), the
in-browser till copy and send queue (WP-1.6), `tests/*.test.js` (server
tests), `tests/helpers/**`, `scripts/ci/**`, `.github/**`, `docker*`,
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
a contract for every small change.

## 4. The rules that stop collisions

### 4.1 One route file per area (new WP-0.4, Mark, before anything runs in parallel)

Move the routes out of `server/server.js` into `server/routes/<area>.js`
(auth, settings, shops, products, stock, till, customers, workshop, booking,
messages, reports, website, orders, c2w, import). Each file exports a
`register(route)` function, and `server.js` calls them **in a fixed order**:
the router takes the first route that matches, so moving routes must not
change which one wins. This is a move, not a rewrite: no behaviour change,
proven by the existing `npm test` and `npm run test:browser` passing
unchanged. After it lands, a package adds its own route file instead of
editing `server.js`.

### 4.2 Migrations

Migrations keep their three-digit numbers (`039`, `040`, …; Mark, 4 Oct).
Mark writes them, except in Jack's workshop area. A number is claimed by
opening the pull request. If two open pull requests carry the same number,
whichever merges second renumbers its file before merging. A CI check (part
of WP-0.4) fails if two migration files share a number, so a clash can't
reach `main`. The runner applies files in filename order
(`server/migrations/run-migrations.js:68–70`). Renumbering is safe only
before merging: once a file has run anywhere, it keeps its name.

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
2. the next piece of the workshop pulled forward (§7)
3. old-app removals (§4.5) and the stage check walk-throughs

so he never waits on Mark. (Building blocks ahead of their package was
proposed and turned down, Mark, 4 Oct. See §7 for what Jack does
instead.)

### 4.5 Retiring the old app

When Jack's replacement screen merges, Jack removes the old screen from
`public/app.js` (project rule 5). Mark then removes the server fields kept
only for it, in a follow-up pull request. They are never done in the same
pull request.

### 4.6 Branches, worktrees, size

- Branches are `mark/<wp>-<what>` and `jack/<wp>-<what>`, off fresh
  `origin/main`. Each Claude session works in its own worktree.
- No branch lives more than two days. Rebase on `main` before opening a pull
  request and again before merging.
- The pull request size target stays at 250–600 changed lines.
- A pull request that touches a file the other person owns needs that
  person's approval, as well as the fresh subagent review (project rule 4).

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

Agreed by Mark, 4 Oct (§8 answer 1). It changes a project rule (CLAUDE.md
"Allowed without asking" item 7), so Jack has to agree too, and CLAUDE.md
is updated in the same pull request as this plan.

## 6. Every work package, split

**M** = Mark, **J** = Jack. Where a package names both, Mark's server half
merges first (§4.4). "Whole" means one person builds both halves.

### Stage 0 — Close what's open, and make the code splittable

| Package | Mark | Jack |
|---|---|---|
| 0.1 Merge #110, #112, #111 | review | **J** merges, first, before 0.4 |
| 0.2 Booking bugs | another shop's page on a subdomain; "today" at UTC midnight; a duplicate booking from a lost reply (the server accepts each request once); `null` body error | Back while "Sending…" loses the private link; the client sends the same request key on a retry (from the contract) |
| 0.3 Trim STATUS to 8 KB | **M**, with §5's new layout | — |
| **0.4 (new) Make it splittable** | **M**: route files (§4.1); per-area types files (§4.3); the migration-number CI check (§4.2) | review |
| **0.5 (new) A hosted copy for Jack** | **M**: choose the host (PL-1), deploy `main` there on every merge, test data only | tries it |

### Stage 1 — Foundations (mostly Mark, in the order of §7; Jack pulls workshop pieces forward)

| Package | Mark | Jack |
|---|---|---|
| 1.1 Roles and switches | four roles, eight switches, `/api/auth/me`, a check on every route, a login linked to its staff member | blocks 12, 16, 29; `map`, `staff-app`, `till-rail`; the sidebar per role; a mechanic lands on the Diary |
| 1.2 Settings, change record, activity | **M** whole (no screens) | — |
| 1.3 Settings frame | — | **J** whole: blocks 1, 2, 9, 10, 11; `set-till-quick`, `set-till-quick-add`. Uses 1.2's settings store, so no new server routes |
| 1.4 Shops everywhere | **M** whole (no screens) | — |
| 1.5 Products and stock in pence | **M** whole (no screens) | — |
| 1.6 One sales record | **M** whole, including the in-browser copy, send queue and offline PIN check (front-end code, but it belongs to the offline core) | — |
| 1.7 Sign-in and PINs | WorkOS adapter with its fake; emailed codes; PINs; till set-up; idle timeout (10 minutes, Q6) | blocks 13, 22, 26, 40, 42, 43; the 8 screens |
| 1.8 Messages engine | engine, placeholders, text or email, Undo window, scheduler, the outbox stand-in | `set-msg-list`, `set-msg-edit`, `set-msg-new` |
| 1.9 Live updates | **M** whole: the server side and the `src/lib/live` hook Jack's screens use | — |
| 1.10 Needs attention and Today | the needs-attention model with Seen; Who's in; Workshop today data | block 6; `op-today` |
| 1.11 Small shared parts | spreadsheet download; printing through the print agent; header search API; payments adapter with its fake | block 17, `till-search`; `your-settings` (kept in 1.2's store) |

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
| 3.1 The till, complete | discounts and reasons; parked sales; receipts by email and text link; voids and refunds; store credit, gift cards and accounts; paying for a job with collection recorded | blocks 8, 19, 20, 21; the 22 screens. This is the biggest screens package |
| 3.2 Customers | duplicate catching, one history, statements, merging, privacy requests | the 8 screens |
| 3.3 Opening the shop | — | **J** whole: block 18, float check (a small server change), 2 screens, Today lines |
| 3.4 End-of-day cash-up | count, paid-outs, banking, card check, end-of-day figures, reopen | blocks 5, 7; the 4 screens |

### Stage 4 — The workshop and the customer's repair

| Package | Mark | Jack |
|---|---|---|
| 4.1 Workshop day, the rest | — | **J** whole (his workshop area, §3): blocks 15, 23, 25; 9 screens; storage slots, checklist, "Mark ready" as the sign-off (Q3) |
| 4.2 Quotes, the rest | reminders through 1.8's scheduler, spending limit, deposit through the payments adapter | blocks 37, 38; 3 screens |
| 4.3 Collect and pay | "Bike ready" on Mark ready; online payment; receipts; the uncollected reminder | blocks 39, 41; 5 screens |
| 4.4 Book a repair, rebuilt | deposits and auto-confirm on the server | **J** most of it: block 36, 8 customer screens, change and cancel, saved draft. Jack's sessions built the booking server, so he keeps it |
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
see nothing new on screen for most of it. Three changes fix that. None of
them changes a package's contents.

**7.1 Mark builds stage 1's server halves in the order that unlocks the most
screens first.** Packages whose server half has screens waiting on it come
first; packages with no screens come after:

1. 1.1 Roles and switches (unlocks the app frame and the sidebar per role)
2. 1.2 Settings store (unlocks 1.3 Settings frame and Your settings)
3. 1.10 Needs attention (unlocks Today)
4. 1.7 Sign-in and PINs (unlocks 8 screens)
5. 1.8 Messages engine (unlocks Settings › Messages)
6. 1.11 search, printing, spreadsheet download, the payments adapter
7. then 1.4, 1.5, 1.6 and 1.9, which have no screens of their own

All of stage 1 still finishes before stage 2's server halves start.

**7.2 Jack pulls the workshop forward while stage 1's server work runs.**
The workshop is his full-stack area (§3, agreed). It already runs: the
diary, the job page and quotes 1–3 are built. So Jack builds the parts of
WP-4.1 that use only blocks that already exist, on the server he owns:

- the request pop-up (mechanic pills, offer another time, decline with a
  message)
- new job extras
- storage slots
- bike tag at book-in
- done ticks and notes per line
- "I'll do this"
- "Who did what"
- "Mark ready" as the sign-off (Q3)
- "Use my phone" photo
- diary settings (once 1.3's Settings frame has merged)

`overview` (needs block 3) and `job-checklist` (needs block 7) stay in
WP-4.1's place after stages 2 and 3, as do the situations that need roles
(`diary-mechanic`) until 1.1 merges. This changes the order Jack chose in
Q2, so Jack has to agree (§8).

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
4. **The workshop as Jack's full-stack area.** Mark, 4 Oct: yes.
5. **Hosting and infrastructure.** Mark, 4 Oct: Mark's, all of it,
   including the hosted copy for Jack (WP-0.5).
6. **For Jack:** agree to §5's change to the project rules and §7.2's
   change to the build order. Jack, 4 Oct (issue #127): **agrees to §5**
   (one status pull request a day) **and to working in two lanes** (§3, §4);
   `CLAUDE.md` and the top of `.agents/STATUS.md` now say the same. §7.2's
   change to the build order is still open.

## 9. The first week, concretely

1. Jack merges #110, #112 and #111 (WP-0.1). The till, the teal "Waiting for
   the customer" and the diary extras are then on `main` to click.
2. Mark opens WP-0.4 (route files, types files, the migration-number CI
   check) and WP-0.3. Jack reviews them.
3. Mark writes the WP-1.1 contract, then builds 1.1's server half, then 1.2.
4. Jack, meanwhile: the screen half of WP-0.2, then workshop pieces (§7.2),
   then 1.1's screens as soon as their server half merges, then 1.3.
5. Mark stands up the hosted copy (WP-0.5) once WP-0.4 has merged.
6. Mark takes WP-0.2's server half between 1.1 and 1.2, so the booking
   bugs are closed within the week.

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
| No building blocks ahead; stage 1's server order puts screens first; workshop pieces pulled forward | Mark, 4 Oct, answer 2: Jack should see progress and working software as early as possible |
| Migrations keep their numbers; the second to merge renumbers; CI catches a clash | Mark, 4 Oct, answer 3 |
| Project rules changed to match: two lanes, one status pull request a day | Jack, 4 Oct (issue #127, option 1) |
| Hosting and infrastructure are Mark's, and a hosted copy comes in stage 0 | Mark, 4 Oct: "assign the hosting and infra to me"; Jack sees each merge without running the app |
