# Wheelhouse EPOS — project rules

Wheelhouse is a till, workshop and website system for independent UK bike
shops. Jack Curphey owns this project; Mark Curphey is his collaborator. Jack
is not a programmer: write to him in plain English, with numbered options
(1, 2, 3) and concrete trade-offs, one question at a time.

These rules override the matching lines in the global rules for this
project only (Jack, 3 Oct 2026, `docs/decisions/2026-10-03-build-plan-questions.md` Q1).

## Start of every session

1. Read the top of `.agents/STATUS.md` (where things stand, what's next).
2. If building, read `docs/superpowers/plans/2026-10-03-release-2-build-plan.md`
   (what is built, in which stage) and
   `docs/superpowers/plans/2026-10-04-release-2-two-person-split.md` (who
   builds which half, and in what order). Find out whose session this is —
   Mark's or Jack's — and take the next piece in that person's lane.
3. **Two people build at once** (Jack, 4 Oct, agreeing to the split plan):
   Mark takes the server half of each work package and all hosting; Jack
   takes the screens and the whole workshop. Each file has one owner (split
   plan §3); a pull request touching the other person's files needs their
   approval.
4. **The build has not been started.** Mark has reviewed the plan (4 Oct).
   Stage 0 starts once the four blockers in issue #142 are fixed and Jack
   says so in chat.

## Where things live

- Specs: `docs/superpowers/specs/`. Plans: `docs/superpowers/plans/`.
- Jack's decisions: `docs/decisions/` (one file per journey, plus the
  walk-throughs). Never reopen a decision; note when work touches one.
- The drawings: `docs/design/user-journeys/generator/` (screen ids in
  `journeys.mjs`), published as claude.ai canvases listed in `.agents/STATUS.md`.
- Personas for walk-throughs: `docs/design/user-journeys/personas.md`;
  the method: `docs/design/user-journeys/ux-walkthrough-script.md`.
- Gaps the drawings didn't cover, decided while building:
  `docs/decisions/decided-while-building.md` ("Decided here, for Jack to
  overrule"), with the screen id, what was decided and the pattern followed.

## Allowed without asking (once the build has started)

1. Build exactly what the drawings and decisions show, in your lane's order
   (split plan §4.4, §7 and §9).
2. Make the database changes the plan lists.
3. Where a drawing is silent, follow the closest pattern already built, log
   it in `decided-while-building.md`, and carry on.
4. Merge your own pull request once CI has passed on its final commit and a
   fresh reviewer (a subagent that didn't write the code) has checked it
   against the spec and the drawings.
5. Remove an old-app screen (`public/app.js`) once its new replacement is
   merged.
6. Add a small, well-known dependency when a piece needs it; say so in the
   pull request.
7. Keep the build board artifact (https://claude.ai/artifact/NSgsNTKzrYr6GUK4GjF3by,
   source `docs/build-progress/build-board.html`, edit only its `BOARD` block)
   and `.agents/STATUS.md` current with **one status pull request a day**,
   made by whoever finishes last, covering both people's merges (split plan
   §5). Feature pull requests don't touch `STATUS.md` or the board.
   `decided-while-building.md` has a section per person; append only to
   your own.

## Always stop and ask Jack

- Spending money, or creating or connecting a real account or key.
- Touching real shop data. Real Citrus Lime export files never go in the repo.
- Deleting anything not covered by rule 5 above.
- Anything that contradicts a recorded decision.
- A test that can't be made to pass, or a stage check that finds a broken
  story the decisions don't settle.
- Changing a screen's design beyond what the drawings show.

## How each piece is built

Short spec section → tests first, each watched failing for the right reason
→ build to the drawings → fresh review → `npm test` and
`npm run test:browser` pass locally → pull request → merge when CI is green.
The board and STATUS catch up in the day's status pull request. Where a
package has both halves, the contract is written first and Mark's server
half merges before Jack's screens half starts (split plan §4.3, §4.4). Pull requests aim for 250–600 changed lines.
Outside services (payments, email, sign-in, accounts software, Lightspeed,
Citrus Lime) are built behind an adapter with a pretend version until a real
account exists.

## Testing and environment

- The app runs on `localhost:8080`; Postgres via `docker compose` on port
  5433. `npm test` hangs silently without compose Postgres up.
- Server tests pin the clock to 1 Sep 2026 (`WHEELHOUSE_TEST_CLOCK`); never
  add fixed test dates before it. Customer tests need `npm run pretest` first.
- Compare DOM query results with `assert.ok(x === null)`: `assert.equal` on a
  DOM node hangs about 60 s on failure.
- A worktree needs its own `.env` (gitignored), or server-booting tests fail
  with `ECONNREFUSED`.
- Use a scratch database to test migrations from empty.

## Never

- Invent data: example data comes from the drawings; unknowns stay as
  bracketed placeholders like `[n]`.
- Invent a logo: there is no official Wheelhouse logo file yet.
- Commit to `main`, or commit `.env` files or keys.
