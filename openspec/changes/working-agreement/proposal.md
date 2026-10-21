# Proposal: how Mark and Jack work together, from 21 Oct 2026

## Why

The split plan (4 Oct, `docs/superpowers/plans/2026-10-04-release-2-two-person-split.md`)
divides the work by layer and by file: Mark takes the server half of each work
package, Jack the screens and the workshop, every Jack server change needs
Mark's approval, and the stage check gates each stage. Three weeks in, what it
produced:

- Jack's work waits on Mark's server half (auto-confirm since 19 Oct, the
  booking page's data since 21 Oct, sales in pence), and Mark's work waits on
  nothing but his own time.
- While Mark was away (from 15 Oct) about 25 pull requests changing Mark's
  files merged "flagged for Mark" with no approval, and STATUS grew a run of
  "Check #NNN" items nobody can act on.
- The stage check (line 7 of split plan §9) never ran, because it waits on
  lines Mark owns, and stage 1 to 4 work was built regardless.
- A review of origin/main on 21 Oct found money, stock and sign-in gaps that
  neither approval nor flagging caught. A gate that depends on one person
  being free caught none of them.

Mark, 21 Oct: self-review plus `/review` is enough outside a short list of
risky areas; either of them can fix anything; the change is written up now
and Jack is told by an issue, not asked to approve first.

## What Changes

1. **Feature slices.** Whoever starts a piece owns it from the drawing to the
   server to the screen, including its migration and routes. No "server half
   first, then screens". The contract in `design.md` stays as a note for the
   reader, not a handoff.
2. **A risky-areas list instead of file ownership.** Four areas get a second
   pair of eyes (after merging, never blocking it): migrations; money and
   stock; sign-in, customer accounts and public routes; `server.js` and the
   messaging core. Everything else is the author's call after a self-review.
3. **Checks enforce it, not people.** CI gains: an Owner-only route list test,
   concurrency tests for payment and stock, one real-server browser test per
   new screen, and one shared file of reply shapes.
4. **Themes per week, not stages.** Each week names a theme per person; either
   can pick up anything in a theme. The stage check becomes a checklist run
   when its lines are in, not a gate that stops other work.
5. **Less process.** One status pull request a day; one "who is on what"
   block in STATUS; the "Check #NNN" list becomes one checklist issue.
6. **The 21 Oct review findings** are the first tasks (`tasks.md`, group 3),
   each owned by "either".

## Lane, work package, drawings and decisions

- **Work package:** none; this is how all work packages are run.
- **Lane:** both people. The change edits `CLAUDE.md`, `openspec/config.yaml`,
  CI, and adds tests; it touches no app behaviour.
- **Drawings:** none. **Decisions followed:** `2026-10-08-openspec-only.md`
  (OpenSpec stays the way each piece is written) and
  `2026-10-03-build-plan-questions.md` Q1 (CLAUDE.md overrides the global
  rules for this project). It changes split plan §3, §3.1, §4.3 and §4.4;
  Mark made that call on 21 Oct. Jack is told by an issue and can overrule it.

## Out of scope

- The build plan's work packages, stage contents and the order of its work.
- Anything Jack must still decide under "Always stop and ask Jack" in
  `CLAUDE.md` (money, real accounts, real shop data, deletions, design).
- Rewriting the split plan beyond a one-line pointer at its top.

## Impact

- `CLAUDE.md`, `openspec/config.yaml`; the split plan's first lines
- CI workflow and tests (tasks group 2): listed in `tasks.md`; editing CI is
  its own approved step per the global ask-first list
- STATUS layout (tasks group 4)
