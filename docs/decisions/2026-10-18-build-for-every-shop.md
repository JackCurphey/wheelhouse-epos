# Build for every shop, not to move Jack's shop first (18 Oct 2026)

Jack, 18 Oct, choosing the next piece of work:

> "I would not like to specifically design this anymore so that we can move
> my current shop over to it. I think we can kind of nix asking the
> accountant about Citrus Lime reports and stuff like that. We should just
> build it for the broadest use case, and all shops ultimately. If my shop
> wants to use it, then we can fold them into the general kind of handover
> that we have."

1. **Wheelhouse is built for the broadest range of independent bike shops**,
   not shaped around moving Jack's own shop off Citrus Lime first.
2. **Jack's shop is no longer the first switch-over.** If it moves to
   Wheelhouse, it goes through the same handover as any other shop.
3. **Dropped:** the to-do that followed from answer 1 of
   `2026-10-16-go-live-checklist.md`: asking Jack's shop's accountant which
   Citrus Lime reports they use (also on the build board). Answer 1 itself
   is not changed by this.

This changes earlier records that treat Jack's shop as the shop Release 2
must replace (for example the go-live checklist,
`docs/runbooks/go-live-checklist.md`, "switching Jack's shop from Citrus
Lime"). Which of them change, and how, is for Jack to settle one at a time;
nothing else in them changes until he has.

## Release 2's finish line (Jack, 18 Oct)

4. **Release 2 is done when everything is built and every stage check has
   passed on the test copy**, so it is ready to sell (Jack: "two, where
   everything is completely built… consider it done when it's ready to
   sell"). Selling it and getting shops to use it is the stage after.
   This replaces "Jack's shop has switched Citrus Lime off and traded for
   one full trading week" (programme spec §1,
   `docs/superpowers/specs/2026-09-27-release-2-design.md`; build plan §2).
   A real shop trying it first would be better, and is welcome, but is not
   part of the finish line: Jack doesn't expect his own shop to move, and
   there is no plan yet for how to get one. Chosen over a first real shop trading
   on it for a week, and over the first paying shop going live.

5. **Stage 8: the Citrus Lime move tools stay in Release 2** (Jack: "1").
   WP-8.1 (the move page, weekly refresh, weekly check, switch-over
   checklist, switch-over morning, the first week) is still built, tested
   on made-up files shaped like Citrus Lime's screen reports, whose columns
   were read from the real thing (`docs/superpowers/specs/2026-10-05-citrus-lime-exports.md`);
   a ready-made way off Citrus Lime helps sell to Citrus Lime shops. **WP-8.2
   (running alongside) and WP-8.3 (switch-over and a trading week) move to
   the selling stage**, as they need a real shop. Chosen over building only
   the import and leaving the rest of 8.1 for a real move, and over moving
   all Citrus Lime importing out of Release 2.
6. **The go-live checklist becomes "the first shop going live", for any
   shop** (Jack: "1"). Its general lines stay; the ones about Jack's shop
   (its accountant, its export files, its staff, Citrus Lime's full export)
   now say "the first shop". #171 (asking Citrus Lime for a full export) and
   #138 (Jack's shop's Paymentsense machine) are closed, to be written again
   as general research if a shop needs them. Chosen over splitting it into
   "ready to sell" and "first shop's move", and over leaving it as it was.

7. **The all-in-one comes first; the Lightspeed version after** (Jack,
   18 Oct: "having the entire all-in-one epos technically will be release
   1, and then afterwards we can adapt it so that it will work with
   Lightspeed, and that will be release 2… it will be easier to adapt what
   we have already built for Lightspeed rather than the other way
   around"). This reverses the order in the programme spec ("Release 1
   carries on… as a workshop add-on for Lightspeed shops", with the
   all-in-one second), and the order in `2026-09-02-lightspeed-first-platform.md`
   (Lightspeed the first platform) and `2026-09-10-release-1-scope-reduction.md`
   (Release 1 as the Lightspeed add-on): the Lightspeed connection
   (journey 21) is built after the all-in-one is ready to sell, by adapting
   it.
8. **Stock suggestions are in the all-in-one** (Jack: "pretty simple, and
   we can have that in release 1"), not after the trading week.
9. **The names stay; a note says which comes first** (Jack: "keeping the
   name files and just adding a note"). "Release 2" stays the name of the
   all-in-one build in the plans, specs and pull requests, with a dated note
   at the top of the build plan, the programme spec and the split plan
   saying it now comes first and the Lightspeed version follows it. Chosen
   over renaming everywhere, and over new plain names in the live
   documents.

10. **Importing Citrus Lime's full export and the workshop job history
    moves to the selling stage** (Jack: "1"), built against the real file
    when the first Citrus Lime shop moves and asks Citrus Lime for it.
    Until then a moving shop brings across what the screen reports hold
    (customers who have bought, no workshop history), and the weekly check's
    customer count can't fully match. Chosen over building it now against a
    guessed shape, and over dropping it.

## Open, for Jack (found by the fresh review, 18 Oct)

- ~~What was "after the trading week"~~: settled by answers 7 and 8
  (Lightspeed after, stock suggestions in). The three supplier browsing
  screens stay held by Jack, and the "later in Release 2" items stay where
  they were. Online service history and reminders are already in WP-4.5
  (Account, history and reminders), so they are in.
- ~~Citrus Lime's full export and the workshop job history~~: settled by
  answer 10.

The plans are shared, so Mark is told.
