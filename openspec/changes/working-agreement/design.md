# Design: how Mark and Jack work together

Plain English first; the file lists are for whoever builds the checks.

## Decisions

### 1. Slices, not halves
Whoever starts a piece writes its `openspec` change (contract in `design.md`,
all tasks in `tasks.md`) and builds every part: migration, routes, screens,
tests. Mark's old "server half merges before Jack's screens half starts"
(split plan §4.3, §4.4) and the file-owner table (§3, §3.1) stop applying.
If the other person has the better context for one part, they say so in the
pull request and either can take it.

Cost: two people can edit the same file at once, so the diary file
(`src/screens/diary/diary-page.tsx`, 2,064 lines) is split first (task 3.12).
Pull requests stay 250–600 lines so a clash is small.

### 2. The risky-areas list
Anything here needs `/review` run by the author before merging, and goes in
the weekly digest for the other person to read. The other person's comments
never block a merge; a problem found is a new task, fixed by either.

1. **Migrations:** `server/migrations/**`.
2. **Money and stock:** `server/routes/sales.js`, `server/lib/sales.js`,
   `server/routes/products.js`, `server/routes/purchase-orders.js`,
   `server/till/**`, `server/workshop/sign-off.js`, and anything else that
   writes `stock_qty`, a sale, a payment or a refund.
3. **Sign-in, customer accounts and public routes:** `server/auth.js`,
   `server/customer-auth.js`, `server/routes/auth.js`, `server/routes/team.js`,
   `server/lib/owner-only.js`, `server/routes/portal.js`,
   `server/booking-link.js`, and every `/api/portal/*` route.
4. **The core:** `server/server.js`, `server/db.js`, `server/messaging/**`,
   `server/hosted-copy-guard.js`.

Everything else, including the rest of the workshop server, is the author's
call after a self-review (read your own diff against the spec, run the tests).
The existing rule that a pull request is checked by a fresh reviewer before it
merges is replaced by: `/review` for the list above; a self-review elsewhere.

Always-stop-and-ask-Jack items in `CLAUDE.md` are unchanged.

### 3. Checks do the enforcing
A rule that depends on one person being free fails when they are away. These
checks fail the build instead (tasks group 2):

- **Owner-only list:** one list of settings and team routes in
  `server/lib/owner-only.js`; a test calls each as a non-owner and expects a
  refusal, and fails if a route under the settings paths is not on the list.
- **Concurrency:** tests that fire two converts of one order and two sales of
  the last unit with `Promise.all`, and expect exactly one to succeed.
- **Real-server browser test per new screen:** a check that every screen
  file under `src/screens/` is named in a `tests/browser/*.spec.ts`, with an
  allowed-gaps list that may only shrink.
- **One reply-shape file:** each API reply the screens read is described once
  (for example `src/api/shapes.ts`), imported by the screens' tests' mocks
  and by a server test that checks real replies against it.

### 4. Themes and the stage check
Each week one message (STATUS "who is on what") names a theme per person from
the build plan, for example "money, stock and hosting" and "workshop and
booking". Either person takes any piece in either theme if the other is
busy. The stage check (split plan §9 line 7) becomes a checklist issue,
ticked when its lines are in; it no longer stops other work. Stage order in
the build plan is unchanged as a guide to what depends on what.

### 5. Process load
- One status pull request a day (`CLAUDE.md` rule 7), by whoever finishes last.
- STATUS has one "Jack is on" and one "Mark is on" block and no dated copies.
- The "Check #NNN" run-on in STATUS moves to one checklist issue, "To
  review", one line per pull request in a risky area; ticked when read.
- The weekly digest is one issue per week listing risky-area merges.

## Risks

- **Two people both build the same piece.** The "who is on what" block names
  each piece taken; take it there before starting.
- **A weak self-review.** The checks in decision 3 are the backstop, and
  `/review` is mandatory in the four areas.
- **The checks give false comfort.** Each is watched failing against a
  deliberate break before it merges (task 2.5).
